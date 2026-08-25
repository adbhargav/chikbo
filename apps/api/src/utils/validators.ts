import { z } from 'zod';

/**
 * A reference to an image we will render.
 *
 * Accepts either an absolute http(s) URL or a server-relative path served by
 * this API (`/uploads/...`). Plain `z.string().url()` rejects the second form,
 * which silently breaks every image that was uploaded rather than linked.
 */
export const imageRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith('/'), {
    message: 'Must be an uploaded image path (/uploads/…) or an absolute http(s) URL',
  });
