import { Prisma } from '@prisma/client';
import type { CategoryDto, FilterFacetsDto, Paginated, ProductDetailDto, ProductListItemDto } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { effectiveUnitPrice } from '../../utils/pricing';

export async function getCategoryTree(): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const byParent = new Map<string | null, typeof categories>();
  for (const c of categories) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const toDto = (c: (typeof categories)[number]): CategoryDto => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    children: (byParent.get(c.id) ?? []).map(toDto),
  });
  return (byParent.get(null) ?? []).map(toDto);
}

/** Canonical apparel-size order for the filter sidebar; unknown sizes sort after these. */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * Distinct sizes and colours across active variants of active products, so the
 * storefront filter sidebar always reflects what admins actually entered.
 * Values are deduped case-insensitively (colour matching in listProducts is
 * insensitive too) and colours are title-cased for consistent display.
 */
export async function getFilterFacets(): Promise<FilterFacetsDto> {
  const rows = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    select: { size: true, color: true },
    distinct: ['size', 'color'],
  });

  const sizes = new Map<string, string>();
  const colors = new Map<string, string>();
  for (const row of rows) {
    const size = row.size?.trim();
    if (size && !sizes.has(size.toLowerCase())) sizes.set(size.toLowerCase(), size);
    const color = row.color?.trim();
    if (color && !colors.has(color.toLowerCase())) colors.set(color.toLowerCase(), titleCase(color));
  }

  const sizeRank = (s: string) => {
    const i = SIZE_ORDER.findIndex((o) => o.toLowerCase() === s.toLowerCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return {
    sizes: [...sizes.values()].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b)),
  };
}

export interface ProductListQuery {
  page: number;
  pageSize: number;
  categorySlug?: string;
  search?: string;
  minPriceInPaise?: number;
  maxPriceInPaise?: number;
  sizes?: string[];
  colors?: string[];
  inStockOnly?: boolean;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'rating';
}

type ProductWithRels = Prisma.ProductGetPayload<{
  include: { images: true; variants: true; category: true };
}>;

export function toListItem(p: ProductWithRels): ProductListItemDto {
  const active = p.variants.filter((v) => v.isActive);
  const prices = active.map((v) => v.priceInPaise);
  const effectives = active.map(effectiveUnitPrice);
  const hasDiscount = active.some((v) => v.discountPriceInPaise != null);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    categorySlug: p.category.slug,
    thumbnailUrl: p.images[0]?.url ?? null,
    badge: p.badge,
    minPriceInPaise: prices.length ? Math.min(...prices) : 0,
    minDiscountPriceInPaise: hasDiscount && effectives.length ? Math.min(...effectives) : null,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    inStock: active.some((v) => v.stockQty > 0),
  };
}

export async function listProducts(q: ProductListQuery): Promise<Paginated<ProductListItemDto>> {
  // A category filter matches the category itself or any of its children.
  let categoryIds: string[] | undefined;
  if (q.categorySlug) {
    const category = await prisma.category.findUnique({
      where: { slug: q.categorySlug },
      include: { children: { select: { id: true } } },
    });
    if (!category) throw ApiError.notFound('Category not found');
    categoryIds = [category.id, ...category.children.map((c) => c.id)];
  }

  const variantFilter: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(q.sizes?.length ? { size: { in: q.sizes } } : {}),
    ...(q.colors?.length ? { color: { in: q.colors, mode: 'insensitive' } } : {}),
    ...(q.inStockOnly ? { stockQty: { gt: 0 } } : {}),
    ...(q.minPriceInPaise != null || q.maxPriceInPaise != null
      ? {
          OR: [
            {
              discountPriceInPaise: {
                not: null,
                ...(q.minPriceInPaise != null ? { gte: q.minPriceInPaise } : {}),
                ...(q.maxPriceInPaise != null ? { lte: q.maxPriceInPaise } : {}),
              },
            },
            {
              discountPriceInPaise: null,
              priceInPaise: {
                ...(q.minPriceInPaise != null ? { gte: q.minPriceInPaise } : {}),
                ...(q.maxPriceInPaise != null ? { lte: q.maxPriceInPaise } : {}),
              },
            },
          ],
        }
      : {}),
  };

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { description: { contains: q.search, mode: 'insensitive' } },
            { category: { name: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    variants: { some: variantFilter },
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    q.sort === 'rating' ? [{ ratingAvg: { sort: 'desc', nulls: 'last' } }, { ratingCount: 'desc' }] : [{ createdAt: 'desc' }];

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true, category: true },
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  let items = products.map(toListItem);
  // Price sorts operate on the effective (post-discount) price, which lives
  // across variants — sort the page in memory after the DB pass.
  if (q.sort === 'price_asc' || q.sort === 'price_desc') {
    const key = (i: ProductListItemDto) => i.minDiscountPriceInPaise ?? i.minPriceInPaise;
    items = items.sort((a, b) => (q.sort === 'price_asc' ? key(a) - key(b) : key(b) - key(a)));
  }

  return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) };
}

/**
 * Fetch a hand-picked set of products (homepage "manual" carousels), keeping
 * the caller's id order and dropping anything inactive or missing.
 */
export async function listProductsByIds(ids: string[]): Promise<ProductListItemDto[]> {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true, category: true },
  });
  const byId = new Map(products.map((p) => [p.id, toListItem(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductListItemDto => p !== undefined);
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDto> {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { sortOrder: 'asc' } }, variants: true, category: true },
  });
  if (!p || !p.isActive) throw ApiError.notFound('Product not found');
  const active = p.variants.filter((v) => v.isActive);
  const listItem = toListItem(p);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    categorySlug: p.category.slug,
    badge: p.badge,
    description: p.description,
    attributes: (p.attributes as Record<string, string> | null) ?? null,
    images: p.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt, color: img.color ?? null, sortOrder: img.sortOrder })),
    variants: active.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      size: v.size,
      color: v.color,
      weightGrams: v.weightGrams,
      priceInPaise: v.priceInPaise,
      discountPriceInPaise: v.discountPriceInPaise,
      stockQty: v.stockQty,
      isActive: v.isActive,
      inStock: v.stockQty > 0,
    })),
    minPriceInPaise: listItem.minPriceInPaise,
    minDiscountPriceInPaise: listItem.minDiscountPriceInPaise,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    inStock: listItem.inStock,
  };
}

/**
 * The photo to show for a specific colour: the first image tagged with that
 * colour, else the first untagged image, else the product's first image.
 * Images must already be ordered by sortOrder.
 */
export function thumbnailFor(images: { url: string; color?: string | null }[], color: string | null | undefined): string | null {
  const want = color?.trim().toLowerCase();
  if (want) {
    const match = images.find((i) => i.color?.trim().toLowerCase() === want);
    if (match) return match.url;
  }
  return (images.find((i) => !i.color) ?? images[0])?.url ?? null;
}
