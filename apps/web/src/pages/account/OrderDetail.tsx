import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CANCELLABLE_STATUSES, RETURNABLE_STATUSES, formatPaise } from '@chikbo/shared';
import type { OrderDto } from '@chikbo/shared';
import { api, ApiError, uploadImages } from '../../lib/api';
import { useOrder } from '../../lib/queries';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/usePageMeta';
import { formatDateTime } from '../../lib/format';
import { ProductImage } from '../../components/ProductImage';
import { ErrorState, StatusPill } from '../../components/ui';

/* ------------------------------------------------------------- Timeline */

function Timeline({ order }: { order: OrderDto }) {
  const events = [
    { status: 'Order placed', description: `Order ${order.orderNumber} received`, at: order.createdAt },
    ...(order.trackingEvents ?? []),
  ];
  return (
    <ol className="timeline">
      {events.map((event, i) => (
        <li
          key={i}
          className={i === events.length - 1 ? 'timeline-item timeline-item--latest' : 'timeline-item'}
          style={{ '--step': i } as React.CSSProperties}
        >
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <p className="timeline-status">{event.status}</p>
            {event.description && <p className="muted timeline-desc">{event.description}</p>}
            <p className="muted timeline-date">{formatDateTime(event.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------- Cancel form */

function CancelForm({ order, onDone }: { order: OrderDto; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.show('Please tell us why you are cancelling.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      toast.show('Order cancelled. Any payment will be refunded.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      onDone();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not cancel the order.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-pad" onSubmit={submit}>
      <h3 className="account-inline-title">Cancel order</h3>
      <div className="field">
        <label htmlFor="cancel-reason">Reason</label>
        <textarea
          id="cancel-reason"
          className="textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ordered by mistake, found a better fit…"
        />
      </div>
      <div className="address-form-actions">
        <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
          {busy ? 'Cancelling…' : 'Confirm cancellation'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Keep order
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------- Return form */

function ReturnForm({ order, onDone }: { order: OrderDto; onDone: () => void }) {
  const [orderItemId, setOrderItemId] = useState<string>(order.items[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length > 6) {
      setError('You can upload at most 6 photos.');
      setFiles(chosen.slice(0, 6));
      return;
    }
    setError(null);
    setFiles(chosen);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderItemId) {
      setError('Choose the item you want to return.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Please describe the damage in at least 10 characters.');
      return;
    }
    if (files.length < 1) {
      setError('Please attach at least one photo of the damage.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadImages(files);
      await api(`/orders/${order.id}/return`, {
        method: 'POST',
        body: {
          orderItemId,
          reason: reason.trim(),
          imageUrls: uploaded.map((u) => u.url),
        },
      });
      toast.show('Return request submitted. We will review it shortly.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit the return request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-pad" onSubmit={submit}>
      <h3 className="account-inline-title">Request a return</h3>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        Returns are accepted for genuine damage. Attach 1–6 clear photos of the issue.
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <fieldset className="return-items">
        <legend>Which item?</legend>
        {order.items.map((item) => (
          <label key={item.id} className="check-row">
            <input
              type="radio"
              name="return-item"
              checked={orderItemId === item.id}
              onChange={() => setOrderItemId(item.id)}
            />
            {item.productName}
            {item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join(', ')})` : ''} ×{' '}
            {item.qty}
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="return-reason">What went wrong? (at least 10 characters)</label>
        <textarea
          id="return-reason"
          className="textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the damage — tear, stain, missing embellishment…"
        />
      </div>

      <div className="field">
        <label htmlFor="return-photos">Damage photos (1–6 images)</label>
        <input
          id="return-photos"
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={onFiles}
        />
        {files.length > 0 && (
          <span className="muted" style={{ fontSize: 13 }}>
            {files.length} photo{files.length === 1 ? '' : 's'} selected
          </span>
        )}
      </div>

      <div className="address-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit return request'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------- Order detail */

export default function OrderDetail() {
  const { id } = useParams();
  const order = useOrder(id);
  usePageMeta(order.data ? `Order ${order.data.orderNumber}` : 'Order', 'Order details and tracking.');
  const [panel, setPanel] = useState<'none' | 'cancel' | 'return'>('none');

  if (order.isPending) {
    return (
      <div className="account-stack" aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 280 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }
  if (order.isError || !order.data) return <ErrorState onRetry={() => order.refetch()} />;

  const data = order.data;
  const canCancel = CANCELLABLE_STATUSES.includes(data.status);
  const canReturn = RETURNABLE_STATUSES.includes(data.status);

  return (
    <div className="account-stack">
      <div className="account-section-head">
        <div>
          <Link to="/account/orders" className="muted" style={{ fontSize: 13 }}>
            ← All orders
          </Link>
          <h2 style={{ marginTop: 4 }}>{data.orderNumber}</h2>
        </div>
        <StatusPill status={data.status} />
      </div>

      <div className="order-detail-grid">
        <div className="account-stack">
          {/* Items */}
          <section className="card card-pad" aria-label="Items">
            <ul className="order-items">
              {data.items.map((item) => (
                <li key={item.id} className="order-item">
                  <div className="order-item-media">
                    <ProductImage
                      src={item.thumbnailUrl}
                      alt={item.productName}
                      name={item.productName}
                      className="order-item-img"
                    />
                  </div>
                  <div>
                    <p className="order-item-name">{item.productName}</p>
                    <p className="muted" style={{ fontSize: 13 }}>
                      {[item.size, item.color].filter(Boolean).join(' · ') || item.sku} · Qty {item.qty}
                    </p>
                  </div>
                  <span className="price">{formatPaise(item.lineTotalInPaise)}</span>
                </li>
              ))}
            </ul>
            <dl className="totals" style={{ marginTop: 20 }}>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPaise(data.subtotalInPaise)}</dd>
              </div>
              {data.discountInPaise > 0 && (
                <div className="totals-discount">
                  <dt>Discount{data.couponCode ? ` (${data.couponCode})` : ''}</dt>
                  <dd>−{formatPaise(data.discountInPaise)}</dd>
                </div>
              )}
              <div>
                <dt>Shipping</dt>
                <dd>{data.shippingInPaise === 0 ? 'Free' : formatPaise(data.shippingInPaise)}</dd>
              </div>
              <div className="totals-grand">
                <dt>Total</dt>
                <dd>{formatPaise(data.totalInPaise)}</dd>
              </div>
            </dl>
          </section>

          {panel === 'cancel' && <CancelForm order={data} onDone={() => setPanel('none')} />}
          {panel === 'return' && <ReturnForm order={data} onDone={() => setPanel('none')} />}

          {(canCancel || canReturn) && panel === 'none' && (
            <div className="address-form-actions">
              {canCancel && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setPanel('cancel')}>
                  Cancel order
                </button>
              )}
              {canReturn && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPanel('return')}>
                  Request a return
                </button>
              )}
            </div>
          )}
        </div>

        <div className="account-stack">
          {/* Tracking */}
          <section className="card card-pad" aria-label="Tracking">
            <h3 className="account-inline-title">Tracking</h3>
            {(data.awbCode || data.courierName) && (
              <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
                {data.courierName && (
                  <>
                    Courier: <strong style={{ color: 'var(--ink-900)' }}>{data.courierName}</strong>
                    <br />
                  </>
                )}
                {data.awbCode && (
                  <>
                    AWB: <strong style={{ color: 'var(--ink-900)' }}>{data.awbCode}</strong>
                  </>
                )}
              </p>
            )}
            <Timeline order={data} />
          </section>

          {/* Address */}
          <section className="card card-pad" aria-label="Delivery address">
            <h3 className="account-inline-title">Delivering to</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              <strong style={{ color: 'var(--ink-900)' }}>{data.shippingAddress.fullName}</strong>
              <br />
              {data.shippingAddress.line1}
              {data.shippingAddress.line2 ? `, ${data.shippingAddress.line2}` : ''}
              <br />
              {data.shippingAddress.city}, {data.shippingAddress.state} — {data.shippingAddress.pincode}
              <br />
              +91 {data.shippingAddress.phone}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
