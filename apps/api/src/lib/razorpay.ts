import Razorpay from 'razorpay';
import { env } from '../config/env';

export const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

// The SDK constructor throws without keys — build lazily so the API can boot
// (and the catalog can be browsed) before Razorpay is configured. Callers gate
// on `razorpayConfigured` (checkout returns PAYMENTS_UNAVAILABLE otherwise).
let instance: Razorpay | null = null;

export const razorpay: Razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    if (!instance) {
      if (!razorpayConfigured) throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)');
      instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    }
    return (instance as unknown as Record<PropertyKey, unknown>)[prop];
  },
});
