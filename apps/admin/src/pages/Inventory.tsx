import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { AdminProduct, AdminVariant, InventoryLogEntry, LowStockVariant } from '../lib/types';
import { formatDateTime, humanize } from '../lib/format';
import { PermissionGate } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, PageHead, TableSkeleton, useDebounced } from '../components/ui';

const REASONS = ['MANUAL_ADJUSTMENT', 'RESTOCK', 'CORRECTION', 'RETURN_RECEIVED'] as const;

interface PickedVariant {
  id: string;
  sku: string;
  productName: string;
  stockQty: number;
}

function AdjustDialog({ initial, onClose }: { initial: PickedVariant | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<PickedVariant | null>(initial);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]>('RESTOCK');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['variant-search', debounced],
    queryFn: () =>
      api<Paginated<AdminProduct>>('/admin/products', { query: { page: 1, pageSize: 10, search: debounced } }),
    enabled: !picked && debounced.trim().length >= 2,
  });

  const adjust = useMutation({
    mutationFn: (body: { variantId: string; delta: number; reason: string; note?: string }) =>
      api<AdminVariant>('/admin/inventory/adjust', { method: 'POST', body }),
    onSuccess: (v) => {
      toast(`Stock updated — ${v.sku} now has ${v.stockQty}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!picked) return setError('Pick a variant first');
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0) return setError('Delta must be a non-zero whole number');
    if (d < 0 && picked.stockQty + d < 0) return setError(`Only ${picked.stockQty} in stock — cannot go below zero`);
    adjust.mutate({ variantId: picked.id, delta: d, reason, note: note.trim() || undefined });
  };

  return (
    <Modal
      title="Adjust stock"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={adjust.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={adjust.isPending || !picked}>
            {adjust.isPending ? 'Adjusting…' : 'Apply adjustment'}
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        {picked ? (
          <div className="img-tile" style={{ marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{picked.sku}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {picked.productName} · {picked.stockQty} in stock
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="adj-search">Find variant by SKU or product name</label>
            <input
              id="adj-search"
              type="search"
              placeholder="e.g. SAR-IVR-M or Banarasi…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {results.isFetching && <span className="hint">Searching…</span>}
            {results.data && (
              <div className="editor-rows" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
                {results.data.items.flatMap((p) =>
                  p.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="img-tile"
                      style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                      onClick={() =>
                        setPicked({ id: v.id, sku: v.sku, productName: p.name, stockQty: v.stockQty })
                      }
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 13 }}>{v.sku}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.name} {v.size ? `· ${v.size}` : ''} {v.color ? `· ${v.color}` : ''}
                        </div>
                      </div>
                      <span className="mono muted" style={{ fontSize: 12.5 }}>
                        {v.stockQty} in stock
                      </span>
                    </button>
                  )),
                )}
                {results.data.items.length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Nothing matched.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-row cols-2">
          <div className="field">
            <label htmlFor="adj-delta">Delta</label>
            <input
              id="adj-delta"
              type="number"
              placeholder="+10 or -2"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              required
            />
            <span className="hint">Positive adds stock, negative removes.</span>
          </div>
          <div className="field">
            <label htmlFor="adj-reason">Reason</label>
            <select
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="adj-note">Note (optional)</label>
          <input
            id="adj-note"
            type="text"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. New consignment from the mill"
          />
        </div>
      </form>
    </Modal>
  );
}

function HistoryDrawer({ variant, onClose }: { variant: LowStockVariant; onClose: () => void }) {
  const history = useQuery({
    queryKey: ['inventory-history', variant.id],
    queryFn: () => api<InventoryLogEntry[]>(`/admin/inventory/history/${variant.id}`),
  });

  return (
    <Modal drawer title={`History · ${variant.sku}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {variant.productName} · currently {variant.stockQty} in stock
      </p>
      {history.isPending ? (
        <div className="editor-rows">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="skel" key={i} style={{ height: 44 }} />
          ))}
        </div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.length === 0 ? (
        <EmptyState title="No movements yet" message="Adjustments and order deductions will show here." />
      ) : (
        <ul className="timeline">
          {history.data.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong style={{ color: entry.delta > 0 ? 'var(--success)' : 'var(--error)' }}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </strong>{' '}
                → {entry.qtyAfter} after · {humanize(entry.reason)}
              </div>
              {entry.note && <div className="note">{entry.note}</div>}
              <div className="when">{formatDateTime(entry.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function Inventory() {
  const [adjusting, setAdjusting] = useState<PickedVariant | null | 'blank'>(null);
  const [historyFor, setHistoryFor] = useState<LowStockVariant | null>(null);

  const lowStock = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api<LowStockVariant[]>('/admin/inventory/low-stock'),
  });

  return (
    <main className="page">
      <PageHead
        overline="Catalog"
        title="Inventory"
        sub="Variants at or below their low-stock threshold."
        actions={
          <PermissionGate permission="inventory.write">
            <button className="btn btn-primary" onClick={() => setAdjusting('blank')}>
              Adjust stock
            </button>
          </PermissionGate>
        }
      />

      {lowStock.isError ? (
        <ErrorState error={lowStock.error} onRetry={() => lowStock.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Variant</th>
                <th className="num">Stock</th>
                <th className="num">Threshold</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            {lowStock.isPending ? (
              <TableSkeleton cols={7} rows={7} />
            ) : lowStock.data.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="All stocked up" message="Nothing is running low right now." />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {lowStock.data.map((v) => (
                  <tr key={v.id} className={v.stockQty === 0 ? 'danger-row' : ''}>
                    <td className="primary">{v.sku}</td>
                    <td>{v.productName}</td>
                    <td className="muted">{[v.size, v.color].filter(Boolean).join(' · ') || '—'}</td>
                    <td
                      className="num"
                      style={v.stockQty === 0 ? { color: 'var(--error)', fontWeight: 700 } : { fontWeight: 600 }}
                    >
                      {v.stockQty}
                    </td>
                    <td className="num muted">{v.lowStockThreshold}</td>
                    <td>
                      {v.stockQty === 0 ? (
                        <span className="pill error">Out of stock</span>
                      ) : (
                        <span className="pill warn">Running low</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setHistoryFor(v)}>
                        History
                      </button>
                      <PermissionGate permission="inventory.write">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAdjusting({ id: v.id, sku: v.sku, productName: v.productName, stockQty: v.stockQty })
                          }
                        >
                          Adjust
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}

      {adjusting !== null && (
        <AdjustDialog initial={adjusting === 'blank' ? null : adjusting} onClose={() => setAdjusting(null)} />
      )}
      {historyFor && <HistoryDrawer variant={historyFor} onClose={() => setHistoryFor(null)} />}
    </main>
  );
}
