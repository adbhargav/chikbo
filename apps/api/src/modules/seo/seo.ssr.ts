/**
 * Server-side head injection.
 *
 * The storefront is a client-rendered SPA, so any meta tag written by React is
 * invisible to crawlers that do not execute JavaScript — which is all of the
 * social ones (Facebook, WhatsApp, X, LinkedIn, Slack). Shared product links
 * would therefore never produce a preview card.
 *
 * This middleware serves the built SPA's index.html with the real <head>
 * already filled in for the requested route: title, description, canonical,
 * robots, Open Graph, Twitter and JSON-LD. The SPA then hydrates as normal;
 * users see no difference, crawlers see complete HTML.
 *
 * In production point the storefront domain at this server (or put it in front
 * of the static bundle). In development Vite serves index.html directly, so
 * `GET /api/v1/seo/head?path=…` exposes the same output for inspection.
 */
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import {
  resolveCategorySeo,
  resolveGenericSeo,
  resolveHomeSeo,
  resolveProductSeo,
  getSeoSettings,
} from './seo.service';
import type { PageSeo } from './seo.service';
import { getCanonicalUrl } from './seo.config';

/** Escape for use inside an HTML attribute. */
const attr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Escape for a <script> body. `</script>` inside JSON would close the tag
 * early and turn data into markup, so the angle brackets are neutralised.
 */
const jsonLdSafe = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

export function renderHeadTags(seo: PageSeo, siteName: string, extras: {
  googleSiteVerification?: string | null;
  googleAnalyticsId?: string | null;
  googleTagManagerId?: string | null;
  facebookAppId?: string | null;
  twitterSite?: string | null;
}): string {
  const tags: string[] = [
    `<title>${attr(seo.title)}</title>`,
    `<meta name="description" content="${attr(seo.description)}" />`,
    `<link rel="canonical" href="${attr(seo.canonical)}" />`,
    `<meta name="robots" content="${attr(seo.robots)}" />`,

    `<meta property="og:type" content="${attr(seo.ogType)}" />`,
    `<meta property="og:site_name" content="${attr(siteName)}" />`,
    `<meta property="og:title" content="${attr(seo.ogTitle)}" />`,
    `<meta property="og:description" content="${attr(seo.ogDescription)}" />`,
    `<meta property="og:url" content="${attr(seo.canonical)}" />`,
    ...(seo.ogImage ? [`<meta property="og:image" content="${attr(seo.ogImage)}" />`] : []),

    `<meta name="twitter:card" content="${attr(seo.twitterCard)}" />`,
    `<meta name="twitter:title" content="${attr(seo.twitterTitle)}" />`,
    `<meta name="twitter:description" content="${attr(seo.twitterDescription)}" />`,
    ...(seo.twitterImage ? [`<meta name="twitter:image" content="${attr(seo.twitterImage)}" />`] : []),
    ...(extras.twitterSite ? [`<meta name="twitter:site" content="${attr(extras.twitterSite)}" />`] : []),
    ...(extras.facebookAppId ? [`<meta property="fb:app_id" content="${attr(extras.facebookAppId)}" />`] : []),
    ...(extras.googleSiteVerification
      ? [`<meta name="google-site-verification" content="${attr(extras.googleSiteVerification)}" />`]
      : []),
  ];

  if (seo.jsonLd.length > 0) {
    // One @graph rather than many scripts: fewer nodes, and the entities can
    // reference each other by @id.
    tags.push(
      `<script type="application/ld+json">${jsonLdSafe({
        '@context': 'https://schema.org',
        '@graph': seo.jsonLd,
      })}</script>`,
    );
  }

  // Analytics is opt-in: nothing is emitted unless an id is configured.
  if (extras.googleTagManagerId) {
    tags.push(
      `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${attr(extras.googleTagManagerId)}');</script>`,
    );
  } else if (extras.googleAnalyticsId) {
    tags.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${attr(extras.googleAnalyticsId)}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${attr(extras.googleAnalyticsId)}');</script>`,
    );
  }

  return tags.join('\n    ');
}

/** Resolve the SEO payload for an SPA path. `null` means the entity is gone. */
export async function seoForPath(pathname: string): Promise<PageSeo | null> {
  if (pathname === '/' || pathname === '') return resolveHomeSeo();

  const product = pathname.match(/^\/p\/([^/?#]+)\/?$/);
  if (product?.[1]) return resolveProductSeo(decodeURIComponent(product[1]));

  const category = pathname.match(/^\/c\/([^/?#]+)\/?$/);
  if (category?.[1]) return resolveCategorySeo(decodeURIComponent(category[1]));

  return resolveGenericSeo(pathname);
}

/** Paths this middleware must never touch. */
const PASS_THROUGH = /^\/(api|uploads|assets|robots\.txt|sitemap|health|brand|images|favicon)/i;

let cachedTemplate: { html: string; mtimeMs: number } | null = null;

/** The built SPA shell, re-read when the file changes. */
function readTemplate(distDir: string): string | null {
  const file = path.join(distDir, 'index.html');
  try {
    const stat = fs.statSync(file);
    if (!cachedTemplate || cachedTemplate.mtimeMs !== stat.mtimeMs) {
      cachedTemplate = { html: fs.readFileSync(file, 'utf8'), mtimeMs: stat.mtimeMs };
    }
    return cachedTemplate.html;
  } catch {
    return null;
  }
}

/**
 * Replace the shell's existing title/description/canonical with the resolved
 * ones, then inject the rest before </head>. Stripping first avoids shipping
 * two <title> tags, which crawlers resolve unpredictably.
 */
export function injectHead(template: string, headTags: string): string {
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace('</head>', `    ${headTags}\n  </head>`);
}

export function createSpaSeoMiddleware(distDir: string) {
  return async function spaSeoMiddleware(req: Request, res: Response, next: NextFunction) {
    // Only real page loads: never assets, API calls, or non-GET requests.
    if (req.method !== 'GET' || PASS_THROUGH.test(req.path)) return next();
    if (!req.accepts('html')) return next();

    const template = readTemplate(distDir);
    if (!template) return next(); // no built SPA here — nothing to serve

    try {
      // A moved slug must 301 before anything else, so inbound links keep
      // their value instead of hitting a 404.
      const redirect = await prisma.redirect.findUnique({ where: { source: req.path } });
      if (redirect?.isActive) {
        await prisma.redirect
          .update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } })
          .catch(() => undefined);
        return res.redirect(redirect.statusCode, redirect.destination);
      }

      const seo = await seoForPath(req.path);
      const settings = await getSeoSettings();

      if (!seo) {
        // Unknown product/category: real 404 status, and never indexable.
        const notFound = await resolveGenericSeo(req.path, 'Page not found');
        const html = injectHead(
          template,
          renderHeadTags({ ...notFound, robots: 'noindex,follow' }, settings.siteName, settings),
        );
        return res.status(404).type('html').send(html);
      }

      const html = injectHead(template, renderHeadTags(seo, settings.siteName, settings));
      res.type('html').set('Cache-Control', 'public, max-age=0, s-maxage=300').send(html);
    } catch (err) {
      logger.error({ err, path: req.path }, 'SEO head injection failed');
      // Never let SEO break the store — fall back to the untouched shell.
      res.type('html').send(template);
    }
  };
}

/** Dev/debug: inspect exactly what a crawler would receive for a path. */
export async function headPreview(pathname: string) {
  const settings = await getSeoSettings();
  const seo = await seoForPath(pathname);
  if (!seo) return null;
  return {
    path: pathname,
    canonical: getCanonicalUrl(pathname),
    seo,
    head: renderHeadTags(seo, settings.siteName, settings),
  };
}
