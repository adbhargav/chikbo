import crypto from 'crypto';

/** Constant-time HMAC-SHA256 comparison. */
function hmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Razorpay Checkout callback: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacSha256(params.keySecret, `${params.razorpayOrderId}|${params.razorpayPaymentId}`);
  return safeEqualHex(expected, params.signature);
}

/** Razorpay webhook: HMAC_SHA256(rawBody, webhook_secret) vs X-Razorpay-Signature. */
export function verifyRazorpayWebhookSignature(rawBody: Buffer | string, signature: string, webhookSecret: string): boolean {
  const expected = hmacSha256(webhookSecret, typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
  return safeEqualHex(expected, signature);
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
