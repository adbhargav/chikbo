/**
 * SEO primitives for the storefront.
 *
 * Chikbo is a Vite + React SPA, so everything here is the *client-side* layer:
 * it keeps the head correct during in-app navigation and puts JSON-LD in the
 * served DOM for Googlebot (which renders JS). Social crawlers never run JS —
 * they are served the same tags by the head-injection middleware in the API
 * (docs/seo-plan.md §2). Both layers read from the same rules below, so the
 * rendered head and the injected head agree.
 */

export const SITE_NAME = 'Chikbo';
export const DEFAULT_TITLE = 'Chikbo — Woven with trust since 1992';
export const DEFAULT_DESCRIPTION =
  'Chikbo — premium sarees, dresses, tops, bottomwear and antique imitation jewellery. Dealing in textiles since 1992.';
/** Site-wide social card image. Ships in `public/`, so it is always present. */
export const DEFAULT_OG_IMAGE = '/images/editorial/hero.jpg';
export const LOGO_PATH = '/brand/chikbo-logo.png';

const RAW_SITE_URL = (import.meta.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Canonical origin for the storefront. `VITE_SITE_URL` wins so that preview
 * deploys and the dev server still emit production canonicals when configured;
 * otherwise we fall back to wherever the page is actually being served from.
 */
export function siteOrigin(): string {
  if (RAW_SITE_URL) return RAW_SITE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Absolute URL for a site-relative path. Already-absolute URLs pass through. */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Canonical URL for a route. Path only — query strings and hashes are dropped
 * so `?sort=`, `?page=` and tracking params can never split a page's equity
 * across duplicate URLs.
 */
export function canonicalFor(pathname: string): string {
  const origin = siteOrigin();
  const bare = (pathname.split('?')[0] ?? '/').split('#')[0] ?? '/';
  const path = bare.startsWith('/') ? bare : `/${bare}`;
  const trimmed = path === '/' ? '/' : path.replace(/\/+$/, '') || '/';
  return `${origin}${trimmed}`;
}

/**
 * Routes that must never be indexed: transactional funnels, authentication and
 * anything personal or infinitely-parameterised. `follow` is kept so link
 * equity still flows through to the catalogue.
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

export function robotsFor(pathname: string): string {
  const bare = (pathname.split('?')[0] ?? '/').split('#')[0] ?? '/';
  const path = (bare.replace(/\/+$/, '') || '/').toLowerCase();
  const blocked = NOINDEX_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  return blocked ? 'noindex,follow' : 'index,follow';
}

/* ----------------------------------------------------------------- Image */

/**
 * `fetchpriority` as a spreadable attribute object.
 *
 * React 18's DOM does not know the camelCase `fetchPriority` prop — it warns
 * and falls back to writing the lowercase attribute anyway. Writing the
 * lowercase attribute directly gets the same HTML without the console noise.
 * (React 19 supports `fetchPriority`; this helper can go then.)
 */
export function fetchPriorityAttr(
  priority?: 'high' | 'low' | 'auto',
): Record<string, string> {
  return priority ? { fetchpriority: priority } : {};
}

/* ------------------------------------------------------------------ Text */

/** Collapse whitespace and clip to `max` characters on a word boundary. */
export function clampText(text: string | null | undefined, max = 155): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Drop null/undefined/empty entries so JSON-LD never carries empty fields. */
export function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/* --------------------------------------------------------- JSON-LD models */

const SCHEMA = 'https://schema.org';

export function organizationSchema(): Record<string, unknown> {
  const origin = siteOrigin();
  return compact({
    '@context': SCHEMA,
    '@type': 'Organization',
    name: SITE_NAME,
    url: origin || undefined,
    logo: absoluteUrl(LOGO_PATH) ?? undefined,
    description: DEFAULT_DESCRIPTION,
    foundingDate: '1992',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '21-1-684 & 85, Rikab Gunj',
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-93460-60635',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi', 'te'],
    },
  });
}

export function webSiteSchema(): Record<string, unknown> {
  const origin = siteOrigin();
  return compact({
    '@context': SCHEMA,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin || undefined,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: SITE_NAME },
    // Points at the real storefront search route (`/search?q=`).
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

export interface BreadcrumbEntry {
  name: string;
  url?: string | null;
}

/**
 * BreadcrumbList built from the *same* array the visible trail renders from —
 * see `Breadcrumbs` in components/ui.tsx. They cannot drift apart.
 */
export function breadcrumbSchema(entries: BreadcrumbEntry[]): Record<string, unknown> {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, i) =>
      compact({
        '@type': 'ListItem',
        position: i + 1,
        name: entry.name,
        item: entry.url ?? undefined,
      }),
    ),
  };
}

export interface ProductSchemaInput {
  name: string;
  description: string;
  /** Absolute image URLs, ordered. */
  images: string[];
  sku: string | null;
  url: string;
  /** Selling price in paise. */
  priceInPaise: number;
  /** True only when real stock is available. */
  inStock: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  category?: string | null;
}

export function productSchema(input: ProductSchemaInput): Record<string, unknown> {
  const hasRating = input.ratingCount > 0 && input.ratingAvg !== null;
  return compact({
    '@context': SCHEMA,
    '@type': 'Product',
    name: input.name,
    description: clampText(input.description, 500),
    image: input.images,
    sku: input.sku ?? undefined,
    category: input.category ?? undefined,
    brand: { '@type': 'Brand', name: SITE_NAME },
    // Only ever emitted when real reviews exist — never invented.
    aggregateRating: hasRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(input.ratingAvg).toFixed(1),
          reviewCount: input.ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    offers: {
      '@type': 'Offer',
      url: input.url,
      priceCurrency: 'INR',
      price: (input.priceInPaise / 100).toFixed(2),
      itemCondition: `${SCHEMA}/NewCondition`,
      // Mirrors real variant stock, not a wishful default.
      availability: input.inStock ? `${SCHEMA}/InStock` : `${SCHEMA}/OutOfStock`,
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  });
}

export interface CollectionSchemaInput {
  name: string;
  description: string;
  url: string;
  /** Absolute URLs of the sub-collections linked on the page. */
  subCollections?: { name: string; url: string }[];
}

export function collectionPageSchema(input: CollectionSchemaInput): Record<string, unknown> {
  const subs = input.subCollections ?? [];
  return compact({
    '@context': SCHEMA,
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: siteOrigin() || undefined },
    hasPart: subs.map((sub) => ({
      '@type': 'CollectionPage',
      name: sub.name,
      url: sub.url,
    })),
  });
}
