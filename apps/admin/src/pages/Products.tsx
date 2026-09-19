import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { Paginated } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { AdminCategory, AdminProduct } from '../lib/types';
import { categoryOptions, formatPaise } from '../lib/format';
import { PermissionGate } from '../lib/auth';
import { useToast } from '../components/Toast';
import { CategorySelect } from '../components/pickers/CategorySelect';
import {
  EmptyState,
  ErrorState,
  PageHead,
  Pagination,
  Switch,
  TableSkeleton,
  Thumb,
  useDebounced,
} from '../components/ui';

export function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const debouncedSearch = useDebounced(search);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const products = useQuery({
    queryKey: ['products', page, debouncedSearch, categoryId],
    queryFn: () =>
      api<Paginated<AdminProduct>>('/admin/products', {
        query: { page, pageSize: 20, search: debouncedSearch || undefined, categoryId: categoryId || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api<AdminCategory[]>('/admin/categories'),
  });
  const categoryChoices = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api<AdminProduct>(`/admin/products/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: (_data, vars) => {
      toast(vars.isActive ? 'Product activated' : 'Product hidden from the store', 'success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const data = products.data;

  return (
    <main className="page">
      <PageHead
        overline="Catalog"
        title="Products"
        sub="Everything on the shelf, active or resting."
        actions={
          <PermissionGate permission="products.write">
            <Link to="/products/new" className="btn btn-primary">
              + New product
            </Link>
          </PermissionGate>
        }
      />

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or SKU…"
          aria-label="Search products"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <CategorySelect
          id="products-category"
          aria-label="Filter by category"
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
          options={categoryChoices}
          clearLabel="All categories"
        />
      </div>

      {products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Variants</th>
                  <th className="num">Stock</th>
                  <th className="num">From</th>
                  <th>Active</th>
                </tr>
              </thead>
              {products.isPending ? (
                <TableSkeleton cols={6} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No products found"
                        message={debouncedSearch ? 'Try a different search.' : 'Add your first product to begin.'}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((p) => {
                    const stock = p.variants.reduce((s, v) => s + v.stockQty, 0);
                    const minPrice = Math.min(
                      ...p.variants.map((v) => v.discountPriceInPaise ?? v.priceInPaise),
                    );
                    return (
                      <tr
                        key={p.id}
                        className="row-link"
                        onClick={() => navigate(`/products/${p.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/products/${p.id}`);
                        }}
                        tabIndex={0}
                      >
                        <td>
                          <div className="cell-product">
                            <Thumb url={p.images[0]?.url} name={p.name} />
                            <div className="titles">
                              <div className="t">{p.name}</div>
                              <div className="s">{p.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted">{p.category?.name ?? '—'}</td>
                        <td className="num">{p.variants.length}</td>
                        <td className="num" style={stock === 0 ? { color: 'var(--error)', fontWeight: 600 } : undefined}>
                          {stock}
                        </td>
                        <td className="money">{p.variants.length ? formatPaise(minPrice) : '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <PermissionGate
                            permission="products.write"
                            fallback={<span className="muted">{p.isActive ? 'Yes' : 'No'}</span>}
                          >
                            <Switch
                              checked={p.isActive}
                              disabled={toggleActive.isPending}
                              label={`Toggle ${p.name} active`}
                              onChange={(next) => toggleActive.mutate({ id: p.id, isActive: next })}
                            />
                          </PermissionGate>
                        </td>
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
