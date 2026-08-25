import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import * as paymentsService from './payments.service';

export const paymentsRouter = Router();

paymentsRouter.post(
  '/verify',
  requireAuth,
  validate({
    body: z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await paymentsService.verifyAndCapture(user.id, req.body));
  }),
);

paymentsRouter.post(
  '/failed',
  requireAuth,
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
