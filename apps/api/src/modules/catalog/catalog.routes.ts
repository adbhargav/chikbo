import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { prisma } from '../../lib/prisma';
import * as catalogService from './catalog.service';
import { getHomeSections } from './home.service';
import { checkPincodeServiceability } from './serviceability.service';

export const catalogRouter = Router();

catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => ok(res, await catalogService.getCategoryTree())),
);

/**
 * The merchandised homepage: active, in-schedule sections in order, each with
 * its active items, and PRODUCT_CAROUSEL sections resolved to real products.
 * Public and cacheable.
 */
catalogRouter.get(
  '/home',
  asyncHandler(async (_req, res) => ok(res, await getHomeSections())),
);

/** Pincode delivery check (PDP). COD is always false — Chikbo is prepaid only. */
catalogRouter.get(
  '/serviceability',
  validate({
    query: z.object({
      pincode: z
        .string()
        .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian pincode'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { pincode } = req.query as unknown as { pincode: string };
    ok(res, await checkPincodeServiceability(pincode));
  }),
);

/** Distinct sizes/colours in the active catalog — drives the PLP filter sidebar. */
catalogRouter.get(
  '/filters',
  asyncHandler(async (_req, res) => ok(res, await catalogService.getFilterFacets())),
);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  category: z.string().optional(),
  search: z.string().max(200).optional(),
  minPrice: z.coerce.number().int().min(0).optional(), // rupees
  maxPrice: z.coerce.number().int().min(0).optional(), // rupees
  sizes: z.string().optional(), // comma-separated
  colors: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
});

catalogRouter.get(
  '/products',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    ok(
      res,
      await catalogService.listProducts({
        page: q.page,
        pageSize: q.pageSize,
        categorySlug: q.category,
        search: q.search,
        minPriceInPaise: q.minPrice != null ? q.minPrice * 100 : undefined,
        maxPriceInPaise: q.maxPrice != null ? q.maxPrice * 100 : undefined,
        sizes: q.sizes?.split(',').map((s) => s.trim()).filter(Boolean),
        colors: q.colors?.split(',').map((s) => s.trim()).filter(Boolean),
        inStockOnly: q.inStock,
        sort: q.sort,
      }),
    );
  }),
);

catalogRouter.get(
  '/products/:slug',
  validate({ params: z.object({ slug: z.string().min(1).max(200) }) }),
  asyncHandler(async (req, res) => ok(res, await catalogService.getProductBySlug(req.params.slug))),
);

catalogRouter.get(
  '/products/:slug/reviews',
  validate({
    params: z.object({ slug: z.string() }),
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const product = await prisma.product.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!product) return ok(res, { items: [], page, pageSize, total: 0, totalPages: 0 });
    const where = { productId: product.id, isApproved: true };
    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    ok(res, {
      items: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.user.name,
        verifiedPurchase: r.verifiedPurchase,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }),
);
