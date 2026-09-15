import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ORDER_STATUSES, type Paginated } from '@chikbo/shared';
import { api } from '../lib/api';
import type { AdminOrderListItem } from '../lib/types';
import { formatDateTime, humanize } from '../lib/format';
import {
  EmptyState,
  ErrorState,
  Money,
  PageHead,
  Pagination,
  Pill,
  TableSkeleton,
  useDebounced,
} from '../components/ui';

export function Orders() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedSearch = useDebounced(search);

  const orders = useQuery({
    queryKey: ['orders', page, status, debouncedSearch, from, to],
    queryFn: () =>
      api<Paginated<AdminOrderListItem>>('/admin/orders', {
        query: {
          page,
          pageSize: 20,
          status: status || undefined,
          search: debouncedSearch || undefined,
          from: from || undefined,
          to: to ? `${to}T23:59:59` : undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const data = orders.data;
  const resetPage = () => setPage(1);

  return (
    <main className="page">
      <PageHead overline="Fulfilment" title="Orders" sub="Every order, from placed to delivered." />

      <div className="toolbar">
        <input
          type="search"
          placeholder="Order no, customer, phone…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <label className="muted" style={{ fontSize: 12.5 }} htmlFor="o-from">
          From
        </label>
        <input
          id="o-from"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            resetPage();
          }}
        />
        <label className="muted" style={{ fontSize: 12.5 }} htmlFor="o-to">
          To
        </label>
        <input
          id="o-to"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            resetPage();
          }}
        />
      </div>

      {orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="num">Total</th>
                  <th>Placed</th>
                </tr>
              </thead>
              {orders.isPending ? (
                <TableSkeleton cols={7} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No orders match" message="Loosen the filters to see more." />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((o) => {
                    const payment = o.payments.find((p) => p.status === 'CAPTURED') ?? o.payments[0];
                    return (
                      <tr
                        key={o.id}
                        className="row-link"
                        tabIndex={0}
                        onClick={() => navigate(`/orders/${o.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/orders/${o.id}`);
                        }}
                      >
                        <td className="primary">{o.orderNumber}</td>
                        <td>
                          <div>
                            {o.user?.name ?? o.shipFullName}
                            {!o.user && <span className="muted"> · guest</span>}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {o.user?.email ?? o.guestEmail ?? '—'}
                          </div>
                        </td>
                        <td className="num">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                        <td>
                          <Pill status={o.status} />
                        </td>
                        <td>{payment ? <Pill status={payment.status} /> : <span className="muted">—</span>}</td>
                        <td className="money">
                          <Money paise={o.totalInPaise} />
                        </td>
                        <td className="muted">{formatDateTime(o.createdAt)}</td>
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
