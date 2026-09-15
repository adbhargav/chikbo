/**
 * @chikbo/shared — single source of truth for enums, domain types and
 * API contracts shared by the API, web storefront, admin dashboard and
 * mobile app. Keep this dependency-free.
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

export const COUPON_TYPES = ['PERCENT', 'FLAT'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

/** RBAC permission keys. Staff roles hold a subset; SUPER_ADMIN implicitly has all. */
export const PERMISSIONS = [
  'dashboard.view',
  'products.read',
  'products.write',
  'categories.write',
  'inventory.read',
  'inventory.write',
  'orders.read',
  'orders.write',
  'customers.read',
  'customers.write',
  'coupons.read',
  'coupons.write',
  'returns.read',
  'returns.write',
  'refunds.write',
  'shipments.read',
  'shipments.write',
  'payments.read',
  'reports.read',
  'staff.read',
  'staff.write',
  'notifications.write',
  'content.read',
  'content.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

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
  /** Merchandising badge ("New", "Bestseller", "Festive Edit"); shown bottom-left on the card. */
  badge: string | null;
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

/** Distinct filterable variant values across the active catalog (PLP sidebar). */
export interface FilterFacetsDto {
  sizes: string[];
  colors: string[];
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
// Homepage CMS (mirrored in prisma/schema.prisma — keep in sync)
// ---------------------------------------------------------------------------

/** The homepage is an ordered stack of typed sections; staff arrange them in the admin. */
export const HOME_SECTION_TYPES = [
  'HERO_CAROUSEL', // full-bleed promotional banners
  'CATEGORY_RAIL', // circular category chips
  'CATEGORY_CARDS', // editorial category cards
  'BANNER_GRID', // 2-4 offer tiles with a label
  'PRODUCT_CAROUSEL', // products by newest / category / manual pick
  'EDITORIAL', // image + copy + CTA strip
] as const;
export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export const PRODUCT_CAROUSEL_SOURCES = ['newest', 'category', 'manual'] as const;
export type ProductCarouselSource = (typeof PRODUCT_CAROUSEL_SOURCES)[number];

/** `config` of a PRODUCT_CAROUSEL section. */
export interface ProductCarouselConfig {
  source: ProductCarouselSource;
  /** Required when source === 'category'. */
  categorySlug?: string;
  /** Required when source === 'manual'; order is preserved. */
  productIds?: string[];
  /** How many products to resolve (1-24, default 12). */
  limit?: number;
}

/** Per-type section settings. PRODUCT_CAROUSEL uses ProductCarouselConfig. */
export type HomeSectionConfig = Partial<ProductCarouselConfig> & Record<string, unknown>;

/** One tile/slide inside a section. */
export interface HomeSectionItemDto {
  id: string;
  imageUrl: string | null;
  /** Portrait crop for small screens; falls back to imageUrl. */
  mobileImageUrl: string | null;
  title: string | null;
  /** e.g. "Up to 70% off" */
  subtitle: string | null;
  ctaLabel: string | null;
  /** `/c/<slug>`, `/p/<slug>` or an absolute URL. */
  href: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface HomeSectionDto {
  id: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Scheduled merchandising window (ISO strings); null means always. */
  startsAt: string | null;
  endsAt: string | null;
  config: HomeSectionConfig | null;
  items: HomeSectionItemDto[];
  /** Resolved products — filled for PRODUCT_CAROUSEL, `[]` for every other type. */
  products: ProductListItemDto[];
}

/** Admin reads/writes sections without resolving `products`. */
export type AdminHomeSectionDto = Omit<HomeSectionDto, 'products'>;

// ---------------------------------------------------------------------------
// Serviceability (pincode delivery check)
// ---------------------------------------------------------------------------

export interface ServiceabilityDto {
  pincode: string;
  serviceable: boolean;
  /** Best courier estimate in days; null when unknown. */
  etaDays: number | null;
  /** Chikbo is prepaid only — always false. */
  codAvailable: false;
  message: string;
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

/** Delivery address supplied inline (guest checkout, or a one-off address). */
export interface CheckoutAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface CheckoutCreateRequest {
  /** Signed-in customers: one of their saved addresses. */
  addressId?: string;
  /** Guests (or anyone): an address typed at checkout. Takes precedence over addressId. */
  address?: CheckoutAddressInput;
  /** Guests: where the confirmation goes. Ignored when signed in. */
  email?: string;
  couponCode?: string;
  /** Client-generated UUID; server dedupes repeated submissions. */
  idempotencyKey: string;
}

/** Response of POST /orders/claim — attaches a guest session's orders and cart to the account. */
export interface OrderClaimResponse {
  claimedOrders: number;
  mergedCartLines: number;
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
