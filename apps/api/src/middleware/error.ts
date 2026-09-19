import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';
import { MulterError } from 'multer';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new ApiError(422, code, message, details);
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large. Images must be 5 MB or smaller and videos 100 MB or smaller.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Upload up to 6 files at a time.'
          : 'The upload could not be read. Please try again.';
    res.status(400).json({ success: false, error: { code: 'UPLOAD_REJECTED', message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        // flatten() only keeps the top-level key ("variants"); issues carry the
        // full path so a client can say which row and field was rejected.
        details: { ...err.flatten(), issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with this value already exists' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return;
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Something went wrong' : err instanceof Error ? err.message : 'Unknown error',
    },
  });
}

/** Wrap async route handlers so rejections reach the error handler. */
export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

export const ok = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data });
