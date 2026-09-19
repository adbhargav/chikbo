/**
 * Cloudflare R2 (S3-compatible) object storage.
 *
 * Every uploaded image and video lives in the R2 bucket under `uploads/…`,
 * so media survives API redeploys and is not tied to one server's disk.
 */
import type { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';

export const r2Configured = Boolean(env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);

/** Public base for the bucket, without a trailing slash; empty when the API serves media itself. */
export const r2PublicBase = env.R2_PUBLIC_URL.replace(/\/+$/, '');

let client: S3Client | null = null;
function s3(): S3Client {
  if (!r2Configured) throw new Error('R2 storage is not configured');
  client ??= new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  return client;
}

/** Object key for a path below /uploads, e.g. "products/a.jpg" → "uploads/products/a.jpg". */
export const uploadKey = (relativePath: string) => `uploads/${relativePath.replace(/^\/+/, '')}`;

export async function putObject(key: string, body: Buffer | Readable, contentType: string, contentLength?: number): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      // Names are unique and never reused, so the bytes behind a key never change.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

const isMissing = (err: unknown) =>
  err instanceof S3ServiceException && (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404);

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (isMissing(err)) return false;
    throw err;
  }
}

export interface StoredObject {
  body: Readable;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  etag?: string;
}

/** Fetches an object (optionally a byte range). Returns null when the key does not exist. */
export async function getObject(key: string, range?: string): Promise<StoredObject | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Range: range }));
    return {
      body: res.Body as Readable,
      contentType: res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      etag: res.ETag,
    };
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}
