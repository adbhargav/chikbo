import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Permission, UserRole } from '@chikbo/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { ApiError } from './error';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
}

export interface AuthedRequest extends Request {
  user: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

async function resolveUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staffRole: true },
  });
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or deactivated');
  const permissions =
    user.role === 'SUPER_ADMIN'
      ? (undefined as never) // filled below — super admin gets all implicitly
      : ((user.staffRole?.permissions as Permission[] | undefined) ?? []);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    permissions: user.role === 'SUPER_ADMIN' ? (['*'] as unknown as Permission[]) : permissions,
  };
}

/** Requires a valid Bearer access token. */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    const token = header.slice('Bearer '.length);
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }
    (req as AuthedRequest).user = await resolveUser(payload.sub);
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Attaches `req.user` when a valid Bearer token is present, and otherwise
 * continues without one. Routes that serve guests and members alike (cart,
 * checkout, payments) use this together with the guest token header.
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next();
      return;
    }
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(header.slice('Bearer '.length), env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      // An expired token on a guest-capable route must not fail the request;
      // the client refreshes and retries on its own schedule.
      next();
      return;
    }
    try {
      (req as AuthedRequest).user = await resolveUser(payload.sub);
    } catch {
      // Deactivated or deleted account: treat as signed out.
    }
    next();
  } catch (e) {
    next(e);
  }
};

/** Requires STAFF or SUPER_ADMIN. Use after requireAuth. */
export const requireStaff = (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as AuthedRequest).user;
  if (!user || (user.role !== 'STAFF' && user.role !== 'SUPER_ADMIN')) {
    next(ApiError.forbidden());
    return;
  }
  next();
};

/** Requires a specific RBAC permission (SUPER_ADMIN passes implicitly). */
export const requirePermission =
  (permission: Permission) => (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      next(ApiError.unauthorized());
      return;
    }
    if (user.role === 'SUPER_ADMIN' || user.permissions.includes(permission)) {
      next();
      return;
    }
    next(ApiError.forbidden(`Missing permission: ${permission}`));
  };
