import { Prisma } from '@prisma/client';
import type { CheckoutCreateRequest, CheckoutCreateResponse } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { razorpay, razorpayConfigured } from '../../lib/razorpay';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/error';
import type { CartOwner } from '../../middleware/guest';
import { computeTotals, effectiveUnitPrice, type CouponRule } from '../../utils/pricing';
import { generateOrderNumber } from '../../utils/orderNumber';
import { getValidCoupon, ownerWhere, type CouponIdentity } from '../cart/cart.service';

/** Who is checking out: an account holder, or a guest identified by cart token + email. */
export type CheckoutActor =
  | { kind: 'user'; user: { id: string; email: string; name: string } }
  | { kind: 'guest'; guestToken: string; email: string };

interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Creates an order from the user's cart:
 *  1. Idempotency: an existing order for the same idempotencyKey is returned
 *     as-is (no double charge, no double stock deduction).
 *  2. All prices/totals come from DB rows read inside the transaction.
 *  3. Stock is reserved atomically via conditional decrements — a concurrent
 *     checkout of the last unit loses cleanly with INSUFFICIENT_STOCK.
 *  4. The Razorpay order is created after the DB transaction; on failure the
 *     reservation is compensated (stock restored, order cancelled).
 */
export async function createCheckout(actor: CheckoutActor, input: CheckoutCreateRequest): Promise<CheckoutCreateResponse> {
  if (!razorpayConfigured) {
    throw ApiError.unprocessable('PAYMENTS_UNAVAILABLE', 'Payments are not configured yet. Please try again later.');
  }

  const owner: CartOwner = actor.kind === 'user' ? { userId: actor.user.id } : { guestToken: actor.guestToken };
  const contactEmail = (actor.kind === 'user' ? actor.user.email : actor.email).trim().toLowerCase();
  const couponIdentity: CouponIdentity =
    actor.kind === 'user' ? { userId: actor.user.id } : { guestEmail: contactEmail };

  // Idempotent replay: return the existing pending order — but only to whoever placed it.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (existing) {
    const owned = owner.userId ? existing.userId === owner.userId : existing.guestToken === owner.guestToken;
    if (!owned) throw ApiError.conflict('This checkout belongs to another session');
    const payment = existing.payments[0];
    if (!payment) throw ApiError.conflict('Order already exists in an inconsistent state, contact support');
    if (existing.status !== 'PENDING') throw ApiError.conflict('This order has already been processed');
    return buildResponse(existing, payment.razorpayOrderId, contactEmail);
  }

  const address = await resolveAddress(actor, input);

  const order = await prisma.$transaction(
    async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: ownerWhere(owner),
        include: { variant: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } } } },
      });
      const usable = cartItems.filter((c) => c.variant.isActive && c.variant.product.isActive);
      if (usable.length === 0) throw ApiError.badRequest('Your cart is empty');

      // Atomic conditional stock reservation.
      for (const item of usable) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQty: { gte: item.qty } },
          data: { stockQty: { decrement: item.qty } },
        });
        if (updated.count === 0) {
          throw ApiError.unprocessable(
            'INSUFFICIENT_STOCK',
            `"${item.variant.product.name}" has insufficient stock`,
            { variantId: item.variantId },
          );
        }
      }

      const lines = usable.map((c) => ({
        variantId: c.variantId,
        qty: c.qty,
        unitPriceInPaise: effectiveUnitPrice(c.variant),
      }));

      let couponRule: CouponRule | null = null;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      if (input.couponCode) {
        const subtotal = lines.reduce((s, l) => s + l.unitPriceInPaise * l.qty, 0);
        const coupon = await getValidCoupon(input.couponCode, couponIdentity, subtotal);
        couponRule = {
          type: coupon.type,
          value: coupon.value,
          minOrderInPaise: coupon.minOrderInPaise,
          maxDiscountInPaise: coupon.maxDiscountInPaise,
        };
        couponId = coupon.id;
        couponCode = coupon.code;
      }

      const totals = computeTotals(lines, couponRule);

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: owner.userId ?? null,
          guestToken: owner.guestToken ?? null,
          guestEmail: actor.kind === 'guest' ? contactEmail : null,
          idempotencyKey: input.idempotencyKey,
          status: 'PENDING',
          subtotalInPaise: totals.subtotalInPaise,
          discountInPaise: totals.discountInPaise,
          shippingInPaise: totals.shippingInPaise,
          totalInPaise: totals.totalInPaise,
          couponId,
          shipFullName: address.fullName,
          shipPhone: address.phone,
          shipLine1: address.line1,
          shipLine2: address.line2,
          shipCity: address.city,
          shipState: address.state,
          shipPincode: address.pincode,
          items: {
            create: usable.map((c) => ({
              variantId: c.variantId,
              productName: c.variant.product.name,
              sku: c.variant.sku,
              size: c.variant.size,
              color: c.variant.color,
              thumbnailUrl: c.variant.product.images[0]?.url ?? null,
              unitPriceInPaise: effectiveUnitPrice(c.variant),
              qty: c.qty,
              lineTotalInPaise: effectiveUnitPrice(c.variant) * c.qty,
            })),
          },
          statusHistory: { create: { status: 'PENDING', note: 'Order created, awaiting payment' } },
        },
      });

      if (couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId,
            userId: owner.userId ?? null,
            guestEmail: actor.kind === 'guest' ? contactEmail : null,
            orderId: created.id,
          },
        });
      }

      for (const item of usable) {
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId } });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            delta: -item.qty,
            qtyAfter: variant.stockQty,
            reason: 'ORDER_PLACED',
            refType: 'order',
            refId: created.id,
          },
        });
      }

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
  );

  // Razorpay order creation happens outside the DB transaction; compensate on failure.
  try {
    const rzpOrder = await razorpay.orders.create({
      amount: order.totalInPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { chikboOrderId: order.id },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: rzpOrder.id,
        amountInPaise: order.totalInPaise,
        status: 'CREATED',
      },
    });
    return buildResponse(order, rzpOrder.id, contactEmail);
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Razorpay order creation failed — compensating');
    await releaseOrderStock(order.id, 'Payment initialisation failed');
    throw ApiError.unprocessable('PAYMENT_INIT_FAILED', 'Could not start the payment. Your cart is unchanged — please retry.');
  }
}

/**
 * The address to ship to: an inline address wins (it is the only option for
 * guests); otherwise a saved address that belongs to the signed-in user.
 */
async function resolveAddress(actor: CheckoutActor, input: CheckoutCreateRequest): Promise<ShippingAddress> {
  if (input.address) {
    const a = input.address;
    return {
      fullName: a.fullName.trim(),
      phone: a.phone.trim(),
      line1: a.line1.trim(),
      line2: a.line2?.trim() || null,
      city: a.city.trim(),
      state: a.state.trim(),
      pincode: a.pincode.trim(),
    };
  }
  if (actor.kind !== 'user' || !input.addressId) throw ApiError.badRequest('Enter a delivery address');
  const saved = await prisma.address.findFirst({ where: { id: input.addressId, userId: actor.user.id } });
  if (!saved) throw ApiError.badRequest('Select a valid delivery address');
  return {
    fullName: saved.fullName,
    phone: saved.phone,
    line1: saved.line1,
    line2: saved.line2,
    city: saved.city,
    state: saved.state,
    pincode: saved.pincode,
  };
}

function buildResponse(
  order: { id: string; orderNumber: string; totalInPaise: number; shipFullName: string; shipPhone: string },
  razorpayOrderId: string,
  email: string,
): CheckoutCreateResponse {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    razorpayOrderId,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    amountInPaise: order.totalInPaise,
    currency: 'INR',
    prefill: { name: order.shipFullName, email, contact: order.shipPhone },
  };
}

/** Restore stock and cancel an unpaid order (compensation / stale cleanup / cancellation). */
export async function releaseOrderStock(orderId: string, note: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status === 'CANCELLED') return; // already released
    for (const item of order.items) {
      const variant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { increment: item.qty } },
      });
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          delta: item.qty,
          qtyAfter: variant.stockQty,
          reason: 'ORDER_CANCELLED',
          refType: 'order',
          refId: order.id,
        },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelReason: note } });
    await tx.orderStatusHistory.create({ data: { orderId, status: 'CANCELLED', note } });
    await tx.couponRedemption.deleteMany({ where: { orderId } });
  });
}

/**
 * Cancels PENDING orders whose payment never arrived (webhook lost or user
 * abandoned checkout) and restores their reserved stock.
 * Called periodically from server.ts.
 */
export async function releaseStalePendingOrders(olderThanMinutes = 45): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
      payments: { none: { status: { in: ['CAPTURED', 'AUTHORIZED'] } } },
    },
    select: { id: true },
  });
  for (const { id } of stale) {
    try {
      await releaseOrderStock(id, 'Payment not completed in time');
    } catch (err) {
      logger.error({ err, orderId: id }, 'Failed to release stale order');
    }
  }
  return stale.length;
}
