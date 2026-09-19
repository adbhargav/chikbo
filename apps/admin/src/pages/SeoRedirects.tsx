import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/Modal';
import { EmptyState, ErrorState, Pagination, TableSkeleton } from '../components/ui';
import type { SeoRedirect } from '../lib/seo';

const emptyForm = { source: '', destination: '', statusCode: '301' };

/** Normalise what people paste: a full URL becomes its path, and paths get a slash. */
function toPath(input: string): string {
  const raw = input.trim();
  if (raw === '') return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`.replace(/\/+$/, '') || '/';
    } catch {
      return raw;
    }
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function SeoRedirects({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SeoRedirect | null>(null);

  const redirects = useQuery({
    queryKey: ['seo-redirects', page],
    queryFn: () => api<Paginated<SeoRedirect>>('/admin/seo/redirects', { query: { page, pageSize: 50 } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['seo-redirects'] });
    queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
  };

  const create = useMutation({
    mutationFn: (body: { source: string; destination: string; statusCode: number }) =>
      api<SeoRedirect>('/admin/seo/redirects', { method: 'POST', body }),
    onSuccess: () => {
      toast('Redirect added', 'success');
      setForm(emptyForm);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/seo/redirects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Redirect removed', 'success');
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setDeleting(null);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const source = toPath(form.source);
    const destination = toPath(form.destination);
    if (!source.startsWith('/')) return setError('The old path must start with /');
    if (!destination.startsWith('/')) return setError('The new path must start with /');
    if (source.startsWith('//') || destination.startsWith('//')) {
      return setError('Paths must not start with // — that is read as another site.');
    }
    if (source === destination) return setError('A redirect cannot point at itself.');
    create.mutate({ source, destination, statusCode: Number(form.statusCode) });
  };

  // The API refuses chains that fold back on themselves; that answer deserves
  // an explanation rather than a bare red line.
  const isLoopError = error?.toLowerCase().includes('loop') ?? false;

  return (
    <div className="stack">
      {canWrite && (
        <div className="card pad">
          <h3 className="card-title">Add a redirect</h3>
          <p className="seo-lede">
            When a URL changes, point the old path here so the link keeps working and its search ranking carries
            over. Slug changes made in the catalogue already add their own redirect automatically.
          </p>
          {error && (
            <div className="login-error" role="alert">
              {error}
              {isLoopError && (
                <div style={{ marginTop: 6, fontWeight: 400 }}>
                  The destination already redirects back to this path. Following it would bounce a visitor between
                  the two forever, so remove the other redirect first, or send this one somewhere else.
                </div>
              )}
            </div>
          )}
          <form onSubmit={onSubmit}>
            <div className="redirect-form">
              <div className="field">
                <label htmlFor="r-source">Old path</label>
                <input
                  id="r-source"
                  type="text"
                  placeholder="/p/old-product-name"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="r-destination">New path</label>
                <input
                  id="r-destination"
                  type="text"
                  placeholder="/p/new-product-name"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="r-status">Type</label>
                <select
                  id="r-status"
                  value={form.statusCode}
                  onChange={(e) => setForm((f) => ({ ...f, statusCode: e.target.value }))}
                >
                  <option value="301">301 — permanent</option>
                  <option value="302">302 — temporary</option>
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={create.isPending}>
                {create.isPending ? 'Adding…' : 'Add redirect'}
              </button>
            </div>
            <span className="hint">
              301 passes ranking to the new URL and is what a permanent move needs; 302 keeps the old URL indexed.
            </span>
          </form>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Old path</th>
              <th>New path</th>
              <th>Type</th>
              <th>Added by</th>
              <th className="num">Hits</th>
              <th>Created</th>
              {canWrite && <th />}
            </tr>
          </thead>
          {redirects.isPending ? (
            <TableSkeleton cols={canWrite ? 7 : 6} />
          ) : (
            <tbody>
              {(redirects.data?.items ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="primary">
                    <code>{r.source}</code>
                  </td>
                  <td>
                    <code>{r.destination}</code>
                  </td>
                  <td>
                    <span className={`pill ${r.statusCode === 301 ? 'info' : 'neutral'}`}>{r.statusCode}</span>
                  </td>
                  <td className="muted">{r.origin === 'MANUAL' ? 'Added by hand' : 'Web address changed'}</td>
                  <td className="num">{r.hits.toLocaleString('en-IN')}</td>
                  <td className="muted">{formatDate(r.createdAt)}</td>
                  {canWrite && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm dept-del" onClick={() => setDeleting(r)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {redirects.isError && <ErrorState error={redirects.error} onRetry={() => redirects.refetch()} />}
        {!redirects.isPending && !redirects.isError && (redirects.data?.items.length ?? 0) === 0 && (
          <EmptyState
            title="No redirects"
            message="Nothing has moved yet. When you change a category\u2019s web address, a forwarding link appears here automatically."
          />
        )}
      </div>

      {redirects.data && (
        <Pagination
          page={redirects.data.page}
          totalPages={redirects.data.totalPages}
          total={redirects.data.total}
          onPage={setPage}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete redirect?"
          danger
          confirmLabel="Delete"
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          message={
            <>
              <code>{deleting.source}</code> will stop forwarding to <code>{deleting.destination}</code> and start
              returning a 404 instead. Any link or search result still pointing at the old path will break.
            </>
          }
        />
      )}
    </div>
  );
}
