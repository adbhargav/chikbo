import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),

  /** Public URL of the storefront — used to build password-reset links. */
  WEB_APP_URL: z.string().default('http://localhost:5173'),

  /** Google Sign-In: OAuth 2.0 Web client ID — also the audience ID tokens are verified against. */
  GOOGLE_CLIENT_ID: z.string().default(''),

  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

  SHIPROCKET_EMAIL: z.string().default(''),
  SHIPROCKET_PASSWORD: z.string().default(''),
  SHIPROCKET_PICKUP_LOCATION: z.string().default('Primary'),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().default(''),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('Chikbo <no-reply@chikbo.in>'),

  WHATSAPP_API_URL: z.string().default(''),
  WHATSAPP_API_KEY: z.string().default(''),

  FCM_SERVICE_ACCOUNT_JSON: z.string().default(''),

  // Cloudflare R2 (S3-compatible) object storage for uploaded images and
  // videos. When the four required values are set every upload goes to R2;
  // otherwise images fall back to Postgres and video uploads are refused.
  R2_ENDPOINT: z.string().default(''), // https://<account-id>.r2.cloudflarestorage.com
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  // Optional public base URL for the bucket (r2.dev or a custom domain). When
  // set, uploads return absolute links there; otherwise the API serves them
  // at /uploads/... straight from R2.
  R2_PUBLIC_URL: z.string().default(''),

  // Single-server (VPS) hosting: when set, this process also serves the built
  // storefront (with SEO head tags per page) and the admin console, so one
  // domain carries everything. Leave blank when the frontends are hosted
  // elsewhere or during development.
  WEB_DIST_DIR: z.string().default(''), // e.g. /var/www/chikbo/apps/web/dist
  ADMIN_DIST_DIR: z.string().default(''), // e.g. /var/www/chikbo/apps/admin/dist/admin

  /**
   * Firebase Authentication (Google sign-in via Firebase). Server-side
   * verification uses the FCM service account above; this public Web API Key
   * (Firebase console → Project settings → General) is what the browser SDK
   * needs. Both must be present for the sign-in button to go live.
   */
  FIREBASE_WEB_API_KEY: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const googleAuthEnabled = Boolean(parsed.data.GOOGLE_CLIENT_ID);
export const firebaseAuthEnabled = Boolean(
  parsed.data.FCM_SERVICE_ACCOUNT_JSON && parsed.data.FIREBASE_WEB_API_KEY,
);
/** Deployed frontends, always allowed regardless of env configuration. */
const PRODUCTION_ORIGINS = [
  'https://chikbo-web.vercel.app', // storefront
  'https://chikbo-admin-seven.vercel.app', // admin panel
];

/**
 * Allowed browser origins. WEB_APP_URL and the known production frontends are
 * always included — the sites must be able to call their own API even if
 * CORS_ORIGINS forgets them — and trailing slashes are stripped so
 * `https://site.app/` matches the Origin header (which never carries one).
 */
export const corsOrigins = [
  ...new Set(
    [...env.CORS_ORIGINS.split(','), env.WEB_APP_URL, ...PRODUCTION_ORIGINS]
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  ),
];
