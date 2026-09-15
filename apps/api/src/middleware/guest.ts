import type { Request } from 'express';
import type { AuthedRequest } from './auth';
import { ApiError } from './error';

/** Header carrying the client-generated guest cart token. */
export const GUEST_TOKEN_HEADER = 'x-guest-token';

/** Opaque, URL-safe, 16-128 chars — the web app sends a UUID. */
const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * The owner of a cart / checkout: a signed-in user or an anonymous browser
 * identified by its guest token. Exactly one side is set.
 */
export type CartOwner = { userId: string; guestToken?: undefined } | { guestToken: string; userId?: undefined };

/** Returns the request's guest token when present and well-formed, else null. */
export function readGuestToken(req: Request): string | null {
  const raw = req.headers[GUEST_TOKEN_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !GUEST_TOKEN_RE.test(value)) return null;
  return value;
}

/**
 * Resolves who owns the cart for this request. A signed-in user always wins;
 * otherwise the guest token is required. Use after `optionalAuth`.
 */
export function resolveCartOwner(req: Request): CartOwner {
  const user = (req as Partial<AuthedRequest>).user;
  if (user) return { userId: user.id };
  const guestToken = readGuestToken(req);
  if (!guestToken) throw ApiError.unauthorized('Sign in or provide a guest token');
  return { guestToken };
}
