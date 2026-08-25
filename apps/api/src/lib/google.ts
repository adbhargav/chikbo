/**
 * Google Sign-In — ID token verification.
 *
 * The clients (web, mobile) run Google's own sign-in UI and receive an ID
 * token (a JWT signed by Google). They send only that token here; this module
 * verifies the signature, issuer, audience and expiry against Google's public
 * keys before we trust a single field. Client-supplied email/name/picture are
 * never trusted on their own.
 *
 * No client secret is needed: this is the ID-token flow, not the auth-code
 * flow, so nothing confidential ever reaches the browser.
 */
import { OAuth2Client } from 'google-auth-library';
import { env, googleAuthEnabled } from '../config/env';
import { ApiError } from '../middleware/error';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!googleAuthEnabled) {
    throw ApiError.unprocessable('GOOGLE_AUTH_DISABLED', 'Google Sign-In is not configured');
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Google sign-in could not be verified');
  }

  if (!payload?.sub || !payload.email) {
    throw ApiError.unauthorized('Google sign-in returned an incomplete profile');
  }
  // Only accept Google-verified addresses: otherwise an unverified Google
  // account could be used to claim an existing Chikbo account by email.
  if (!payload.email_verified) {
    throw ApiError.unauthorized('Your Google email address is not verified');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name?.trim() || payload.email.split('@')[0] || 'Chikbo customer',
    avatarUrl: payload.picture ?? null,
  };
}
