import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import type { AdminCustomerDetail } from '../lib/types';
import { formatDate, formatDateTime } from '../lib/format';
import { PermissionGate } from '../lib/auth';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/Modal';
import { CardSkeleton, EmptyState, ErrorState, Money, PageHead, Pill } from '../components/ui';

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState(false);

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<AdminCustomerDetail>(`/admin/customers/${id}`),
  });

  const toggle = useMutation({
    mutationFn: (isActive: boolean) =>
      api<{ id: string; isActive: boolean }>(`/admin/customers/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: (res) => {
      toast(res.isActive ? 'Account activated' : 'Account deactivated', 'success');
      setConfirmToggle(false);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setConfirmToggle(false);
    },
  });

  if (customer.isPending) {
    return (
      <main className="page">
        <PageHead overline="People" title="Customer" />
        <CardSkeleton height={380} />
      </main>
    );
  }
  if (customer.isError) {
    return (
      <main className="page">
        <PageHead overline="People" title="Customer" />
        <ErrorState error={customer.error} onRetry={() => customer.refetch()} />
      </main>
    );
  }

  const c = customer.data;

  return (
    <main className="page">
      <PageHead
        overline="People"
        title={c.name}
        sub={`Customer since ${formatDate(c.createdAt)}`}
        actions={
          <>
            <Link to="/customers" className="btn btn-secondary">
              ← All customers
            </Link>
            <PermissionGate permission="customers.write">
              <button
                className={`btn ${c.isActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => setConfirmToggle(true)}
              >
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </PermissionGate>
          </>
        }
      />

      <div className="detail-grid">
        <div className="stack">
          <div className="card">
            <div className="pad" style={{ paddingBottom: 0 }}>
              <h3 className="card-title">Recent orders</h3>
            </div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th className="num">Items</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {c.orders.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState title="No orders yet" />
                      </td>
                    </tr>
                  ) : (
                    c.orders.map((o) => (
                      <tr key={o.id}>
                        <td className="primary">
                          <Link className="link" to={`/orders/${o.id}`}>
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="num">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                        <td>
                          <Pill status={o.status} />
                        </td>
                        <td className="money">
                          <Money paise={o.totalInPaise} />
                        </td>
                        <td className="muted">{formatDateTime(o.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card pad">
            <h3 className="card-title">Wishlist</h3>
            {c.wishlist.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>
                Nothing saved yet.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {c.wishlist.map((w) => (
                  <li key={w.id} style={{ padding: '2px 0' }}>
                    {w.product.name} <span className="muted">/{w.product.slug}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <h3 className="card-title">Profile</h3>
            <dl className="kv">
              <dt>Email</dt>
              <dd>{c.email}</dd>
              <dt>Phone</dt>
              <dd>{c.phone ?? '—'}</dd>
              <dt>Status</dt>
              <dd>
                {c.isActive ? (
                  <span className="pill success">Active</span>
                ) : (
                  <span className="pill error">Deactivated</span>
                )}
              </dd>
              <dt>Orders</dt>
              <dd>{c.orders.length}</dd>
            </dl>
          </div>

          <div className="card pad">
            <h3 className="card-title">Addresses</h3>
            {c.addresses.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>
                No saved addresses.
              </p>
            ) : (
              c.addresses.map((a) => (
                <p
                  key={a.id}
                  style={{
                    fontSize: 13,
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(185,178,169,.25)',
                    color: 'var(--ink-900)',
                  }}
                >
                  <strong>{a.fullName}</strong>
                  {a.isDefault && (
                    <span className="pill info" style={{ marginLeft: 8 }}>
                      Default
                    </span>
                  )}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                  <br />
                  {a.city}, {a.state} {a.pincode}
                  <br />
                  <span className="muted">{a.phone}</span>
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {confirmToggle && (
        <ConfirmDialog
          title={c.isActive ? 'Deactivate account?' : 'Activate account?'}
          message={
            c.isActive ? (
              <>
                <strong>{c.name}</strong> will no longer be able to sign in or place orders until reactivated.
              </>
            ) : (
              <>
                <strong>{c.name}</strong> will be able to sign in and shop again.
              </>
            )
          }
          confirmLabel={c.isActive ? 'Deactivate' : 'Activate'}
          danger={c.isActive}
          busy={toggle.isPending}
          onConfirm={() => toggle.mutate(!c.isActive)}
          onClose={() => setConfirmToggle(false)}
        />
      )}
    </main>
  );
}
