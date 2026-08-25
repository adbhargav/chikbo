import type { OrderDto, Paginated } from '@chikbo/shared';
import { CANCELLABLE_STATUSES, RETURNABLE_STATUSES } from '@chikbo/shared';
import type { Order, OrderItem, Prisma, Shipment, ShipmentTrackingEvent } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { initiateRefund } from '../payments/payments.service';
import { releaseOrderStock } from '../checkout/checkout.service';
import { notifyUser } from '../../lib/notify';
import { orderStatusEmail, returnRequestedEmail } from '../../lib/emails';

type OrderWithRels = Order & {
  items: OrderItem[];
  shipments: (Shipment & { trackingEvents?: ShipmentTrackingEvent[] })[];
  coupon: { code: string } | null;
};

export function toOrderDto(o: OrderWithRels): OrderDto {
  const shipment = o.shipments.find((s) => !s.isReturn);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    items: o.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productName: i.productName,
      sku: i.sku,
      size: i.size,
      color: i.color,
      thumbnailUrl: i.thumbnailUrl,
      qty: i.qty,
      unitPriceInPaise: i.unitPriceInPaise,
      lineTotalInPaise: i.lineTotalInPaise,
    })),
    subtotalInPaise: o.subtotalInPaise,
    discountInPaise: o.discountInPaise,
    shippingInPaise: o.shippingInPaise,
    totalInPaise: o.totalInPaise,
    couponCode: o.coupon?.code ?? null,
    shippingAddress: {
      fullName: o.shipFullName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      city: o.shipCity,
      state: o.shipState,
      pincode: o.shipPincode,
    },
    awbCode: shipment?.awbCode ?? null,
    courierName: shipment?.courierName ?? null,
    trackingEvents: shipment?.trackingEvents?.map((e) => ({
      status: e.status,
      description: e.description,
      at: e.occurredAt.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
  };
}

const includeForDto = {
  items: true,
  shipments: { include: { trackingEvents: { orderBy: { occurredAt: 'desc' as const } } } },
  coupon: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export async function listMyOrders(userId: string, page: number, pageSize: number): Promise<Paginated<OrderDto>> {
  const where = { userId };
  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: includeForDto,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: orders.map((o) => toOrderDto(o)),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getMyOrder(userId: string, orderId: string): Promise<OrderDto> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: includeForDto });
  if (!order) throw ApiError.notFound('Order not found');
  return toOrderDto(order);
}

/** Customer cancellation. Restocks; refunds automatically when already paid. */
export async function cancelMyOrder(userId: string, orderId: string, reason: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { payments: true },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw ApiError.unprocessable('NOT_CANCELLABLE', `Orders in status ${order.status} cannot be cancelled`);
  }

  const hasCapturedPayment = order.payments.some((p) => p.status === 'CAPTURED');
  await releaseOrderStock(orderId, `Cancelled by customer: ${reason}`);
  if (hasCapturedPayment) {
    // initiateRefund sends its own refund email; this one confirms the cancel.
    await initiateRefund(orderId, undefined, `Customer cancellation: ${reason}`, userId);
  }

  const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
  if (full) {
    const mail = orderStatusEmail(full, full.user.name, 'CANCELLED', { note: `Reason: ${reason}` });
    await notifyUser({
      userId: full.userId,
      type: 'order_update',
      title: 'Order cancelled',
      body: `Your order ${full.orderNumber} has been cancelled.`,
      data: { orderId },
      email: mail ? { to: full.user.email, subject: mail.subject, html: mail.html } : undefined,
    });
  }
}

/** Return request — genuine damage policy: photos required. */
export async function requestReturn(
  userId: string,
  orderId: string,
  input: { orderItemId: string; reason: string; imageUrls: string[] },
): Promise<string> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
  if (!order) throw ApiError.notFound('Order not found');
  if (!RETURNABLE_STATUSES.includes(order.status)) {
    throw ApiError.unprocessable('NOT_RETURNABLE', 'Returns can only be requested for delivered orders');
  }
  const item = order.items.find((i) => i.id === input.orderItemId);
  if (!item) throw ApiError.notFound('Order item not found');

  const existing = await prisma.returnRequest.findFirst({
    where: { orderItemId: input.orderItemId, status: { notIn: ['REJECTED'] } },
  });
  if (existing) throw ApiError.conflict('A return request already exists for this item');

  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.returnRequest.create({
      data: {
        orderId,
        orderItemId: input.orderItemId,
        userId,
        reason: input.reason,
        imageUrls: input.imageUrls,
        status: 'REQUESTED',
      },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: 'RETURN_REQUESTED' } });
    await tx.orderStatusHistory.create({
      data: { orderId, status: 'RETURN_REQUESTED', note: `Return requested for ${item.productName}` },
    });
    return r;
  });

  const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
  if (full) {
    const mail = returnRequestedEmail(full, full.user.name, item.productName);
    await notifyUser({
      userId: full.userId,
      type: 'return_update',
      title: 'Return request received',
      body: `We've received your return request for ${item.productName}.`,
      data: { orderId },
      email: { to: full.user.email, subject: mail.subject, html: mail.html },
    });
  }
  return request.id;
}

export async function listMyReturns(userId: string) {
  return prisma.returnRequest.findMany({
    where: { userId },
    include: { orderItem: true, order: { select: { orderNumber: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
