/**
 * Admin SEO APIs: global settings, redirects and the SEO health audit.
 *
 * Per-entity SEO fields are handled by extending the existing product and
 * category PATCH routes rather than adding parallel endpoints.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, ApiError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { requireAuth, requireStaff, requirePermission, type AuthedRequest } from '../../middleware/auth';
import { ROBOTS_VALUES, generateSlug, getCanonicalUrl } from './seo.config';
import { getSeoSettings } from './seo.service';

export const seoAdminRouter = Router();
seoAdminRouter.use(requireAuth, requireStaff);

/** Reject javascript: and data: URLs — SEO fields end up in <head> and headers. */
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/'), {
    message: 'Must be an absolute http(s) URL or a site-relative path',
  });

const settingsBody = z.object({
  siteName: z.string().trim().min(1).max(80).optional(),
  defaultTitle: z.string().trim().max(200).nullable().optional(),
  titleTemplate: z.string().trim().max(120).optional(),
  defaultDescription: z.string().trim().max(500).nullable().optional(),
  defaultRobots: z.enum(ROBOTS_VALUES).optional(),

  homeTitle: z.string().trim().max(200).nullable().optional(),
  homeDescription: z.string().trim().max(500).nullable().optional(),
  homeOgImage: safeUrl.nullable().optional(),

  defaultOgImage: safeUrl.nullable().optional(),
  defaultTwitterImage: safeUrl.nullable().optional(),
  twitterCardType: z.enum(['summary', 'summary_large_image']).optional(),
  twitterSite: z.string().trim().max(40).nullable().optional(),
  facebookAppId: z.string().trim().max(40).nullable().optional(),

  organizationName: z.string().trim().max(120).nullable().optional(),
  organizationLogo: safeUrl.nullable().optional(),
  organizationDescription: z.string().trim().max(600).nullable().optional(),
  organizationPhone: z.string().trim().max(40).nullable().optional(),
  organizationEmail: z.string().trim().email().max(120).nullable().optional().or(z.literal('')),
  organizationAddress: z.string().trim().max(300).nullable().optional(),
  organizationSocials: z.array(z.string().url().max(300)).max(12).nullable().optional(),

  googleSiteVerification: z.string().trim().max(120).nullable().optional(),
  googleAnalyticsId: z.string().trim().regex(/^$|^G-[A-Z0-9]+$/i, 'Expected a G-XXXXXXX id').nullable().optional(),
  googleTagManagerId: z.string().trim().regex(/^$|^GTM-[A-Z0-9]+$/i, 'Expected a GTM-XXXXXXX id').nullable().optional(),
});

seoAdminRouter.get(
  '/seo/settings',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => ok(res, await getSeoSettings())),
);

seoAdminRouter.patch(
  '/seo/settings',
  requirePermission('products.write'),
  validate({ body: settingsBody }),
  asyncHandler(async (req, res) => {
    await getSeoSettings(); // ensure the row exists
    const updated = await prisma.seoSettings.update({ where: { id: 'default' }, data: req.body });
    ok(res, updated);
  }),
);

/* ------------------------------------------------------------------ redirects */

const redirectPath = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v.startsWith('/'), { message: 'Must be a site-relative path starting with /' })
  // Block protocol-relative (//evil.com) which browsers treat as absolute.
  .refine((v) => !v.startsWith('//'), { message: 'Must not start with //' });

seoAdminRouter.get(
  '/seo/redirects',
  requirePermission('dashboard.view'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const [total, items] = await prisma.$transaction([
      prisma.redirect.count(),
      prisma.redirect.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

seoAdminRouter.post(
  '/seo/redirects',
  requirePermission('products.write'),
  validate({
    body: z.object({
      source: redirectPath,
      destination: redirectPath,
      statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { source, destination, statusCode } = req.body;
    if (source === destination) throw ApiError.badRequest('A redirect cannot point at itself');
    // Walk the existing chain: if the destination leads back to the source we
    // would build an infinite loop.
    let cursor = destination;
    for (let hop = 0; hop < 10; hop++) {
      const next = await prisma.redirect.findUnique({ where: { source: cursor } });
      if (!next) break;
      if (next.destination === source) throw ApiError.badRequest('That would create a redirect loop');
      cursor = next.destination;
    }
    const created = await prisma.redirect.upsert({
      where: { source },
      update: { destination, statusCode, isActive: true, origin: 'MANUAL' },
      create: { source, destination, statusCode, origin: 'MANUAL' },
    });
    ok(res, created, 201);
  }),
);

seoAdminRouter.delete(
  '/seo/redirects/:id',
  requirePermission('products.write'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await prisma.redirect.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  }),
);

/* ---------------------------------------------------------------- SEO audit */

seoAdminRouter.get(
  '/seo/audit',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const settings = await getSeoSettings();
    const [
      totalProducts,
      missingTitle,
      missingDescription,
      totalCategories,
      catMissingTitle,
      catMissingDescription,
      imagesMissingAlt,
      totalImages,
      noindexProducts,
      redirects,
    ] = await prisma.$transaction([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, OR: [{ seoTitle: null }, { seoTitle: '' }] } }),
      prisma.product.count({ where: { isActive: true, OR: [{ seoDescription: null }, { seoDescription: '' }] } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true, OR: [{ seoTitle: null }, { seoTitle: '' }] } }),
      prisma.category.count({ where: { isActive: true, OR: [{ seoDescription: null }, { seoDescription: '' }] } }),
      prisma.productImage.count({ where: { OR: [{ alt: null }, { alt: '' }] } }),
      prisma.productImage.count(),
      prisma.product.count({ where: { isActive: true, metaRobots: { startsWith: 'noindex' } } }),
      prisma.redirect.count({ where: { isActive: true } }),
    ]);

    // Every check is either satisfied or not; the score is their weighted mean
    // so a mostly-complete catalogue doesn't read as a failure.
    const checks = [
      { key: 'settings.siteName', label: 'Site name configured', ok: Boolean(settings.siteName), weight: 1 },
      { key: 'settings.description', label: 'Default description set', ok: Boolean(settings.defaultDescription), weight: 1 },
      { key: 'settings.ogImage', label: 'Default social image set', ok: Boolean(settings.defaultOgImage), weight: 1 },
      { key: 'settings.organization', label: 'Organization details set', ok: Boolean(settings.organizationName), weight: 1 },
      {
        key: 'products.title',
        label: 'Products with an SEO title',
        ok: missingTitle === 0,
        detail: `${totalProducts - missingTitle}/${totalProducts}`,
        weight: 2,
      },
      {
        key: 'products.description',
        label: 'Products with an SEO description',
        ok: missingDescription === 0,
        detail: `${totalProducts - missingDescription}/${totalProducts}`,
        weight: 2,
      },
      {
        key: 'images.alt',
        label: 'Product images with alt text',
        ok: imagesMissingAlt === 0,
        detail: `${totalImages - imagesMissingAlt}/${totalImages}`,
        weight: 2,
      },
      {
        key: 'categories.title',
        label: 'Categories with an SEO title',
        ok: catMissingTitle === 0,
        detail: `${totalCategories - catMissingTitle}/${totalCategories}`,
        weight: 1,
      },
      {
        key: 'categories.description',
        label: 'Categories with an SEO description',
        ok: catMissingDescription === 0,
        detail: `${totalCategories - catMissingDescription}/${totalCategories}`,
        weight: 1,
      },
    ];

    const totalWeight = checks.reduce((n, c) => n + c.weight, 0);
    const earned = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0);

    ok(res, {
      score: Math.round((earned / totalWeight) * 100),
      checks,
      counts: {
        totalProducts,
        missingTitle,
        missingDescription,
        totalCategories,
        catMissingTitle,
        catMissingDescription,
        totalImages,
        imagesMissingAlt,
        noindexProducts,
        redirects,
      },
      sitemapUrl: getCanonicalUrl('/sitemap.xml'),
      robotsUrl: getCanonicalUrl('/robots.txt'),
    });
  }),
);

/* ------------------------------------------------------------ bulk fill-in */

seoAdminRouter.post(
  '/seo/bulk',
  requirePermission('products.write'),
  validate({
    body: z.object({
      target: z.enum(['productSlugs', 'imageAlt', 'productTitles', 'productDescriptions']),
      /** Never touch fields an admin has already written. */
      overwrite: z.literal(false).default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const settings = await getSeoSettings();
    let updated = 0;

    if (req.body.target === 'imageAlt') {
      const images = await prisma.productImage.findMany({
        where: { OR: [{ alt: null }, { alt: '' }] },
        include: { product: { select: { name: true } } },
      });
      for (const image of images) {
        await prisma.productImage.update({ where: { id: image.id }, data: { alt: image.product.name } });
        updated++;
      }
    } else if (req.body.target === 'productSlugs') {
      const products = await prisma.product.findMany({ where: { OR: [{ slug: '' }] }, select: { id: true, name: true } });
      for (const product of products) {
        await prisma.product.update({ where: { id: product.id }, data: { slug: generateSlug(product.name) } });
        updated++;
      }
    } else if (req.body.target === 'productTitles') {
      const products = await prisma.product.findMany({
        where: { isActive: true, OR: [{ seoTitle: null }, { seoTitle: '' }] },
        select: { id: true, name: true },
      });
      for (const product of products) {
        await prisma.product.update({
          where: { id: product.id },
          data: { seoTitle: `${product.name} | ${settings.siteName}` },
        });
        updated++;
      }
    } else {
      const products = await prisma.product.findMany({
        where: { isActive: true, OR: [{ seoDescription: null }, { seoDescription: '' }] },
        select: { id: true, description: true },
      });
      for (const product of products) {
        const text = product.description.replace(/\s+/g, ' ').trim().slice(0, 158);
        await prisma.product.update({ where: { id: product.id }, data: { seoDescription: text } });
        updated++;
      }
    }

    await prisma.auditLog
      .create({ data: { actorId: user.id, action: `seo.bulk.${req.body.target}`, entity: 'seo', detail: { updated } } })
      .catch(() => undefined);
    ok(res, { updated });
  }),
);
