/** Admin: categories, products, variants, inventory. All RBAC-guarded. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, requireStaff, requirePermission, type AuthedRequest } from '../../middleware/auth';
import { imageRefSchema } from '../../utils/validators';
import { ROBOTS_VALUES } from '../seo/seo.config';
import { recordSlugChange } from '../seo/seo.service';

/// Canonical/OG URLs land in <head>; only http(s) or site-relative paths are
/// accepted so javascript: and data: URLs can never be injected.
const seoUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/'), {
    message: 'Must be an absolute http(s) URL or a site-relative path',
  });

export const adminCatalogRouter = Router();
adminCatalogRouter.use(requireAuth, requireStaff);

const audit = (actorId: string, action: string, entity: string, entityId?: string, detail?: unknown) =>
  prisma.auditLog.create({ data: { actorId, action, entity, entityId, detail: detail as never } }).catch(() => undefined);

// --- Categories -------------------------------------------------------------

const categoryBody = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  parentId: z.string().nullable().optional(),
  imageUrl: imageRefSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  imageAlt: z.string().trim().max(200).nullable().optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  seoKeywords: z.string().trim().max(300).nullable().optional(),
  canonicalUrl: seoUrl.nullable().optional(),
  metaRobots: z.enum(ROBOTS_VALUES).nullable().optional(),
  ogTitle: z.string().trim().max(200).nullable().optional(),
  ogDescription: z.string().trim().max(500).nullable().optional(),
  ogImage: seoUrl.nullable().optional(),
});

adminCatalogRouter.get(
  '/categories',
  requirePermission('products.read'),
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true } } } }));
  }),
);

adminCatalogRouter.post(
  '/categories',
  requirePermission('categories.write'),
  validate({ body: categoryBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const category = await prisma.category.create({ data: req.body });
    await audit(user.id, 'category.create', 'category', category.id);
    ok(res, category, 201);
  }),
);

adminCatalogRouter.patch(
  '/categories/:id',
  requirePermission('categories.write'),
  validate({ params: z.object({ id: z.string() }), body: categoryBody.partial() }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const before = await prisma.category.findUnique({ where: { id: req.params.id }, select: { slug: true } });
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    if (before?.slug && req.body.slug && req.body.slug !== before.slug) {
      await recordSlugChange('/c', before.slug, req.body.slug, 'CATEGORY_SLUG');
    }
    await audit(user.id, 'category.update', 'category', category.id, req.body);
    ok(res, category);
  }),
);

adminCatalogRouter.delete(
  '/categories/:id',
  requirePermission('categories.write'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const productCount = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (productCount > 0) throw ApiError.conflict('Move or delete the products in this category first');
    await prisma.category.delete({ where: { id: req.params.id } });
    await audit(user.id, 'category.delete', 'category', req.params.id);
    ok(res, { deleted: true });
  }),
);

// --- Products ---------------------------------------------------------------

const variantBody = z.object({
  sku: z.string().min(2).max(60),
  barcode: z.string().max(64).nullable().optional(),
  size: z.string().max(20).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  weightGrams: z.number().int().min(1).nullable().optional(),
  priceInPaise: z.number().int().min(100),
  discountPriceInPaise: z.number().int().min(1).nullable().optional(),
  stockQty: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const productBody = z.object({
  name: z.string().min(3).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(200),
  description: z.string().min(10).max(10_000),
  categoryId: z.string().min(1),
  attributes: z.record(z.string()).nullable().optional(),
  /// Merchandising badge shown on the product card, e.g. "Bestseller".
  badge: z.string().max(40).nullable().optional(),
  /// SEO overrides. Empty/omitted means "derive it at request time" — the
  /// resolver falls back to the product's own content, so blanks are valid.
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  seoKeywords: z.string().trim().max(300).nullable().optional(),
  canonicalUrl: seoUrl.nullable().optional(),
  metaRobots: z.enum(ROBOTS_VALUES).nullable().optional(),
  ogTitle: z.string().trim().max(200).nullable().optional(),
  ogDescription: z.string().trim().max(500).nullable().optional(),
  ogImage: seoUrl.nullable().optional(),
  twitterTitle: z.string().trim().max(200).nullable().optional(),
  twitterDescription: z.string().trim().max(500).nullable().optional(),
  twitterImage: seoUrl.nullable().optional(),
  isActive: z.boolean().optional(),
  images: z.array(z.object({ url: z.string().min(1), alt: z.string().max(200).nullable().optional() })).max(10).optional(),
  variants: z.array(variantBody).min(1).max(50),
}).superRefine((val, ctx) => {
  for (const [i, v] of val.variants.entries()) {
    if (v.discountPriceInPaise != null && v.discountPriceInPaise >= v.priceInPaise) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants', i, 'discountPriceInPaise'], message: 'Discount price must be below the price' });
    }
  }
});

adminCatalogRouter.get(
  '/products',
  requirePermission('products.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().max(200).optional(),
      categoryId: z.string().optional(),
      includeInactive: z.coerce.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; search?: string; categoryId?: string; includeInactive: boolean };
    const where = {
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { variants: { some: { sku: { contains: q.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: true, images: { orderBy: { sortOrder: 'asc' } }, variants: true },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

adminCatalogRouter.post(
  '/products',
  requirePermission('products.write'),
  validate({ body: productBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { images, variants, ...data } = req.body;
    const product = await prisma.product.create({
      data: {
        ...data,
        images: { create: (images ?? []).map((img: { url: string; alt?: string | null }, i: number) => ({ ...img, sortOrder: i })) },
        variants: { create: variants },
      },
      include: { images: true, variants: true },
    });
    await audit(user.id, 'product.create', 'product', product.id);
    ok(res, product, 201);
  }),
);

adminCatalogRouter.patch(
  '/products/:id',
  requirePermission('products.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().min(3).max(200).optional(),
      slug: z.string().regex(/^[a-z0-9-]+$/).max(200).optional(),
      description: z.string().min(10).max(10_000).optional(),
      categoryId: z.string().optional(),
      attributes: z.record(z.string()).nullable().optional(),
      badge: z.string().max(40).nullable().optional(),
      /// SEO overrides. Empty/omitted means "derive it at request time" — the
      /// resolver falls back to the product's own content, so blanks are valid.
      seoTitle: z.string().trim().max(200).nullable().optional(),
      seoDescription: z.string().trim().max(500).nullable().optional(),
      seoKeywords: z.string().trim().max(300).nullable().optional(),
      canonicalUrl: seoUrl.nullable().optional(),
      metaRobots: z.enum(ROBOTS_VALUES).nullable().optional(),
      ogTitle: z.string().trim().max(200).nullable().optional(),
      ogDescription: z.string().trim().max(500).nullable().optional(),
      ogImage: seoUrl.nullable().optional(),
      twitterTitle: z.string().trim().max(200).nullable().optional(),
      twitterDescription: z.string().trim().max(500).nullable().optional(),
      twitterImage: seoUrl.nullable().optional(),
      isActive: z.boolean().optional(),
      images: z.array(z.object({ url: z.string().min(1), alt: z.string().max(200).nullable().optional() })).max(10).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { images, ...data } = req.body;
    const before = await prisma.product.findUnique({ where: { id: req.params.id }, select: { slug: true } });
    const product = await prisma.$transaction(async (tx) => {
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: req.params.id } });
        await tx.productImage.createMany({
          data: images.map((img: { url: string; alt?: string | null }, i: number) => ({ productId: req.params.id, url: img.url, alt: img.alt ?? null, sortOrder: i })),
        });
      }
      return tx.product.update({
        where: { id: req.params.id },
        data,
        include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true },
      });
    });
    // A renamed slug leaves its old URL live via a 301 — see seo.service.
    if (before?.slug && data.slug && data.slug !== before.slug) {
      await recordSlugChange('/p', before.slug, data.slug, 'PRODUCT_SLUG');
    }
    await audit(user.id, 'product.update', 'product', product.id, data);
    ok(res, product);
  }),
);

adminCatalogRouter.post(
  '/products/:id/variants',
  requirePermission('products.write'),
  validate({ params: z.object({ id: z.string() }), body: variantBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const variant = await prisma.productVariant.create({ data: { ...req.body, productId: req.params.id } });
    await audit(user.id, 'variant.create', 'variant', variant.id);
    ok(res, variant, 201);
  }),
);

adminCatalogRouter.patch(
  '/variants/:id',
  requirePermission('products.write'),
  validate({ params: z.object({ id: z.string() }), body: variantBody.partial().omit({ stockQty: true }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const variant = await prisma.productVariant.update({ where: { id: req.params.id }, data: req.body });
    await audit(user.id, 'variant.update', 'variant', variant.id, req.body);
    ok(res, variant);
  }),
);

// --- Inventory --------------------------------------------------------------

adminCatalogRouter.get(
  '/inventory/low-stock',
  requirePermission('inventory.read'),
  asyncHandler(async (_req, res) => {
    const variants = await prisma.$queryRaw`
      SELECT v.*, p.name as "productName"
      FROM "ProductVariant" v
      JOIN "Product" p ON p.id = v."productId"
      WHERE v."isActive" = true AND v."stockQty" <= v."lowStockThreshold"
      ORDER BY v."stockQty" ASC
      LIMIT 200
    `;
    ok(res, variants);
  }),
);

adminCatalogRouter.post(
  '/inventory/adjust',
  requirePermission('inventory.write'),
  validate({
    body: z.object({
      variantId: z.string().min(1),
      delta: z.number().int().refine((n) => n !== 0, 'Delta cannot be zero'),
      reason: z.enum(['MANUAL_ADJUSTMENT', 'RESTOCK', 'CORRECTION', 'RETURN_RECEIVED']),
      note: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.updateMany({
        where: { id: req.body.variantId, ...(req.body.delta < 0 ? { stockQty: { gte: -req.body.delta } } : {}) },
        data: { stockQty: { increment: req.body.delta } },
      });
      if (updated.count === 0) throw ApiError.unprocessable('INSUFFICIENT_STOCK', 'Cannot reduce stock below zero');
      const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: req.body.variantId } });
      await tx.inventoryLog.create({
        data: {
          variantId: req.body.variantId,
          delta: req.body.delta,
          qtyAfter: variant.stockQty,
          reason: req.body.reason,
          note: req.body.note,
          actorId: user.id,
        },
      });
      return variant;
    });
    await audit(user.id, 'inventory.adjust', 'variant', req.body.variantId, req.body);
    ok(res, result);
  }),
);

adminCatalogRouter.get(
  '/inventory/history/:variantId',
  requirePermission('inventory.read'),
  validate({ params: z.object({ variantId: z.string() }) }),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await prisma.inventoryLog.findMany({
        where: { variantId: req.params.variantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }),
);
