import { prisma } from '../../lib/prisma';
import { razorpay } from '../../lib/razorpay';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/error';
import { notifyUser } from '../../lib/notify';
import { orderConfirmedEmail, refundCompletedEmail, refundInitiatedEmail } from '../../lib/emails';
import { verifyRazorpayPaymentSignature } from '../../utils/signatures';

/**
 * Marks a payment captured and confirms its order. Idempotent — safe to call
 * from both the checkout callback and the webhook, in any order or repeatedly.
 */
export async function markPaymentCaptured(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  method?: string;
}): Promise<void> {
  const confirmed = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { razorpayOrderId: params.razorpayOrderId },
      include: { order: true },
    });
    if (!payment) {
      logger.warn({ razorpayOrderId: params.razorpayOrderId }, 'Payment record not found for captured payment');
      return null;
    }
    if (payment.status === 'CAPTURED') return null; // already processed

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', razorpayPaymentId: params.razorpayPaymentId, method: params.method },
    });

    if (payment.order.status === 'PENDING') {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
      await tx.orderStatusHistory.create({
        data: { orderId: payment.orderId, status: 'CONFIRMED', note: 'Payment captured' },
      });
      // Clear purchased items from the cart.
      const items = await tx.orderItem.findMany({ where: { orderId: payment.orderId }, select: { variantId: true } });
      await tx.cartItem.deleteMany({
        where: { userId: payment.order.userId, variantId: { in: items.map((i) => i.variantId) } },
      });
      return payment.order;
    }
    return null;
  });

  if (confirmed) {
    const [user, full] = await Promise.all([
      prisma.user.findUnique({ where: { id: confirmed.userId } }),
      prisma.order.findUnique({ where: { id: confirmed.id }, include: { items: true } }),
    ]);
    if (user && full) {
      const mail = orderConfirmedEmail(full, user.name);
      await notifyUser({
        userId: user.id,
        type: 'order_update',
        title: 'Order confirmed 🎉',
        body: `Your Chikbo order ${confirmed.orderNumber} is confirmed. We'll start packing it right away!`,
        data: { orderId: confirmed.id },
        email: { to: user.email, subject: mail.subject, html: mail.html },
        whatsapp: user.phone
          ? { phone: user.phone, message: `Chikbo: your order ${confirmed.orderNumber} is confirmed! Track it in the app.` }
          : undefined,
      });
    }
  }
}

export async function markPaymentFailed(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  errorCode?: string;
  errorDescription?: string;
}): Promise<void> {
  await prisma.payment.updateMany({
    where: { razorpayOrderId: params.razorpayOrderId, status: { in: ['CREATED', 'AUTHORIZED'] } },
    data: {
      status: 'FAILED',
      razorpayPaymentId: params.razorpayPaymentId,
      errorCode: params.errorCode,
      errorDescription: params.errorDescription,
    },
  });
}

/** Client callback after Razorpay Checkout succeeds: verify HMAC then confirm. */
export async function verifyAndCapture(
  userId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
): Promise<{ orderId: string; orderNumber: string; status: string }> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: body.razorpay_order_id },
    include: { order: true },
  });
  if (!payment || payment.order.userId !== userId) throw ApiError.notFound('Payment not found');

  const valid = verifyRazorpayPaymentSignature({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
    keySecret: env.RAZORPAY_KEY_SECRET,
  });
  if (!valid) {
    logger.warn({ razorpayOrderId: body.razorpay_order_id, userId }, 'Invalid payment signature');
    throw ApiError.badRequest('Payment verification failed');
  }

  await markPaymentCaptured({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
  });

  const order = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
  return { orderId: order.id, orderNumber: order.orderNumber, status: order.status };
}

/** Initiate a Razorpay refund for a captured payment (full or partial). */
export async function initiateRefund(orderId: string, amountInPaise: number | undefined, reason: string, actorId: string) {
  const payment = await prisma.payment.findFirst({
    where: { orderId, status: 'CAPTURED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment?.razorpayPaymentId) throw ApiError.unprocessable('NO_CAPTURED_PAYMENT', 'No captured payment to refund');

  const amount = amountInPaise ?? payment.amountInPaise;
  if (amount <= 0 || amount > payment.amountInPaise) throw ApiError.badRequest('Invalid refund amount');

  const refund = await prisma.refund.create({
    data: { paymentId: payment.id, amountInPaise: amount, reason, status: 'INITIATED' },
  });

  try {
    const rzpRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount,
      notes: { reason, actorId },
    });
    await prisma.$transaction([
      prisma.refund.update({ where: { id: refund.id }, data: { razorpayRefundId: rzpRefund.id } }),
      prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_INITIATED' } }),
      prisma.order.update({ where: { id: orderId }, data: { status: 'REFUND_INITIATED' } }),
      prisma.orderStatusHistory.create({
        data: { orderId, status: 'REFUND_INITIATED', note: `Refund of ₹${(amount / 100).toFixed(2)} initiated`, actorId },
      }),
    ]);

    // Tell the customer their money is moving — silence here is the single
    // biggest driver of "where is my refund?" support tickets.
    const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
    if (full) {
      const mail = refundInitiatedEmail(full, full.user.name, amount, reason);
      await notifyUser({
        userId: full.userId,
        type: 'refund_update',
        title: 'Refund started',
        body: `We've started a refund of ₹${(amount / 100).toFixed(2)} for order ${full.orderNumber}.`,
        data: { orderId },
        email: { to: full.user.email, subject: mail.subject, html: mail.html },
        whatsapp: full.user.phone
          ? { phone: full.user.phone, message: `Chikbo: refund of ₹${(amount / 100).toFixed(2)} started for order ${full.orderNumber}. It reaches your account in 5-7 working days.` }
          : undefined,
      });
    }
    return refund.id;
  } catch (err) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
    logger.error({ err, orderId }, 'Razorpay refund failed');
    throw ApiError.unprocessable('REFUND_FAILED', 'Refund could not be initiated with the payment gateway');
  }
}

/** Webhook: refund.processed — mark refund complete. Idempotent. */
export async function markRefundProcessed(razorpayRefundId: string): Promise<void> {
  const refund = await prisma.refund.findUnique({
    where: { razorpayRefundId },
    include: { payment: true },
  });
  if (!refund || refund.status === 'PROCESSED') return;
  await prisma.$transaction([
    prisma.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED' } }),
    prisma.payment.update({ where: { id: refund.paymentId }, data: { status: 'REFUNDED' } }),
    prisma.order.update({ where: { id: refund.payment.orderId }, data: { status: 'REFUNDED' } }),
    prisma.orderStatusHistory.create({
      data: { orderId: refund.payment.orderId, status: 'REFUNDED', note: 'Refund processed by gateway' },
    }),
  ]);

  const full = await prisma.order.findUnique({
    where: { id: refund.payment.orderId },
    include: { items: true, user: true },
  });
  if (full) {
    const mail = refundCompletedEmail(full, full.user.name);
    await notifyUser({
      userId: full.userId,
      type: 'refund_update',
      title: 'Refund completed',
      body: `Your refund for order ${full.orderNumber} has been processed.`,
      data: { orderId: full.id },
      email: { to: full.user.email, subject: mail.subject, html: mail.html },
    });
  }
}
