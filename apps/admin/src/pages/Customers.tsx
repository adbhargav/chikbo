import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Paginated } from '@chikbo/shared';
import { api } from '../lib/api';
import type { AdminCustomerRow } from '../lib/types';
import { formatDate } from '../lib/format';
import {
  EmptyState,
  ErrorState,
  PageHead,
  Pagination,
  TableSkeleton,
  useDebounced,
} from '../components/ui';

export function Customers() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const customers = useQuery({
    queryKey: ['customers', page, debounced],
    queryFn: () =>
      api<Paginated<AdminCustomerRow>>('/admin/customers', {
        query: { page, pageSize: 20, search: debounced || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  const data = customers.data;

  return (
    <main className="page">
      <PageHead overline="People" title="Customers" sub="The people who keep the looms running." />

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, phone…"
          aria-label="Search customers"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {customers.isError ? (
        <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="num">Orders</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              {customers.isPending ? (
                <TableSkeleton cols={6} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No customers found" message="Try a different search." />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((c) => (
                    <tr
                      key={c.id}
                      className="row-link"
                      tabIndex={0}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/customers/${c.id}`);
                      }}
                    >
                      <td className="primary">{c.name}</td>
                      <td className="muted">{c.email}</td>
                      <td className="muted">{c.phone ?? '—'}</td>
                      <td className="num">{c._count.orders}</td>
                      <td>
                        {c.isActive ? (
                          <span className="pill success">Active</span>
                        ) : (
                          <span className="pill error">Deactivated</span>
                        )}
                      </td>
                      <td className="muted">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
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
