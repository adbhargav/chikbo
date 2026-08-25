/**
 * Admin-endpoint DTOs. The admin API returns Prisma rows (plus includes)
 * directly, so these mirror prisma/schema.prisma for the relevant models.
 */
import type {
  AddressDto,
  AdminHomeSectionDto,
  CouponType,
  HomeSectionItemDto,
  OrderStatus,
  Paise,
  PaymentStatus,
  Permission,
  ReturnStatus,
  UserRole,
} from '@chikbo/shared';

// --- Catalog ---------------------------------------------------------------

/** Per-entity SEO columns. All nullable — empty means "resolve at request time". */
export interface SeoColumns {
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
}

export interface AdminCategory extends SeoColumns {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  /** Alt text for imageUrl — image search and screen readers. */
  imageAlt: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface AdminVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  weightGrams: number | null;
  priceInPaise: Paise;
  discountPriceInPaise: Paise | null;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductImage {
  id: string;
  productId: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}

export interface AdminProduct extends SeoColumns {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  /** Products additionally carry Twitter-specific overrides. */
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  attributes: Record<string, string> | null;
  /** Merchandising badge shown bottom-left on the storefront product card. */
  badge: string | null;
  isActive: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  category?: AdminCategory;
  images: AdminProductImage[];
  variants: AdminVariant[];
}

export interface VariantInput {
  sku: string;
  size?: string | null;
  color?: string | null;
  weightGrams?: number | null;
  priceInPaise: Paise;
  discountPriceInPaise?: Paise | null;
  stockQty?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}

// --- Homepage CMS ----------------------------------------------------------

/** Admin section rows are the shared DTO (products are resolved only publicly). */
export type AdminHomeSection = AdminHomeSectionDto;
export type AdminHomeSectionItem = HomeSectionItemDto;

// --- Dashboard & reports ---------------------------------------------------

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalInPaise: Paise;
  createdAt: string;
  user: { name: string };
  items: { qty: number }[];
}

export interface DashboardData {
  ordersToday: number;
  revenueTodayInPaise: Paise;
  revenueMonthInPaise: Paise;
  pendingShipments: number;
  openReturns: number;
  lowStockCount: number;
  customers: number;
  recentOrders: RecentOrder[];
}

export interface SalesReport {
  daily: { day: string; orders: number; revenue: number }[];
  bestSellers: { productName: string; sku: string; units: number; revenue: number }[];
  byCategory: { category: string; units: number; revenue: number }[];
}

// --- Inventory -------------------------------------------------------------

export type InventoryReason =
  | 'MANUAL_ADJUSTMENT'
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'
  | 'RETURN_RECEIVED'
  | 'RESTOCK'
  | 'CORRECTION';

export interface LowStockVariant extends AdminVariant {
  productName: string;
}

export interface InventoryLogEntry {
  id: string;
  variantId: string;
  delta: number;
  qtyAfter: number;
  reason: InventoryReason;
  refType: string | null;
  refId: string | null;
  note: string | null;
  actorId: string | null;
  createdAt: string;
}

// --- Orders ----------------------------------------------------------------

export interface AdminOrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  thumbnailUrl: string | null;
  unitPriceInPaise: Paise;
  qty: number;
  lineTotalInPaise: Paise;
}

export type RefundStatus = 'INITIATED' | 'PROCESSED' | 'FAILED';

export interface AdminRefund {
  id: string;
  paymentId: string;
  razorpayRefundId: string | null;
  amountInPaise: Paise;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountInPaise: Paise;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: string;
  refunds?: AdminRefund[];
}

export type ShipmentStatus =
  | 'CREATED'
  | 'AWB_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO'
  | 'CANCELLED';

export interface AdminShipment {
  id: string;
  orderId: string;
  shiprocketOrderId: string | null;
  shiprocketShipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
  status: ShipmentStatus;
  isReturn: boolean;
  createdAt: string;
  trackingEvents?: {
    id: string;
    status: string;
    description: string | null;
    location: string | null;
    occurredAt: string;
  }[];
}

export interface AdminShipmentRow extends AdminShipment {
  order: { orderNumber: string; shipCity: string; shipState: string };
}

interface AdminOrderBase {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  subtotalInPaise: Paise;
  discountInPaise: Paise;
  shippingInPaise: Paise;
  totalInPaise: Paise;
  couponId: string | null;
  shipFullName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
}

export interface AdminOrderListItem extends AdminOrderBase {
  user: { id: string; name: string; email: string };
  payments: AdminPayment[];
  shipments: AdminShipment[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface AdminReturnRequest {
  id: string;
  orderId: string;
  orderItemId: string;
  userId: string;
  reason: string;
  imageUrls: string[] | null;
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderDetail extends AdminOrderBase {
  user: { id: string; name: string; email: string; phone: string | null };
  payments: AdminPayment[];
  shipments: AdminShipment[];
  statusHistory: OrderStatusHistoryEntry[];
  returnRequests: AdminReturnRequest[];
  coupon: AdminCoupon | null;
}

export interface AdminReturnRow extends AdminReturnRequest {
  order: { orderNumber: string };
  orderItem: AdminOrderItem;
  user: { name: string; email: string };
}

export interface AdminPaymentRow extends AdminPayment {
  order: { orderNumber: string; user: { email: string } };
  refunds: AdminRefund[];
}

// --- Customers -------------------------------------------------------------

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

export interface AdminCustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: AddressDto[];
  orders: (AdminOrderBase & { items: { qty: number }[] })[];
  wishlist: { id: string; productId: string; product: { name: string; slug: string } }[];
}

// --- Coupons ---------------------------------------------------------------

export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderInPaise: Paise;
  maxDiscountInPaise: Paise | null;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  perUserLimit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { redemptions: number };
}

// --- Staff & roles ---------------------------------------------------------

export interface StaffRoleRow {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface StaffUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  staffRole: StaffRoleRow | null;
  createdAt: string;
}
