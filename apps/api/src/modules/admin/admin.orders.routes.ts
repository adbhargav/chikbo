/** Admin: order management, shipments, returns & refunds. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth, requireStaff, requirePermission, type AuthedRequest } from '../../middleware/auth';
import * as shippingService from '../shipping/shipping.service';
import * as paymentsService from '../payments/payments.service';
import { releaseOrderStock } from '../checkout/checkout.service';
import { notifyUser } from '../../lib/notify';
import { orderStatusEmail, returnDecisionEmail } from '../../lib/emails';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAuth, requireStaff);

adminOrdersRouter.get(
  '/orders',
  requirePermission('orders.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      status: z.string().optional(),
      search: z.string().max(120).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; status?: string; search?: string; from?: Date; to?: Date };
    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.search
        ? {
            OR: [
              { orderNumber: { contains: q.search, mode: 'insensitive' as const } },
              { user: { email: { contains: q.search, mode: 'insensitive' as const } } },
              { user: { name: { contains: q.search, mode: 'insensitive' as const } } },
              { shipPhone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: true,
          payments: true,
          shipments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

adminOrdersRouter.get(
  '/orders/:id',
  requirePermission('orders.read'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
        payments: { include: { refunds: true } },
        shipments: { include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        returnRequests: true,
        coupon: true,
      },
    });
    if (!order) throw ApiError.notFound('Order not found');
    ok(res, order);
  }),
);

/** Manual status transitions an admin may perform (courier webhooks drive the rest). */
const MANUAL_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

adminOrdersRouter.post(
  '/orders/:id/status',
  requirePermission('orders.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      status: z.enum(['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
      note: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payments: true, user: true } });
    if (!order) throw ApiError.notFound('Order not found');
    const allowed = MANUAL_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      throw ApiError.unprocessable('INVALID_TRANSITION', `Cannot move an order from ${order.status} to ${req.body.status}`);
    }

    if (req.body.status === 'CANCELLED') {
      await releaseOrderStock(order.id, req.body.note ?? 'Cancelled by store');
      if (order.payments.some((p) => p.status === 'CAPTURED')) {
        await paymentsService.initiateRefund(order.id, undefined, req.body.note ?? 'Cancelled by store', user.id);
      }
    } else {
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: req.body.status as never } }),
        prisma.orderStatusHistory.create({
          data: { orderId: order.id, status: req.body.status as never, note: req.body.note, actorId: user.id },
        }),
      ]);
    }

    // Staff moving an order by hand must reach the customer too — otherwise
    // only courier-driven transitions are ever announced.
    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, user: true, shipments: { where: { isReturn: false }, take: 1 } },
    });
    if (full) {
      const shipment = full.shipments[0];
      const mail = orderStatusEmail(full, full.user.name, req.body.status, {
        awbCode: shipment?.awbCode,
        courierName: shipment?.courierName,
        note: req.body.note,
      });
      if (mail) {
        await notifyUser({
          userId: full.userId,
          type: 'order_update',
          title: `Order ${req.body.status.toLowerCase().replace(/_/g, ' ')}`,
          body: `Your Chikbo order ${full.orderNumber} is now ${req.body.status.toLowerCase().replace(/_/g, ' ')}.`,
          data: { orderId: full.id },
          email: { to: full.user.email, subject: mail.subject, html: mail.html },
        });
      }
    }
    ok(res, await prisma.order.findUnique({ where: { id: order.id }, include: { statusHistory: true } }));
  }),
);

// --- Shipments --------------------------------------------------------------

adminOrdersRouter.post(
  '/orders/:id/shipment',
  requirePermission('shipments.write'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await shippingService.createShipmentForOrder(req.params.id, user.id), 201);
  }),
);

adminOrdersRouter.post(
  '/shipments/:id/awb',
  requirePermission('shipments.write'),
  validate({ params: z.object({ id: z.string() }), body: z.object({ courierId: z.number().int().optional() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, await shippingService.assignAwb(req.params.id, req.body.courierId, user.id));
  }),
);

adminOrdersRouter.get(
  '/shipments',
  requirePermission('shipments.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const [total, items] = await prisma.$transaction([
      prisma.shipment.count(),
      prisma.shipment.findMany({
        include: { order: { select: { orderNumber: true, shipCity: true, shipState: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

// --- Returns & refunds ------------------------------------------------------

adminOrdersRouter.get(
  '/returns',
  requirePermission('returns.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      status: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; status?: string };
    const where = q.status ? { status: q.status as never } : {};
    const [total, items] = await prisma.$transaction([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          orderItem: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

adminOrdersRouter.post(
  '/returns/:id/decision',
  requirePermission('returns.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      adminNote: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const request = await prisma.returnRequest.findUnique({
      where: { id: req.params.id },
      include: { order: true, orderItem: true },
    });
    if (!request) throw ApiError.notFound('Return request not found');
    if (request.status !== 'REQUESTED') throw ApiError.conflict('This return request has already been decided');

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.returnRequest.update({
        where: { id: request.id },
        data: { status: req.body.decision, adminNote: req.body.adminNote },
      });
      if (req.body.decision === 'REJECTED') {
        await tx.order.update({ where: { id: request.orderId }, data: { status: 'DELIVERED' } });
        await tx.orderStatusHistory.create({
          data: { orderId: request.orderId, status: 'DELIVERED', note: 'Return request rejected', actorId: user.id },
        });
      }
      return r;
    });

    const full = await prisma.order.findUnique({
      where: { id: request.orderId },
      include: { items: true, user: true },
    });
    const mail = full
      ? returnDecisionEmail(
          full,
          full.user.name,
          request.orderItem.productName,
          req.body.decision === 'APPROVED',
          req.body.adminNote,
        )
      : null;
    await notifyUser({
      userId: request.userId,
      type: 'return_update',
      title: req.body.decision === 'APPROVED' ? 'Return approved' : 'Return request update',
      body:
        req.body.decision === 'APPROVED'
          ? `Your return for "${request.orderItem.productName}" is approved. Pickup will be scheduled soon.`
          : `Your return for "${request.orderItem.productName}" could not be approved. ${req.body.adminNote ?? ''}`,
      data: { orderId: request.orderId },
      email: mail && full ? { to: full.user.email, subject: mail.subject, html: mail.html } : undefined,
    });
    ok(res, updated);
  }),
);

adminOrdersRouter.post(
  '/returns/:id/received',
  requirePermission('returns.write'),
  validate({ params: z.object({ id: z.string() }), body: z.object({ restock: z.boolean().default(true) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const request = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: { orderItem: true } });
    if (!request) throw ApiError.notFound('Return request not found');
    if (!['APPROVED', 'PICKUP_SCHEDULED', 'IN_TRANSIT'].includes(request.status)) {
      throw ApiError.unprocessable('INVALID_STATE', 'Return is not in a receivable state');
    }

    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id: request.id }, data: { status: 'RECEIVED' } });
      await tx.order.update({ where: { id: request.orderId }, data: { status: 'RETURNED' } });
      await tx.orderStatusHistory.create({
        data: { orderId: request.orderId, status: 'RETURNED', note: 'Returned item received at warehouse', actorId: user.id },
      });
      if (req.body.restock) {
        const variant = await tx.productVariant.update({
          where: { id: request.orderItem.variantId },
          data: { stockQty: { increment: request.orderItem.qty } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: request.orderItem.variantId,
            delta: request.orderItem.qty,
            qtyAfter: variant.stockQty,
            reason: 'RETURN_RECEIVED',
            refType: 'return',
            refId: request.id,
            actorId: user.id,
          },
        });
      }
    });
    ok(res, { received: true });
  }),
);

adminOrdersRouter.post(
  '/orders/:id/refund',
  requirePermission('refunds.write'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      amountInPaise: z.number().int().min(100).optional(),
      reason: z.string().min(3).max(500),
      returnRequestId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const refundId = await paymentsService.initiateRefund(req.params.id, req.body.amountInPaise, req.body.reason, user.id);
    if (req.body.returnRequestId) {
      await prisma.returnRequest.updateMany({
        where: { id: req.body.returnRequestId, orderId: req.params.id },
        data: { status: 'REFUNDED' },
      });
    }
    ok(res, { refundId }, 201);
  }),
);

adminOrdersRouter.get(
  '/payments',
  requirePermission('payments.read'),
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      status: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; status?: string };
    const where = q.status ? { status: q.status as never } : {};
    const [total, items] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: { order: { select: { orderNumber: true, user: { select: { email: true } } } }, refunds: true },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    ok(res, { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);
