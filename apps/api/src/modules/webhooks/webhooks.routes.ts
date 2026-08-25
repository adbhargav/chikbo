/**
 * Payment & shipping webhooks.
 *
 * Razorpay: mounted with express.raw() so the HMAC is computed over the exact
 * bytes Razorpay signed. Idempotency: each event is recorded in WebhookEvent
 * keyed by (source, externalId) with a unique constraint — a duplicate
 * delivery short-circuits before any side effect.
 *
 * Shiprocket: authenticated by a shared token header configured in the
 * Shiprocket panel; deduped by a hash of the meaningful payload fields.
 */
import { Router, raw } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { verifyRazorpayWebhookSignature, sha256Hex } from '../../utils/signatures';
import { markPaymentCaptured, markPaymentFailed, markRefundProcessed } from '../payments/payments.service';
import { syncShipmentFromWebhook } from '../shipping/shipping.service';
import { webhookLimiter } from '../../middleware/rateLimit';

export const webhooksRouter = Router();
webhooksRouter.use(webhookLimiter);

/** Record the event; returns false when it was already processed. */
async function recordEventOnce(source: string, externalId: string, eventType: string, payload: unknown): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: { source, externalId, eventType, payload: payload as Prisma.InputJsonValue },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}

webhooksRouter.post('/razorpay', raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string' || !env.RAZORPAY_WEBHOOK_SECRET) {
      res.status(400).json({ received: false });
      return;
    }
    const rawBody: Buffer = req.body;
    if (!verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
      logger.warn('Razorpay webhook signature mismatch');
      res.status(400).json({ received: false });
      return;
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = (req.headers['x-razorpay-event-id'] as string | undefined) ?? sha256Hex(rawBody.toString('utf8'));

    const fresh = await recordEventOnce('razorpay', eventId, event.event, event);
    if (!fresh) {
      res.json({ received: true, duplicate: true });
      return;
    }

    switch (event.event) {
      case 'payment.captured': {
        const p = event.payload.payment.entity;
        await markPaymentCaptured({ razorpayOrderId: p.order_id, razorpayPaymentId: p.id, method: p.method });
        break;
      }
      case 'payment.failed': {
        const p = event.payload.payment.entity;
        await markPaymentFailed({
          razorpayOrderId: p.order_id,
          razorpayPaymentId: p.id,
          errorCode: p.error_code ?? undefined,
          errorDescription: p.error_description ?? undefined,
        });
        break;
      }
      case 'refund.processed': {
        const r = event.payload.refund.entity;
        await markRefundProcessed(r.id);
        break;
      }
      default:
        logger.debug({ event: event.event }, 'Unhandled Razorpay webhook event');
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, 'Razorpay webhook processing failed');
    // 500 so Razorpay retries; idempotency guard makes retries safe.
    res.status(500).json({ received: false });
  }
});

webhooksRouter.post('/shiprocket', raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    if (env.SHIPROCKET_WEBHOOK_TOKEN) {
      const token = req.headers['x-api-key'] ?? req.headers['x-webhook-token'];
      if (token !== env.SHIPROCKET_WEBHOOK_TOKEN) {
        res.status(401).json({ received: false });
        return;
      }
    }
    const payload = JSON.parse((req.body as Buffer).toString('utf8'));
    const awb = String(payload.awb ?? payload.awb_code ?? '');
    const status = String(payload.current_status ?? payload.shipment_status ?? '');
    if (!awb || !status) {
      res.json({ received: true, ignored: true });
      return;
    }

    const externalId = sha256Hex(`${awb}:${status}:${payload.current_timestamp ?? payload.scans?.length ?? ''}`);
    const fresh = await recordEventOnce('shiprocket', externalId, status, payload);
    if (!fresh) {
      res.json({ received: true, duplicate: true });
      return;
    }

    await syncShipmentFromWebhook(awb, status, payload);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, 'Shiprocket webhook processing failed');
    res.status(500).json({ received: false });
  }
});
