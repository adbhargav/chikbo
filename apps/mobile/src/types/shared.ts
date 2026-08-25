/**
 * Copied from packages/shared/src/index.ts (@chikbo/shared).
 *
 * PROVENANCE: apps/mobile is intentionally excluded from the npm workspace, so
 * the workspace package cannot be linked here. This file is a verbatim copy of
 * the customer-facing subset of the shared contract — keep it in sync with
 * packages/shared/src/index.ts when the API contract changes.
 */

// ---------------------------------------------------------------------------
// Enums (mirrored in prisma/schema.prisma — keep in sync)
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUND_INITIATED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUND_INITIATED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'PICKUP_SCHEDULED',
  'IN_TRANSIT',
  'RECEIVED',
  'REFUNDED',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const USER_ROLES = ['CUSTOMER', 'STAFF', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ---------------------------------------------------------------------------
// Domain DTOs (as returned by the API — amounts are integer paise)
// ---------------------------------------------------------------------------

/** All monetary amounts travel as integer paise (₹1 = 100) to avoid float errors. */
export type Paise = number;

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  children?: CategoryDto[];
}

export interface ProductImageDto {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}

export interface VariantDto {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  weightGrams: number | null;
  priceInPaise: Paise;
  discountPriceInPaise: Paise | null;
  stockQty: number;
  isActive: boolean;
  inStock: boolean;
}

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  thumbnailUrl: string | null;
  minPriceInPaise: Paise;
  minDiscountPriceInPaise: Paise | null;
  ratingAvg: number | null;
  ratingCount: number;
  inStock: boolean;
}

export interface ProductDetailDto extends Omit<ProductListItemDto, 'thumbnailUrl'> {
  description: string;
  images: ProductImageDto[];
  variants: VariantDto[];
  attributes: Record<string, string> | null;
}

export interface AddressDto {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CartItemDto {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  thumbnailUrl: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  unitPriceInPaise: Paise;
  lineTotalInPaise: Paise;
  stockQty: number;
}

export interface CartDto {
  items: CartItemDto[];
  subtotalInPaise: Paise;
  couponCode: string | null;
  discountInPaise: Paise;
  shippingInPaise: Paise;
  totalInPaise: Paise;
}

export interface OrderItemDto {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  thumbnailUrl: string | null;
  qty: number;
  unitPriceInPaise: Paise;
  lineTotalInPaise: Paise;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItemDto[];
  subtotalInPaise: Paise;
  discountInPaise: Paise;
  shippingInPaise: Paise;
  totalInPaise: Paise;
  couponCode: string | null;
  shippingAddress: Omit<AddressDto, 'id' | 'isDefault'>;
  awbCode: string | null;
  courierName: string | null;
  trackingEvents?: { status: string; description: string | null; at: string }[];
  createdAt: string;
}

export interface ReviewDto {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API envelope
// ---------------------------------------------------------------------------

export interface ApiOk<T> {
  success: true;
  data: T;
}

export interface ApiErr {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Checkout contract
// ---------------------------------------------------------------------------

export interface CheckoutCreateRequest {
  addressId: string;
  couponCode?: string;
  /** Client-generated UUID; server dedupes repeated submissions. */
  idempotencyKey: string;
}

export interface CheckoutCreateResponse {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountInPaise: Paise;
  currency: 'INR';
  prefill: { name: string; email: string; contact: string };
}

export interface PaymentVerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const formatPaise = (paise: Paise): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const FREE_SHIPPING_THRESHOLD_PAISE: Paise = 99_900; // free shipping at/above ₹999
export const FLAT_SHIPPING_PAISE: Paise = 7_900; // ₹79 otherwise

/** Statuses from which a customer may cancel an order. */
export const CANCELLABLE_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

/** Statuses from which a customer may request a return (genuine damage policy). */
export const RETURNABLE_STATUSES: OrderStatus[] = ['DELIVERED'];
