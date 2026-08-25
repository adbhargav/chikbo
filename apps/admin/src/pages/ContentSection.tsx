import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  HOME_SECTION_TYPES,
  PRODUCT_CAROUSEL_SOURCES,
  type CategoryDto,
  type HomeSectionType,
  type ProductCarouselSource,
} from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import { ImageInput } from '../components/ImageInput';
import type { AdminHomeSection, AdminHomeSectionItem } from '../lib/types';
import { humanize } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/Modal';
import { CardSkeleton, ErrorState, PageHead, Thumb } from '../components/ui';

/** `2026-08-20T10:30` for a datetime-local input; '' when unset. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface ItemRow {
  id: string;
  imageUrl: string;
  mobileImageUrl: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  isActive: boolean;
}

function toRow(item: AdminHomeSectionItem): ItemRow {
  return {
    id: item.id,
    imageUrl: item.imageUrl ?? '',
    mobileImageUrl: item.mobileImageUrl ?? '',
    title: item.title ?? '',
    subtitle: item.subtitle ?? '',
    ctaLabel: item.ctaLabel ?? '',
    href: item.href ?? '',
    isActive: item.isActive,
  };
}

const trimmed = (value: string) => (value.trim() === '' ? null : value.trim());

interface MediaSpec {
  name: string;
  aspect: string;
  spec: string;
}

/**
 * Every section type crops its artwork differently on the storefront, so the
 * upload slots have to quote that type's real ratio — a hero's 21:8 letterbox
 * is useless advice for a circular category chip. Ratios mirror
 * apps/web/src/styles/marketplace.css.
 */
const MEDIA_SPECS: Record<HomeSectionType, { desktop: MediaSpec; mobile: MediaSpec }> = {
  HERO_CAROUSEL: {
    desktop: { name: 'Desktop banner', aspect: '21 / 8', spec: '21:8 · 2520 × 960' },
    mobile: { name: 'Mobile crop', aspect: '5 / 4', spec: '5:4 · 1080 × 864' },
  },
  CATEGORY_RAIL: {
    desktop: { name: 'Chip artwork', aspect: '1 / 1', spec: 'Circular 1:1 · 400 × 400' },
    mobile: { name: 'Mobile chip', aspect: '1 / 1', spec: 'Circular 1:1 · 400 × 400' },
  },
  CATEGORY_CARDS: {
    desktop: { name: 'Card artwork', aspect: '4 / 5', spec: '4:5 · 1000 × 1250' },
    mobile: { name: 'Mobile crop', aspect: '4 / 5', spec: '4:5 · 1000 × 1250' },
  },
  BANNER_GRID: {
    desktop: { name: 'Offer tile', aspect: '16 / 9', spec: '16:9 · 1440 × 810' },
    mobile: { name: 'Mobile crop', aspect: '16 / 9', spec: '16:9 · 1440 × 810' },
  },
  EDITORIAL: {
    desktop: { name: 'Editorial image', aspect: '3 / 2', spec: '3:2 · 1500 × 1000' },
    mobile: { name: 'Mobile crop', aspect: '3 / 2', spec: '3:2 · 1500 × 1000' },
  },
  PRODUCT_CAROUSEL: {
    desktop: { name: 'Image', aspect: '3 / 4', spec: '3:4 · 900 × 1200' },
    mobile: { name: 'Mobile crop', aspect: '3 / 4', spec: '3:4 · 900 × 1200' },
  },
};

/** Flatten the category tree into "Sarees / Pattu Silk" style options. */
function flattenCategories(tree: CategoryDto[], prefix = ''): { slug: string; label: string }[] {
  return tree.flatMap((c) => [
    { slug: c.slug, label: `${prefix}${c.name}` },
    ...flattenCategories(c.children ?? [], `${prefix}${c.name} / `),
  ]);
}

export function ContentSection() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('content.write');

  const sections = useQuery({
    queryKey: ['home-sections'],
    queryFn: () => api<AdminHomeSection[]>('/admin/home-sections'),
  });
  const categories = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api<CategoryDto[]>('/catalog/categories'),
  });

  const section = (sections.data ?? []).find((s) => s.id === id);

  // --- settings form state ---
  const [type, setType] = useState<HomeSectionType>('HERO_CAROUSEL');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [source, setSource] = useState<ProductCarouselSource>('newest');
  const [categorySlug, setCategorySlug] = useState('');
  const [limit, setLimit] = useState('12');
  const [productIds, setProductIds] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [deleting, setDeleting] = useState<ItemRow | null>(null);

  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (!section || loadedId.current === section.id) return;
    loadedId.current = section.id;
    setType(section.type);
    setTitle(section.title ?? '');
    setSubtitle(section.subtitle ?? '');
    setIsActive(section.isActive);
    setStartsAt(toLocalInput(section.startsAt));
    setEndsAt(toLocalInput(section.endsAt));
    const config = section.config ?? {};
    setSource((config.source as ProductCarouselSource | undefined) ?? 'newest');
    setCategorySlug(config.categorySlug ?? '');
    setLimit(String(config.limit ?? 12));
    setProductIds((config.productIds ?? []).join(', '));
  }, [section]);

  // Items are re-synced whenever the server list changes (add / reorder / delete).
  const itemsKey = section ? section.items.map((i) => `${i.id}:${i.sortOrder}`).join('|') : '';
  useEffect(() => {
    if (!section) return;
    // Keep whatever is already typed into a row that survived the change.
    setRows((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      return section.items.map((item) => byId.get(item.id) ?? toRow(item));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['home-sections'] });

  const saveSection = useMutation({
    mutationFn: () => {
      const parsedLimit = Number(limit);
      const config =
        type === 'PRODUCT_CAROUSEL'
          ? {
              source,
              limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 24) : 12,
              ...(source === 'category' ? { categorySlug } : {}),
              ...(source === 'manual'
                ? { productIds: productIds.split(',').map((s) => s.trim()).filter(Boolean) }
                : {}),
            }
          : null;
      return api<AdminHomeSection>(`/admin/home-sections/${id}`, {
        method: 'PATCH',
        body: {
          type,
          title: trimmed(title),
          subtitle: trimmed(subtitle),
          isActive,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
          config,
        },
      });
    },
    onSuccess: () => {
      toast('Section saved', 'success');
      invalidate();
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const addItem = useMutation({
    mutationFn: () => api<AdminHomeSectionItem>(`/admin/home-sections/${id}/items`, { method: 'POST', body: { isActive: true } }),
    onSuccess: () => {
      toast('Item added', 'success');
      invalidate();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const saveItem = useMutation({
    mutationFn: (row: ItemRow) =>
      api<AdminHomeSectionItem>(`/admin/home-section-items/${row.id}`, {
        method: 'PATCH',
        body: {
          imageUrl: trimmed(row.imageUrl),
          mobileImageUrl: trimmed(row.mobileImageUrl),
          title: trimmed(row.title),
          subtitle: trimmed(row.subtitle),
          ctaLabel: trimmed(row.ctaLabel),
          href: trimmed(row.href),
          isActive: row.isActive,
        },
      }),
    onSuccess: () => {
      toast('Item saved', 'success');
      invalidate();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api(`/admin/home-section-items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Item removed', 'success');
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setDeleting(null);
    },
  });

  const reorderItems = useMutation({
    mutationFn: (ids: string[]) =>
      api<AdminHomeSectionItem[]>(`/admin/home-sections/${id}/items/reorder`, { method: 'POST', body: { ids } }),
    onSuccess: () => invalidate(),
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const setRow = (itemId: string, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((r) => (r.id === itemId ? { ...r, ...patch } : r)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((r) => r.id);
    const moved = ids[index];
    const displaced = ids[target];
    if (!moved || !displaced) return;
    ids[index] = displaced;
    ids[target] = moved;
    reorderItems.mutate(ids);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (type === 'PRODUCT_CAROUSEL' && source === 'category' && !categorySlug) {
      setFormError('Pick a category for this carousel');
      return;
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setFormError('The schedule end must be after the start');
      return;
    }
    saveSection.mutate();
  };

  const categoryOptions = useMemo(() => flattenCategories(categories.data ?? []), [categories.data]);

  if (sections.isPending) {
    return (
      <main className="page">
        <PageHead overline="Content" title="Section" />
        <CardSkeleton height={400} />
      </main>
    );
  }
  if (sections.isError) {
    return (
      <main className="page">
        <PageHead overline="Content" title="Section" />
        <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
      </main>
    );
  }
  if (!section) {
    return (
      <main className="page">
        <PageHead overline="Content" title="Section not found" sub="It may have been deleted by someone else." />
        <Link to="/content" className="btn btn-secondary">
          ← Homepage sections
        </Link>
      </main>
    );
  }

  const isCarousel = type === 'PRODUCT_CAROUSEL';
  const media = MEDIA_SPECS[type] ?? MEDIA_SPECS.HERO_CAROUSEL;

  return (
    <main className="page">
      <PageHead
        overline="Content"
        title={section.title ?? humanize(section.type)}
        sub={`${humanize(section.type)} · position ${section.sortOrder + 1} on the homepage`}
        actions={
          <Link to="/content" className="btn btn-secondary">
            ← Homepage
          </Link>
        }
      />

      <div className="detail-grid">
        <div className="stack">
          <div className="card pad">
            <h3 className="card-title">{isCarousel ? 'Products' : 'Items'}</h3>
            {isCarousel ? (
              <p className="muted" style={{ fontSize: 13 }}>
                This section pulls its products from the source on the right — there is nothing to arrange by hand.
                Switch the source to <strong>Hand-picked</strong> to choose exact products.
              </p>
            ) : (
              <>
                <div className="editor-rows">
                  {rows.map((row, i) => (
                    <div className="cms-item" key={row.id}>
                      <div className="cms-item-media">
                        <div className="media-slot">
                          <div className="media-slot-head">
                            <span className="media-slot-name">{media.desktop.name}</span>
                            <span className="media-slot-spec">{media.desktop.spec}</span>
                          </div>
                          {canWrite ? (
                            <ImageInput
                              max={1}
                              compact
                              previewAspect={media.desktop.aspect}
                              value={row.imageUrl ? [row.imageUrl] : []}
                              onChange={(urls) => setRow(row.id, { imageUrl: urls[0] ?? '' })}
                            />
                          ) : (
                            <Thumb url={row.imageUrl} name={row.title || 'Item'} large />
                          )}
                        </div>

                        <div className="media-slot">
                          <div className="media-slot-head">
                            <span className="media-slot-name">{media.mobile.name}</span>
                            <span className="media-slot-spec">{media.mobile.spec}</span>
                          </div>
                          {canWrite ? (
                            <ImageInput
                              max={1}
                              compact
                              previewAspect={media.mobile.aspect}
                              hint="Optional — the desktop image is used when this is empty."
                              value={row.mobileImageUrl ? [row.mobileImageUrl] : []}
                              onChange={(urls) => setRow(row.id, { mobileImageUrl: urls[0] ?? '' })}
                            />
                          ) : (
                            <Thumb url={row.mobileImageUrl} name={row.title || 'Item'} large />
                          )}
                        </div>
                      </div>

                      <div className="cms-item-fields">
                        <div className="form-row cols-2">
                          <div className="field">
                            <label htmlFor={`t-${row.id}`}>Title</label>
                            <input
                              id={`t-${row.id}`}
                              type="text"
                              value={row.title}
                              onChange={(e) => setRow(row.id, { title: e.target.value })}
                              disabled={!canWrite}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`s-${row.id}`}>Subtitle</label>
                            <input
                              id={`s-${row.id}`}
                              type="text"
                              placeholder="Up to 70% off"
                              value={row.subtitle}
                              onChange={(e) => setRow(row.id, { subtitle: e.target.value })}
                              disabled={!canWrite}
                            />
                          </div>
                        </div>
                        <div className="form-row cols-2">
                          <div className="field">
                            <label htmlFor={`c-${row.id}`}>CTA label</label>
                            <input
                              id={`c-${row.id}`}
                              type="text"
                              placeholder="Shop now"
                              value={row.ctaLabel}
                              onChange={(e) => setRow(row.id, { ctaLabel: e.target.value })}
                              disabled={!canWrite}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`h-${row.id}`}>Link</label>
                            <input
                              id={`h-${row.id}`}
                              type="text"
                              placeholder="/c/sarees"
                              value={row.href}
                              onChange={(e) => setRow(row.id, { href: e.target.value })}
                              disabled={!canWrite}
                            />
                          </div>
                        </div>
                        {row.mobileImageUrl && (
                          <p className="muted" style={{ fontSize: 12 }}>
                            Mobile crop: {row.mobileImageUrl}
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setRow(row.id, { mobileImageUrl: '' });
                                  saveItem.mutate({ ...row, mobileImageUrl: '' });
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </p>
                        )}
                        <div className="cms-item-actions">
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={row.isActive}
                              onChange={(e) => setRow(row.id, { isActive: e.target.checked })}
                              disabled={!canWrite}
                            />
                            Active
                          </label>
                          <span className="spacer" />
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label={`Move item ${i + 1} up`}
                            disabled={!canWrite || i === 0 || reorderItems.isPending}
                            onClick={() => move(i, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label={`Move item ${i + 1} down`}
                            disabled={!canWrite || i === rows.length - 1 || reorderItems.isPending}
                            onClick={() => move(i, 1)}
                          >
                            ↓
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={saveItem.isPending}
                                onClick={() => saveItem.mutate(row)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--error)' }}
                                onClick={() => setDeleting(row)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <p className="muted" style={{ fontSize: 13 }}>
                      No items yet — add a banner, tile or card.
                    </p>
                  )}
                </div>
                {canWrite && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    disabled={addItem.isPending}
                    onClick={() => addItem.mutate()}
                  >
                    + Add item
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="stack">
          <form className="card pad" onSubmit={onSubmit}>
            <h3 className="card-title">Settings</h3>
            {formError && (
              <div className="login-error" role="alert">
                {formError}
              </div>
            )}
            <div className="field">
              <label htmlFor="sec-type">Type</label>
              <select
                id="sec-type"
                value={type}
                onChange={(e) => setType(e.target.value as HomeSectionType)}
                disabled={!canWrite}
              >
                {HOME_SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sec-title">Title</label>
              <input
                id="sec-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className="field">
              <label htmlFor="sec-sub">Subtitle</label>
              <input
                id="sec-sub"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="sec-from">Starts</label>
                <input
                  id="sec-from"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div className="field">
                <label htmlFor="sec-to">Ends</label>
                <input
                  id="sec-to"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={!canWrite}
                />
              </div>
            </div>
            <span className="hint">Leave both empty to keep the section on the homepage indefinitely.</span>
            <label className="checkbox" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={!canWrite}
              />
              Live on the storefront
            </label>

            {isCarousel && (
              <>
                <h3 className="card-title" style={{ marginTop: 18 }}>
                  Carousel source
                </h3>
                <div className="field">
                  <label htmlFor="sec-source">Products from</label>
                  <select
                    id="sec-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value as ProductCarouselSource)}
                    disabled={!canWrite}
                  >
                    {PRODUCT_CAROUSEL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s === 'newest' ? 'Newest arrivals' : s === 'category' ? 'A category' : 'Hand-picked'}
                      </option>
                    ))}
                  </select>
                </div>
                {source === 'category' && (
                  <div className="field">
                    <label htmlFor="sec-cat">Category</label>
                    <select
                      id="sec-cat"
                      value={categorySlug}
                      onChange={(e) => setCategorySlug(e.target.value)}
                      disabled={!canWrite}
                    >
                      <option value="">Choose…</option>
                      {categoryOptions.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {source === 'manual' && (
                  <div className="field">
                    <label htmlFor="sec-ids">Product IDs</label>
                    <textarea
                      id="sec-ids"
                      placeholder="cmt0obc…, cmt0obd…"
                      value={productIds}
                      onChange={(e) => setProductIds(e.target.value)}
                      disabled={!canWrite}
                    />
                    <span className="hint">Comma-separated product IDs, in the order they should appear.</span>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="sec-limit">How many</label>
                  <input
                    id="sec-limit"
                    type="number"
                    min={1}
                    max={24}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              </>
            )}

            {canWrite && (
              <button className="btn btn-primary" type="submit" disabled={saveSection.isPending} style={{ marginTop: 14 }}>
                {saveSection.isPending ? 'Saving…' : 'Save section'}
              </button>
            )}
          </form>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Remove item?"
          message={
            <>
              Remove <strong>{deleting.title || 'this item'}</strong> from the section? This cannot be undone.
            </>
          }
          confirmLabel="Remove"
          danger
          busy={removeItem.isPending}
          onConfirm={() => removeItem.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
