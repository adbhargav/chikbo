# CHIKBO — E-commerce Platform

*Trust, Quality and Budget friendly · Dealing in textiles since 1992*

Production-grade e-commerce platform: React web storefront, React Native mobile
app, Node.js API, PostgreSQL, Razorpay payments and Shiprocket shipping.

## Repository layout

```
chikbo/
├── apps/
│   ├── api/       Node.js + Express + TypeScript + Prisma (PostgreSQL)
│   ├── web/       React storefront (Vite, port 5173)
│   ├── admin/     React admin dashboard (Vite, port 5174)
│   └── mobile/    React Native app (Expo — standalone, not an npm workspace)
├── packages/
│   └── shared/    Shared TypeScript types, API contracts, money helpers
└── docs/
    ├── api-contract.md    REST API reference
    └── design-system.md   Brand & UI system ("Heritage Modern")
```

## Quick start (development)

Prerequisites: Node 20+, Docker (for PostgreSQL) or a local PostgreSQL 14+.

```bash
# 1. Install workspace dependencies (api, web, admin, shared)
npm install

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Configure the API
cp apps/api/.env.example apps/api/.env
#    -> set JWT secrets (any long random strings for dev)
#    -> Razorpay/Shiprocket/SMTP keys can stay empty for browsing the catalog;
#       checkout requires Razorpay test keys.

# 4. Create the schema and seed the catalog (categories, products, roles,
#    admin user, WELCOME10 coupon)
npm run prisma:migrate --workspace apps/api   # answer "init" as migration name
npm run prisma:seed --workspace apps/api

# 5. Run everything (three terminals)
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
npm run dev:admin   # http://localhost:5174

# Mobile app (separate install — not part of the npm workspace)
cd apps/mobile && npm install && npx expo start
```

Seeded logins (change these in production — set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`):

| Account | Email | Password | Role |
|---|---|---|---|
| Super admin | admin@chikbo.in | ChangeMe@123 | SUPER_ADMIN (all permissions) |
| Operations | ops@chikbo.in | ChangeMe@123 | STAFF — Operations Manager |

## Tests & builds

```bash
npm test          # API unit tests (pricing engine, Razorpay signatures)
npm run typecheck # strict TypeScript across all workspaces
npm run build     # production builds: shared, api, web, admin
```

## Architecture highlights

**Security**
- JWT access tokens (15 min) + rotating refresh tokens stored hashed (SHA-256)
  in the DB; password change revokes all sessions. bcrypt cost 12.
- **Google Sign-In** (ID-token flow, verified server-side against Google's
  public keys) and **password reset** by single-use hashed token, with no
  account enumeration. Setup: [docs/google-auth-setup.md](docs/google-auth-setup.md).
  Google sign-in can only ever create a CUSTOMER — never staff.
- RBAC: `SUPER_ADMIN` implicit all-permissions; staff roles hold granular
  permission lists (see `PERMISSIONS` in `packages/shared`); every admin route
  is guarded by `requirePermission(...)`.
- Razorpay/Shiprocket/SMTP credentials live only in API env vars — never in
  web/mobile bundles. Zod validation on every request; helmet, CORS allow-list,
  tiered rate limiting (strict on auth, bounded on webhooks), pino logging with
  secret redaction.

**Storefront experience ("Atelier")**
- Motion stack: `framer-motion` for choreography, `lenis` for smooth scroll.
  Full art-direction spec in [docs/design-uplift.md](docs/design-uplift.md).
- **SilkArt** (`apps/web/src/components/SilkArt.tsx`): deterministic generated
  "woven silk" artwork — a per-family hue pair, an SVG thread crosshatch and a
  drifting sheen, seeded by slug so a product always weaves the same silk. It
  stands in for photography today and crossfades to real images the moment a
  photo URL loads, so the catalogue never shows a broken or empty frame.
- Choreography: session intro curtain, route transitions, mask-based headline
  reveals, parallax hero, ghost heritage marquee, editorial category grid,
  count-up stats, drag-scroll arrivals rail, sticky split editorial, cart
  drawer with badge pop, gallery tilt and add-to-cart morph.
- Every ambient loop and transition is disabled under
  `prefers-reduced-motion`; animation is transform/opacity only.
- Imagery policy in [docs/imagery.md](docs/imagery.md): editorial areas (hero,
  category tiles, story panels) use licensed stock photography; **product
  images are never stock** — they stay on SilkArt until real photographs of the
  actual stock are uploaded through the admin.

**Money & orders**
- All amounts are integer paise end-to-end; totals are computed exclusively on
  the server (`apps/api/src/utils/pricing.ts`) from DB prices — client prices
  are never trusted.
- Checkout is transactional: conditional atomic stock decrements (a concurrent
  purchase of the last unit fails cleanly with `INSUFFICIENT_STOCK`), coupon
  validation with global/per-user limits, order + items + inventory-log created
  atomically, then the Razorpay order is created with compensation (stock
  restored, order cancelled) if the gateway call fails.
- Client-supplied UUID idempotency key makes order creation retry-safe;
  duplicate payments are impossible (unique razorpay ids + idempotent capture).
- A background reaper cancels unpaid PENDING orders after 45 min and restores
  reserved stock.

**Payments (Razorpay)**
- Server-side HMAC-SHA256 signature verification (constant-time compare) for
  both the checkout callback and webhooks (raw-body verification).
- Webhooks are idempotent: every event is recorded in `WebhookEvent` with a
  unique `(source, externalId)` key; duplicates short-circuit. Handled events:
  `payment.captured`, `payment.failed`, `refund.processed`.
- Refunds (cancellations, damage returns) go through the Razorpay refunds API
  with full audit trail (`Refund` rows + order status history).

**Shipping (Shiprocket)**
- Token-cached client: create adhoc order, assign AWB, track, create return
  pickup. Tracking webhook syncs courier scans into `ShipmentTrackingEvent`
  and advances order status (SHIPPED → OUT_FOR_DELIVERY → DELIVERED) without
  ever regressing terminal states; deduped like payment webhooks.

**Inventory**
- Per-variant stock with low-stock thresholds, automatic out-of-stock (derived
  from `stockQty`), and a full `InventoryLog` audit trail (order placed /
  cancelled / return received / manual adjustment / restock / correction).

**Notifications**
- In-app notifications persisted per user; push via FCM (device-token registry
  with dead-token pruning), transactional email via SMTP, WhatsApp via a
  provider HTTP API. Each channel activates only when configured — flows never
  fail because a channel is down.

## Go-live checklist

1. **Razorpay**: create the merchant account, put `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET` in the API env; configure a webhook to
   `https://api.<domain>/api/v1/webhooks/razorpay` with events
   `payment.captured`, `payment.failed`, `refund.processed` and set
   `RAZORPAY_WEBHOOK_SECRET`.
2. **Shiprocket**: create an API user, set `SHIPROCKET_EMAIL`/`PASSWORD` and
   the pickup location name; point the tracking webhook to
   `https://api.<domain>/api/v1/webhooks/shiprocket` and set a shared
   `SHIPROCKET_WEBHOOK_TOKEN` (sent as `x-api-key`).
3. **Database**: managed PostgreSQL, `npm run prisma:deploy --workspace apps/api`.
4. **Secrets**: generate long random JWT secrets; rotate the seeded admin
   password immediately.
5. **Email/WhatsApp/Push**: SMTP creds (SES/Zoho), WhatsApp provider API
   (Gupshup/Interakt/Twilio), Firebase service-account path for FCM. SMTP is
   required for password-reset emails.
6. **Google Sign-In**: create an OAuth *Web application* client, add the
   production origins, set `GOOGLE_CLIENT_ID`, and set `WEB_APP_URL` to the
   public storefront URL so reset links point at the right host — see
   [docs/google-auth-setup.md](docs/google-auth-setup.md).
7. **Uploads**: local `/uploads` works out of the box; for scale swap the
   multer storage engine for S3/Cloudinary (single file:
   `apps/api/src/modules/uploads/uploads.routes.ts`).
8. Serve web/admin builds behind a CDN; set `VITE_API_URL`, and add the final
   origins to `CORS_ORIGINS`.

## Business profile

- Phone: 9346060635 · Warehouse: 21-1-684 & 85, Rikab gunj, Hyderabad
- Payments: Razorpay (prepaid only, COD disabled by design)
- Shipping: Pan-India via Shiprocket; free delivery at/above ₹999, else ₹79
- Returns: genuine-damage only — photo evidence required at request time
