/**
 * Homepage CMS contract (docs/marketplace-redesign.md §1).
 *
 * The types mirror `HomeSectionDto` / `HomeSectionItemDto` in `@chikbo/shared`,
 * but are declared locally so the storefront builds while the shared package
 * and `GET /catalog/home` are being added in parallel. Once the shared types
 * ship these stay structurally identical, so nothing here needs to change.
 */
import { useQuery } from '@tanstack/react-query';
import type { ProductListItemDto } from '@chikbo/shared';
import { api } from './api';

export const HOME_SECTION_TYPES = [
  'HERO_CAROUSEL',
  'CATEGORY_RAIL',
  'CATEGORY_CARDS',
  'BANNER_GRID',
  'PRODUCT_CAROUSEL',
  'EDITORIAL',
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export interface HomeSectionItemDto {
  id: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  href: string | null;
  sortOrder: number;
}

export interface HomeSectionDto {
  id: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  config: Record<string, unknown> | null;
  items: HomeSectionItemDto[];
  products?: ProductListItemDto[];
}

/** Read a string out of a section's free-form `config` blob. */
export function configString(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = config?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Read a number out of a section's free-form `config` blob. */
export function configNumber(
  config: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = config?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Items ordered by `sortOrder`, defensive against a missing/!array payload. */
export function sortedItems(section: HomeSectionDto): HomeSectionItemDto[] {
  const items = Array.isArray(section.items) ? section.items : [];
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * CMS homepage sections. Never retries: while `GET /catalog/home` does not yet
 * exist it 404s, and the page falls back to the hand-built sections.
 */
export function useHomeSections() {
  return useQuery({
    queryKey: ['home-sections'],
    queryFn: () => api<HomeSectionDto[]>('/catalog/home'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
