import { apiDelete, apiGet, apiPatch, apiPost, client } from './client';
import type {
  AuthSessionResponse,
  AuthUser,
  NotificationDto,
  ProductListParams,
  ReturnRequestDto,
  TokenPairResponse,
  UploadedFileDto,
} from './types';
import type {
  AddressDto,
  ApiOk,
  CartDto,
  CategoryDto,
  CheckoutCreateRequest,
  CheckoutCreateResponse,
  OrderDto,
  Paginated,
  PaymentVerifyRequest,
  ProductDetailDto,
  ProductListItemDto,
  ReviewDto,
} from '../types/shared';

// --- Auth --------------------------------------------------------------------

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiPost<AuthSessionResponse>('/auth/login', body),
  register: (body: { email: string; password: string; name: string; phone?: string }) =>
    apiPost<AuthSessionResponse>('/auth/register', body),
  refresh: (refreshToken: string) =>
    apiPost<TokenPairResponse>('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => apiPost<unknown>('/auth/logout', { refreshToken }),
  me: () => apiGet<AuthUser>('/auth/me'),
};

// --- Profile & addresses -----------------------------------------------------

export type AddressInput = Omit<AddressDto, 'id' | 'isDefault'> & { isDefault?: boolean };

export const userApi = {
  updateProfile: (body: { name?: string; phone?: string }) => apiPatch<AuthUser>('/users/me', body),
  addresses: () => apiGet<AddressDto[]>('/users/me/addresses'),
  createAddress: (body: AddressInput) => apiPost<AddressDto>('/users/me/addresses', body),
  updateAddress: (id: string, body: Partial<AddressInput>) =>
    apiPatch<AddressDto>(`/users/me/addresses/${id}`, body),
  deleteAddress: (id: string) => apiDelete<unknown>(`/users/me/addresses/${id}`),
  registerDeviceToken: (token: string, platform: 'ios' | 'android' | 'web') =>
    apiPost<unknown>('/users/me/device-tokens', { token, platform }),
  notifications: () => apiGet<NotificationDto[]>('/users/me/notifications'),
};

// --- Catalog -----------------------------------------------------------------

export const catalogApi = {
  categories: () => apiGet<CategoryDto[]>('/catalog/categories'),
  products: (params: ProductListParams) =>
    apiGet<Paginated<ProductListItemDto>>('/catalog/products', { ...params }),
  product: (slug: string) => apiGet<ProductDetailDto>(`/catalog/products/${slug}`),
  reviews: (slug: string, page = 1, pageSize = 10) =>
    apiGet<Paginated<ReviewDto>>(`/catalog/products/${slug}/reviews`, { page, pageSize }),
};

// --- Cart --------------------------------------------------------------------

export const cartApi = {
  get: (coupon?: string) => apiGet<CartDto>('/cart', coupon ? { coupon } : undefined),
  addItem: (variantId: string, qty: number) => apiPost<CartDto>('/cart/items', { variantId, qty }),
  updateItem: (id: string, qty: number) => apiPatch<CartDto>(`/cart/items/${id}`, { qty }),
  removeItem: (id: string) => apiDelete<CartDto>(`/cart/items/${id}`),
};

// --- Wishlist ----------------------------------------------------------------

export const wishlistApi = {
  get: () => apiGet<ProductListItemDto[]>('/wishlist'),
  add: (productId: string) => apiPost<unknown>(`/wishlist/${productId}`),
  remove: (productId: string) => apiDelete<unknown>(`/wishlist/${productId}`),
};

// --- Checkout & payments -----------------------------------------------------

export const checkoutApi = {
  create: (body: CheckoutCreateRequest) => apiPost<CheckoutCreateResponse>('/checkout', body),
  verifyPayment: (body: PaymentVerifyRequest) =>
    apiPost<{ orderId: string; orderNumber: string; status: string }>('/payments/verify', body),
  paymentFailed: (body: {
    razorpay_order_id: string;
    error_code?: string;
    error_description?: string;
  }) => apiPost<unknown>('/payments/failed', body),
};

// --- Orders ------------------------------------------------------------------

export const ordersApi = {
  list: (page = 1, pageSize = 10) => apiGet<Paginated<OrderDto>>('/orders', { page, pageSize }),
  detail: (id: string) => apiGet<OrderDto>(`/orders/${id}`),
  cancel: (id: string, reason: string) => apiPost<OrderDto>(`/orders/${id}/cancel`, { reason }),
  requestReturn: (id: string, body: { orderItemId: string; reason: string; imageUrls: string[] }) =>
    apiPost<ReturnRequestDto>(`/orders/${id}/return`, body),
  myReturns: () => apiGet<ReturnRequestDto[]>('/orders/returns'),
};

// --- Reviews -----------------------------------------------------------------

export const reviewsApi = {
  upsert: (body: { productId: string; rating: number; title?: string; body?: string }) =>
    apiPost<ReviewDto>('/reviews', body),
  remove: (id: string) => apiDelete<unknown>(`/reviews/${id}`),
};

// --- Uploads -----------------------------------------------------------------

export interface LocalImageFile {
  uri: string;
  name: string;
  type: string;
}

export const uploadsApi = {
  /** Multipart upload of local images (field name `files`). Returns server-relative URLs. */
  async upload(files: LocalImageFile[]): Promise<UploadedFileDto[]> {
    const form = new FormData();
    for (const file of files) {
      // React Native FormData accepts {uri, name, type} file descriptors.
      form.append('files', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
    }
    const res = await client.post<ApiOk<UploadedFileDto[]>>('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return res.data.data;
  },
};
