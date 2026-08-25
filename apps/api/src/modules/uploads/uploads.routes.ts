/**
 * Image uploads (product photos, damage evidence). Stores on local disk under
 * /uploads and serves statically; swap the storage engine for S3/Cloudinary
 * in production by replacing `storage` only.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { fetchRemoteImage } from '../../utils/safeFetchImage';
import { logger } from '../../lib/logger';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
]);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) ?? '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(ApiError.badRequest('Only JPEG, PNG, WebP or AVIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  requireAuth,
  upload.array('files', 6),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw ApiError.badRequest('No files uploaded');
    ok(
      res,
      files.map((f) => ({ url: `/uploads/${f.filename}`, size: f.size })),
      201,
    );
  }),
);

/**
 * Import an image from a URL. The file is downloaded and re-hosted under
 * /uploads rather than hot-linked, so the catalogue keeps working when the
 * source goes away, changes, or blocks hot-linking.
 *
 * The fetch itself is SSRF-guarded — see utils/safeFetchImage.ts.
 */
uploadsRouter.post(
  '/from-url',
  requireAuth,
  validate({ body: z.object({ url: z.string().url().max(2048) }) }),
  asyncHandler(async (req, res) => {
    const { buffer, extension } = await fetchRemoteImage(req.body.url);
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), buffer);
    logger.info({ source: req.body.url, filename, bytes: buffer.byteLength }, 'Image imported from URL');
    ok(res, { url: `/uploads/${filename}`, size: buffer.byteLength }, 201);
  }),
);
