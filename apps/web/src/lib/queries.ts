import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddressDto,
  CartDto,
  CategoryDto,
  FilterFacetsDto,
  OrderDto,
  Paginated,
  ProductDetailDto,
  ProductListItemDto,
  ReviewDto,
} from '@chikbo/shared';
import { api } from './api';
import { useAuth } from './auth';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoryDto[]>('/catalog/categories'),
    staleTime: 10 * 60 * 1000,
  });
}

/** Distinct sizes/colours in the active catalog, for the filter sidebar. */
export function useFilterFacets() {
  return useQuery({
    queryKey: ['filter-facets'],
    queryFn: () => api<FilterFacetsDto>('/catalog/filters'),
    staleTime: 10 * 60 * 1000,
  });
}

export type ProductListParams = {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  sizes?: string;
  colors?: string;
  inStock?: string;
  sort?: string;
  /** Minimum discount percentage. Forward-compatible — ignored by the API today. */
  minDiscount?: string;
};

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () =>
      api<Paginated<ProductListItemDto>>('/catalog/products', {
        query: { ...params },
      }),
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api<ProductDetailDto>(`/catalog/products/${slug}`),
    enabled: !!slug,
  });
}

export function useReviews(slug: string | undefined, page: number) {
  return useQuery({
    queryKey: ['reviews', slug, page],
    queryFn: () =>
      api<Paginated<ReviewDto>>(`/catalog/products/${slug}/reviews`, {
        query: { page, pageSize: 5 },
      }),
    enabled: !!slug,
  });
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export function useCart(coupon?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cart', coupon ?? null],
    queryFn: () => api<CartDto>('/cart', { query: coupon ? { coupon } : undefined }),
    enabled: !!user,
    retry: (failureCount, error) => {
      // Coupon validation errors (422) should surface immediately, not retry.
      if (coupon) return false;
      return failureCount < 2 && !(error instanceof Error && error.name === 'ApiError');
    },
  });
}

export function useCartMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cart'] });

  const addItem = useMutation({
    mutationFn: (input: { variantId: string; qty: number }) =>
      api<CartDto>('/cart/items', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
  const updateItem = useMutation({
    mutationFn: (input: { id: string; qty: number }) =>
      api<CartDto>(`/cart/items/${input.id}`, { method: 'PATCH', body: { qty: input.qty } }),
    onSuccess: invalidate,
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => api<CartDto>(`/cart/items/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  return { addItem, updateItem, removeItem };
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export function useWishlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api<ProductListItemDto[]>('/wishlist'),
    enabled: !!user,
  });
}

export function useWishlistMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['wishlist'] });
  const add = useMutation({
    mutationFn: (productId: string) => api(`/wishlist/${productId}`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (productId: string) => api(`/wishlist/${productId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  return { add, remove };
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export function useAddresses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['addresses'],
    queryFn: () => api<AddressDto[]>('/users/me/addresses'),
    enabled: !!user,
  });
}

export type AddressInput = Omit<AddressDto, 'id' | 'isDefault'> & { isDefault?: boolean };

export function useAddressMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });
  const create = useMutation({
    mutationFn: (input: AddressInput) =>
      api<AddressDto>('/users/me/addresses', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: Partial<AddressInput> & { id: string }) =>
      api<AddressDto>(`/users/me/addresses/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/users/me/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// ---------------------------------------------------------------------------
// Orders, returns, notifications
// ---------------------------------------------------------------------------

export function useOrders(page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => api<Paginated<OrderDto>>('/orders', { query: { page, pageSize: 10 } }),
    enabled: !!user,
  });
}

export function useOrder(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDto>(`/orders/${id}`),
    enabled: !!user && !!id,
  });
}

/** Shape returned by GET /orders/returns (not in shared types — kept permissive). */
export interface ReturnRequestDto {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  orderNumber?: string;
  orderId?: string;
  productName?: string;
  adminNote?: string | null;
  imageUrls?: string[];
}

export function useReturns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['returns'],
    queryFn: () => api<ReturnRequestDto[]>('/orders/returns'),
    enabled: !!user,
  });
}

/** Shape returned by GET /users/me/notifications (not in shared types — kept permissive). */
export interface NotificationDto {
  id: string;
  title: string;
  body?: string | null;
  message?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationDto[]>('/users/me/notifications'),
    enabled: !!user,
  });
}
