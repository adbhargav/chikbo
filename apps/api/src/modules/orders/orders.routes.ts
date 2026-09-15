import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { readGuestToken } from '../../middleware/guest';
import * as ordersService from './orders.service';
import * as cartService from '../cart/cart.service';
import { imageRefSchema } from '../../utils/validators';

export const ordersRouter = Router();

/**
 * Guest order lookup: the order-success page reads the order it just placed
 * using the same guest token that placed it. Registered before the auth gate.
 */
ordersRouter.get(
  '/guest/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const guestToken = readGuestToken(req);
    if (!guestToken) throw ApiError.unauthorized('Guest token required');
    ok(res, await ordersService.getGuestOrder(guestToken, req.params.id));
  }),
);

/**
 * After a guest creates an account or signs in, attach everything their guest
 * session did — placed orders and the cart — to the account. Idempotent.
 */
ordersRouter.post(
  '/claim',
  requireAuth,
  validate({ body: z.object({ guestToken: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const claimedOrders = await ordersService.claimGuestOrders(user.id, req.body.guestToken);
    const mergedCartLines = await cartService.mergeGuestCart(user.id, req.body.guestToken);
    ok(res, { claimedOrders, mergedCartLines });
  }),
);

ordersRouter.use(requireAuth);

ordersRouter.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    ok(res, await ordersService.listMyOrders(user.id, page, pageSize));
  }),
);

ordersRouter.get(
  '/returns',
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await ordersService.listMyReturns(user.id));
  }),
);

ordersRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await ordersService.getMyOrder(user.id, req.params.id));
  }),
);

ordersRouter.post(
  '/:id/cancel',
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({ reason: z.string().min(3).max(500) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await ordersService.cancelMyOrder(user.id, req.params.id, req.body.reason);
    ok(res, await ordersService.getMyOrder(user.id, req.params.id));
  }),
);

ordersRouter.post(
  '/:id/return',
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      orderItemId: z.string().min(1),
      reason: z.string().min(10, 'Please describe the damage in at least 10 characters').max(1000),
      imageUrls: z.array(imageRefSchema).min(1, 'Please attach at least one photo of the damage').max(6),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const id = await ordersService.requestReturn(user.id, req.params.id, req.body);
    ok(res, { returnRequestId: id }, 201);
  }),
);
