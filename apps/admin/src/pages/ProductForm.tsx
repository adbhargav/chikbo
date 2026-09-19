import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_SIZE_TYPE, SIZE_CHARTS, type Paginated, type SizeType } from '@chikbo/shared';
import { api, assetUrl, errorMessage } from '../lib/api';
import { ImageInput } from '../components/ImageInput';
import { SUGGESTED_COLOURS, swatchFor } from '../lib/colors';
import { WebAddressField, webAddressError } from '../components/WebAddressField';
import type { AdminCategory, AdminProduct, AdminVariant, VariantInput } from '../lib/types';
import { categoryOptions, paiseToRupees, rupeesToPaise, slugify } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { CategorySelect } from '../components/pickers/CategorySelect';
import { CardSkeleton, ErrorState, PageHead } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { SeoPanel } from '../components/seo';
import {
  emptySeoValues,
  productSeoPayload,
  seoValuesFrom,
  useSeoSettings,
  useSiteOrigin,
  type SeoValues,
} from '../lib/seo';

/** The admin API has no GET /products/:id — scan the paginated list for it. */
async function fetchProductById(id: string): Promise<AdminProduct> {
  let page = 1;
  for (;;) {
    const res = await api<Paginated<AdminProduct>>('/admin/products', { query: { page, pageSize: 100 } });
    const found = res.items.find((p) => p.id === id);
    if (found) return found;
    if (page >= res.totalPages || page >= 20) break;
    page += 1;
  }
  throw new Error('Product not found');
}

interface ImageRow {
  url: string;
  alt: string;
  /** Colour this photo shows; '' = every colour. */
  color: string;
}
interface AttrRow {
  key: string;
  value: string;
}
interface VariantRow {
  id?: string; // present on saved variants (edit mode)
  sku: string;
  size: string;
  color: string;
  weightGrams: string;
  price: string; // rupees, text
  discountPrice: string; // rupees, text
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
  stockQty?: number; // server value, edit mode display
}

const emptyVariant = (): VariantRow => ({
  sku: '',
  size: '',
  color: '',
  weightGrams: '',
  price: '',
  discountPrice: '',
  stock: '0',
  lowStockThreshold: '5',
  isActive: true,
});

function variantToRow(v: AdminVariant): VariantRow {
  return {
    id: v.id,
    sku: v.sku,
    size: v.size ?? '',
    color: v.color ?? '',
    weightGrams: v.weightGrams === null ? '' : String(v.weightGrams),
    price: paiseToRupees(v.priceInPaise),
    discountPrice: paiseToRupees(v.discountPriceInPaise),
    stock: String(v.stockQty),
    lowStockThreshold: String(v.lowStockThreshold),
    isActive: v.isActive,
    stockQty: v.stockQty,
  };
}

/** "maroon-anarkali" + Maroon + XL -> "MAROON-ANARKALI-MAROON-XL", used when the SKU box is left empty. */
function autoSku(productSlug: string, row: VariantRow): string {
  return [productSlug, row.color, row.size]
    .map((part) => slugify(part))
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .slice(0, 60);
}

/** Validate one variant row; returns an error string or the API payload. */
function buildVariant(row: VariantRow, forCreate: boolean): { error?: string; payload?: VariantInput } {
  if (row.sku.trim().length < 2) return { error: 'SKU must be at least 2 characters' };
  // Same limits the API enforces, so a long value is caught here by name
  // instead of coming back as a bare "Invalid request data".
  if (row.sku.trim().length > 60) return { error: `SKU ${row.sku.trim().slice(0, 20)}… is too long (60 characters max)` };
  if (row.size.trim().length > 20) return { error: `Size for ${row.sku} is too long (20 characters max)` };
  if (row.color.trim().length > 40) return { error: `Colour for ${row.sku} is too long (40 characters max)` };
  const price = rupeesToPaise(row.price);
  if (price === null || price < 100) return { error: `Price for ${row.sku || 'variant'} must be at least ₹1` };
  const typedDiscount = row.discountPrice.trim() === '' ? null : rupeesToPaise(row.discountPrice);
  if (row.discountPrice.trim() !== '' && typedDiscount === null) return { error: `Invalid discount for ${row.sku}` };
  // "0" means no discounted price; the API rejects a zero amount.
  const discount = typedDiscount === 0 ? null : typedDiscount;
  if (discount !== null && discount >= price) {
    return { error: `Discount for ${row.sku} must be below the price` };
  }
  const weight = row.weightGrams.trim() === '' ? null : Number(row.weightGrams);
  if (weight !== null && (!Number.isInteger(weight) || weight < 1)) {
    return { error: `Weight for ${row.sku} must be a whole number of grams` };
  }
  const low = Number(row.lowStockThreshold || '5');
  const payload: VariantInput = {
    sku: row.sku.trim(),
    size: row.size.trim() || null,
    color: row.color.trim() || null,
    weightGrams: weight,
    priceInPaise: price,
    discountPriceInPaise: discount,
    lowStockThreshold: Number.isInteger(low) && low >= 0 ? low : 5,
    isActive: row.isActive,
  };
  if (forCreate) {
    const stock = Number(row.stock || '0');
    if (!Number.isInteger(stock) || stock < 0) return { error: `Invalid stock for ${row.sku}` };
    payload.stockQty = stock;
  }
  return { payload };
}

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('products.write');
  const queryClient = useQueryClient();

  const existing = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProductById(id!),
    enabled: isEdit,
  });

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api<AdminCategory[]>('/admin/categories'),
  });
  const categoryChoices = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);

  // --- form state ---
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [attrs, setAttrs] = useState<AttrRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [seo, setSeo] = useState<SeoValues>(emptySeoValues());
  const [formError, setFormError] = useState<string | null>(null);

  // Site-wide defaults and the storefront origin drive the honest previews.
  // Both are gated on dashboard.view, so a products-only role simply sees the
  // built-in defaults rather than a permission error.
  const canReadSeo = hasPermission('dashboard.view');
  const seoSettings = useSeoSettings(canReadSeo);
  const siteOrigin = useSiteOrigin(canReadSeo);

  // hydrate on edit
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    const p = existing.data;
    if (!p || loadedId.current === p.id) return;
    loadedId.current = p.id;
    setName(p.name);
    setSlug(p.slug);
    setSlugTouched(true);
    setDescription(p.description);
    setCategoryId(p.categoryId);
    setBadge(p.badge ?? '');
    setIsActive(p.isActive);
    setAttrs(Object.entries(p.attributes ?? {}).map(([key, value]) => ({ key, value })));
    setImages(p.images.map((img) => ({ url: img.url, alt: img.alt ?? '', color: img.color ?? '' })));
    setVariants(p.variants.map(variantToRow));
    setSeo(seoValuesFrom(p));
  }, [existing.data]);

  const onNameChange = (value: string) => {
    setName(value);
    if (!isEdit && !slugTouched) setSlug(slugify(value));
  };

  const setVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  // The category decides which sizes are on offer (its own chart, else its
  // department's). "none" — watches, bags — hides sizes altogether.
  const chosenCategory = (categories.data ?? []).find((c) => c.id === categoryId);
  const parentCategory = chosenCategory?.parentId
    ? (categories.data ?? []).find((c) => c.id === chosenCategory.parentId)
    : undefined;
  const sizeType: SizeType = chosenCategory?.sizeType ?? parentCategory?.sizeType ?? DEFAULT_SIZE_TYPE;
  const chartSizes = SIZE_CHARTS[sizeType].sizes;
  const rowSizes = [...new Set(variants.map((v) => v.size.trim()).filter(Boolean))];
  const sizeChips = [...chartSizes, ...rowSizes.filter((size) => !chartSizes.includes(size))];
  const showSizes = sizeType !== 'none' || rowSizes.length > 0;
  const [customSize, setCustomSize] = useState('');

  /** Tick a size: one row per colour appears. Untick: its unsaved rows go. */
  const toggleSize = (size: string) => {
    setVariants((prev) => {
      if (prev.some((r) => r.size.trim() === size)) {
        // Saved rows carry stock history — they are switched off with "Active", not removed.
        const next = prev.filter((r) => r.size.trim() !== size || r.id);
        return next.length ? next : [emptyVariant()];
      }
      // New rows still waiting for a size take this one.
      if (prev.some((r) => !r.id && r.size.trim() === '')) {
        return prev.map((r) => (!r.id && r.size.trim() === '' ? { ...r, size } : r));
      }
      const colours = [...new Set(prev.map((r) => r.color.trim()))];
      const first = prev[0];
      return [
        ...prev,
        ...colours.map((color) => ({
          ...emptyVariant(),
          size,
          color,
          weightGrams: first?.weightGrams ?? '',
          price: first?.price ?? '',
          discountPrice: first?.discountPrice ?? '',
          lowStockThreshold: first?.lowStockThreshold ?? '5',
        })),
      ];
    });
  };

  const addCustomSize = () => {
    const size = customSize.trim();
    if (!size || size.length > 20) return;
    if (!rowSizes.includes(size)) toggleSize(size);
    setCustomSize('');
  };

  const attributesPayload = (): Record<string, string> | null => {
    const entries = attrs
      .filter((a) => a.key.trim() !== '' && a.value.trim() !== '')
      .map((a) => [a.key.trim(), a.value.trim()] as const);
    return entries.length ? Object.fromEntries(entries) : null;
  };

  const validateShared = (): string | null => {
    if (name.trim().length < 3) return 'Name must be at least 3 characters';
    if (description.trim().length < 10) return 'Description must be at least 10 characters';
    if (!categoryId) return 'Pick a category';
    if (name.trim().length > 200) return 'Name is too long (200 characters max)';
    if (badge.trim().length > 40) return 'Badge is too long (40 characters max)';
    if (images.length > 10) return 'A product can have up to 10 photos';
    if (images.some((img) => img.alt.trim().length > 200)) return 'A photo description is too long (200 characters max)';
    return null;
  };

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api<AdminProduct>('/admin/products', { method: 'POST', body }),
    onSuccess: (p) => {
      toast('Product created', 'success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(`/products/${p.id}`, { replace: true });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (body: unknown) => api<AdminProduct>(`/admin/products/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast('Product saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const saveVariantMutation = useMutation({
    mutationFn: ({ variantId, payload }: { variantId: string; payload: VariantInput }) => {
      const { stockQty: _stock, ...rest } = payload;
      return api<AdminVariant>(`/admin/variants/${variantId}`, { method: 'PATCH', body: rest });
    },
    onSuccess: () => {
      toast('Variant saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const addVariantMutation = useMutation({
    mutationFn: (payload: VariantInput) =>
      api<AdminVariant>(`/admin/products/${id}/variants`, { method: 'POST', body: payload }),
    onSuccess: () => {
      toast('Variant added', 'success');
      loadedId.current = null; // rehydrate rows (to pick up the new id)
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => api<{ deleted: boolean }>(`/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Product deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.removeQueries({ queryKey: ['product', id] });
      navigate('/products', { replace: true });
    },
    onError: (err) => {
      setConfirmDelete(false);
      toast(errorMessage(err), 'error');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const sharedErr = validateShared();
    if (sharedErr) return setFormError(sharedErr);

    if (!isEdit) {
      const addressError = webAddressError(slug);
      if (addressError) return setFormError(addressError);
      if (variants.length === 0) return setFormError('Add at least one variant');
      const built: VariantInput[] = [];
      for (const row of variants) {
        const { error, payload } = buildVariant(row.sku.trim() ? row : { ...row, sku: autoSku(slug, row) }, true);
        if (error) return setFormError(error);
        built.push(payload!);
      }
      const skus = built.map((v) => v.sku.toLowerCase());
      const repeated = skus.find((sku, i) => skus.indexOf(sku) !== i);
      if (repeated) {
        return setFormError(`Two rows share the SKU ${repeated.toUpperCase()} — each size and colour needs its own row`);
      }
      createMutation.mutate({
        name: name.trim(),
        slug,
        description: description.trim(),
        categoryId,
        attributes: attributesPayload(),
        badge: badge.trim() || null,
        isActive,
        images: images.map((img) => ({ url: img.url, alt: img.alt.trim() || null, color: img.color.trim() || null })),
        variants: built,
        ...productSeoPayload(seo),
      });
    } else {
      updateMutation.mutate({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        attributes: attributesPayload(),
        badge: badge.trim() || null,
        isActive,
        images: images.map((img) => ({ url: img.url, alt: img.alt.trim() || null, color: img.color.trim() || null })),
        ...productSeoPayload(seo),
      });
    }
  };

  const onSaveVariantRow = (row: VariantRow) => {
    const { error, payload } = buildVariant(row.sku.trim() ? row : { ...row, sku: autoSku(slug, row) }, false);
    if (error) return toast(error, 'error');
    if (row.id) {
      saveVariantMutation.mutate({ variantId: row.id, payload: payload! });
    } else {
      addVariantMutation.mutate({ ...payload!, stockQty: Number(row.stock || '0') || 0 });
    }
  };

  if (isEdit && existing.isPending) {
    return (
      <main className="page">
        <PageHead overline="Catalog" title="Edit product" />
        <CardSkeleton height={400} />
      </main>
    );
  }
  if (isEdit && existing.isError) {
    return (
      <main className="page">
        <PageHead overline="Catalog" title="Edit product" />
        <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
      </main>
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const colourNames = Array.from(new Set(variants.map((v) => v.color.trim()).filter(Boolean)));
  // One upload box per colour used by the variants, plus one for photos shared by every colour.
  // Photos tagged with a colour no variant uses any more (a renamed colour) stay visible so they can be fixed.
  const leftoverColours = Array.from(new Set(images.map((img) => img.color).filter((c) => c && !colourNames.includes(c))));
  const photoGroups: { key: string; label: string; leftover?: boolean }[] = [
    ...colourNames.map((c) => ({ key: c, label: c })),
    ...leftoverColours.map((c) => ({ key: c, label: c, leftover: true })),
    { key: '', label: colourNames.length ? 'All colours' : 'Product photos' },
  ];

  return (
    <main className="page">
      <PageHead
        overline="Catalog"
        title={isEdit ? existing.data?.name ?? 'Edit product' : 'New product'}
        sub={isEdit ? 'Stock changes live in Inventory — everything else lives here.' : 'A new piece for the shelf.'}
        actions={
          <>
            {isEdit && canWrite && (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete product
              </button>
            )}
            <Link to="/products" className="btn btn-secondary">
              ← All products
            </Link>
          </>
        }
      />

      {confirmDelete && (
        <ConfirmDialog
          title="Delete product?"
          message={`Delete ${existing.data?.name ?? 'this product'} with all its photos, variants and stock history? This cannot be undone. Products that appear on orders cannot be deleted — hide them from the store instead.`}
          confirmLabel="Delete"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <form onSubmit={onSubmit}>
        <div className="detail-grid">
          <div className="stack">
            <div className="card pad">
              <h3 className="card-title">Details</h3>
              {formError && (
                <div className="login-error" role="alert">
                  {formError}
                </div>
              )}
              <div className="field">
                <label htmlFor="p-name">Name</label>
                <input
                  id="p-name"
                  type="text"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  disabled={!canWrite}
                  required
                />
              </div>
              <WebAddressField
                id="p-slug"
                kind="product"
                value={slug}
                origin={siteOrigin}
                locked={isEdit}
                disabled={!canWrite}
                onChange={(v) => {
                  setSlugTouched(true);
                  setSlug(v);
                }}
              />
              <div className="field">
                <label htmlFor="p-desc">Description</label>
                <textarea
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canWrite}
                  required
                />
              </div>
              <div className="form-row cols-2">
                <div className="field">
                  <label htmlFor="p-cat">Category</label>
                  <CategorySelect
                    id="p-cat"
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categoryChoices}
                    placeholder="Choose a category…"
                    disabled={!canWrite}
                  />
                </div>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <label className="checkbox" style={{ marginTop: 22 }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={!canWrite}
                    />
                    Visible in the store
                  </label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="p-badge">Badge</label>
                <input
                  id="p-badge"
                  type="text"
                  maxLength={40}
                  placeholder="Bestseller"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  disabled={!canWrite}
                />
                <span className="hint">Optional merchandising flag on the product card — "New", "Bestseller", "Festive Edit".</span>
              </div>
            </div>

            <div className="card pad">
              <h3 className="card-title">Variants</h3>
              {isEdit && (
                <p className="hint" style={{ marginBottom: 10, fontSize: 12.5, color: 'var(--ink-500)' }}>
                  One row per colour and size. Each row has its own price and stock, so a Maroon saree can cost more than a
                  Sage one. Stock is adjusted in{' '}
                  <Link to="/inventory" className="link">
                    Inventory
                  </Link>{' '}
                  so every change is logged. Other fields save per row.
                </p>
              )}
              {showSizes ? (
                <div className="sizepick">
                  <div className="sizepick-head">
                    <span className="sizepick-label">Sizes</span>
                    <span className="hint">
                      {chosenCategory
                        ? `${SIZE_CHARTS[sizeType].label} — set by the ${chosenCategory.name} category`
                        : 'Pick a category to see its sizes'}
                    </span>
                  </div>
                  <div className="sizepick-chips" role="group" aria-label="Sizes this product comes in">
                    {sizeChips.map((size) => {
                      const rows = variants.filter((r) => r.size.trim() === size);
                      const locked = rows.length > 0 && rows.every((r) => r.id);
                      return (
                        <button
                          key={size}
                          type="button"
                          className="size-chip"
                          aria-pressed={rows.length > 0}
                          disabled={!canWrite || locked}
                          title={locked ? 'Already saved — untick Active on its row to stop selling it' : undefined}
                          onClick={() => toggleSize(size)}
                        >
                          {size}
                        </button>
                      );
                    })}
                    {canWrite && (
                      <span className="sizepick-custom">
                        <input
                          type="text"
                          aria-label="Another size"
                          placeholder="Other size"
                          maxLength={20}
                          value={customSize}
                          onChange={(e) => setCustomSize(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomSize();
                            }
                          }}
                        />
                        <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomSize} disabled={!customSize.trim()}>
                          Add
                        </button>
                      </span>
                    )}
                  </div>
                  <span className="hint">
                    Tick every size you stock. Each one gets a row below for every colour, with its own price and stock.
                  </span>
                </div>
              ) : (
                <p className="hint sizepick-none">
                  Products in {chosenCategory?.name ?? 'this category'} don't come in sizes, so there is no size to fill
                  in. You can change that under Categories.
                </p>
              )}
              <div className="variant-grid">
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      {showSizes && <th>Size</th>}
                      <th>Colour</th>
                      <th className="num">Weight g</th>
                      <th className="num">Price ₹</th>
                      <th className="num">Discount ₹</th>
                      <th className="num">Stock</th>
                      <th className="num">Low @</th>
                      <th>Active</th>
                      {isEdit && canWrite && <th />}
                      {!isEdit && canWrite && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((row, i) => (
                      <tr key={row.id ?? `new-${i}`}>
                        <td style={{ minWidth: 130 }}>
                          <input
                            type="text"
                            aria-label={`Variant ${i + 1} SKU`}
                            placeholder="Auto"
                            value={row.sku}
                            onChange={(e) => setVariant(i, { sku: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        {showSizes && (
                          <td style={{ width: 96 }}>
                            <input
                              type="text"
                              aria-label={`Variant ${i + 1} size`}
                              value={row.size}
                              onChange={(e) => setVariant(i, { size: e.target.value })}
                              disabled={!canWrite}
                            />
                          </td>
                        )}
                        <td style={{ minWidth: 190 }}>
                          <div className="colour-cell">
                            <span
                              className={`colour-dot${swatchFor(row.color || '').light ? ' colour-dot--light' : ''}`}
                              style={{ background: row.color ? swatchFor(row.color).fill : 'transparent' }}
                              title={row.color || 'No colour'}
                              aria-hidden="true"
                            />
                            <input
                              type="text"
                              list="colour-suggestions"
                              aria-label={`Variant ${i + 1} colour`}
                              placeholder="e.g. Maroon"
                              value={row.color}
                              onChange={(e) => setVariant(i, { color: e.target.value })}
                              disabled={!canWrite}
                            />
                          </div>
                        </td>
                        <td style={{ width: 80 }}>
                          <input
                            type="number"
                            min={1}
                            aria-label={`Variant ${i + 1} weight in grams`}
                            value={row.weightGrams}
                            onChange={(e) => setVariant(i, { weightGrams: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        <td style={{ width: 96 }}>
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            aria-label={`Variant ${i + 1} price in rupees`}
                            value={row.price}
                            onChange={(e) => setVariant(i, { price: e.target.value })}
                            disabled={!canWrite}
                            required
                          />
                        </td>
                        <td style={{ width: 96 }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`Variant ${i + 1} discount price in rupees`}
                            value={row.discountPrice}
                            onChange={(e) => setVariant(i, { discountPrice: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        <td style={{ width: 76 }}>
                          {row.id ? (
                            <span className="num mono" style={{ display: 'block', textAlign: 'right', paddingRight: 6 }}>
                              {row.stockQty}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              aria-label={`Variant ${i + 1} opening stock`}
                              value={row.stock}
                              onChange={(e) => setVariant(i, { stock: e.target.value })}
                              disabled={!canWrite}
                            />
                          )}
                        </td>
                        <td style={{ width: 66 }}>
                          <input
                            type="number"
                            min={0}
                            aria-label={`Variant ${i + 1} low stock threshold`}
                            value={row.lowStockThreshold}
                            onChange={(e) => setVariant(i, { lowStockThreshold: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Variant ${i + 1} active`}
                            checked={row.isActive}
                            onChange={(e) => setVariant(i, { isActive: e.target.checked })}
                            disabled={!canWrite}
                          />
                        </td>
                        {canWrite && (
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {isEdit ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => onSaveVariantRow(row)}
                                disabled={saveVariantMutation.isPending || addVariantMutation.isPending}
                              >
                                {row.id ? 'Save' : 'Add'}
                              </button>
                            ) : (
                              variants.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  aria-label={`Remove variant ${i + 1}`}
                                  onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                                >
                                  Remove
                                </button>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
                >
                  + Add variant row
                </button>
              )}
            </div>
          </div>

          <div className="stack">
            <div className="card pad">
              <h3 className="card-title">Photos</h3>
              <p className="muted" style={{ fontSize: 13, margin: '-6px 0 14px' }}>
                Each colour gets its own photos. Shoppers see the photos for the colour they pick. Colours come from the
                Variants table — add a variant row with a colour and its box appears here.
              </p>
              <datalist id="colour-suggestions">
                {Array.from(new Set([...colourNames, ...SUGGESTED_COLOURS])).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {photoGroups.map((group) => {
                const groupImages = images.filter((img) => (img.color || '') === group.key);
                return (
                  <div className="photo-group" key={group.key || '__all__'}>
                    <div className="photo-group-head">
                      {group.key ? (
                        <span
                          className={`colour-dot${swatchFor(group.key).light ? ' colour-dot--light' : ''}`}
                          style={{ background: swatchFor(group.key).fill }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <strong>{group.label}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {group.leftover
                          ? `No variant is called “${group.key}” any more, so shoppers can't see these. Move them to a colour or remove them.`
                          : group.key
                            ? `Shown when a shopper picks ${group.key}.`
                            : 'Shown for every colour, e.g. fabric close-ups.'}
                      </span>
                      {group.leftover && canWrite && colourNames.length > 0 && (
                        <select
                          aria-label={`Move ${group.key} photos to`}
                          value=""
                          onChange={(e) => {
                            const to = e.target.value;
                            if (to === '') return;
                            const target = to === '__all__' ? '' : to;
                            setImages((prev) => prev.map((im) => (im.color === group.key ? { ...im, color: target } : im)));
                          }}
                        >
                          <option value="">Move these photos to…</option>
                          {colourNames.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="__all__">All colours</option>
                        </select>
                      )}
                    </div>
                    {groupImages.length > 0 && (
                      <div className="photo-grid">
                        {groupImages.map((img) => {
                          const i = images.indexOf(img);
                          return (
                            <div className="photo-cell" key={`${img.url}-${i}`}>
                              <img
                                src={assetUrl(img.url) ?? ''}
                                alt={img.alt || ''}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                                }}
                              />
                              {i === 0 && <span className="photo-main">Main photo</span>}
                              {canWrite && (
                                <button
                                  type="button"
                                  className="photo-remove"
                                  aria-label={`Remove photo ${i + 1}`}
                                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                >
                                  ✕
                                </button>
                              )}
                              {canWrite && (
                                <button
                                  type="button"
                                  className="photo-first"
                                  title="Make this the first photo"
                                  aria-label={`Make photo ${i + 1} the first photo`}
                                  onClick={() => setImages((prev) => [img, ...prev.filter((_, j) => j !== i)])}
                                  disabled={i === 0}
                                >
                                  ★
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canWrite && !group.leftover && (
                      <ImageInput
                        max={10}
                        showPreviews={false}
                        value={groupImages.map((img) => img.url)}
                        hint={group.key ? `Add ${group.key} photos — up to 10.` : 'Optional. Photos that apply to every colour.'}
                        onChange={(urls) =>
                          setImages((prev) => {
                            const others = prev.filter((im) => (im.color || '') !== group.key);
                            const mine = urls.map(
                              (url) => prev.find((im) => im.url === url && (im.color || '') === group.key) ?? { url, alt: '', color: group.key },
                            );
                            return [...others, ...mine];
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
              {images.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No photos yet.</p>}
            </div>

            <div className="card pad">
              <h3 className="card-title">Attributes</h3>
              <div className="editor-rows">
                {attrs.map((a, i) => (
                  <div className="editor-row" key={i}>
                    <input
                      type="text"
                      placeholder="Fabric"
                      aria-label={`Attribute ${i + 1} name`}
                      value={a.key}
                      onChange={(e) =>
                        setAttrs((prev) => prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                      }
                      disabled={!canWrite}
                    />
                    <input
                      type="text"
                      placeholder="Banarasi silk"
                      aria-label={`Attribute ${i + 1} value`}
                      value={a.value}
                      onChange={(e) =>
                        setAttrs((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                      }
                      disabled={!canWrite}
                    />
                    {canWrite && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Remove attribute ${i + 1}`}
                        onClick={() => setAttrs((prev) => prev.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {attrs.length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Fabric, occasion, care instructions…
                  </p>
                )}
              </div>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => setAttrs((prev) => [...prev, { key: '', value: '' }])}
                >
                  + Add attribute
                </button>
              )}
            </div>

            {canWrite && (
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save product' : 'Create product'}
              </button>
            )}
          </div>
        </div>

        {/* Full width rather than inside the two-column grid: the previews are
            only honest at something near a real result's width, and the left
            column tops out around 400px. The second Save is the same submit as
            the one in the sidebar — this section sits far below it. */}
        <div className="card pad seo-section">
          <h3 className="card-title">SEO &amp; sharing</h3>
          <p className="seo-lede">
            Every field here is optional. Left empty, the storefront works out a sensible value at request time —
            the previews show exactly what a crawler would receive today.
          </p>
          <SeoPanel
            idPrefix="p-seo"
            subject={{
              kind: 'product',
              name: name.trim(),
              slug: slug || 'product-name',
              description,
              imageUrl: images[0]?.url ?? null,
            }}
            values={seo}
            onChange={(patch) => setSeo((prev) => ({ ...prev, ...patch }))}
            settings={seoSettings.data}
            origin={siteOrigin}
            disabled={!canWrite}
          />
          {canWrite && (
            <div className="seo-save">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save product' : 'Create product'}
              </button>
            </div>
          )}
        </div>
      </form>
    </main>
  );
}
