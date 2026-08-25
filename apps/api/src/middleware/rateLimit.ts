import rateLimit from 'express-rate-limit';

/** Global API limiter — generous; protects against floods. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } },
});

/** Strict limiter for auth endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

/** Webhook limiter — higher ceiling, still bounded. */
export const webhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
