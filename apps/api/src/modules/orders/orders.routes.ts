import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import * as ordersService from './orders.service';
import { imageRefSchema } from '../../utils/validators';

export const ordersRouter = Router();
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
