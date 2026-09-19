import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { HOME_SECTION_TYPES, type HomeSectionType } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { AdminHomeSection } from '../lib/types';
import { formatDate, humanize } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CardSkeleton, EmptyState, ErrorState, PageHead, Switch } from '../components/ui';
import { STOREFRONT_URL } from '../lib/format';

/** Where the storefront lives, for the "preview" link. */

const TYPE_HINTS: Record<HomeSectionType, string> = {
  HERO_CAROUSEL: 'Full-bleed promotional banners',
  CATEGORY_RAIL: 'Circular category chips',
  CATEGORY_CARDS: 'Editorial category cards',
  BANNER_GRID: '2-4 offer tiles with a label',
  PRODUCT_CAROUSEL: 'Products by newest, category or hand-pick',
  EDITORIAL: 'Image + copy + CTA strip',
};

function scheduleLabel(section: AdminHomeSection): string {
  if (!section.startsAt && !section.endsAt) return 'Always on';
  const from = section.startsAt ? formatDate(section.startsAt) : 'now';
  const to = section.endsAt ? formatDate(section.endsAt) : 'no end';
  return `${from} → ${to}`;
}

export function Content() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('content.write');

  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<HomeSectionType>('HERO_CAROUSEL');
  const [newTitle, setNewTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminHomeSection | null>(null);

  const sections = useQuery({
    queryKey: ['home-sections'],
    queryFn: () => api<AdminHomeSection[]>('/admin/home-sections'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['home-sections'] });

  const create = useMutation({
    mutationFn: () =>
      api<AdminHomeSection>('/admin/home-sections', {
        method: 'POST',
        body: {
          type: newType,
          title: newTitle.trim() || null,
          isActive: true,
          ...(newType === 'PRODUCT_CAROUSEL' ? { config: { source: 'newest', limit: 12 } } : {}),
        },
      }),
    onSuccess: (section) => {
      toast('Section created', 'success');
      setCreating(false);
      setNewTitle('');
      invalidate();
      navigate(`/content/${section.id}`);
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api<AdminHomeSection>(`/admin/home-sections/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: (section) => {
      toast(section.isActive ? 'Section is live' : 'Section hidden', 'success');
      invalidate();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api<AdminHomeSection[]>('/admin/home-sections/reorder', { method: 'POST', body: { ids } }),
    onSuccess: (next) => queryClient.setQueryData(['home-sections'], next),
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/home-sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Section deleted', 'success');
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setDeleting(null);
    },
  });

  const rows = sections.data ?? [];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((s) => s.id);
    const moved = ids[index];
    const displaced = ids[target];
    if (!moved || !displaced) return;
    ids[index] = displaced;
    ids[target] = moved;
    reorder.mutate(ids);
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    create.mutate();
  };

  return (
    <main className="page">
      <PageHead
        overline="Content"
        title="Homepage"
        sub="The stack of sections the storefront renders, top to bottom."
        actions={
          <>
            <a className="btn btn-secondary" href={STOREFRONT_URL} target="_blank" rel="noreferrer">
              Preview ↗
            </a>
            {canWrite && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setFormError(null);
                  setCreating(true);
                }}
              >
                + New section
              </button>
            )}
          </>
        }
      />

      {sections.isPending ? (
        <CardSkeleton height={320} />
      ) : sections.isError ? (
        <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            title="The homepage is empty"
            message="Add a hero banner, a category rail and a product carousel to give the storefront something to show."
            action={
              canWrite ? (
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                  + New section
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 84 }}>Order</th>
                <th>Section</th>
                <th>Schedule</th>
                <th className="num">Items</th>
                <th style={{ width: 90 }}>Live</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((section, i) => (
                <tr key={section.id}>
                  <td>
                    <div className="reorder">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Move ${humanize(section.type)} up`}
                        disabled={!canWrite || i === 0 || reorder.isPending}
                        onClick={() => move(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Move ${humanize(section.type)} down`}
                        disabled={!canWrite || i === rows.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="primary">
                    <Link to={`/content/${section.id}`} className="link">
                      {section.title ?? humanize(section.type)}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      <span className="pill neutral">{humanize(section.type)}</span>{' '}
                      {section.subtitle ?? TYPE_HINTS[section.type]}
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {scheduleLabel(section)}
                  </td>
                  <td className="num mono">
                    {section.type === 'PRODUCT_CAROUSEL' ? `up to ${section.config?.limit ?? 12}` : section.items.length}
                  </td>
                  <td>
                    <Switch
                      checked={section.isActive}
                      disabled={!canWrite || toggleActive.isPending}
                      label={`${section.title ?? humanize(section.type)} visible on the homepage`}
                      onChange={(next) => toggleActive.mutate({ id: section.id, isActive: next })}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link to={`/content/${section.id}`} className="btn btn-ghost btn-sm">
                      Edit
                    </Link>
                    {canWrite && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => setDeleting(section)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal
          title="New section"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCreating(false)} disabled={create.isPending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onCreate} disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <form onSubmit={onCreate}>
            {formError && (
              <div className="login-error" role="alert">
                {formError}
              </div>
            )}
            <div className="field">
              <label htmlFor="s-type">Type</label>
              <select id="s-type" value={newType} onChange={(e) => setNewType(e.target.value as HomeSectionType)}>
                {HOME_SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </select>
              <span className="hint">{TYPE_HINTS[newType]}</span>
            </div>
            <div className="field">
              <label htmlFor="s-title">Title (optional)</label>
              <input
                id="s-title"
                type="text"
                placeholder="In the spotlight"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <span className="hint">Shown above the section on the storefront. Leave blank for hero banners.</span>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete section?"
          message={
            <>
              Delete <strong>{deleting.title ?? humanize(deleting.type)}</strong> and its {deleting.items.length}{' '}
              item{deleting.items.length === 1 ? '' : 's'}? This cannot be undone.
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
