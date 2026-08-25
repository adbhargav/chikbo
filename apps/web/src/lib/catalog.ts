/**
 * Small catalog helpers shared by the product card, PLP and PDP.
 *
 * `Product.badge` (docs/marketplace-redesign.md §2) is being added to the API
 * and to `@chikbo/shared` in parallel, so it is read defensively here: the
 * storefront compiles and renders correctly both before and after it lands.
 */
import type { ProductDetailDto, ProductListItemDto } from '@chikbo/shared';

/** Merchandising badge ("New", "Bestseller", "Festive Edit") or null. */
export function productBadge(product: ProductListItemDto | ProductDetailDto): string | null {
  const badge = (product as { badge?: unknown }).badge;
  return typeof badge === 'string' && badge.trim().length > 0 ? badge.trim() : null;
}

/** "antique-imitation-jewellery" -> "Antique Imitation Jewellery" */
export function humanizeSlug(slug: string | null | undefined): string {
  if (!slug) return '';
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Selling price for a list item (discount price when present). */
export function listPrice(product: ProductListItemDto): number {
  return product.minDiscountPriceInPaise ?? product.minPriceInPaise;
}

/** MRP to strike through, or null when the product is not discounted. */
export function listMrp(product: ProductListItemDto): number | null {
  return product.minDiscountPriceInPaise !== null &&
    product.minDiscountPriceInPaise < product.minPriceInPaise
    ? product.minPriceInPaise
    : null;
}
