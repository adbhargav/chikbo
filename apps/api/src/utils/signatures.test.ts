import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './signatures';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

describe('verifyRazorpayPaymentSignature', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const validSignature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  it('accepts a valid signature', () => {
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: validSignature,
        keySecret: KEY_SECRET,
      }),
    ).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const tampered = validSignature.replace(/^./, validSignature[0] === 'a' ? 'b' : 'a');
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: tampered,
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });

  it('rejects a signature for a different payment', () => {
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_OTHER',
        signature: validSignature,
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });

  it('rejects garbage signatures without throwing', () => {
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: 'not-hex-at-all',
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });
});

describe('verifyRazorpayWebhookSignature', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
  const validSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  it('accepts a valid signature over the raw body', () => {
    expect(verifyRazorpayWebhookSignature(Buffer.from(body), validSignature, WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects when the body was modified', () => {
    const modified = body.replace('pay_1', 'pay_2');
    expect(verifyRazorpayWebhookSignature(Buffer.from(modified), validSignature, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects with the wrong secret', () => {
    expect(verifyRazorpayWebhookSignature(Buffer.from(body), validSignature, 'wrong_secret')).toBe(false);
  });
});
