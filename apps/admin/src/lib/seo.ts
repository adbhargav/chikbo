/**
 * SEO types, shared queries and the resolver mirror.
 *
 * The preview panels are only worth anything if they show what the server will
 * actually emit, so the fallback chain below is a deliberate port of
 * apps/api/src/modules/seo/seo.service.ts + seo.config.ts. Anything that
 * changes there has to change here too — the alternative (a preview that
 * guesses) is worse than no preview at all.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// --- API shapes ------------------------------------------------------------

export const ROBOTS_VALUES = ['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'] as const;
export type RobotsValue = (typeof ROBOTS_VALUES)[number];

export const ROBOTS_LABELS: Record<RobotsValue, string> = {
  'index,follow': 'Index, follow — normal',
  'noindex,follow': 'No index, follow links',
  'index,nofollow': 'Index, don’t follow links',
  'noindex,nofollow': 'No index, no follow',
};

export type TwitterCardType = 'summary' | 'summary_large_image';

export interface SeoSettings {
  id: string;
  siteName: string;
  defaultTitle: string | null;
  titleTemplate: string;
  defaultDescription: string | null;
  defaultRobots: string;
  homeTitle: string | null;
  homeDescription: string | null;
  homeOgImage: string | null;
  defaultOgImage: string | null;
  defaultTwitterImage: string | null;
  twitterCardType: string;
  twitterSite: string | null;
  facebookAppId: string | null;
  organizationName: string | null;
  organizationLogo: string | null;
  organizationDescription: string | null;
  organizationPhone: string | null;
  organizationEmail: string | null;
  organizationAddress: string | null;
  organizationSocials: string[] | null;
  googleSiteVerification: string | null;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  updatedAt: string;
}

export interface SeoCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  weight: number;
}

export interface SeoAuditCounts {
  totalProducts: number;
  missingTitle: number;
  missingDescription: number;
  totalCategories: number;
  catMissingTitle: number;
  catMissingDescription: number;
  totalImages: number;
  imagesMissingAlt: number;
  noindexProducts: number;
  redirects: number;
}

export interface SeoAudit {
  score: number;
  checks: SeoCheck[];
  counts: SeoAuditCounts;
  sitemapUrl: string;
  robotsUrl: string;
}

export type RedirectOrigin = 'MANUAL' | 'SLUG_CHANGE' | string;

export interface SeoRedirect {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  origin: RedirectOrigin;
  hits: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BulkTarget = 'productSlugs' | 'imageAlt' | 'productTitles' | 'productDescriptions';

// --- Resolver mirror -------------------------------------------------------

/** Settings used before the real row arrives, so a preview never renders blank. */
export const FALLBACK_SETTINGS: Pick<
  SeoSettings,
  'siteName' | 'titleTemplate' | 'defaultDescription' | 'defaultRobots' | 'defaultOgImage' | 'organizationDescription'
> = {
  siteName: 'Chikbo',
  titleTemplate: '%title% | %siteName%',
  defaultDescription: null,
  defaultRobots: 'index,follow',
  defaultOgImage: null,
  organizationDescription: null,
};

const firstNonEmpty = (...values: (string | null | undefined)[]): string | undefined =>
  values.map((v) => v?.trim()).find((v) => v && v.length > 0) ?? undefined;

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

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

export const isRobotsValue = (v: unknown): v is RobotsValue =>
  typeof v === 'string' && (ROBOTS_VALUES as readonly string[]).includes(v);

/** Absolute URL for an image that may be stored server-relative. */
export function absoluteSiteUrl(origin: string, url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!origin) return url;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Canonical URL for a path — query and fragment stripped, as the server does. */
export function canonicalFor(origin: string, path: string): string {
  const cleanPath = `/${String(path).replace(/^\/+/, '').split(/[?#]/)[0] ?? ''}`.replace(/\/+$/, '');
  return `${origin}${cleanPath === '' ? '/' : cleanPath}`;
}

/** The editable SEO field set. Category rows leave the twitter keys unused. */
export interface SeoValues {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  metaRobots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  imageAlt: string;
}

export const emptySeoValues = (): SeoValues => ({
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  canonicalUrl: '',
  metaRobots: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  imageAlt: '',
});

/** Read the SEO columns off a product/category row into editable strings. */
export function seoValuesFrom(row: Partial<Record<keyof SeoValues, string | null>>): SeoValues {
  const base = emptySeoValues();
  for (const key of Object.keys(base) as (keyof SeoValues)[]) base[key] = row[key] ?? '';
  return base;
}

/** Blank strings must clear the column, not store "". */
const orNull = (v: string) => {
  const t = v.trim();
  return t === '' ? null : t;
};

/** Product payload for PATCH /admin/products/:id. */
export function productSeoPayload(v: SeoValues): Record<string, string | null> {
  return {
    seoTitle: orNull(v.seoTitle),
    seoDescription: orNull(v.seoDescription),
    seoKeywords: orNull(v.seoKeywords),
    canonicalUrl: orNull(v.canonicalUrl),
    metaRobots: orNull(v.metaRobots),
    ogTitle: orNull(v.ogTitle),
    ogDescription: orNull(v.ogDescription),
    ogImage: orNull(v.ogImage),
    twitterTitle: orNull(v.twitterTitle),
    twitterDescription: orNull(v.twitterDescription),
    twitterImage: orNull(v.twitterImage),
  };
}

/** Category payload for PATCH /admin/categories/:id (no twitter fields). */
export function categorySeoPayload(v: SeoValues): Record<string, string | null> {
  return {
    seoTitle: orNull(v.seoTitle),
    seoDescription: orNull(v.seoDescription),
    seoKeywords: orNull(v.seoKeywords),
    canonicalUrl: orNull(v.canonicalUrl),
    metaRobots: orNull(v.metaRobots),
    ogTitle: orNull(v.ogTitle),
    ogDescription: orNull(v.ogDescription),
    ogImage: orNull(v.ogImage),
    imageAlt: orNull(v.imageAlt),
  };
}

/** What the crawler will actually receive, once every fallback has applied. */
export interface ResolvedSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  /** Absolute URL as the server will emit it — points at the storefront origin. */
  ogImage: string | null;
  /**
   * The same image as stored (usually "/uploads/..."). Rendered in the preview
   * instead of the absolute form so the card still shows the picture when the
   * storefront happens to be down — the admin can always serve its own uploads.
   */
  ogImageRaw: string | null;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string | null;
  /** Whether each of these came from an admin value rather than a fallback. */
  titleIsFallback: boolean;
  descriptionIsFallback: boolean;
}

export interface SeoSubject {
  kind: 'product' | 'category';
  name: string;
  slug: string;
  /** Product long copy, or "" for a category (it has none). */
  description: string;
  /** First gallery image / category image, used as the social image fallback. */
  imageUrl: string | null;
}

/**
 * Port of resolveProductSeo / resolveCategorySeo. Deliberately mirrors their
 * quirks: a product's own seoDescription is emitted verbatim while a category's
 * is clamped to 158 characters either way.
 */
export function resolveSeo(
  subject: SeoSubject,
  values: SeoValues,
  settings: SeoSettings | undefined,
  origin: string,
): ResolvedSeo {
  const s = settings ?? (FALLBACK_SETTINGS as SeoSettings);
  const siteName = s.siteName || 'Chikbo';
  const path = `${subject.kind === 'product' ? '/p/' : '/c/'}${subject.slug}`;
  const templated = applyTitleTemplate(s.titleTemplate || '%title% | %siteName%', subject.name, siteName);

  const ownTitle = firstNonEmpty(values.seoTitle);
  const title = ownTitle ?? templated;

  let description: string;
  let descriptionIsFallback: boolean;
  if (subject.kind === 'product') {
    const own = firstNonEmpty(values.seoDescription);
    const fromCopy = subject.description.trim() ? clampText(stripHtml(subject.description), 158) : undefined;
    description = own ?? fromCopy ?? s.defaultDescription ?? '';
    descriptionIsFallback = own === undefined;
  } else {
    const own = firstNonEmpty(values.seoDescription);
    const generated =
      `Shop ${subject.name.toLowerCase()} at ${siteName}. ${s.organizationDescription ?? ''} Free delivery over ₹999, shipped pan-India.`.trim();
    description = clampText(own ?? generated, 158);
    descriptionIsFallback = own === undefined;
  }

  const imageRaw =
    firstNonEmpty(values.ogImage) ?? firstNonEmpty(subject.imageUrl) ?? firstNonEmpty(s.defaultOgImage) ?? null;
  const image = absoluteSiteUrl(origin, imageRaw);

  const robots = isRobotsValue(values.metaRobots.trim())
    ? values.metaRobots.trim()
    : s.defaultRobots || 'index,follow';

  const ogTitle = firstNonEmpty(values.ogTitle) ?? title;
  const ogDescription = firstNonEmpty(values.ogDescription) ?? description;

  // Categories have no twitter columns; the server mirrors the OG values there.
  const twitterTitle =
    subject.kind === 'product' ? (firstNonEmpty(values.twitterTitle) ?? title) : title;
  const twitterDescription =
    subject.kind === 'product' ? (firstNonEmpty(values.twitterDescription) ?? description) : description;
  const twitterImage =
    subject.kind === 'product'
      ? (absoluteSiteUrl(origin, firstNonEmpty(values.twitterImage)) ?? image)
      : image;

  return {
    title,
    description,
    canonical: firstNonEmpty(values.canonicalUrl) ?? canonicalFor(origin, path),
    robots,
    ogTitle,
    ogDescription,
    ogImage: image,
    ogImageRaw: imageRaw,
    twitterTitle,
    twitterDescription,
    twitterImage,
    titleIsFallback: ownTitle === undefined,
    descriptionIsFallback,
  };
}

// --- Character guidance ----------------------------------------------------

export type LengthTone = 'empty' | 'short' | 'good' | 'long';

export interface LengthAdvice {
  tone: LengthTone;
  message: string;
}

/**
 * Advisory only. Nothing here blocks a save or trims what was typed — Google
 * truncates by pixel width anyway, so these ranges are guidance, not rules.
 */
export function adviseLength(length: number, min: number, max: number, kind: 'title' | 'description'): LengthAdvice {
  if (length === 0) return { tone: 'empty', message: 'Using the fallback below' };
  if (length < min) return { tone: 'short', message: `A little short — aim for ${min}–${max}` };
  if (length > max) {
    return {
      tone: 'long',
      message: kind === 'title' ? 'May be trimmed in results' : 'May be trimmed in the snippet',
    };
  }
  return { tone: 'good', message: 'Good length' };
}

export const TITLE_RANGE = { min: 50, max: 60 } as const;
export const DESCRIPTION_RANGE = { min: 140, max: 160 } as const;

// --- Shared queries --------------------------------------------------------

export function useSeoSettings(enabled = true) {
  return useQuery({
    queryKey: ['seo-settings'],
    queryFn: () => api<SeoSettings>('/admin/seo/settings'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSeoAudit(enabled = true) {
  return useQuery({
    queryKey: ['seo-audit'],
    queryFn: () => api<SeoAudit>('/admin/seo/audit'),
    enabled,
    staleTime: 60_000,
    // A 403 (no dashboard.view) or a failing audit is not worth three attempts;
    // the error states offer an explicit retry instead.
    retry: false,
  });
}

/**
 * Storefront origin. It is not on the settings row, and the audit is the only
 * endpoint that reports it (as the sitemap URL) — so the product and category
 * editors share the dashboard's cached audit rather than issuing their own
 * call. Empty until known, in which case the previews show the path alone
 * rather than inventing a hostname.
 */
export function useSiteOrigin(enabled = true): string {
  const sitemap = useSeoAudit(enabled).data?.sitemapUrl;
  if (!sitemap) return '';
  try {
    return new URL(sitemap).origin;
  } catch {
    return '';
  }
}

/** "chikbo.in › p › blush-saree" — Google's breadcrumb rendering of a URL. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return [parsed.host, ...segments].join(' › ');
  } catch {
    return url.split('/').filter(Boolean).join(' › ') || url;
  }
}
