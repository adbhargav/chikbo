import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/error';
import { signAccessToken } from '../../middleware/auth';
import { sha256Hex } from '../../utils/signatures';
import { verifyGoogleIdToken } from '../../lib/google';
import { verifyFirebaseIdToken } from '../../lib/firebase';
import { sendEmail } from '../../lib/notify';
import { welcomeEmail } from '../../lib/emails';
import { logger } from '../../lib/logger';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
}

const toPublicUser = (u: { id: string; email: string; name: string; phone: string | null; role: string }): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  role: u.role,
});

async function issueTokens(user: { id: string; role: string }): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role as never });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256Hex(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

export async function register(input: { email: string; password: string; name: string; phone?: string }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
  });
  if (existing) throw ApiError.conflict('An account with this email or phone already exists');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      passwordHash: await bcrypt.hash(input.password, 12),
    },
  });
  const tokens = await issueTokens(user);
  // Fire-and-forget: a slow mail server must never delay signup.
  const welcome = welcomeEmail(user.name);
  void sendEmail(user.email, welcome.subject, welcome.html);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // An account created through Google has no local password.
  if (user && !user.passwordHash) {
    throw ApiError.unprocessable(
      'USE_GOOGLE_SIGNIN',
      'This account was created with Google. Continue with Google, or use "Forgot password" to set a password.',
    );
  }

  // Hash compare even when the user is missing, to keep timing uniform.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const valid = await bcrypt.compare(input.password, hash);
  if (!user || !valid || !user.isActive) throw ApiError.unauthorized('Invalid email or password');
  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const tokenHash = sha256Hex(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  // Rotate: revoke old token, issue a new pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokens(stored.user);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256Hex(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    throw ApiError.unprocessable(
      'NO_PASSWORD_SET',
      'This account signs in with Google. Use "Forgot password" to set a password first.',
    );
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
    // Sign out everywhere on password change.
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

/**
 * Google Sign-In. The ID token is verified against Google's public keys before
 * anything is trusted, then one of three things happens:
 *
 *  1. Known googleId  -> sign in.
 *  2. Known email     -> link Google to that existing account and sign in.
 *     (Safe because we only accept Google-verified email addresses.)
 *  3. Neither         -> create a new CUSTOMER account with no password.
 *
 * Roles are never granted here: a Google login can only ever create a
 * CUSTOMER. Staff and admin accounts must be created deliberately in the
 * admin, so signing in with Google can never escalate privileges.
 */
export async function loginWithGoogle(idToken: string) {
  return signInWithGoogleIdentity(await verifyGoogleIdToken(idToken));
}

/**
 * Google sign-in via Firebase Authentication — same trust and linking rules
 * as loginWithGoogle, only the token verifier differs (Firebase surfaces
 * Google's own subject id, so accounts linked by either flow stay linked).
 */
export async function loginWithFirebase(idToken: string) {
  return signInWithGoogleIdentity(await verifyFirebaseIdToken(idToken));
}

async function signInWithGoogleIdentity(identity: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  let user = await prisma.user.findUnique({ where: { googleId: identity.googleId } });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
    user = byEmail
      ? await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: identity.googleId,
            emailVerified: true,
            avatarUrl: byEmail.avatarUrl ?? identity.avatarUrl,
          },
        })
      : await prisma.user.create({
          data: {
            email: identity.email,
            name: identity.name,
            googleId: identity.googleId,
            avatarUrl: identity.avatarUrl,
            emailVerified: true,
            passwordHash: null,
            role: 'CUSTOMER',
          },
        });
  }

  if (!user.isActive) throw ApiError.unauthorized('This account has been deactivated');

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

/** How long a password-reset link stays valid. */
const RESET_TTL_MINUTES = 60;

/**
 * Starts a password reset. Always resolves the same way whether or not the
 * address exists — revealing which emails are registered would let anyone
 * enumerate the customer list.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  // Invalidate any outstanding links, then issue exactly one.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: sha256Hex(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  const link = `${env.WEB_APP_URL.replace(/\/+$/, '')}/reset-password?token=${token}`;
  logger.info({ userId: user.id }, 'Password reset requested');

  await sendEmail(
    user.email,
    'Reset your Chikbo password',
    `<div style="font-family:Helvetica,Arial,sans-serif;color:#3d3833;line-height:1.6">
       <h2 style="color:#1a1714;margin-bottom:4px">Reset your password</h2>
       <p style="color:#6e675f;margin-top:0">Chikbo — trust, quality and budget friendly since 1992</p>
       <p>Hello ${user.name}, we received a request to reset your Chikbo password.</p>
       <p style="margin:28px 0">
         <a href="${link}" style="background:#ea7a12;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;display:inline-block;font-weight:600">Choose a new password</a>
       </p>
       <p>This link expires in ${RESET_TTL_MINUTES} minutes and can be used once.</p>
       <p style="color:#6e675f">If you didn't ask for this, you can safely ignore this email — your password stays unchanged.</p>
     </div>`,
  );
}

/**
 * Completes a password reset: consumes the single-use token, sets the new
 * password and signs the account out everywhere (any session an attacker may
 * hold is killed along with the user's own).
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  logger.info({ userId: record.userId }, 'Password reset completed');
}
