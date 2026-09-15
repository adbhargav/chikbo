import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { optionalAuth, type AuthedRequest } from '../../middleware/auth';
import { readGuestToken } from '../../middleware/guest';
import * as checkoutService from './checkout.service';

/** Checkout is open to guests: a guest token plus an email and an inline address stand in for an account. */
export const checkoutRouter = Router();
checkoutRouter.use(optionalAuth);

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
});

checkoutRouter.post(
  '/',
  validate({
    body: z.object({
      addressId: z.string().min(1).optional(),
      address: addressSchema.optional(),
      email: z.string().trim().email().max(254).optional(),
      couponCode: z.string().max(40).optional(),
      idempotencyKey: z.string().uuid('idempotencyKey must be a UUID'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = (req as Partial<AuthedRequest>).user;
    if (user) {
      if (!req.body.addressId && !req.body.address) throw ApiError.badRequest('Select a delivery address');
      ok(res, await checkoutService.createCheckout({ kind: 'user', user }, req.body), 201);
      return;
    }
    const guestToken = readGuestToken(req);
    if (!guestToken) throw ApiError.unauthorized('Sign in or provide a guest token');
    if (!req.body.email) throw ApiError.badRequest('Enter an email address for your order confirmation');
    if (!req.body.address) throw ApiError.badRequest('Enter a delivery address');
    ok(res, await checkoutService.createCheckout({ kind: 'guest', guestToken, email: req.body.email }, req.body), 201);
  }),
);
