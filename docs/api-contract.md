# Chikbo API Contract (v1)

Base URL: `http://localhost:4000/api/v1` (env-configurable per client).
All responses use the envelope `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.
All money values are **integer paise** (₹1 = 100). Use `formatPaise` from `@chikbo/shared`.
Auth: `Authorization: Bearer <accessToken>`. Refresh with the refresh token; access tokens last 15 min.
Shared TypeScript types live in `packages/shared/src/index.ts` (`@chikbo/shared`) — use them.

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /auth/register | `{email, password, name, phone?}` | → `{user, accessToken, refreshToken}` (201) |
| POST | /auth/login | `{email, password}` | → `{user, accessToken, refreshToken}` |
| POST | /auth/refresh | `{refreshToken}` | → `{accessToken, refreshToken}` (rotates; store the new one) |
| POST | /auth/logout | `{refreshToken}` | revokes it |
| GET | /auth/providers | — | → `{google:{enabled, clientId}}` — clients render the Google button only when `enabled` |
| POST | /auth/google | `{idToken}` | Google ID token from Google Identity Services → `{user, accessToken, refreshToken}`. Verified server-side against Google's public keys; only ever creates a CUSTOMER |
| POST | /auth/forgot-password | `{email}` | Always → `{sent:true}` (never reveals whether an address is registered). Emails a single-use link valid 60 min |
| POST | /auth/reset-password | `{token, newPassword}` | Consumes the token, sets the password, revokes every session |
| POST | /auth/change-password | `{currentPassword, newPassword}` | auth required; revokes all sessions |
| GET | /auth/me | — | → `{id, email, name, role, permissions}` |

Password rule: ≥8 chars with a letter and a number. Phone: 10-digit Indian mobile.

## Profile & addresses (auth)
- `PATCH /users/me` `{name?, phone?}`
- `GET /users/me/addresses` → `AddressDto[]`
- `POST /users/me/addresses` (AddressDto fields minus id; `pincode` 6 digits) — first address becomes default
- `PATCH /users/me/addresses/:id`, `DELETE /users/me/addresses/:id`
- `POST /users/me/device-tokens` `{token, platform: 'ios'|'android'|'web'}` — push registration
- `GET /users/me/notifications` → in-app notifications (latest 50)

## Catalog (public)
- `GET /catalog/categories` → `CategoryDto[]` tree (top level: sarees, dresses, tops, bottomwear, antique-imitation-jewellery)
- `GET /catalog/products?page&pageSize&category=<slug>&search&minPrice&maxPrice&sizes=S,M&colors=Ivory&inStock=true&sort=newest|price_asc|price_desc|rating`
  → `Paginated<ProductListItemDto>`. minPrice/maxPrice are **rupees**.
- `GET /catalog/products/:slug` → `ProductDetailDto` (includes `variants` with per-variant price/discount/stock)
- `GET /catalog/products/:slug/reviews?page&pageSize` → `Paginated<ReviewDto>`
- `GET /catalog/home` → `HomeSectionDto[]` — the merchandised homepage: active sections inside
  their schedule window, ordered by `sortOrder`, each with its **active** items ordered by
  `sortOrder`. `PRODUCT_CAROUSEL` sections arrive with `products: ProductListItemDto[]` already
  resolved from their `config` (`{source: 'newest'|'category'|'manual', categorySlug?, productIds?, limit?}`);
  every other type has `products: []`. Section/item shapes live in `@chikbo/shared`
  (`HomeSectionDto`, `HomeSectionItemDto`, `HOME_SECTION_TYPES`). No auth, cacheable.
- `GET /catalog/serviceability?pincode=500002` → `ServiceabilityDto`
  `{pincode, serviceable, etaDays, codAvailable: false, message}`. Pincode is 6 digits and cannot
  start with 0. Backed by Shiprocket courier serviceability when configured, otherwise a pan-India
  default (≈5 days); answers are cached in-process for 24h. **COD is always false** — Chikbo is prepaid only.

`ProductListItemDto` carries `badge` (`"New"`, `"Bestseller"`, …) for the card's bottom-left flag.

## Cart (auth)
- `GET /cart?coupon=CODE` → `CartDto` (server prices everything; passing `coupon` validates & prices it — 422 with codes `COUPON_INVALID|COUPON_EXPIRED|COUPON_MIN_ORDER|COUPON_EXHAUSTED|COUPON_ALREADY_USED` when not applicable)
- `POST /cart/items` `{variantId, qty}` → CartDto (max 10/line, clamped to stock)
- `PATCH /cart/items/:id` `{qty}` (0 removes) → CartDto
- `DELETE /cart/items/:id` → CartDto

Shipping: free at/above ₹999 after discount, else ₹79 (constants in shared).

## Wishlist (auth)
- `GET /wishlist`, `POST /wishlist/:productId`, `DELETE /wishlist/:productId`

## Checkout & payment (auth)
1. `POST /checkout` `{addressId, couponCode?, idempotencyKey: <uuid>}` → `CheckoutCreateResponse` `{orderId, orderNumber, razorpayOrderId, razorpayKeyId, amountInPaise, currency, prefill}`. Keep the same idempotencyKey when retrying — the same pending order is returned.
   Errors: 422 `INSUFFICIENT_STOCK`, `PAYMENTS_UNAVAILABLE`, coupon codes above.
2. Open Razorpay Checkout with `key: razorpayKeyId, order_id: razorpayOrderId, amount, currency`.
3. On success: `POST /payments/verify` with `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` → `{orderId, orderNumber, status}`.
4. On failure/dismiss: `POST /payments/failed` `{razorpay_order_id, error_code?, error_description?}`.
   The server also confirms via webhook, so verify failure is non-fatal; poll the order.

## Orders (auth)
- `GET /orders?page&pageSize` → `Paginated<OrderDto>`
- `GET /orders/:id` → `OrderDto` (includes `trackingEvents` when shipped)
- `POST /orders/:id/cancel` `{reason}` — allowed in PENDING/CONFIRMED/PROCESSING; auto-refunds if paid
- `POST /orders/:id/return` `{orderItemId, reason (≥10 chars), imageUrls: [≥1 photo]}` — only for DELIVERED (genuine damage policy)
- `GET /orders/returns` → my return requests

Order statuses: PENDING, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURNED, REFUND_INITIATED, REFUNDED.

## Reviews (auth)
- `POST /reviews` `{productId, rating 1-5, title?, body?}` (upserts own review; verifiedPurchase auto-set)
- `DELETE /reviews/:id`

## Uploads (auth)
- `POST /uploads` multipart field `files` (≤6 images ≤5MB; jpeg/png/webp/avif) → `[{url, size}]`. URLs are server-relative (`/uploads/...`) — prefix with the API origin when rendering.

## Admin (auth + STAFF/SUPER_ADMIN + RBAC permission)
All under `/admin`. 403 body includes the missing permission.
- `GET /admin/dashboard` (dashboard.view) → `{ordersToday, revenueTodayInPaise, revenueMonthInPaise, pendingShipments, openReturns, lowStockCount, customers, recentOrders}`
- `GET /admin/reports/sales?days=30` (reports.read) → `{daily[], bestSellers[], byCategory[]}`
- Categories: `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` (products.read / categories.write)
- Products: `GET /admin/products?page&search&categoryId`, `POST /admin/products` (name, slug, description, categoryId, attributes?, badge?, images[{url,alt}], variants[{sku, size?, color?, weightGrams?, priceInPaise, discountPriceInPaise?, stockQty, lowStockThreshold?}]), `PATCH /admin/products/:id` (same fields incl. `badge`), `POST /admin/products/:id/variants`, `PATCH /admin/variants/:id` (stock changes go through inventory adjust, not variant patch)
- Inventory: `GET /admin/inventory/low-stock`, `POST /admin/inventory/adjust` `{variantId, delta, reason: MANUAL_ADJUSTMENT|RESTOCK|CORRECTION|RETURN_RECEIVED, note?}`, `GET /admin/inventory/history/:variantId`
- Orders: `GET /admin/orders?page&status&search&from&to`, `GET /admin/orders/:id` (full detail incl. payments, shipments, history), `POST /admin/orders/:id/status` `{status: PROCESSING|SHIPPED|OUT_FOR_DELIVERY|DELIVERED|CANCELLED, note?}`
- Shipments: `POST /admin/orders/:id/shipment` (creates in Shiprocket), `POST /admin/shipments/:id/awb` `{courierId?}`, `GET /admin/shipments`
- Returns: `GET /admin/returns?status`, `POST /admin/returns/:id/decision` `{decision: APPROVED|REJECTED, adminNote?}`, `POST /admin/returns/:id/received` `{restock}`
- Refunds: `POST /admin/orders/:id/refund` `{amountInPaise?, reason, returnRequestId?}`
- Payments: `GET /admin/payments?status`
- Customers: `GET /admin/customers?search`, `GET /admin/customers/:id`, `PATCH /admin/customers/:id` `{isActive}`
- Coupons: `GET/POST /admin/coupons`, `PATCH /admin/coupons/:id` — PERCENT value is basis points (1000 = 10%), FLAT value is paise
- Staff: `GET /admin/roles` → `{roles, allPermissions}`, `POST/PATCH /admin/roles(/:id)`, `GET/POST /admin/staff`, `PATCH /admin/staff/:id` `{staffRoleId?, isActive?}`
- Homepage CMS (`content.read` to read, `content.write` to change) — all return `AdminHomeSectionDto`
  (the public shape minus `products`) or `HomeSectionItemDto`:
  - `GET /admin/home-sections` → every section, **including inactive and out-of-schedule ones**, with all items
  - `POST /admin/home-sections` `{type, title?, subtitle?, isActive?, sortOrder?, config?, startsAt?, endsAt?}` — appended to the bottom when `sortOrder` is omitted
  - `PATCH /admin/home-sections/:id` (same fields, all optional), `DELETE /admin/home-sections/:id` (items cascade)
  - `POST /admin/home-sections/reorder` `{ids: string[]}` → the re-sorted list (`sortOrder` becomes the array index)
  - `POST /admin/home-sections/:id/items` `{imageUrl?, mobileImageUrl?, title?, subtitle?, ctaLabel?, href?, isActive?, sortOrder?}`
  - `POST /admin/home-sections/:id/items/reorder` `{ids: string[]}` → the re-sorted items
  - `PATCH /admin/home-section-items/:id`, `DELETE /admin/home-section-items/:id`
  - Images go through `POST /uploads`; `href` takes `/c/<slug>`, `/p/<slug>` or an absolute URL.
  - `endsAt` must be after `startsAt` (400 `BAD_REQUEST` otherwise). Every write lands in the audit log.

Demo credentials after seeding: `admin@chikbo.in` / `ChangeMe@123` (SUPER_ADMIN), `ops@chikbo.in` / `ChangeMe@123` (Operations Manager).
