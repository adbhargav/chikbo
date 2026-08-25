/**
 * Pure helpers shared by every navigation surface.
 *
 * The nav is entirely category-tree driven: nothing here names a category, so
 * adding/removing categories in the admin reshapes the nav with no code change.
 */
import type { CategoryDto } from '@chikbo/shared';

/** Top-level categories, defensively filtered and sorted. */
export function topLevelCategories(categories: CategoryDto[] | undefined): CategoryDto[] {
  return (categories ?? [])
    .filter((c) => !c.parentId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function childrenOf(category: CategoryDto): CategoryDto[] {
  return (category.children ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Longest column before we open another one. */
const COLUMN_TARGET = 6;
/** Never more than this many link columns beside the editorial tile. */
const MAX_COLUMNS = 4;

/**
 * Flow subcategories into columns of at most `COLUMN_TARGET`, opening extra
 * columns up to `MAX_COLUMNS` and then growing the columns instead. Keeps the
 * panel readable whether a category has 2 children or 40.
 */
export function columnsFor<T>(items: T[], target = COLUMN_TARGET, max = MAX_COLUMNS): T[][] {
  if (items.length === 0) return [];
  const columns = Math.min(max, Math.max(1, Math.ceil(items.length / target)));
  const perColumn = Math.ceil(items.length / columns);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perColumn) out.push(items.slice(i, i + perColumn));
  return out;
}

/** Route for a category. */
export const categoryPath = (category: CategoryDto): string => `/c/${category.slug}`;

/** "New Arrivals" is the one non-category destination the spec asks for. */
export const NEW_ARRIVALS = { label: 'New Arrivals', to: '/search?sort=newest' } as const;

export interface NavLink {
  label: string;
  to: string;
}

/** Account links for the mobile drawer — destinations depend on sign-in state. */
export function accountLinks(signedIn: boolean): NavLink[] {
  if (!signedIn) {
    return [
      { label: 'Sign in', to: '/login' },
      { label: 'Create an account', to: '/register' },
    ];
  }
  return [
    { label: 'Orders', to: '/account/orders' },
    { label: 'Wishlist', to: '/account/wishlist' },
    { label: 'Profile', to: '/account/profile' },
  ];
}

export const POLICY_LINKS: NavLink[] = [
  { label: 'Shipping & Delivery', to: '/policy/shipping' },
  { label: 'Returns & Refunds', to: '/policy/returns' },
  { label: 'Privacy Policy', to: '/policy/privacy' },
  { label: 'Terms of Service', to: '/policy/terms' },
];
