/**
 * SEO resolver.
 *
 * Single source of truth for the metadata of any public page. Admin overrides
 * win; anything left empty falls back to the entity's own content and finally
 * to global settings — resolved at request time and never written back, so an
 * admin can always take control later without a migration.
 */
import type { SeoSettings } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  absoluteUrl,
  applyTitleTemplate,
  clampText,
  getCanonicalUrl,
  isNoindexPath,
  isRobotsValue,
  stripHtml,
} from './seo.config';

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  ogType: 'website' | 'product';
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string | null;
  /** JSON-LD graph objects rendered into the page. */
  jsonLd: Record<string, unknown>[];
}

const SETTINGS_ID = 'default';

/** Global settings, created on first read so the admin always has a row. */
export async function getSeoSettings(): Promise<SeoSettings> {
  const existing = await prisma.seoSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.seoSettings.create({
    data: {
      id: SETTINGS_ID,
      siteName: 'Chikbo',
      defaultTitle: 'Chikbo — Woven with trust since 1992',
      defaultDescription:
        'Premium sarees, dresses, tops, bottomwear and antique imitation jewellery. Dealing in textiles since 1992. Free delivery over ₹999, shipped pan-India.',
      organizationName: 'Chikbo',
      organizationDescription: 'Dealing in textiles since 1992. Trusted top quality clothing.',
      organizationPhone: '+919346060635',
      organizationAddress: '21-1-684 & 85, Rikab Gunj, Hyderabad, Telangana, India',
    },
  });
}

const firstNonEmpty = (...values: (string | null | undefined)[]): string | undefined =>
  values.map((v) => v?.trim()).find((v) => v && v.length > 0) ?? undefined;

/** Organization JSON-LD — emitted only for fields that actually have values. */
export function organizationSchema(s: SeoSettings): Record<string, unknown> {
  const socials = Array.isArray(s.organizationSocials) ? (s.organizationSocials as string[]) : [];
  return {
    '@type': 'Organization',
    '@id': `${getCanonicalUrl('/')}#organization`,
    name: s.organizationName || s.siteName,
    url: getCanonicalUrl('/'),
    ...(absoluteUrl(s.organizationLogo) ? { logo: absoluteUrl(s.organizationLogo) } : {}),
    ...(s.organizationDescription ? { description: s.organizationDescription } : {}),
    ...(s.organizationPhone ? { telephone: s.organizationPhone } : {}),
    ...(s.organizationEmail ? { email: s.organizationEmail } : {}),
    ...(s.organizationAddress
      ? { address: { '@type': 'PostalAddress', streetAddress: s.organizationAddress } }
      : {}),
    ...(socials.length > 0 ? { sameAs: socials } : {}),
  };
}

/**
 * WebSite JSON-LD. SearchAction is included because /search?q= is a real,
 * working page — declaring one that does not resolve is a spam signal.
 */
export function websiteSchema(s: SeoSettings): Record<string, unknown> {
  const origin = getCanonicalUrl('/');
  return {
    '@type': 'WebSite',
    '@id': `${origin}#website`,
    name: s.siteName,
    url: origin,
    publisher: { '@id': `${origin}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: getCanonicalUrl(crumb.path),
    })),
  };
}

function baseSeo(s: SeoSettings, path: string): Omit<PageSeo, 'jsonLd'> {
  const title = s.defaultTitle || s.siteName;
  const description = s.defaultDescription ?? '';
  const ogImage = absoluteUrl(s.defaultOgImage);
  return {
    title,
    description,
    canonical: getCanonicalUrl(path),
    robots: isNoindexPath(path) ? 'noindex,follow' : s.defaultRobots,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogType: 'website',
    twitterCard: s.twitterCardType,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: absoluteUrl(s.defaultTwitterImage) ?? ogImage,
  };
}

export async function resolveHomeSeo(): Promise<PageSeo> {
  const s = await getSeoSettings();
  const base = baseSeo(s, '/');
  const title = firstNonEmpty(s.homeTitle, s.defaultTitle, s.siteName)!;
  const description = firstNonEmpty(s.homeDescription, s.defaultDescription) ?? '';
  const ogImage = absoluteUrl(s.homeOgImage) ?? base.ogImage;
  return {
    ...base,
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
    jsonLd: [organizationSchema(s), websiteSchema(s)],
  };
}

/** Static/unknown SPA route: global defaults plus the correct robots rule. */
export async function resolveGenericSeo(path: string, title?: string): Promise<PageSeo> {
  const s = await getSeoSettings();
  const base = baseSeo(s, path);
  if (!title) return { ...base, jsonLd: [organizationSchema(s), websiteSchema(s)] };
  const full = applyTitleTemplate(s.titleTemplate, title, s.siteName);
  return {
    ...base,
    title: full,
    ogTitle: full,
    twitterTitle: full,
    jsonLd: [organizationSchema(s), websiteSchema(s)],
  };
}

export async function resolveProductSeo(slug: string): Promise<PageSeo | null> {
  const s = await getSeoSettings();
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { isActive: true } },
    },
  });
  // An unpublished product must not receive metadata — the caller 404s.
  if (!product || !product.isActive) return null;

  const path = `/p/${product.slug}`;
  const base = baseSeo(s, path);

  const title = firstNonEmpty(product.seoTitle) ?? applyTitleTemplate(s.titleTemplate, product.name, s.siteName);
  const description =
    firstNonEmpty(product.seoDescription) ??
    clampText(stripHtml(product.description), 158) ??
    base.description;

  const image = absoluteUrl(firstNonEmpty(product.ogImage) ?? product.images[0]?.url) ?? base.ogImage;
  const robots = isRobotsValue(product.metaRobots) ? product.metaRobots : base.robots;

  // Availability and price must mirror the page — inventing either is exactly
  // what earns a structured-data penalty.
  const inStock = product.variants.some((v) => v.stockQty > 0);
  const prices = product.variants.map((v) => v.discountPriceInPaise ?? v.priceInPaise);
  const lowest = prices.length > 0 ? Math.min(...prices) : null;

  const trail = [
    { name: 'Home', path: '/' },
    ...(product.category.parent
      ? [{ name: product.category.parent.name, path: `/c/${product.category.parent.slug}` }]
      : []),
    { name: product.category.name, path: `/c/${product.category.slug}` },
    { name: product.name, path },
  ];

  const productSchema: Record<string, unknown> = {
    '@type': 'Product',
    name: product.name,
    description: clampText(stripHtml(product.description), 480),
    url: getCanonicalUrl(path),
    image: product.images.map((i) => absoluteUrl(i.url)).filter(Boolean),
    ...(product.variants[0]?.sku ? { sku: product.variants[0].sku } : {}),
    brand: { '@type': 'Brand', name: s.organizationName || s.siteName },
    ...(lowest != null
      ? {
          offers: {
            '@type': 'Offer',
            price: (lowest / 100).toFixed(2),
            priceCurrency: 'INR',
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: getCanonicalUrl(path),
          },
        }
      : {}),
    // Only emit a rating when real reviews exist.
    ...(product.ratingCount > 0 && product.ratingAvg
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  return {
    ...base,
    title,
    description,
    canonical: firstNonEmpty(product.canonicalUrl) ?? base.canonical,
    robots,
    ogTitle: firstNonEmpty(product.ogTitle) ?? title,
    ogDescription: firstNonEmpty(product.ogDescription) ?? description,
    ogImage: image,
    ogType: 'product',
    twitterTitle: firstNonEmpty(product.twitterTitle) ?? title,
    twitterDescription: firstNonEmpty(product.twitterDescription) ?? description,
    twitterImage: absoluteUrl(firstNonEmpty(product.twitterImage)) ?? image,
    jsonLd: [organizationSchema(s), websiteSchema(s), productSchema, breadcrumbSchema(trail)],
  };
}

export async function resolveCategorySeo(slug: string): Promise<PageSeo | null> {
  const s = await getSeoSettings();
  const category = await prisma.category.findUnique({
    where: { slug },
    include: { parent: true, _count: { select: { products: true } } },
  });
  if (!category || !category.isActive) return null;

  const path = `/c/${category.slug}`;
  const base = baseSeo(s, path);

  const title = firstNonEmpty(category.seoTitle) ?? applyTitleTemplate(s.titleTemplate, category.name, s.siteName);
  const description =
    firstNonEmpty(category.seoDescription) ??
    `Shop ${category.name.toLowerCase()} at ${s.siteName}. ${s.organizationDescription ?? ''} Free delivery over ₹999, shipped pan-India.`.trim();
  const image = absoluteUrl(firstNonEmpty(category.ogImage) ?? category.imageUrl) ?? base.ogImage;

  const trail = [
    { name: 'Home', path: '/' },
    ...(category.parent ? [{ name: category.parent.name, path: `/c/${category.parent.slug}` }] : []),
    { name: category.name, path },
  ];

  return {
    ...base,
    title,
    description: clampText(description, 158),
    canonical: firstNonEmpty(category.canonicalUrl) ?? base.canonical,
    robots: isRobotsValue(category.metaRobots) ? category.metaRobots : base.robots,
    ogTitle: firstNonEmpty(category.ogTitle) ?? title,
    ogDescription: firstNonEmpty(category.ogDescription) ?? clampText(description, 158),
    ogImage: image,
    twitterTitle: title,
    twitterDescription: clampText(description, 158),
    twitterImage: image,
    jsonLd: [
      organizationSchema(s),
      websiteSchema(s),
      breadcrumbSchema(trail),
      {
        '@type': 'CollectionPage',
        name: category.name,
        url: getCanonicalUrl(path),
        ...(category._count.products > 0
          ? { mainEntity: { '@type': 'ItemList', numberOfItems: category._count.products } }
          : {}),
      },
    ],
  };
}

/**
 * Record a 301 when a slug changes so inbound links — and the ranking they
 * carry — survive the rename.
 *
 * Also repoints any redirect that pointed at the old path, which keeps chains
 * flat (A→B→C collapses to A→C) and stops a rename from creating a loop.
 */
export async function recordSlugChange(
  prefix: '/p' | '/c',
  oldSlug: string,
  newSlug: string,
  origin: 'PRODUCT_SLUG' | 'CATEGORY_SLUG',
): Promise<void> {
  if (!oldSlug || oldSlug === newSlug) return;
  const source = `${prefix}/${oldSlug}`;
  const destination = `${prefix}/${newSlug}`;

  await prisma.$transaction([
    // The new path must not itself be a redirect source, or we'd bounce
    // visitors straight back off the page we just created.
    prisma.redirect.deleteMany({ where: { source: destination } }),
    prisma.redirect.updateMany({ where: { destination: source }, data: { destination } }),
    prisma.redirect.upsert({
      where: { source },
      update: { destination, isActive: true, statusCode: 301, origin },
      create: { source, destination, statusCode: 301, origin },
    }),
  ]);
}
