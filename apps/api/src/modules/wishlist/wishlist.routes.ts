import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { effectiveUnitPrice } from '../../utils/pricing';

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

wishlistRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: user.id, product: { isActive: true } },
      include: {
        product: {
          include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, variants: { where: { isActive: true } }, category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(
      res,
      rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        name: r.product.name,
        slug: r.product.slug,
        categorySlug: r.product.category.slug,
        thumbnailUrl: r.product.images[0]?.url ?? null,
        minPriceInPaise: r.product.variants.length ? Math.min(...r.product.variants.map((v) => v.priceInPaise)) : 0,
        minDiscountPriceInPaise: r.product.variants.some((v) => v.discountPriceInPaise != null)
          ? Math.min(...r.product.variants.map(effectiveUnitPrice))
          : null,
        inStock: r.product.variants.some((v) => v.stockQty > 0),
      })),
    );
  }),
);

wishlistRouter.post(
  '/:productId',
  validate({ params: z.object({ productId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId: req.params.productId } },
      update: {},
      create: { userId: user.id, productId: req.params.productId },
    });
    ok(res, { added: true }, 201);
  }),
);

wishlistRouter.delete(
  '/:productId',
  validate({ params: z.object({ productId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId: req.params.productId } });
    ok(res, { removed: true });
  }),
);
