/**
 * Public SEO endpoints: robots.txt and the XML sitemap.
 *
 * Mounted at the site root (not under /api) because crawlers only ever look
 * for /robots.txt and /sitemap.xml.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { getCanonicalUrl, isNoindexPath, siteOrigin } from './seo.config';
import { getSeoSettings } from './seo.service';
import { headPreview } from './seo.ssr';

export const seoPublicRouter = Router();

/** Areas with no search value, or that would leak private pages into results. */
const DISALLOW = ['/admin/', '/api/', '/cart', '/checkout', '/account', '/order-success', '/search'];

seoPublicRouter.get(
  '/robots.txt',
  asyncHandler(async (_req, res) => {
    const settings = await getSeoSettings();
    // A site-wide noindex must also be reflected here, or crawlers keep
    // fetching pages that will never be indexed.
    const blockAll = settings.defaultRobots.startsWith('noindex');

    const lines = blockAll
      ? ['User-agent: *', 'Disallow: /']
      : [
          'User-agent: *',
          'Allow: /',
          ...DISALLOW.map((path) => `Disallow: ${path}`),
          '',
          // Sort/filter params create endless near-duplicate URLs.
          'Disallow: /*?sort=',
          'Disallow: /*?page=',
          'Disallow: /*&sort=',
          '',
          `Sitemap: ${siteOrigin()}/sitemap.xml`,
        ];

    res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(`${lines.join('\n')}\n`);
  }),
);

const PAGE_SIZE = 5_000;
const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urlEntry = (loc: string, lastMod?: Date | null) =>
  `  <url><loc>${xmlEscape(loc)}</loc>${lastMod ? `<lastmod>${lastMod.toISOString()}</lastmod>` : ''}</url>`;

/** Static routes worth indexing. Everything transactional is excluded. */
const STATIC_PATHS = ['/', '/policy/shipping', '/policy/returns', '/policy/privacy', '/policy/terms'];

/** Sitemap index — points at the partitioned children. */
seoPublicRouter.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const [products, categories] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
    ]);

    const parts = ['pages', 'categories'];
    for (let i = 0; i < Math.max(1, Math.ceil(products / PAGE_SIZE)); i++) parts.push(`products-${i + 1}`);
    if (categories === 0) parts.splice(parts.indexOf('categories'), 1);

    const body = parts
      .map((part) => `  <sitemap><loc>${xmlEscape(`${siteOrigin()}/sitemap-${part}.xml`)}</loc></sitemap>`)
      .join('\n');

    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`);
  }),
);

seoPublicRouter.get(
  '/sitemap-:part.xml',
  validate({ params: z.object({ part: z.string().regex(/^(pages|categories|products-\d+)$/) }) }),
  asyncHandler(async (req, res) => {
    const part = req.params.part;
    let entries: string[] = [];

    if (part === 'pages') {
      entries = STATIC_PATHS.filter((p) => !isNoindexPath(p)).map((p) => urlEntry(getCanonicalUrl(p)));
    } else if (part === 'categories') {
      // Only categories that actually have something to show — empty listing
      // pages are thin content and dilute the crawl.
      const rows = await prisma.category.findMany({
        where: {
          isActive: true,
          OR: [
            { products: { some: { isActive: true } } },
            { children: { some: { products: { some: { isActive: true } } } } },
          ],
          // metaRobots is null on most rows; NOT(null LIKE …) is null in SQL,
          // which would exclude everything. Treat unset as indexable.
          AND: [{ OR: [{ metaRobots: null }, { NOT: { metaRobots: { startsWith: 'noindex' } } }] }],
        },
        select: { slug: true, updatedAt: true },
        orderBy: { sortOrder: 'asc' },
      });
      entries = rows.map((c) => urlEntry(getCanonicalUrl(`/c/${c.slug}`), c.updatedAt));
    } else {
      const page = Number(part.split('-')[1] ?? 1);
      // Batched by page — a large catalogue is never pulled into memory at once.
      const rows = await prisma.product.findMany({
        where: {
          isActive: true,
          // Unset metaRobots means "indexable" — see the note above.
          AND: [{ OR: [{ metaRobots: null }, { NOT: { metaRobots: { startsWith: 'noindex' } } }] }],
        },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      entries = rows.map((p) => urlEntry(getCanonicalUrl(`/p/${p.slug}`), p.updatedAt));
    }

    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);
  }),
);

/**
 * Inspect exactly what a crawler receives for a path. Public and read-only —
 * it exposes nothing that isn't already in the page's <head>.
 */
/**
 * Redirect lookup for the client-rendered storefront.
 *
 * The storefront is a static SPA, so a request for a renamed product or
 * category never reaches the server. When a page cannot find what it was
 * asked for, it asks here whether an admin redirect (manual, or the automatic
 * one recorded on a slug change) covers the path, and navigates there.
 */
seoPublicRouter.get(
  '/api/v1/seo/redirect',
  validate({
    query: z.object({
      path: z
        .string()
        .max(2048)
        .refine((v) => v.startsWith('/') && !v.startsWith('//'), { message: 'Must be a site-relative path' }),
    }),
  }),
  asyncHandler(async (req, res) => {
    const raw = String((req.query as { path: string }).path).split('?')[0].split('#')[0];
    const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
    let cursor = path;
    let statusCode = 301;
    // Follow short chains (a product renamed twice) but never loop.
    for (let hop = 0; hop < 5; hop++) {
      const hit = await prisma.redirect.findUnique({ where: { source: cursor } });
      if (!hit || !hit.isActive) break;
      if (hop === 0) statusCode = hit.statusCode;
      void prisma.redirect.update({ where: { id: hit.id }, data: { hits: { increment: 1 } } }).catch(() => undefined);
      cursor = hit.destination;
      if (cursor === path) break;
    }
    ok(res, cursor !== path ? { destination: cursor, statusCode } : { destination: null, statusCode: null });
  }),
);

seoPublicRouter.get(
  '/api/v1/seo/head',
  validate({ query: z.object({ path: z.string().max(2048).default('/') }) }),
  asyncHandler(async (req, res) => {
    const requested = (req.query as unknown as { path: string }).path;
    const pathname = `/${requested.replace(/^\/+/, '').split(/[?#]/)[0] ?? ''}`;
    const preview = await headPreview(pathname);
    if (!preview) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No such page' } });
      return;
    }
    res.json({ success: true, data: preview });
  }),
);
