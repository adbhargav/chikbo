import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PAYMENT_STATUSES, type Paginated } from '@chikbo/shared';
import { api } from '../lib/api';
import type { AdminPaymentRow } from '../lib/types';
import { formatDateTime, formatPaise, humanize } from '../lib/format';
import { EmptyState, ErrorState, Money, PageHead, Pagination, Pill, TableSkeleton } from '../components/ui';

export function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const payments = useQuery({
    queryKey: ['payments', page, status],
    queryFn: () =>
      api<Paginated<AdminPaymentRow>>('/admin/payments', {
        query: { page, pageSize: 20, status: status || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  const data = payments.data;

  return (
    <main className="page">
      <PageHead overline="Fulfilment" title="Payments" sub="Razorpay records with their refunds." />

      <div className="toolbar">
        <select
          aria-label="Filter by payment status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>

      {payments.isError ? (
        <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="num">Refunded</th>
                  <th>When</th>
                </tr>
              </thead>
              {payments.isPending ? (
                <TableSkeleton cols={7} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No payments match" />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((p) => {
                    const refunded = p.refunds
                      .filter((r) => r.status !== 'FAILED')
                      .reduce((s, r) => s + r.amountInPaise, 0);
                    return (
                      <tr key={p.id}>
                        <td className="primary">{p.order.orderNumber}</td>
                        <td className="muted">{p.order.user.email}</td>
                        <td className="money">
                          <Money paise={p.amountInPaise} />
                        </td>
                        <td className="muted">{p.method ?? '—'}</td>
                        <td>
                          <Pill status={p.status} />
                        </td>
                        <td className="num muted">{refunded > 0 ? formatPaise(refunded) : '—'}</td>
                        <td className="muted">{formatDateTime(p.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
        </>
      )}
    </main>
  );
}
