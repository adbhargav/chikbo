export { formatPaise } from '@chikbo/shared';

/**
 * The admin categories endpoint returns one flat list ordered by
 * (sortOrder, name), which interleaves departments and subcategories — a
 * subcategory can sort ahead of the department it belongs to. Rebuild it as a
 * tree walk so every department is immediately followed by its own children,
 * which is the order a picker needs. Departments stay selectable because
 * products may hang off them directly.
 */
export interface CategoryOption {
  id: string;
  /** Same as id — lets the list feed <CategorySelect> directly. */
  value: string;
  name: string;
  isChild: boolean;
  /** "Sarees / Pattu Silk" — unambiguous even when the indent is invisible. */
  path: string;
}

export function categoryOptions<
  T extends { id: string; name: string; parentId: string | null; sortOrder: number },
>(categories: readonly T[]): CategoryOption[] {
  const bySort = (a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const parents = categories.filter((c) => !c.parentId).sort(bySort);
  const out: CategoryOption[] = [];
  for (const parent of parents) {
    out.push({ id: parent.id, value: parent.id, name: parent.name, isChild: false, path: parent.name });
    for (const child of categories.filter((c) => c.parentId === parent.id).sort(bySort)) {
      out.push({ id: child.id, value: child.id, name: child.name, isChild: true, path: `${parent.name} / ${child.name}` });
    }
  }
  // Orphans (parent missing or inactive) must never vanish from the picker.
  const seen = new Set(out.map((o) => o.id));
  for (const c of categories.filter((c) => !seen.has(c.id)).sort(bySort)) {
    out.push({ id: c.id, value: c.id, name: c.name, isChild: false, path: c.name });
  }
  return out;
}

/** "₹1.2L" / "₹45k" style compact rupees for chart axes. */
export function formatPaiseCompact(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(rupees)}`;
}

/** Parse a rupee text input into integer paise; null when empty/invalid. */
export function rupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Integer paise -> editable rupee string ("" when null). */
export function paiseToRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  return (paise / 100) % 1 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDayShort(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** "PROCESSING" -> "Processing", "OUT_FOR_DELIVERY" -> "Out for delivery" */
export function humanize(status: string): string {
  const words = status.toLowerCase().split('_');
  const first = words[0] ?? '';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...words.slice(1)].join(' ');
}

export type PillTone = 'success' | 'error' | 'info' | 'warn' | 'neutral';

const TONES: Record<string, PillTone> = {
  // orders
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PROCESSING: 'warn',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
  RETURN_REQUESTED: 'warn',
  RETURNED: 'neutral',
  REFUND_INITIATED: 'warn',
  REFUNDED: 'neutral',
  // payments
  CREATED: 'neutral',
  AUTHORIZED: 'info',
  CAPTURED: 'success',
  FAILED: 'error',
  // refunds
  INITIATED: 'warn',
  PROCESSED: 'success',
  // returns
  REQUESTED: 'warn',
  APPROVED: 'success',
  REJECTED: 'error',
  PICKUP_SCHEDULED: 'info',
  IN_TRANSIT: 'info',
  RECEIVED: 'success',
  // shipments
  AWB_ASSIGNED: 'info',
  RTO: 'error',
};

export function toneForStatus(status: string): PillTone {
  return TONES[status] ?? 'neutral';
}

/** Public storefront address, for previews and web-address hints. */
export const STOREFRONT_URL = ((import.meta.env.VITE_WEB_URL as string | undefined) ?? 'http://localhost:5173').replace(/\/+$/, '');
