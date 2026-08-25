/**
 * SEO configuration and small pure helpers.
 *
 * The canonical origin lives in one place: hardcoding a domain across the
 * codebase is how staging and localhost URLs end up in production canonicals.
 */
import { env } from '../../config/env';

/** Absolute, https, no trailing slash. */
export function siteOrigin(): string {
  const raw = (env.WEB_APP_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  return raw;
}

/**
 * Canonical URL for a path.
 *
 * Strips query strings and fragments — sort/filter/tracking parameters must
 * never appear in a canonical, or every variant becomes its own "page" and the
 * catalogue competes with itself.
 */
export function getCanonicalUrl(path: string): string {
  const cleanPath = `/${String(path).replace(/^\/+/, '').split(/[?#]/)[0] ?? ''}`.replace(/\/+$/, '');
  return `${siteOrigin()}${cleanPath === '' ? '/' : cleanPath}`;
}

/** Absolute URL for an image that may be stored server-relative. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Robots values we accept — anything else is rejected rather than emitted. */
export const ROBOTS_VALUES = [
  'index,follow',
  'noindex,follow',
  'index,nofollow',
  'noindex,nofollow',
] as const;
export type RobotsValue = (typeof ROBOTS_VALUES)[number];

export const isRobotsValue = (v: unknown): v is RobotsValue =>
  typeof v === 'string' && (ROBOTS_VALUES as readonly string[]).includes(v);

/**
 * Paths that must never be indexed. Checkout funnels and account areas have no
 * search value, and indexing them leaks order and profile pages into results.
 */
const NOINDEX_PREFIXES = [
  '/cart',
  '/checkout',
  '/order-success',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/account',
  '/search',
];

export function isNoindexPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Apply the admin's title template, e.g. "%title% | %siteName%". */
export function applyTitleTemplate(template: string, title: string, siteName: string): string {
  if (!template.includes('%title%')) return title;
  return template.replace(/%title%/g, title).replace(/%siteName%/g, siteName).trim();
}

/** Collapse whitespace and clip to a length without cutting mid-word. */
export function clampText(input: string, max: number): string {
  const text = input.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Strip any HTML so descriptions can never inject markup into <head>. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

/** URL-safe slug from a name. */
export function generateSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}
