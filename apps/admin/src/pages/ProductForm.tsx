import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Paginated } from '@chikbo/shared';
import { api, assetUrl, errorMessage } from '../lib/api';
import { ImageInput } from '../components/ImageInput';
import type { AdminCategory, AdminProduct, AdminVariant, VariantInput } from '../lib/types';
import { categoryOptions, paiseToRupees, rupeesToPaise, slugify } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { CardSkeleton, ErrorState, PageHead } from '../components/ui';
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

/** Validate one variant row; returns an error string or the API payload. */
function buildVariant(row: VariantRow, forCreate: boolean): { error?: string; payload?: VariantInput } {
  if (row.sku.trim().length < 2) return { error: 'SKU must be at least 2 characters' };
  const price = rupeesToPaise(row.price);
  if (price === null || price < 100) return { error: `Price for ${row.sku || 'variant'} must be at least ₹1` };
  const discount = row.discountPrice.trim() === '' ? null : rupeesToPaise(row.discountPrice);
  if (row.discountPrice.trim() !== '' && discount === null) return { error: `Invalid discount for ${row.sku}` };
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
    setImages(p.images.map((img) => ({ url: img.url, alt: img.alt ?? '' })));
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const sharedErr = validateShared();
    if (sharedErr) return setFormError(sharedErr);

    if (!isEdit) {
      if (!/^[a-z0-9-]+$/.test(slug)) return setFormError('Slug may only contain lowercase letters, digits and dashes');
      if (variants.length === 0) return setFormError('Add at least one variant');
      const built: VariantInput[] = [];
      for (const row of variants) {
        const { error, payload } = buildVariant(row, true);
        if (error) return setFormError(error);
        built.push(payload!);
      }
      createMutation.mutate({
        name: name.trim(),
        slug,
        description: description.trim(),
        categoryId,
        attributes: attributesPayload(),
        badge: badge.trim() || null,
        isActive,
        images: images.map((img) => ({ url: img.url, alt: img.alt.trim() || null })),
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
        images: images.map((img) => ({ url: img.url, alt: img.alt.trim() || null })),
        ...productSeoPayload(seo),
      });
    }
  };

  const onSaveVariantRow = (row: VariantRow) => {
    const { error, payload } = buildVariant(row, false);
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

  return (
    <main className="page">
      <PageHead
        overline="Catalog"
        title={isEdit ? existing.data?.name ?? 'Edit product' : 'New product'}
        sub={isEdit ? 'Stock changes live in Inventory — everything else lives here.' : 'A new piece for the shelf.'}
        actions={
          <Link to="/products" className="btn btn-secondary">
            ← All products
          </Link>
        }
      />

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
              <div className="field">
                <label htmlFor="p-slug">Slug</label>
                <input
                  id="p-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  disabled={isEdit || !canWrite}
                />
                <span className="hint">
                  {isEdit ? 'Slugs are permanent once published.' : 'Auto-suggested from the name; lowercase and dashes.'}
                </span>
              </div>
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
                  <select
                    id="p-cat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={!canWrite}
                    required
                  >
                    <option value="">Choose…</option>
                    {categoryOptions(categories.data ?? []).map((c) => (
                      <option key={c.id} value={c.id} title={c.path}>
                        {c.isChild ? '  — ' : ''}
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                  Stock is adjusted in{' '}
                  <Link to="/inventory" className="link">
                    Inventory
                  </Link>{' '}
                  so every change is logged. Other fields save per row.
                </p>
              )}
              <div className="variant-grid">
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Size</th>
                      <th>Color</th>
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
                            value={row.sku}
                            onChange={(e) => setVariant(i, { sku: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        <td style={{ width: 70 }}>
                          <input
                            type="text"
                            aria-label={`Variant ${i + 1} size`}
                            value={row.size}
                            onChange={(e) => setVariant(i, { size: e.target.value })}
                            disabled={!canWrite}
                          />
                        </td>
                        <td style={{ width: 100 }}>
                          <input
                            type="text"
                            aria-label={`Variant ${i + 1} color`}
                            value={row.color}
                            onChange={(e) => setVariant(i, { color: e.target.value })}
                            disabled={!canWrite}
                          />
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
              <h3 className="card-title">Images</h3>
              <div className="editor-rows">
                {images.map((img, i) => (
                  <div className="img-tile" key={`${img.url}-${i}`}>
                    <img
                      src={assetUrl(img.url) ?? ''}
                      alt=""
                      style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 5, background: 'var(--cream-100)' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                    <span className="url" title={img.url}>
                      {img.url}
                    </span>
                    <input
                      type="text"
                      placeholder="Alt text"
                      aria-label={`Alt text for image ${i + 1}`}
                      style={{ width: 110 }}
                      value={img.alt}
                      onChange={(e) =>
                        setImages((prev) => prev.map((im, j) => (j === i ? { ...im, alt: e.target.value } : im)))
                      }
                      disabled={!canWrite}
                    />
                    {canWrite && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {images.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No images yet.</p>}
              </div>
              {canWrite && (
                <div style={{ marginTop: 12 }}>
                  <ImageInput
                    max={6}
                    showPreviews={false}
                    value={images.map((img) => img.url)}
                    hint="The first image is the card thumbnail. Drag to add several at once."
                    onChange={(urls) =>
                      // Keep the alt text already written for images that survive.
                      setImages((prev) =>
                        urls.map((url) => prev.find((im) => im.url === url) ?? { url, alt: '' }),
                      )
                    }
                  />
                </div>
              )}
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
              slug: slug || 'product-slug',
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
