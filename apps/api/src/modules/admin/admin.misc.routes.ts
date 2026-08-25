/** Admin: dashboard, reports, customers, coupons, staff & roles. */
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, requireStaff, requirePermission, type AuthedRequest } from '../../middleware/auth';

export const adminMiscRouter = Router();
adminMiscRouter.use(requireAuth, requireStaff);

// --- Dashboard --------------------------------------------------------------

adminMiscRouter.get(
  '/dashboard',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

    const [ordersToday, revenueToday, revenueMonth, pendingShipments, openReturns, lowStock, customers, recentOrders] =
      await prisma.$transaction([
        prisma.order.count({ where: { createdAt: { gte: dayStart }, status: { in: paidStatuses as never } } }),
        prisma.order.aggregate({
          where: { createdAt: { gte: dayStart }, status: { in: paidStatuses as never } },
          _sum: { totalInPaise: true },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: monthStart }, status: { in: paidStatuses as never } },
          _sum: { totalInPaise: true },
        }),
        prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] } } }),
        prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count FROM "ProductVariant"
          WHERE "isActive" = true AND "stockQty" <= "lowStockThreshold"`,
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.order.findMany({
          include: { user: { select: { name: true } }, items: { select: { qty: true } } },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

    ok(res, {
      ordersToday,
      revenueTodayInPaise: revenueToday._sum.totalInPaise ?? 0,
      revenueMonthInPaise: revenueMonth._sum.totalInPaise ?? 0,
      pendingShipments,
      openReturns,
      lowStockCount: Number(lowStock[0]?.count ?? 0),
      customers,
      recentOrders,
    });
  }),
);

adminMiscRouter.get(
  '/reports/sales',
  requirePermission('reports.read'),
  validate({
    query: z.object({
      days: z.coerce.number().int().min(7).max(365).default(30),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { days } = req.query as unknown as { days: number };
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const [daily, bestSellers, byCategory] = await Promise.all([
      prisma.$queryRaw<{ day: Date; orders: bigint; revenue: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt") as day,
               COUNT(*)::bigint as orders,
               COALESCE(SUM("totalInPaise"), 0)::bigint as revenue
        FROM "Order"
        WHERE "createdAt" >= ${since}
          AND status IN ('CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ productName: string; sku: string; units: bigint; revenue: bigint }[]>`
        SELECT oi."productName", oi.sku,
               SUM(oi.qty)::bigint as units,
               SUM(oi."lineTotalInPaise")::bigint as revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."createdAt" >= ${since}
          AND o.status IN ('CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')
        GROUP BY 1, 2 ORDER BY units DESC LIMIT 10`,
      prisma.$queryRaw<{ category: string; units: bigint; revenue: bigint }[]>`
        SELECT c.name as category,
               SUM(oi.qty)::bigint as units,
               SUM(oi."lineTotalInPaise")::bigint as revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "ProductVariant" v ON v.id = oi."variantId"
        JOIN "Product" p ON p.id = v."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE o."createdAt" >= ${since}
          AND o.status IN ('CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')
        GROUP BY 1 ORDER BY revenue DESC`,
    ]);

    const serialise = <T extends Record<string, unknown>>(rows: T[]) =>
      rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));

    ok(res, { daily: serialise(daily), bestSellers: serialise(bestSellers), byCategory: serialise(byCategory) });
  }),
);

// --- Customers --------------------------------------------------------------

adminMiscRouter.get(
  '/customers',
  requirePermission('customers.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; search?: string };
    const where = {
      role: 'CUSTOMER' as const,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

adminMiscRouter.get(
  '/customers/:id',
  requirePermission('customers.read'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const customer = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 20, include: { items: { select: { qty: true } } } },
        wishlist: { include: { product: { select: { name: true, slug: true } } } },
      },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    ok(res, customer);
  }),
);

adminMiscRouter.patch(
  '/customers/:id',
  requirePermission('customers.write'),
  validate({ params: z.object({ id: z.string() }), body: z.object({ isActive: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
      select: { id: true, isActive: true },
    });
    ok(res, user);
  }),
);

// --- Coupons ----------------------------------------------------------------

const couponBody = z.object({
  code: z.string().regex(/^[A-Z0-9]{3,20}$/, 'Code must be 3-20 uppercase letters/digits'),
  type: z.enum(['PERCENT', 'FLAT']),
  value: z.number().int().min(1),
  minOrderInPaise: z.number().int().min(0).default(0),
  maxDiscountInPaise: z.number().int().min(1).nullable().optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

adminMiscRouter.get(
  '/coupons',
  requirePermission('coupons.read'),
  asyncHandler(async (_req, res) => {
    ok(
      res,
      await prisma.coupon.findMany({
        include: { _count: { select: { redemptions: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);

adminMiscRouter.post(
  '/coupons',
  requirePermission('coupons.write'),
  validate({ body: couponBody }),
  asyncHandler(async (req, res) => {
    if (req.body.type === 'PERCENT' && req.body.value > 10_000) {
      throw ApiError.badRequest('Percent value is in basis points (max 10000 = 100%)');
    }
    ok(res, await prisma.coupon.create({ data: req.body }), 201);
  }),
);

adminMiscRouter.patch(
  '/coupons/:id',
  requirePermission('coupons.write'),
  validate({ params: z.object({ id: z.string() }), body: couponBody.partial().omit({ code: true }) }),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.coupon.update({ where: { id: req.params.id }, data: req.body }));
  }),
);

// --- Staff & roles ----------------------------------------------------------

adminMiscRouter.get(
  '/roles',
  requirePermission('staff.read'),
  asyncHandler(async (_req, res) => {
    ok(res, {
      roles: await prisma.staffRole.findMany({ include: { _count: { select: { users: true } } } }),
      allPermissions: PERMISSIONS,
    });
  }),
);

adminMiscRouter.post(
  '/roles',
  requirePermission('staff.write'),
  validate({
    body: z.object({
      name: z.string().min(2).max(60),
      description: z.string().max(300).optional(),
      permissions: z.array(z.enum(PERMISSIONS)).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.staffRole.create({ data: req.body }), 201);
  }),
);

adminMiscRouter.patch(
  '/roles/:id',
  requirePermission('staff.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().min(2).max(60).optional(),
      description: z.string().max(300).optional(),
      permissions: z.array(z.enum(PERMISSIONS)).min(1).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    ok(res, await prisma.staffRole.update({ where: { id: req.params.id }, data: req.body }));
  }),
);

adminMiscRouter.get(
  '/staff',
  requirePermission('staff.read'),
  asyncHandler(async (_req, res) => {
    ok(
      res,
      await prisma.user.findMany({
        where: { role: { in: ['STAFF', 'SUPER_ADMIN'] } },
        select: { id: true, name: true, email: true, role: true, isActive: true, staffRole: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }),
);

adminMiscRouter.post(
  '/staff',
  requirePermission('staff.write'),
  validate({
    body: z.object({
      name: z.string().min(2).max(100),
      email: z.string().email().transform((s) => s.toLowerCase()),
      password: z.string().min(8).max(128),
      staffRoleId: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const role = await prisma.staffRole.findUnique({ where: { id: req.body.staffRoleId } });
    if (!role) throw ApiError.badRequest('Unknown staff role');
    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash: await bcrypt.hash(req.body.password, 12),
        role: 'STAFF',
        staffRoleId: role.id,
      },
      select: { id: true, name: true, email: true, role: true, staffRole: true },
    });
    ok(res, user, 201);
  }),
);

adminMiscRouter.patch(
  '/staff/:id',
  requirePermission('staff.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      staffRoleId: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user: actor } = req as AuthedRequest;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.role === 'CUSTOMER') throw ApiError.notFound('Staff member not found');
    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only a super admin can modify a super admin');
    }
    ok(
      res,
      await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
        select: { id: true, name: true, email: true, role: true, isActive: true, staffRole: true },
      }),
    );
  }),
);
