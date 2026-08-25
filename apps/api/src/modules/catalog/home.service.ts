/**
 * Homepage CMS read model. The storefront asks for `GET /catalog/home` and
 * renders whatever it is given — every section, its order and its schedule are
 * merchandising decisions made in the admin.
 */
import type { HomeSection, HomeSectionItem, Prisma } from '@prisma/client';
import type {
  AdminHomeSectionDto,
  HomeSectionConfig,
  HomeSectionDto,
  HomeSectionItemDto,
  HomeSectionType,
  ProductCarouselConfig,
  ProductListItemDto,
} from '@chikbo/shared';
import { PRODUCT_CAROUSEL_SOURCES } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { listProducts, listProductsByIds } from './catalog.service';

const DEFAULT_CAROUSEL_LIMIT = 12;
const MAX_CAROUSEL_LIMIT = 24;

type SectionWithItems = HomeSection & { items: HomeSectionItem[] };

export function toItemDto(item: HomeSectionItem): HomeSectionItemDto {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    mobileImageUrl: item.mobileImageUrl,
    title: item.title,
    subtitle: item.subtitle,
    ctaLabel: item.ctaLabel,
    href: item.href,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

/** Section shape without resolved products — what the admin reads and writes. */
export function toSectionDto(section: SectionWithItems): AdminHomeSectionDto {
  return {
    id: section.id,
    type: section.type as HomeSectionType,
    title: section.title,
    subtitle: section.subtitle,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    startsAt: section.startsAt?.toISOString() ?? null,
    endsAt: section.endsAt?.toISOString() ?? null,
    config: (section.config as HomeSectionConfig | null) ?? null,
    items: section.items.map(toItemDto),
  };
}


/** Section types whose items point at a category and should show its image. */
const CATEGORY_LINKED = new Set(['CATEGORY_RAIL', 'CATEGORY_CARDS']);

const CATEGORY_HREF = /^\/c\/([a-z0-9-]+)\/?$/;

/**
 * Category tiles fall back to the category's own image.
 *
 * A tile can carry its own artwork for a campaign, but when it doesn't, the
 * image set on the category in the admin is used — otherwise "Category image"
 * there would silently have no effect on the homepage, which is exactly what
 * an operator expects it to control.
 */
async function categoryImagesFor(sections: SectionWithItems[]): Promise<Map<string, string | null>> {
  const slugs = new Set<string>();
  for (const section of sections) {
    if (!CATEGORY_LINKED.has(section.type)) continue;
    for (const item of section.items) {
      const slug = item.href?.match(CATEGORY_HREF)?.[1];
      if (slug) slugs.add(slug);
    }
  }
  if (slugs.size === 0) return new Map();
  const rows = await prisma.category.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, imageUrl: true },
  });
  return new Map(rows.map((row) => [row.slug, row.imageUrl]));
}

/** Normalise a stored `config` blob into a usable PRODUCT_CAROUSEL config. */
function readCarouselConfig(config: Prisma.JsonValue | null): ProductCarouselConfig {
  const raw = (config ?? {}) as Record<string, unknown>;
  const source = PRODUCT_CAROUSEL_SOURCES.includes(raw.source as never)
    ? (raw.source as ProductCarouselConfig['source'])
    : 'newest';
  const rawLimit = Number(raw.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_CAROUSEL_LIMIT)
    : DEFAULT_CAROUSEL_LIMIT;
  return {
    source,
    categorySlug: typeof raw.categorySlug === 'string' && raw.categorySlug ? raw.categorySlug : undefined,
    productIds: Array.isArray(raw.productIds) ? raw.productIds.filter((id): id is string => typeof id === 'string') : undefined,
    limit,
  };
}

/**
 * Resolve a PRODUCT_CAROUSEL section's `config` into real products, reusing the
 * catalog list logic so cards look identical everywhere. A misconfigured
 * section resolves to an empty list rather than breaking the whole homepage.
 */
export async function resolveCarouselProducts(config: Prisma.JsonValue | null): Promise<ProductListItemDto[]> {
  const cfg = readCarouselConfig(config);
  const limit = cfg.limit ?? DEFAULT_CAROUSEL_LIMIT;
  try {
    if (cfg.source === 'manual') {
      const products = await listProductsByIds(cfg.productIds ?? []);
      return products.slice(0, limit);
    }
    const page = await listProducts({
      page: 1,
      pageSize: limit,
      sort: 'newest',
      ...(cfg.source === 'category' && cfg.categorySlug ? { categorySlug: cfg.categorySlug } : {}),
    });
    return page.items;
  } catch {
    return []; // deleted category / bad config — the section simply renders empty
  }
}

/**
 * Active, in-schedule sections ordered by sortOrder, each with its active items
 * ordered by sortOrder, and PRODUCT_CAROUSEL sections resolved to products.
 */
export async function getHomeSections(now = new Date()): Promise<HomeSectionDto[]> {
  const sections = await prisma.homeSection.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: { items: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const categoryImages = await categoryImagesFor(sections);

  return Promise.all(
    sections.map(async (section) => {
      const dto = toSectionDto(section);
      if (CATEGORY_LINKED.has(section.type)) {
        dto.items = dto.items.map((item) => {
          if (item.imageUrl) return item;
          const slug = item.href?.match(CATEGORY_HREF)?.[1];
          const fallback = slug ? categoryImages.get(slug) ?? null : null;
          return fallback ? { ...item, imageUrl: fallback } : item;
        });
      }
      return {
        ...dto,
        products: section.type === 'PRODUCT_CAROUSEL' ? await resolveCarouselProducts(section.config) : [],
      };
    }),
  );
}
