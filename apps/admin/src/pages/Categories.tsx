import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, assetUrl, errorMessage } from '../lib/api';
import type { AdminCategory } from '../lib/types';
import { slugify } from '../lib/format';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CardSkeleton, EmptyState, ErrorState, PageHead, Pill } from '../components/ui';
import { ImageInput } from '../components/ImageInput';
import { SeoPanel } from '../components/seo';
import {
  categorySeoPayload,
  emptySeoValues,
  seoValuesFrom,
  useSeoSettings,
  useSiteOrigin,
  type SeoValues,
} from '../lib/seo';
import { useAuth } from '../lib/auth';

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  parentId: string;
  sortOrder: string;
  imageUrl: string;
  isActive: boolean;
  seo: SeoValues;
}

const emptyForm = (): CategoryFormState => ({
  name: '',
  slug: '',
  parentId: '',
  sortOrder: '0',
  imageUrl: '',
  isActive: true,
  seo: emptySeoValues(),
});

export function Categories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [tab, setTab] = useState<'details' | 'seo'>('details');
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canReadSeo = hasPermission('dashboard.view');
  const seoSettings = useSeoSettings(canReadSeo);
  const siteOrigin = useSiteOrigin(canReadSeo);

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api<AdminCategory[]>('/admin/categories'),
  });

  const tree = useMemo(() => {
    const all = categories.data ?? [];
    const parents = all.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    return parents.map((p) => {
      const children = all.filter((c) => c.parentId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
      // Products hang off subcategories, so a department's real count is its
      // own plus everything beneath it.
      const productCount =
        (p._count?.products ?? 0) + children.reduce((sum, c) => sum + (c._count?.products ?? 0), 0);
      return { parent: p, children, productCount };
    });
  }, [categories.data]);

  const totals = useMemo(
    () => ({
      departments: tree.length,
      subcategories: tree.reduce((n, t) => n + t.children.length, 0),
      products: tree.reduce((n, t) => n + t.productCount, 0),
    }),
    [tree],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] });

  const save = useMutation({
    mutationFn: (state: CategoryFormState) => {
      const body = {
        name: state.name.trim(),
        slug: state.slug,
        parentId: state.parentId || null,
        sortOrder: Math.max(0, Number(state.sortOrder) || 0),
        imageUrl: state.imageUrl.trim() || null,
        isActive: state.isActive,
        ...categorySeoPayload(state.seo),
      };
      return state.id
        ? api<AdminCategory>(`/admin/categories/${state.id}`, { method: 'PATCH', body })
        : api<AdminCategory>('/admin/categories', { method: 'POST', body });
    },
    onSuccess: (_d, state) => {
      toast(state.id ? 'Category saved' : 'Category created', 'success');
      setForm(null);
      invalidate();
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Category deleted', 'success');
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setDeleting(null);
    },
  });

  const openCreate = (parentId = '') => {
    setFormError(null);
    setSlugTouched(false);
    setTab('details');
    setForm({ ...emptyForm(), parentId });
  };
  const openEdit = (c: AdminCategory) => {
    setFormError(null);
    setSlugTouched(true);
    setTab('details');
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ?? '',
      sortOrder: String(c.sortOrder),
      imageUrl: c.imageUrl ?? '',
      isActive: c.isActive,
      seo: seoValuesFrom(c),
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    // Both failures live on the Details tab — surface the tab holding the field.
    if (form.name.trim().length < 2) {
      setTab('details');
      return setFormError('Name must be at least 2 characters');
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setTab('details');
      return setFormError('Slug may only contain lowercase letters, digits and dashes');
    }
    save.mutate(form);
  };

  const parentOptions = (categories.data ?? []).filter((c) => !c.parentId && c.id !== form?.id);

  /** Initials used when a department has no image of its own. */
  const monogram = (name: string) =>
    name
      .split(/[\s&]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

  const renderDepartment = ({
    parent,
    children,
    productCount,
  }: {
    parent: AdminCategory;
    children: AdminCategory[];
    productCount: number;
  }) => (
    <article className="dept" key={parent.id}>
      <header className="dept-head">
        <span className="dept-mark" aria-hidden="true">
          {parent.imageUrl ? (
            <img
              src={assetUrl(parent.imageUrl) ?? ''}
              alt=""
              onError={(e) => {
                // Fall back to the monogram rather than a broken-image glyph.
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            monogram(parent.name)
          )}
        </span>
        <div className="dept-id">
          <h2 className="dept-name">
            {parent.name}
            {!parent.isActive && <Pill status="HIDDEN" />}
          </h2>
          <p className="dept-meta">
            <code>/{parent.slug}</code>
            <span aria-hidden="true">·</span>
            <span>
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}
            </span>
          </p>
        </div>
      </header>

      <div className="dept-subs">
        {children.length === 0 ? (
          <p className="dept-empty">No subcategories yet.</p>
        ) : (
          <ul className="sub-chips">
            {children.map((c) => (
              <li key={c.id} className={`sub-chip${c.isActive ? '' : ' sub-chip--off'}`}>
                <button
                  type="button"
                  className="sub-chip-main"
                  onClick={() => openEdit(c)}
                  title={`Edit ${c.name} (/${c.slug})`}
                >
                  <span className="sub-chip-name">{c.name}</span>
                  <span className="sub-chip-count">{c._count?.products ?? 0}</span>
                </button>
                <button
                  type="button"
                  className="sub-chip-del"
                  aria-label={`Delete ${c.name}`}
                  title={`Delete ${c.name}`}
                  onClick={() => setDeleting(c)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="dept-foot">
        <button className="btn btn-secondary btn-sm" onClick={() => openCreate(parent.id)}>
          + Subcategory
        </button>
        <div className="dept-foot-right">
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(parent)}>
            Edit
          </button>
          <button
            className="btn btn-ghost btn-sm dept-del"
            onClick={() => setDeleting(parent)}
          >
            Delete
          </button>
        </div>
      </footer>
    </article>
  );

  return (
    <main className="page">
      <PageHead
        overline="Catalog"
        title="Categories"
        sub="The tree the storefront navigates by."
        actions={
          <button className="btn btn-primary" onClick={() => openCreate()}>
            + New category
          </button>
        }
      />

      {categories.isPending ? (
        <CardSkeleton height={320} />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : tree.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No categories yet"
            message="Create the top-level departments first — sarees, dresses, tops…"
            action={
              <button className="btn btn-primary" onClick={() => openCreate()}>
                + New category
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="cat-summary">
            <div>
              <span className="cat-summary-n">{totals.departments}</span>
              <span className="cat-summary-l">Departments</span>
            </div>
            <div>
              <span className="cat-summary-n">{totals.subcategories}</span>
              <span className="cat-summary-l">Subcategories</span>
            </div>
            <div>
              <span className="cat-summary-n">{totals.products}</span>
              <span className="cat-summary-l">Products</span>
            </div>
          </div>
          <div className="dept-grid">{tree.map(renderDepartment)}</div>
        </>
      )}

      {form && (
        <Modal
          wide
          title={form.id ? 'Edit category' : 'New category'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)} disabled={save.isPending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSubmit} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : form.id ? 'Save' : 'Create'}
              </button>
            </>
          }
        >
          <form onSubmit={onSubmit}>
            {formError && (
              <div className="login-error" role="alert">
                {formError}
              </div>
            )}

            <div className="segmented modal-tabs" role="tablist" aria-label="Category sections">
              <button
                type="button"
                role="tab"
                data-no-autofocus
                aria-selected={tab === 'details'}
                className={tab === 'details' ? 'active' : ''}
                onClick={() => setTab('details')}
              >
                Details
              </button>
              <button
                type="button"
                role="tab"
                data-no-autofocus
                aria-selected={tab === 'seo'}
                className={tab === 'seo' ? 'active' : ''}
                onClick={() => setTab('seo')}
              >
                SEO &amp; sharing
              </button>
            </div>

            {/* Both panes stay mounted so an edit on one tab is never lost by
                switching to the other before saving. */}
            <div hidden={tab !== 'details'}>
            <div className="field">
              <label htmlFor="c-name">Name</label>
              <input
                id="c-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) =>
                    f && {
                      ...f,
                      name: e.target.value,
                      slug: slugTouched ? f.slug : slugify(e.target.value),
                    },
                  )
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="c-slug">Slug</label>
              <input
                id="c-slug"
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  const v = slugify(e.target.value);
                  setForm((f) => f && { ...f, slug: v });
                }}
                required
              />
            </div>
            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="c-parent">Parent</label>
                <select
                  id="c-parent"
                  value={form.parentId}
                  onChange={(e) => setForm((f) => f && { ...f, parentId: e.target.value })}
                >
                  <option value="">None (top level)</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-sort">Sort order</label>
                <input
                  id="c-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => f && { ...f, sortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <ImageInput
                label="Category image (optional)"
                hint="Shown on the storefront category tile and in this list."
                max={1}
                value={form.imageUrl ? [form.imageUrl] : []}
                onChange={(urls) => setForm((f) => f && { ...f, imageUrl: urls[0] ?? '' })}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => f && { ...f, isActive: e.target.checked })}
              />
              Active
            </label>
            </div>

            <div hidden={tab !== 'seo'}>
              <SeoPanel
                idPrefix="c-seo"
                subject={{
                  kind: 'category',
                  name: form.name.trim(),
                  slug: form.slug || 'category-slug',
                  description: '',
                  imageUrl: form.imageUrl || null,
                }}
                values={form.seo}
                onChange={(patch) =>
                  setForm((f) => f && { ...f, seo: { ...f.seo, ...patch } })
                }
                settings={seoSettings.data}
                origin={siteOrigin}
                layout="stacked"
              />
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete category?"
          message={
            <>
              Delete <strong>{deleting.name}</strong>? Its products must be moved first — the API will refuse
              otherwise. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
