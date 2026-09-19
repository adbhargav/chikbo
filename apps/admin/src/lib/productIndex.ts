import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@chikbo/shared';
import { api } from './api';
import type { AdminProduct } from './types';

/** Just what a picker needs to show and choose a product. */
export interface ProductChoice {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  thumbnailUrl: string | null;
}

async function fetchAll(): Promise<ProductChoice[]> {
  const out: ProductChoice[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await api<Paginated<AdminProduct>>('/admin/products', { query: { page, pageSize: 100 } });
    for (const p of res.items) {
      out.push({ id: p.id, name: p.name, slug: p.slug, isActive: p.isActive, thumbnailUrl: p.images[0]?.url ?? null });
    }
    if (page >= res.totalPages) break;
  }
  return out;
}

/** Every product, lightly, so pickers can search by name without a request per keystroke. */
export function useProductIndex(enabled = true) {
  return useQuery({ queryKey: ['product-index'], queryFn: fetchAll, enabled, staleTime: 60_000 });
}

/** Case-insensitive name match, active products first. */
export function searchProducts(all: ProductChoice[], term: string, limit = 8): ProductChoice[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  return all
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
