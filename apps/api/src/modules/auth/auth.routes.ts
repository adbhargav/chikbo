import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../middleware/error';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import * as authService from './auth.service';
import { env, googleAuthEnabled, firebaseAuthEnabled } from '../../config/env';
import { getFirebaseProjectId } from '../../lib/firebase';

export const authRouter = Router();

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

authRouter.post(
  '/register',
  authLimiter,
  validate({
    body: z.object({
      email: z.string().email().max(255).transform((s) => s.toLowerCase().trim()),
      password: passwordSchema,
      name: z.string().min(2).max(100).transform((s) => s.trim()),
      phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await authService.register(req.body), 201)),
);

authRouter.post(
  '/login',
  authLimiter,
  validate({
    body: z.object({
      email: z.string().email().transform((s) => s.toLowerCase().trim()),
      password: z.string().min(1).max(128),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await authService.login(req.body))),
);

/**
 * Tells the clients whether to render the Google button — avoids a dead
 * button when nothing is configured — and hands the browser the (public)
 * config it needs so it isn't duplicated in frontend env files. `firebase`
 * (Google sign-in via Firebase Authentication) is preferred by the clients;
 * `google` is the legacy direct-GIS flow, kept for compatibility.
 */
authRouter.get('/providers', (_req, res) => {
  const projectId = firebaseAuthEnabled ? getFirebaseProjectId() : null;
  ok(res, {
    google: { enabled: googleAuthEnabled, clientId: env.GOOGLE_CLIENT_ID },
    firebase: projectId
      ? {
          enabled: true,
          apiKey: env.FIREBASE_WEB_API_KEY,
          authDomain: `${projectId}.firebaseapp.com`,
          projectId,
        }
      : { enabled: false },
  });
});

authRouter.post(
  '/google',
  authLimiter,
  validate({ body: z.object({ idToken: z.string().min(20).max(4096) }) }),
  asyncHandler(async (req, res) => ok(res, await authService.loginWithGoogle(req.body.idToken))),
);

authRouter.post(
  '/firebase',
  authLimiter,
  validate({ body: z.object({ idToken: z.string().min(20).max(4096) }) }),
  asyncHandler(async (req, res) => ok(res, await authService.loginWithFirebase(req.body.idToken))),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate({
    body: z.object({
      email: z.string().email().max(255).transform((s) => s.toLowerCase().trim()),
    }),
  }),
  asyncHandler(async (req, res) => {
    await authService.requestPasswordReset(req.body.email);
    // Always the same response, whether or not the address is registered.
    ok(res, { sent: true });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate({
    body: z.object({ token: z.string().min(20).max(256), newPassword: passwordSchema }),
  }),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    ok(res, { reset: true });
  }),
);

authRouter.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(20) }) }),
  asyncHandler(async (req, res) => ok(res, await authService.refresh(req.body.refreshToken))),
);

authRouter.post(
  '/logout',
  validate({ body: z.object({ refreshToken: z.string().min(20) }) }),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    ok(res, { loggedOut: true });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validate({
    body: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    await authService.changePassword(user.id, req.body.currentPassword, req.body.newPassword);
    ok(res, { changed: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    ok(res, user);
  }),
);
