import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import path from 'path';
import fs from 'fs';
import { corsOrigins, env } from './config/env';
import { logger } from './lib/logger';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { cartRouter } from './modules/cart/cart.routes';
import { wishlistRouter } from './modules/wishlist/wishlist.routes';
import { checkoutRouter } from './modules/checkout/checkout.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { webhooksRouter } from './modules/webhooks/webhooks.routes';
import { adminCatalogRouter } from './modules/admin/admin.catalog.routes';
import { adminOrdersRouter } from './modules/admin/admin.orders.routes';
import { adminMiscRouter } from './modules/admin/admin.misc.routes';
import { adminContentRouter } from './modules/admin/admin.content.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { serveUpload } from './lib/mediaStore';
import { seoPublicRouter } from './modules/seo/seo.public.routes';
import { seoAdminRouter } from './modules/seo/seo.admin.routes';
import { createSpaSeoMiddleware } from './modules/seo/seo.ssr';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Webhooks BEFORE express.json() — they need the raw body for signatures.
  app.use('/api/v1/webhooks', webhooksRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiLimiter);

  app.use(seoPublicRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'chikbo-api' }));

  // Uploaded media: Cloudflare R2 first, then repo-committed files, then any
  // images stored in Postgres before R2 was configured.
  app.use('/uploads', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    void serveUpload(req, res, next);
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/catalog', catalogRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/wishlist', wishlistRouter);
  app.use('/api/v1/checkout', checkoutRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/reviews', reviewsRouter);
  app.use('/api/v1/uploads', uploadsRouter);
  app.use('/api/v1/admin', adminCatalogRouter);
  app.use('/api/v1/admin', adminOrdersRouter);
  app.use('/api/v1/admin', adminMiscRouter);
  app.use('/api/v1/admin', adminContentRouter);
  app.use('/api/v1/admin', seoAdminRouter);

  mountFrontends(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/**
 * Single-server hosting. Serves the admin console under /admin and the
 * storefront everywhere else, the storefront's HTML going through the SEO
 * middleware so every page carries its own title, description and share
 * image. The API's strict security headers are relaxed for these HTML pages:
 * the store loads Razorpay Checkout, Google sign-in and web fonts, which a
 * `default-src 'self'` policy would block.
 */
function mountFrontends(app: express.Express) {
  const relaxForPages = (res: express.Response) => {
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  };
  const staticOpts = {
    index: false as const,
    setHeaders: (res: express.Response, file: string) => {
      relaxForPages(res);
      // Vite fingerprints everything under /assets, so it can be cached forever.
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  };

  const adminDir = env.ADMIN_DIST_DIR && path.resolve(env.ADMIN_DIST_DIR);
  if (adminDir && fs.existsSync(path.join(adminDir, 'index.html'))) {
    app.use('/admin', express.static(adminDir, staticOpts));
    app.get(['/admin', '/admin/*'], (_req, res) => {
      relaxForPages(res);
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(adminDir, 'index.html'));
    });
  }

  const webDir = env.WEB_DIST_DIR && path.resolve(env.WEB_DIST_DIR);
  if (webDir && fs.existsSync(path.join(webDir, 'index.html'))) {
    app.use(express.static(webDir, staticOpts));
    const spa = createSpaSeoMiddleware(webDir);
    app.use((req, res, next) => {
      relaxForPages(res);
      void spa(req, res, next);
    });
  }
}
