import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { optionalAuth, requireAuth, type AuthedRequest } from '../../middleware/auth';
import { resolveCartOwner } from '../../middleware/guest';
import * as cartService from './cart.service';

/**
 * Cart routes serve guests and members alike: a signed-in user's cart is keyed
 * on their account, a guest's on the `X-Guest-Token` header.
 */
export const cartRouter = Router();
cartRouter.use(optionalAuth);

cartRouter.get(
  '/',
  validate({
    query: z.object({
      coupon: z.string().max(40).optional(),
      /** Guests may pass the email they'll check out with so coupon limits are checked early. */
      email: z.string().email().max(254).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const owner = resolveCartOwner(req);
    const { coupon, email } = req.query as { coupon?: string; email?: string };
    ok(res, await cartService.getCart(owner, coupon, email));
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
    const owner = resolveCartOwner(req);
    await cartService.addToCart(owner, req.body.variantId, req.body.qty);
    ok(res, await cartService.getCart(owner), 201);
  }),
);

cartRouter.patch(
  '/items/:id',
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({ qty: z.number().int().min(0).max(cartService.MAX_QTY_PER_LINE) }),
  }),
  asyncHandler(async (req, res) => {
    const owner = resolveCartOwner(req);
    await cartService.updateCartItem(owner, req.params.id, req.body.qty);
    ok(res, await cartService.getCart(owner));
  }),
);

cartRouter.delete(
  '/items/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const owner = resolveCartOwner(req);
    await cartService.removeCartItem(owner, req.params.id);
    ok(res, await cartService.getCart(owner));
  }),
);

/**
 * After signing in, fold the guest cart into the account cart. Idempotent —
 * a token with no rows merges nothing.
 */
cartRouter.post(
  '/merge',
  requireAuth,
  validate({ body: z.object({ guestToken: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const merged = await cartService.mergeGuestCart(user.id, req.body.guestToken);
    ok(res, { merged, cart: await cartService.getCart({ userId: user.id }) });
  }),
);
