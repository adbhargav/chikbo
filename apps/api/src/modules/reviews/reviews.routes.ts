import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

async function recomputeProductRating(productId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating, ratingCount: agg._count },
  });
}

reviewsRouter.post(
  '/',
  validate({
    body: z.object({
      productId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).optional(),
      body: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product) throw ApiError.notFound('Product not found');

    // Verified purchase: user has a delivered order containing this product.
    const purchased = await prisma.orderItem.findFirst({
      where: {
        order: { userId: user.id, status: { in: ['DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED', 'REFUND_INITIATED'] } },
        variant: { productId: req.body.productId },
      },
    });

    const review = await prisma.review.upsert({
      where: { productId_userId: { productId: req.body.productId, userId: user.id } },
      update: { rating: req.body.rating, title: req.body.title, body: req.body.body },
      create: {
        productId: req.body.productId,
        userId: user.id,
        rating: req.body.rating,
        title: req.body.title,
        body: req.body.body,
        verifiedPurchase: Boolean(purchased),
      },
    });
    await recomputeProductRating(req.body.productId);
    ok(res, review, 201);
  }),
);

reviewsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const review = await prisma.review.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!review) throw ApiError.notFound('Review not found');
    await prisma.review.delete({ where: { id: review.id } });
    await recomputeProductRating(review.productId);
    ok(res, { deleted: true });
  }),
);
