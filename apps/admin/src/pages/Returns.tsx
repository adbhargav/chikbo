import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RETURN_STATUSES, type Paginated } from '@chikbo/shared';
import { api, assetUrl, errorMessage } from '../lib/api';
import type { AdminReturnRow } from '../lib/types';
import { formatDateTime, humanize } from '../lib/format';
import { PermissionGate } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, PageHead, Pagination, Pill, TableSkeleton, Thumb } from '../components/ui';

function ReturnDrawer({ row, onClose }: { row: AdminReturnRow; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['returns'] });
    queryClient.invalidateQueries({ queryKey: ['order', row.orderId] });
  };

  const decide = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      api(`/admin/returns/${row.id}/decision`, {
        method: 'POST',
        body: { decision, adminNote: note.trim() || undefined },
      }),
    onSuccess: (_d, decision) => {
      toast(decision === 'APPROVED' ? 'Return approved' : 'Return rejected', 'success');
      invalidate();
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const received = useMutation({
    mutationFn: () => api(`/admin/returns/${row.id}/received`, { method: 'POST', body: { restock } }),
    onSuccess: () => {
      toast(restock ? 'Marked received — stock restored' : 'Marked received', 'success');
      invalidate();
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const stop = (e: FormEvent) => e.preventDefault();
  const images = row.imageUrls ?? [];

  return (
    <Modal drawer title={`Return · ${row.order.orderNumber}`} onClose={onClose}>
      {error && (
        <div className="login-error" role="alert">
          {error}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Pill status={row.status} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          Requested {formatDateTime(row.createdAt)}
        </span>
      </div>

      <div className="cell-product" style={{ marginBottom: 14 }}>
        <Thumb url={row.orderItem.thumbnailUrl} name={row.orderItem.productName} large />
        <div className="titles">
          <div className="t">{row.orderItem.productName}</div>
          <div className="s">
            {row.orderItem.sku} · qty {row.orderItem.qty}
          </div>
        </div>
      </div>

      <dl className="kv" style={{ marginBottom: 14 }}>
        <dt>Customer</dt>
        <dd>
          {row.user.name} · {row.user.email}
        </dd>
        <dt>Order</dt>
        <dd>
          <Link className="link" to={`/orders/${row.orderId}`}>
            {row.order.orderNumber}
          </Link>
        </dd>
      </dl>

      <div className="field">
        <label>Customer's reason</label>
        <p style={{ fontSize: 13.5, background: '#fff', border: 'var(--border-hairline)', borderRadius: 8, padding: '10px 12px' }}>
          {row.reason}
        </p>
      </div>

      {images.length > 0 && (
        <div className="field">
          <label>Damage photos</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((url, i) => (
              <a key={i} href={assetUrl(url) ?? '#'} target="_blank" rel="noreferrer" aria-label={`Damage photo ${i + 1}`}>
                <img
                  src={assetUrl(url) ?? ''}
                  alt={`Damage photo ${i + 1}`}
                  style={{
                    width: 84,
                    height: 84,
                    objectFit: 'cover',
                    borderRadius: 8,
                    background: 'var(--cream-100)',
                    border: 'var(--border-hairline)',
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {row.adminNote && (
        <div className="field">
          <label>Admin note</label>
          <p style={{ fontSize: 13.5 }}>{row.adminNote}</p>
        </div>
      )}

      <PermissionGate permission="returns.write">
        {row.status === 'REQUESTED' && (
          <form onSubmit={stop}>
            <div className="field">
              <label htmlFor="ret-note">Note to customer (optional)</label>
              <textarea
                id="ret-note"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why it's approved or rejected"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                disabled={decide.isPending}
                onClick={() => decide.mutate('APPROVED')}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                disabled={decide.isPending}
                onClick={() => decide.mutate('REJECTED')}
              >
                Reject
              </button>
            </div>
          </form>
        )}

        {['APPROVED', 'PICKUP_SCHEDULED', 'IN_TRANSIT'].includes(row.status) && (
          <form onSubmit={stop}>
            <label className="checkbox" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
              Restock the returned quantity
            </label>
            <button className="btn btn-primary" disabled={received.isPending} onClick={() => received.mutate()}>
              {received.isPending ? 'Saving…' : 'Mark Received'}
            </button>
          </form>
        )}
      </PermissionGate>

      {row.status === 'RECEIVED' && (
        <PermissionGate permission="refunds.write">
          <Link className="btn btn-primary" to={`/orders/${row.orderId}?refund=1&return=${row.id}`}>
            Refund this return →
          </Link>
        </PermissionGate>
      )}
    </Modal>
  );
}

export function Returns() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<AdminReturnRow | null>(null);

  const returns = useQuery({
    queryKey: ['returns', page, status],
    queryFn: () =>
      api<Paginated<AdminReturnRow>>('/admin/returns', {
        query: { page, pageSize: 20, status: status || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  const data = returns.data;

  return (
    <main className="page">
      <PageHead overline="Fulfilment" title="Returns" sub="Genuine-damage returns awaiting a decision." />

      <div className="toolbar">
        <select
          aria-label="Filter by return status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {RETURN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>

      {returns.isError ? (
        <ErrorState error={returns.error} onRetry={() => returns.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Item</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Requested</th>
                </tr>
              </thead>
              {returns.isPending ? (
                <TableSkeleton cols={6} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No return requests" message="Requests will land here for review." />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((r) => (
                    <tr
                      key={r.id}
                      className="row-link"
                      tabIndex={0}
                      onClick={() => setOpen(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setOpen(r);
                      }}
                    >
                      <td className="primary">{r.order.orderNumber}</td>
                      <td>{r.orderItem.productName}</td>
                      <td className="muted">{r.user.name}</td>
                      <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reason}
                      </td>
                      <td>
                        <Pill status={r.status} />
                      </td>
                      <td className="muted">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
        </>
      )}

      {open && <ReturnDrawer row={open} onClose={() => setOpen(null)} />}
    </main>
  );
}
