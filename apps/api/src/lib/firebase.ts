/**
 * Shared firebase-admin app + Firebase Auth verification.
 *
 * One service account (FCM_SERVICE_ACCOUNT_JSON) powers both push
 * notifications and Firebase Authentication. Everything loads lazily so the
 * API runs fine with Firebase unconfigured — each consumer degrades
 * gracefully instead of failing at boot.
 *
 * Sign-in flow: the browser runs Firebase's Google popup and receives a
 * Firebase ID token (a JWT signed by Google for our Firebase project). Only
 * that token reaches the API; the signature, issuer, audience and expiry are
 * all verified against Google's public keys before any field is trusted.
 */
import { readFileSync } from 'node:fs';
import type { App } from 'firebase-admin/app';
import { env, firebaseAuthEnabled } from '../config/env';
import { ApiError } from '../middleware/error';
import { logger } from './logger';

let app: App | null = null;
let serviceAccount: Record<string, unknown> | null | undefined;

/**
 * The service account, read once. FCM_SERVICE_ACCOUNT_JSON is either a path
 * to the JSON file (local dev) or the JSON itself pasted into the env var
 * (hosts like Render, where an env value is easier than a secret file).
 * Never commit the JSON to the repo — it contains a private key.
 */
function getServiceAccount(): Record<string, unknown> | null {
  if (serviceAccount !== undefined) return serviceAccount;
  serviceAccount = null;
  const src = env.FCM_SERVICE_ACCOUNT_JSON.trim();
  if (src) {
    try {
      serviceAccount = JSON.parse(src.startsWith('{') ? src : readFileSync(src, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      logger.error({ err }, 'Failed to read Firebase service account');
    }
  }
  return serviceAccount;
}

/** The Firebase project id from the service account. */
export function getFirebaseProjectId(): string | null {
  const sa = getServiceAccount();
  return typeof sa?.project_id === 'string' ? sa.project_id : null;
}

export async function getFirebaseApp(): Promise<App | null> {
  if (app) return app;
  const sa = getServiceAccount();
  if (!sa) return null;
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    app = getApps()[0] ?? initializeApp({ credential: cert(sa as Parameters<typeof cert>[0]) });
    return app;
  } catch (err) {
    logger.error({ err }, 'Failed to initialise firebase-admin');
    return null;
  }
}

export interface FirebaseIdentity {
  /** Google's stable subject when the user signed in with Google, else a Firebase-uid marker. */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  if (!firebaseAuthEnabled) {
    throw ApiError.unprocessable('FIREBASE_AUTH_DISABLED', 'Firebase sign-in is not configured');
  }
  const adminApp = await getFirebaseApp();
  if (!adminApp) {
    throw ApiError.unprocessable('FIREBASE_AUTH_DISABLED', 'Firebase sign-in is not configured');
  }

  const { getAuth } = await import('firebase-admin/auth');
  let decoded;
  try {
    decoded = await getAuth(adminApp).verifyIdToken(idToken);
  } catch {
    throw ApiError.unauthorized('Google sign-in could not be verified');
  }

  if (!decoded.email) {
    throw ApiError.unauthorized('Google sign-in returned an incomplete profile');
  }
  // Only accept verified addresses: otherwise an unverified account could be
  // used to claim an existing Chikbo account by email.
  if (!decoded.email_verified) {
    throw ApiError.unauthorized('Your Google email address is not verified');
  }

  // Firebase surfaces the provider's own subject; for Google it is the same
  // value the previous direct-GIS flow stored, so existing links keep working.
  const googleSub = decoded.firebase?.identities?.['google.com']?.[0];

  return {
    googleId: googleSub ? String(googleSub) : `firebase:${decoded.uid}`,
    email: decoded.email.toLowerCase(),
    emailVerified: true,
    name: (typeof decoded.name === 'string' && decoded.name.trim()) || decoded.email.split('@')[0] || 'Chikbo customer',
    avatarUrl: typeof decoded.picture === 'string' ? decoded.picture : null,
  };
}
