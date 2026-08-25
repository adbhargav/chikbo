import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { corsOrigins } from './config/env';
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
import { uploadsRouter, UPLOADS_DIR } from './modules/uploads/uploads.routes';
import { seoPublicRouter } from './modules/seo/seo.public.routes';
import { seoAdminRouter } from './modules/seo/seo.admin.routes';

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

  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
