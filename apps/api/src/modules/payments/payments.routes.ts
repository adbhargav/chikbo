import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { optionalAuth } from '../../middleware/auth';
import { resolveCartOwner } from '../../middleware/guest';
import * as paymentsService from './payments.service';

export const paymentsRouter = Router();

paymentsRouter.use(optionalAuth);

paymentsRouter.post(
  '/verify',
  validate({
    body: z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    ok(res, await paymentsService.verifyAndCapture(resolveCartOwner(req), req.body));
  }),
);

paymentsRouter.post(
  '/failed',
  validate({
    body: z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().optional(),
      error_code: z.string().optional(),
      error_description: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await paymentsService.markPaymentFailed({
      razorpayOrderId: req.body.razorpay_order_id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      errorCode: req.body.error_code,
      errorDescription: req.body.error_description,
    });
    ok(res, { recorded: true });
  }),
);
