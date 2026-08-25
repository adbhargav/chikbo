import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import * as checkoutService from './checkout.service';

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

checkoutRouter.post(
  '/',
  validate({
    body: z.object({
      addressId: z.string().min(1),
      couponCode: z.string().max(40).optional(),
      idempotencyKey: z.string().uuid('idempotencyKey must be a UUID'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await checkoutService.createCheckout(user, req.body), 201);
  }),
);
