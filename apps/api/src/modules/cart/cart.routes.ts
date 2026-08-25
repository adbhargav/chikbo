import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import * as cartService from './cart.service';

export const cartRouter = Router();
cartRouter.use(requireAuth);

cartRouter.get(
  '/',
  validate({ query: z.object({ coupon: z.string().max(40).optional() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await cartService.getCart(user.id, (req.query as { coupon?: string }).coupon));
  }),
);

cartRouter.post(
  '/items',
  validate({
    body: z.object({
      variantId: z.string().min(1),
      qty: z.number().int().min(1).max(cartService.MAX_QTY_PER_LINE).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await cartService.addToCart(user.id, req.body.variantId, req.body.qty);
    ok(res, await cartService.getCart(user.id), 201);
  }),
);

cartRouter.patch(
  '/items/:id',
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({ qty: z.number().int().min(0).max(cartService.MAX_QTY_PER_LINE) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await cartService.updateCartItem(user.id, req.params.id, req.body.qty);
    ok(res, await cartService.getCart(user.id));
  }),
);

cartRouter.delete(
  '/items/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await cartService.removeCartItem(user.id, req.params.id);
    ok(res, await cartService.getCart(user.id));
  }),
);
