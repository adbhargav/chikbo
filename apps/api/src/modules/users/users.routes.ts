import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const addressBody = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  line1: z.string().min(3).max(200),
  // Clients send null when the line is left blank — accept null as well as absent.
  line2: z.string().max(200).nullish(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().optional(),
});

usersRouter.patch(
  '/me',
  validate({
    body: z.object({
      name: z.string().min(2).max(100).optional(),
      phone: z.string().regex(/^[6-9]\d{9}$/).nullable().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: req.body,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    ok(res, updated);
  }),
);

usersRouter.get(
  '/me/addresses',
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    ok(res, addresses);
  }),
);

usersRouter.post(
  '/me/addresses',
  validate({ body: addressBody }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { isDefault, ...data } = req.body;
    const address = await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: user.id } });
      const makeDefault = isDefault ?? count === 0;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }
      return tx.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
    });
    ok(res, address, 201);
  }),
);

usersRouter.patch(
  '/me/addresses/:id',
  validate({ params: z.object({ id: z.string() }), body: addressBody.partial() }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!existing) throw ApiError.notFound('Address not found');
    const { isDefault, ...data } = req.body;
    const address = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: existing.id },
        data: { ...data, ...(isDefault !== undefined ? { isDefault } : {}) },
      });
    });
    ok(res, address);
  }),
);

usersRouter.delete(
  '/me/addresses/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const deleted = await prisma.address.deleteMany({ where: { id: req.params.id, userId: user.id } });
    if (deleted.count === 0) throw ApiError.notFound('Address not found');
    ok(res, { deleted: true });
  }),
);

usersRouter.post(
  '/me/device-tokens',
  validate({
    body: z.object({
      token: z.string().min(10).max(4096),
      platform: z.enum(['ios', 'android', 'web']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await prisma.deviceToken.upsert({
      where: { token: req.body.token },
      update: { userId: user.id, platform: req.body.platform },
      create: { userId: user.id, token: req.body.token, platform: req.body.platform },
    });
    ok(res, { registered: true }, 201);
  }),
);

usersRouter.get(
  '/me/notifications',
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, notifications);
  }),
);
