import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { ApiError } from '../api/client';
import {
  AddressInput,
  cartApi,
  catalogApi,
  ordersApi,
  userApi,
  wishlistApi,
} from '../api/endpoints';
import type { ProductListParams } from '../api/types';
import type { CartDto, Paginated, ProductListItemDto } from '../types/shared';

export const qk = {
  categories: ['categories'] as const,
  products: (params: ProductListParams) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  reviews: (slug: string) => ['reviews', slug] as const,
  cart: (coupon: string | null) => ['cart', coupon] as const,
  cartAll: ['cart'] as const,
  wishlist: ['wishlist'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  returns: ['returns'] as const,
  addresses: ['addresses'] as const,
  notifications: ['notifications'] as const,
};

// --- Catalog -----------------------------------------------------------------

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: catalogApi.categories, staleTime: 5 * 60_000 });
}

export function useInfiniteProducts(params: Omit<ProductListParams, 'page'>) {
  return useInfiniteQuery({
    queryKey: qk.products(params),
    queryFn: ({ pageParam }) => catalogApi.products({ ...params, page: pageParam, pageSize: params.pageSize ?? 12 }),
    initialPageParam: 1,
    getNextPageParam: (last: Paginated<ProductListItemDto>) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: qk.product(slug), queryFn: () => catalogApi.product(slug) });
}

export function useInfiniteReviews(slug: string) {
  return useInfiniteQuery({
    queryKey: qk.reviews(slug),
    queryFn: ({ pageParam }) => catalogApi.reviews(slug, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

// --- Cart --------------------------------------------------------------------

export function useCart(coupon: string | null) {
  return useQuery({
    queryKey: qk.cart(coupon),
    queryFn: () => cartApi.get(coupon ?? undefined),
    // Coupon validation failures (422) are terminal — don't retry them.
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof ApiError && error.status === 422),
  });
}

/** Writes the CartDto the server returns into every cached cart query. */
function useCartWriter() {
  const queryClient = useQueryClient();
  return (cart: CartDto) => {
    queryClient.setQueriesData({ queryKey: qk.cartAll }, cart);
    void queryClient.invalidateQueries({ queryKey: qk.cartAll });
  };
}

export function useAddToCart() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      cartApi.addItem(variantId, qty),
    onSuccess: write,
  });
}

export function useUpdateCartItem() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => cartApi.updateItem(itemId, qty),
    onSuccess: write,
  });
}

export function useRemoveCartItem() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: write,
  });
}

// --- Wishlist ----------------------------------------------------------------

export function useWishlist() {
  return useQuery({ queryKey: qk.wishlist, queryFn: wishlistApi.get });
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, wished }: { productId: string; wished: boolean }) =>
      wished ? wishlistApi.remove(productId) : wishlistApi.add(productId),
    onMutate: async ({ productId, wished }) => {
      await queryClient.cancelQueries({ queryKey: qk.wishlist });
      const previous = queryClient.getQueryData<ProductListItemDto[]>(qk.wishlist);
      if (previous && wished) {
        queryClient.setQueryData(
          qk.wishlist,
          previous.filter((p) => p.id !== productId),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(qk.wishlist, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.wishlist });
    },
  });
}

// --- Orders ------------------------------------------------------------------

export function useInfiniteOrders() {
  return useInfiniteQuery({
    queryKey: qk.orders,
    queryFn: ({ pageParam }) => ordersApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useOrder(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: qk.order(id),
    queryFn: () => ordersApi.detail(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(orderId, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(qk.order(orderId), order);
      void queryClient.invalidateQueries({ queryKey: qk.orders });
    },
  });
}

export function useRequestReturn(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { orderItemId: string; reason: string; imageUrls: string[] }) =>
      ordersApi.requestReturn(orderId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.order(orderId) });
      void queryClient.invalidateQueries({ queryKey: qk.orders });
      void queryClient.invalidateQueries({ queryKey: qk.returns });
    },
  });
}

// --- Addresses ---------------------------------------------------------------

export function useAddresses() {
  return useQuery({ queryKey: qk.addresses, queryFn: userApi.addresses });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddressInput) => userApi.createAddress(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AddressInput> }) =>
      userApi.updateAddress(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.addresses }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.deleteAddress(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.addresses }),
  });
}

// --- Notifications -----------------------------------------------------------

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: userApi.notifications });
}
