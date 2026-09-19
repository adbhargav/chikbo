/**
 * Uploaded media: images and videos.
 *
 * Storage is Cloudflare R2 (see lib/objectStorage). Images are normalised
 * first — EXIF orientation applied, scaled to fit MAX_EDGE, re-encoded as
 * WebP — so a 4 MB phone photo lands around 150–400 KB. Videos are stored as
 * uploaded. Without R2 credentials (local development) images fall back to
 * Postgres and video uploads are refused.
 *
 * Every file keeps the long-standing `/uploads/<name>` URL, served by
 * `serveUpload` below, unless R2_PUBLIC_URL points at a public bucket domain,
 * in which case uploads return absolute links there.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import type { NextFunction, Request, Response } from 'express';
import sharp, { type OutputInfo } from 'sharp';
import { prisma } from './prisma';
import { logger } from './logger';
import { ApiError } from '../middleware/error';
import { getObject, putObject, r2Configured, r2PublicBase, uploadKey } from './objectStorage';

/** Images committed to the repo (seeded catalogue, early uploads). Read-only at runtime. */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_EDGE = 2000;
const WEBP_QUALITY = 82;

export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
export const VIDEO_TYPES = new Map([
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov'],
]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export interface StoredMedia {
  url: string;
  size: number;
  kind: 'image' | 'video';
}

const newName = (ext: string) => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
const publicUrl = (filename: string) => (r2PublicBase ? `${r2PublicBase}/${uploadKey(filename)}` : `/uploads/${filename}`);

/** Normalises an image and stores it. Throws 400 for anything that is not a decodable image. */
export async function storeImage(input: Buffer): Promise<StoredMedia> {
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    logger.warn({ err }, 'Rejected an upload that could not be decoded as an image');
    throw ApiError.badRequest('That file could not be read as an image. Try a JPEG, PNG, WebP or AVIF.');
  }

  const filename = newName('.webp');
  if (r2Configured) {
    await putObject(uploadKey(filename), output.data, 'image/webp', output.info.size);
  } else {
    await prisma.storedImage.create({
      data: {
        filename,
        mimeType: 'image/webp',
        bytes: output.data,
        size: output.info.size,
        width: output.info.width ?? null,
        height: output.info.height ?? null,
      },
    });
  }
  return { url: publicUrl(filename), size: output.info.size, kind: 'image' };
}

/**
 * True when the first bytes look like the claimed video container, so a
 * renamed executable or document cannot be stored as a "video".
 */
function looksLikeVideo(head: Buffer, mime: string): boolean {
  if (mime === 'video/webm') return head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3;
  // MP4 and QuickTime: an ISO-BMFF box type at offset 4.
  const box = head.subarray(4, 8).toString('latin1');
  return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(box);
}

/** Stores a video file (already on local disk) as uploaded. */
export async function storeVideo(filePath: string, mime: string, size: number): Promise<StoredMedia> {
  const ext = VIDEO_TYPES.get(mime);
  if (!ext) throw ApiError.badRequest('Only MP4, WebM or MOV videos are allowed');
  if (!r2Configured) {
    throw ApiError.unprocessable('STORAGE_UNAVAILABLE', 'Video uploads need Cloudflare R2 storage to be configured.');
  }
  const handle = await fs.promises.open(filePath, 'r');
  const head = Buffer.alloc(16);
  try {
    await handle.read(head, 0, 16, 0);
  } finally {
    await handle.close();
  }
  if (!looksLikeVideo(head, mime)) throw ApiError.badRequest('That file could not be read as a video. Try an MP4, WebM or MOV.');

  const filename = newName(ext);
  await putObject(uploadKey(filename), fs.createReadStream(filePath), mime, size);
  return { url: publicUrl(filename), size, kind: 'video' };
}

// ------------------------------------------------------------------ serving

const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

/**
 * Serves `/uploads/<path>`: from R2 first, then images committed to the repo,
 * then images stored in Postgres before R2 was configured. Supports byte
 * ranges so videos can be scrubbed.
 */
export async function serveUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  let rel: string;
  try {
    rel = decodeURIComponent(req.path.replace(/^\/+/, ''));
  } catch {
    next();
    return;
  }
  if (!SAFE_PATH.test(rel) || rel.split('/').some((part) => part === '..' || part === '.')) {
    next();
    return;
  }
  // Names are unique and never reused, so the bytes behind a URL never change.
  const cacheHeader = 'public, max-age=31536000, immutable';

  try {
    if (r2Configured) {
      const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
      let object;
      try {
        object = await getObject(uploadKey(rel), range);
      } catch (err) {
        if ((err as { name?: string }).name === 'InvalidRange') {
          res.status(416).end();
          return;
        }
        throw err;
      }
      if (object) {
        res.status(object.contentRange ? 206 : 200);
        res.setHeader('Content-Type', object.contentType);
        res.setHeader('Cache-Control', cacheHeader);
        res.setHeader('Accept-Ranges', 'bytes');
        if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
        if (object.contentRange) res.setHeader('Content-Range', object.contentRange);
        if (object.etag) res.setHeader('ETag', object.etag);
        if (req.method === 'HEAD') {
          object.body.destroy();
          res.end();
          return;
        }
        await pipeline(object.body, res);
        return;
      }
    }

    const diskPath = path.join(UPLOADS_DIR, rel);
    if (diskPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      res.sendFile(diskPath, { maxAge: '30d', immutable: true });
      return;
    }

    if (!rel.includes('/')) {
      const image = await prisma.storedImage.findUnique({
        where: { filename: rel },
        select: { bytes: true, mimeType: true, size: true },
      });
      if (image) {
        res.setHeader('Cache-Control', cacheHeader);
        res.type(image.mimeType);
        res.setHeader('Content-Length', String(image.size));
        res.end(Buffer.from(image.bytes));
        return;
      }
    }
    next();
  } catch (err) {
    if (res.headersSent) {
      logger.warn({ err, path: rel }, 'Upload stream interrupted');
      res.destroy();
      return;
    }
    next(err);
  }
}
