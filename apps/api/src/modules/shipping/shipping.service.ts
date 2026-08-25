import type { OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { shiprocket } from '../../lib/shiprocket';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/error';
import { notifyUser } from '../../lib/notify';
import { orderStatusEmail } from '../../lib/emails';

/** Create a Shiprocket shipment for a paid order (admin action). */
export async function createShipmentForOrder(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { variant: true } }, user: true, shipments: { where: { isReturn: false } } },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
    throw ApiError.unprocessable('ORDER_NOT_READY', `Cannot ship an order in status ${order.status}`);
  }
  if (order.shipments.length > 0) throw ApiError.conflict('A shipment already exists for this order');

  const weightKg = Math.max(
    0.3,
    order.items.reduce((s, i) => s + ((i.variant.weightGrams ?? 300) * i.qty) / 1000, 0),
  );

  const result = await shiprocket.createShipment({
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    billing: {
      name: order.shipFullName,
      phone: order.shipPhone,
      address: order.shipLine1,
      address2: order.shipLine2 ?? undefined,
      city: order.shipCity,
      state: order.shipState,
      pincode: order.shipPincode,
      email: order.user.email,
    },
    items: order.items.map((i) => ({
      name: i.productName,
      sku: i.sku,
      units: i.qty,
      selling_price: Math.round(i.unitPriceInPaise / 100),
    })),
    subTotalRupees: Math.round(order.subtotalInPaise / 100),
    weightKg,
  });

  const shipment = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.create({
      data: {
        orderId,
        shiprocketOrderId: result.shiprocketOrderId,
        shiprocketShipmentId: result.shiprocketShipmentId,
        status: 'CREATED',
      },
    });
    if (order.status === 'CONFIRMED') {
      await tx.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });
      await tx.orderStatusHistory.create({
        data: { orderId, status: 'PROCESSING', note: 'Shipment created in Shiprocket', actorId },
      });
    }
    return s;
  });
  return shipment;
}

/** Assign AWB / courier to an existing shipment (admin action). */
export async function assignAwb(shipmentId: string, courierId: number | undefined, actorId: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { order: true } });
  if (!shipment) throw ApiError.notFound('Shipment not found');
  if (!shipment.shiprocketShipmentId) throw ApiError.unprocessable('NO_SHIPROCKET_ID', 'Shipment was not created in Shiprocket');
  if (shipment.awbCode) return shipment; // idempotent

  const { awbCode, courierName } = await shiprocket.assignAwb(shipment.shiprocketShipmentId, courierId);
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipmentId },
      data: { awbCode, courierName, status: 'AWB_ASSIGNED' },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: shipment.orderId, status: shipment.order.status, note: `AWB ${awbCode} (${courierName}) assigned`, actorId },
    });
    return s;
  });
  return updated;
}

// Shiprocket status text -> internal shipment + order status.
const STATUS_MAP: Record<string, { shipment: ShipmentStatus; order?: OrderStatus }> = {
  'PICKUP SCHEDULED': { shipment: 'PICKUP_SCHEDULED' },
  'PICKED UP': { shipment: 'IN_TRANSIT', order: 'SHIPPED' },
  SHIPPED: { shipment: 'IN_TRANSIT', order: 'SHIPPED' },
  'IN TRANSIT': { shipment: 'IN_TRANSIT', order: 'SHIPPED' },
  'OUT FOR DELIVERY': { shipment: 'OUT_FOR_DELIVERY', order: 'OUT_FOR_DELIVERY' },
  DELIVERED: { shipment: 'DELIVERED', order: 'DELIVERED' },
  'RTO INITIATED': { shipment: 'RTO' },
  'RTO DELIVERED': { shipment: 'RTO' },
  CANCELED: { shipment: 'CANCELLED' },
  CANCELLED: { shipment: 'CANCELLED' },
};

const CUSTOMER_MESSAGES: Partial<Record<OrderStatus, { title: string; body: (n: string) => string }>> = {
  SHIPPED: { title: 'Order shipped 📦', body: (n) => `Your Chikbo order ${n} is on its way!` },
  OUT_FOR_DELIVERY: { title: 'Out for delivery 🚚', body: (n) => `Your Chikbo order ${n} is out for delivery today.` },
  DELIVERED: { title: 'Delivered ✅', body: (n) => `Your Chikbo order ${n} has been delivered. Enjoy!` },
};

/** Apply a tracking update coming from the Shiprocket webhook. */
export async function syncShipmentFromWebhook(awbCode: string, statusText: string, payload: unknown): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { awbCode }, include: { order: { include: { user: true } } } });
  if (!shipment) {
    logger.warn({ awbCode }, 'Tracking update for unknown AWB');
    return;
  }

  const mapped = STATUS_MAP[statusText.toUpperCase()];
  const p = payload as { location?: string; current_timestamp?: string };

  await prisma.$transaction(async (tx) => {
    await tx.shipmentTrackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: statusText,
        description: null,
        location: p.location ?? null,
        occurredAt: p.current_timestamp ? new Date(p.current_timestamp) : new Date(),
      },
    });
    if (mapped) {
      await tx.shipment.update({ where: { id: shipment.id }, data: { status: mapped.shipment } });
      // Don't regress orders in terminal/return states.
      const movable: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY'];
      if (mapped.order && shipment.order.status !== mapped.order && movable.includes(shipment.order.status)) {
        await tx.order.update({ where: { id: shipment.orderId }, data: { status: mapped.order } });
        await tx.orderStatusHistory.create({
          data: { orderId: shipment.orderId, status: mapped.order, note: `Courier update: ${statusText}` },
        });
      }
    }
  });

  const msg = mapped?.order ? CUSTOMER_MESSAGES[mapped.order] : undefined;
  if (msg && mapped?.order && shipment.order.status !== mapped.order) {
    const full = await prisma.order.findUnique({
      where: { id: shipment.orderId },
      include: { items: true, user: true },
    });
    if (full) {
      const mail = orderStatusEmail(full, full.user.name, mapped.order, {
        awbCode: shipment.awbCode,
        courierName: shipment.courierName,
      });
      await notifyUser({
        userId: full.userId,
        type: 'order_update',
        title: msg.title,
        body: msg.body(full.orderNumber),
        data: { orderId: shipment.orderId },
        email: mail ? { to: full.user.email, subject: mail.subject, html: mail.html } : undefined,
        whatsapp: full.user.phone
          ? { phone: full.user.phone, message: `${msg.body(full.orderNumber)}${shipment.awbCode ? ` Tracking: ${shipment.awbCode}` : ''}` }
          : undefined,
      });
    }
  }
}
