/**
 * Editorial photography shipped with the storefront (public/images/editorial).
 *
 * These are ATMOSPHERE images — hero, category tiles, brand story — not product
 * photography. Product cards deliberately keep the generated SilkArt until real
 * photographs of the actual stock are uploaded, so a listing never shows a
 * garment the customer would not receive. See docs/imagery.md.
 *
 * Source: Unsplash (Unsplash License — free for commercial use, no attribution
 * required). Replace any of these with the shop's own campaign photography by
 * dropping a file of the same name into public/images/editorial/.
 */

const BASE = `${import.meta.env.BASE_URL}images/editorial`;

export const EDITORIAL = {
  hero: `${BASE}/hero.jpg`,
  story1: `${BASE}/story-1.jpg`,
  story2: `${BASE}/story-2.jpg`,
} as const;

/** Top-level category slug -> editorial tile image. */
const CATEGORY_IMAGES: Record<string, string> = {
  sarees: `${BASE}/cat-sarees.jpg`,
  dresses: `${BASE}/cat-dresses.jpg`,
  tops: `${BASE}/cat-tops.jpg`,
  bottomwear: `${BASE}/cat-bottomwear.jpg`,
  'antique-imitation-jewellery': `${BASE}/cat-jewellery.jpg`,
};

/** Returns the editorial tile image for a category, or null to keep pure silk. */
export function categoryImage(slug: string): string | null {
  return CATEGORY_IMAGES[slug] ?? null;
}
