/**
 * Media uploads: product photos, banners, category art, damage evidence, and
 * videos. Files land in a temp folder first (so large videos never sit in
 * memory), are validated, then stored in Cloudflare R2 by lib/mediaStore.
 */
import os from 'os';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ApiError, asyncHandler, ok } from '../../middleware/error';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { fetchRemoteImage } from '../../utils/safeFetchImage';
import { logger } from '../../lib/logger';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
  storeImage,
  storeVideo,
  type StoredMedia,
} from '../../lib/mediaStore';

const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_TYPES.has(file.mimetype) && !VIDEO_TYPES.has(file.mimetype)) {
      cb(ApiError.badRequest('Only JPEG, PNG, WebP or AVIF images, or MP4, WebM or MOV videos are allowed'));
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
    try {
      if (files.length === 0) throw ApiError.badRequest('No files uploaded');
      for (const file of files) {
        if (IMAGE_TYPES.has(file.mimetype) && file.size > MAX_IMAGE_BYTES) {
          throw ApiError.badRequest(`"${file.originalname}" is larger than 5 MB. Images must be 5 MB or smaller.`);
        }
      }
      const stored: StoredMedia[] = [];
      for (const file of files) {
        stored.push(
          IMAGE_TYPES.has(file.mimetype)
            ? await storeImage(await fs.promises.readFile(file.path))
            : await storeVideo(file.path, file.mimetype, file.size),
        );
      }
      ok(res, stored, 201);
    } finally {
      await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => undefined)));
    }
  }),
);

/**
 * Import an image from a URL. The file is downloaded and stored like any other
 * upload rather than hot-linked, so the catalogue keeps working when the
 * source goes away, changes, or blocks hot-linking.
 *
 * The fetch itself is SSRF-guarded — see utils/safeFetchImage.ts.
 */
uploadsRouter.post(
  '/from-url',
  requireAuth,
  validate({ body: z.object({ url: z.string().url().max(2048) }) }),
  asyncHandler(async (req, res) => {
    const { buffer } = await fetchRemoteImage(req.body.url);
    const image = await storeImage(buffer);
    logger.info({ source: req.body.url, url: image.url, bytes: image.size }, 'Image imported from URL');
    ok(res, { url: image.url, size: image.size }, 201);
  }),
);
