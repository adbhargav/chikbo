import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OrderStatus } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { AdminOrderDetail, AdminShipment } from '../lib/types';
import { formatDateTime, formatPaise, humanize, rupeesToPaise } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { CardSkeleton, ErrorState, Money, PageHead, Pill, Thumb } from '../components/ui';

/** Mirrors the API's allowed manual transitions. */
const MANUAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'Mark Processing',
  SHIPPED: 'Mark Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Mark Delivered',
  CANCELLED: 'Cancel Order',
};

function StatusDialog({
  order,
  target,
  onClose,
}: {
  order: AdminOrderDetail;
  target: OrderStatus;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasCaptured = order.payments.some((p) => p.status === 'CAPTURED');

  const mutate = useMutation({
    mutationFn: () =>
      api<{ refundError?: string | null }>(`/admin/orders/${order.id}/status`, {
        method: 'POST',
        body: { status: target, note: note.trim() || undefined },
      }),
    onSuccess: (result) => {
      if (result?.refundError) {
        toast(`Order cancelled, but the refund did not start: ${result.refundError} Use Refund on this order to retry.`, 'error');
      } else {
        toast(`Order marked ${humanize(target).toLowerCase()}`, 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutate.mutate();
  };

  return (
    <Modal
      title={ACTION_LABELS[target] ?? humanize(target)}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutate.isPending}>
            Keep as is
          </button>
          <button
            className={`btn ${target === 'CANCELLED' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onSubmit}
            disabled={mutate.isPending}
          >
            {mutate.isPending ? 'Working…' : ACTION_LABELS[target] ?? 'Confirm'}
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
        <p style={{ fontSize: 14, marginBottom: 12 }}>
          Move <strong>{order.orderNumber}</strong> from <Pill status={order.status} /> to <Pill status={target} />.
        </p>
        {target === 'CANCELLED' && (
          <div className="login-error" role="note">
            Cancelling releases reserved stock{hasCaptured ? ' and automatically refunds the captured payment' : ''}.
            This cannot be undone.
          </div>
        )}
        <div className="field">
          <label htmlFor="st-note">Note {target === 'CANCELLED' ? '(reason)' : '(optional)'}</label>
          <textarea
            id="st-note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Visible in the order's history"
          />
        </div>
      </form>
    </Modal>
  );
}

function RefundDialog({
  order,
  returnRequestId,
  onClose,
}: {
  order: AdminOrderDetail;
  returnRequestId?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: (body: { amountInPaise?: number; reason: string; returnRequestId?: string }) =>
      api<{ refundId: string }>(`/admin/orders/${order.id}/refund`, { method: 'POST', body }),
    onSuccess: () => {
      toast('Refund initiated', 'success');
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 3) return setError('Give a short reason (at least 3 characters)');
    let amountInPaise: number | undefined;
    if (amount.trim() !== '') {
      const parsed = rupeesToPaise(amount);
      if (parsed === null || parsed < 100) return setError('Amount must be at least ₹1');
      if (parsed > order.totalInPaise) return setError('Amount exceeds the order total');
      amountInPaise = parsed;
    }
    mutate.mutate({ amountInPaise, reason: reason.trim(), returnRequestId });
  };

  return (
    <Modal
      title="Refund payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={mutate.isPending}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onSubmit} disabled={mutate.isPending}>
            {mutate.isPending ? 'Initiating…' : 'Initiate refund'}
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
        {returnRequestId && (
          <p className="hint" style={{ marginBottom: 10, fontSize: 12.5, color: 'var(--ink-500)' }}>
            Linked to return request {returnRequestId} — it will be marked refunded.
          </p>
        )}
        <div className="field">
          <label htmlFor="rf-amount">Amount in ₹ (leave empty for a full refund)</label>
          <div className="input-prefix">
            <span>₹</span>
            <input
              id="rf-amount"
              type="number"
              min={1}
              step="0.01"
              placeholder={(order.totalInPaise / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <span className="hint">Order total {formatPaise(order.totalInPaise)}</span>
        </div>
        <div className="field">
          <label htmlFor="rf-reason">Reason</label>
          <input
            id="rf-reason"
            type="text"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damaged item returned"
            required
          />
        </div>
      </form>
    </Modal>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReturnId, setRefundReturnId] = useState<string | undefined>();

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<AdminOrderDetail>(`/admin/orders/${id}`),
  });

  // Deep link from Returns: /orders/:id?refund=1&return=<returnRequestId>
  useEffect(() => {
    if (searchParams.get('refund') === '1' && order.data) {
      setRefundReturnId(searchParams.get('return') ?? undefined);
      setRefundOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, order.data, setSearchParams]);

  const createShipment = useMutation({
    mutationFn: () => api<AdminShipment>(`/admin/orders/${id}/shipment`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast('Shipment created in Shiprocket', 'success');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const assignAwb = useMutation({
    mutationFn: (shipmentId: string) =>
      api<AdminShipment>(`/admin/shipments/${shipmentId}/awb`, { method: 'POST', body: {} }),
    onSuccess: (s) => {
      toast(`AWB ${s.awbCode ?? ''} assigned${s.courierName ? ` · ${s.courierName}` : ''}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  if (order.isPending) {
    return (
      <main className="page">
        <PageHead overline="Fulfilment" title="Order" />
        <CardSkeleton height={420} />
      </main>
    );
  }
  if (order.isError) {
    return (
      <main className="page">
        <PageHead overline="Fulfilment" title="Order" />
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </main>
    );
  }

  const o = order.data;
  const transitions = MANUAL_TRANSITIONS[o.status] ?? [];
  const canWriteOrders = hasPermission('orders.write');
  const canShip = hasPermission('shipments.write');
  const canRefund = hasPermission('refunds.write');
  const hasCaptured = o.payments.some((p) => p.status === 'CAPTURED');
  const outboundShipment = o.shipments.find((s) => !s.isReturn);
  const showCreateShipment = canShip && !outboundShipment && ['CONFIRMED', 'PROCESSING'].includes(o.status);

  return (
    <main className="page">
      <PageHead
        overline="Fulfilment"
        title={o.orderNumber}
        sub={`Placed ${formatDateTime(o.createdAt)} by ${o.user?.name ?? `${o.shipFullName} (guest)`}`}
        actions={
          <Link to="/orders" className="btn btn-secondary">
            ← All orders
          </Link>
        }
      />

      <div className="toolbar" role="group" aria-label="Order actions">
        <Pill status={o.status} />
        <span className="spacer" />
        {canWriteOrders &&
          transitions
            .filter((t) => t !== 'CANCELLED')
            .map((t) => (
              <button key={t} className="btn btn-primary btn-sm" onClick={() => setStatusTarget(t)}>
                {ACTION_LABELS[t]}
              </button>
            ))}
        {showCreateShipment && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => createShipment.mutate()}
            disabled={createShipment.isPending}
          >
            {createShipment.isPending ? 'Creating…' : 'Create Shipment'}
          </button>
        )}
        {canShip && outboundShipment && !outboundShipment.awbCode && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => assignAwb.mutate(outboundShipment.id)}
            disabled={assignAwb.isPending}
          >
            {assignAwb.isPending ? 'Assigning…' : 'Assign AWB'}
          </button>
        )}
        {canRefund && hasCaptured && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setRefundReturnId(undefined);
              setRefundOpen(true);
            }}
          >
            Refund…
          </button>
        )}
        {canWriteOrders && transitions.includes('CANCELLED') && (
          <button className="btn btn-danger btn-sm" onClick={() => setStatusTarget('CANCELLED')}>
            Cancel Order
          </button>
        )}
      </div>

      <div className="detail-grid">
        <div className="stack">
          <div className="card">
            <div className="pad" style={{ paddingBottom: 0 }}>
              <h3 className="card-title">Items</h3>
            </div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="cell-product">
                          <Thumb url={item.thumbnailUrl} name={item.productName} />
                          <div className="titles">
                            <div className="t">{item.productName}</div>
                            <div className="s">{[item.size, item.color].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{item.sku}</td>
                      <td className="num">{item.qty}</td>
                      <td className="money">
                        <Money paise={item.unitPriceInPaise} />
                      </td>
                      <td className="money">
                        <Money paise={item.lineTotalInPaise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pad" style={{ paddingTop: 8, maxWidth: 360, marginLeft: 'auto' }}>
              <div className="totals-row">
                <span className="muted">Subtotal</span>
                <span className="amount">{formatPaise(o.subtotalInPaise)}</span>
              </div>
              {o.discountInPaise > 0 && (
                <div className="totals-row">
                  <span className="muted">Discount{o.coupon ? ` (${o.coupon.code})` : ''}</span>
                  <span className="amount" style={{ color: 'var(--success)' }}>
                    −{formatPaise(o.discountInPaise)}
                  </span>
                </div>
              )}
              <div className="totals-row">
                <span className="muted">Shipping</span>
                <span className="amount">{o.shippingInPaise === 0 ? 'Free' : formatPaise(o.shippingInPaise)}</span>
              </div>
              <div className="totals-row grand">
                <span>Total</span>
                <span className="amount">{formatPaise(o.totalInPaise)}</span>
              </div>
            </div>
          </div>

          <div className="card pad">
            <h3 className="card-title">Payments</h3>
            {o.payments.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>
                No payment records yet.
              </p>
            ) : (
              o.payments.map((p) => (
                <div key={p.id} style={{ borderBottom: '1px solid rgba(185,178,169,.25)', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Pill status={p.status} />
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
                      {formatPaise(p.amountInPaise)}
                    </span>
                    {p.method && <span className="muted">via {p.method}</span>}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(p.createdAt)}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {p.razorpayPaymentId ?? p.razorpayOrderId}
                    {p.errorDescription ? ` · ${p.errorDescription}` : ''}
                  </div>
                  {(p.refunds ?? []).map((r) => (
                    <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        Refund
                      </span>
                      <Pill status={r.status} />
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatPaise(r.amountInPaise)}
                      </span>
                      {r.reason && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {r.reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="card pad">
            <h3 className="card-title">Shipments</h3>
            {o.shipments.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>
                Not shipped yet.
              </p>
            ) : (
              o.shipments.map((s) => (
                <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(185,178,169,.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Pill status={s.status} />
                    {s.isReturn && <span className="pill neutral">Return leg</span>}
                    <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
                      {s.awbCode ? `AWB ${s.awbCode}` : 'AWB pending'}
                    </span>
                    {s.courierName && <span className="muted">{s.courierName}</span>}
                  </div>
                  {(s.trackingEvents ?? []).length > 0 && (
                    <ul className="timeline" style={{ marginTop: 10 }}>
                      {(s.trackingEvents ?? []).map((ev) => (
                        <li key={ev.id}>
                          <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{ev.status}</div>
                          {ev.description && <div className="note">{ev.description}</div>}
                          <div className="when">
                            {ev.location ? `${ev.location} · ` : ''}
                            {formatDateTime(ev.occurredAt)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <h3 className="card-title">Customer</h3>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{o.user?.name ?? o.shipFullName}</dd>
              <dt>Email</dt>
              <dd>{o.user?.email ?? o.guestEmail ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{o.user ? (o.user.phone ?? '—') : o.shipPhone}</dd>
            </dl>
            {o.user && o.userId ? (
              <Link className="link" style={{ fontSize: 13, display: 'inline-block', marginTop: 10 }} to={`/customers/${o.userId}`}>
                View customer →
              </Link>
            ) : (
              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                Guest checkout — no account yet. Emails go to the address above.
              </p>
            )}
          </div>

          <div className="card pad">
            <h3 className="card-title">Shipping address</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-900)' }}>
              {o.shipFullName}
              <br />
              {o.shipLine1}
              {o.shipLine2 ? (
                <>
                  <br />
                  {o.shipLine2}
                </>
              ) : null}
              <br />
              {o.shipCity}, {o.shipState} {o.shipPincode}
              <br />
              <span className="muted">{o.shipPhone}</span>
            </p>
          </div>

          {o.returnRequests.length > 0 && (
            <div className="card pad">
              <h3 className="card-title">Return requests</h3>
              {o.returnRequests.map((r) => (
                <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                  <Pill status={r.status} />
                  <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>
                    {r.reason.slice(0, 60)}
                  </span>
                </div>
              ))}
              <Link className="link" style={{ fontSize: 13, display: 'inline-block', marginTop: 6 }} to="/returns">
                Manage in Returns →
              </Link>
            </div>
          )}

          <div className="card pad">
            <h3 className="card-title">History</h3>
            {o.statusHistory.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>
                No history recorded.
              </p>
            ) : (
              <ul className="timeline">
                {[...o.statusHistory].reverse().map((h) => (
                  <li key={h.id}>
                    <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{humanize(h.status)}</div>
                    {h.note && <div className="note">{h.note}</div>}
                    <div className="when">{formatDateTime(h.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
            {o.cancelReason && (
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                Cancellation reason: {o.cancelReason}
              </p>
            )}
          </div>
        </div>
      </div>

      {statusTarget && <StatusDialog order={o} target={statusTarget} onClose={() => setStatusTarget(null)} />}
      {refundOpen && (
        <RefundDialog order={o} returnRequestId={refundReturnId} onClose={() => setRefundOpen(false)} />
      )}
    </main>
  );
}
