# Chikbo — Marketplace Redesign (Nykaa Fashion pattern)

Reference studied: nykaafashion.com (homepage, PLP, PDP) on 2026-08-20.
We replicate the **layout patterns and commerce UX**, not their assets, brand
or copy. Everything is rendered in Chikbo's palette and type.

## What the reference does

**Header** — compact, dense: wordmark, top-level nav, wide search, then
Account / Wishlist / Cart with a count badge.

**Homepage = a stack of CMS widgets**, in this order:
1. Full-bleed hero banner (carousel, promotional).
2. Circular category rail — image + label, horizontal scroll with arrows.
3. "Hot & Happening Categories" — card carousel, image with caption plate.
4. Offer/deal banner grids with labels like "Up to 70% off", "Min 40% off".
5. Product carousels ("In the spotlight", "Hidden gems").
6. Editorial/trend strips.

Nothing on that page is hardcoded — it is a merchandising surface.

**PLP** — left filter sidebar (Category, Size, Brand, Discount, Occasion,
Colour) as collapsible accordions with a Reset; header with title + item count;
right-aligned "Sort by"; product grid.

**Product card** — image on a light neutral plate, wishlist heart top-right,
badge bottom-left, then: brand/category line (small caps) → title (clamped to
2 lines) → price row `₹3,950  ₹7,899  50%` → offer note ("Price dropped by …").

**PDP** — breadcrumbs; vertical thumbnail strip beside a large image; badge,
brand, title; price block (`₹3,950` + `50% Off`, `MRP ₹7,899` struck +
"Inclusive of all taxes"); stock urgency ("Only 1 left"); **Add to Wishlist**
(outline) + **Add to Bag** (filled); pincode delivery checker; trust row
(payment / returns / delivery-by date); coupons; accordions (Product details,
Know your product, Vendor details, Return policy); then Similar Products and
Customers Also Viewed carousels.

## What we build

### 1. Homepage CMS (the core new capability)

New models. A homepage is an ordered list of **sections**, each with a type and
its own items. Staff arrange them in the admin; the storefront renders whatever
it is given.

```prisma
enum HomeSectionType {
  HERO_CAROUSEL     // full-bleed banners
  CATEGORY_RAIL     // circular category chips
  CATEGORY_CARDS    // editorial category cards
  BANNER_GRID       // 2-4 offer tiles with a label
  PRODUCT_CAROUSEL  // products by category / newest / best-selling / manual
  EDITORIAL         // image + copy + CTA strip
}

model HomeSection {
  id         String          @id @default(cuid())
  type       HomeSectionType
  title      String?
  subtitle   String?
  sortOrder  Int             @default(0)
  isActive   Boolean         @default(true)
  /// PRODUCT_CAROUSEL: { source: 'newest'|'category'|'manual', categorySlug?, productIds?, limit }
  config     Json?
  items      HomeSectionItem[]
  startsAt   DateTime?       // scheduled merchandising
  endsAt     DateTime?
}

model HomeSectionItem {
  id         String  @id @default(cuid())
  sectionId  String
  imageUrl   String?
  mobileImageUrl String?
  title      String?
  subtitle   String?   // e.g. "Up to 70% off"
  ctaLabel   String?
  href       String?   // /c/sarees, /p/<slug>, or absolute
  sortOrder  Int     @default(0)
  isActive   Boolean @default(true)
}
```

**API**
- `GET /catalog/home` → active sections, ordered, within their schedule, with
  `PRODUCT_CAROUSEL` sections resolved to real `ProductListItemDto[]`.
  Public, cacheable.
- Admin (permission `content.write`, read `content.read`):
  - `GET /admin/home-sections` (all, including inactive)
  - `POST /admin/home-sections`, `PATCH/DELETE /admin/home-sections/:id`
  - `POST /admin/home-sections/reorder` `{ids: string[]}`
  - `POST /admin/home-sections/:id/items`, `PATCH/DELETE /admin/home-section-items/:id`
  - Images upload through the existing `POST /uploads`.

Add `content.read` / `content.write` to `PERMISSIONS` in `@chikbo/shared`, and
seed them onto the Catalog Manager role.

### 2. Product badges & offer notes

`ProductVariant` already has price + discountPrice, so `50% off` is derived.
Add to `Product`:
```prisma
  /// Merchandising badge, e.g. "New", "Bestseller", "Festive Edit".
  badge      String?
```
Editable in the admin product form. The card shows the badge bottom-left.

### 3. Pincode serviceability (PDP)

- `GET /catalog/serviceability?pincode=500002` →
  `{serviceable, etaDays?, codAvailable:false, message}`.
- Backed by Shiprocket's courier serviceability API when configured; falls back
  to "Pan-India delivery, 3-7 days" when it is not. Cached in-process 24h.
  COD is always false — Chikbo is prepaid only.

### 4. Storefront pages

- **Home** — renders CMS sections; each section type is one component.
- **PLP** — filter sidebar as accordions + Reset, count, sort, dense grid.
- **PDP** — the anatomy above, with our Atelier motion kept (gallery crossfade,
  sticky buy box). "Add to Bag" wording, coupons pulled from active coupons,
  accordions, Similar Products carousel (same category, excluding current).
- **Product card** — one shared component used by grid, carousels and rails.

### 5. Admin

New **Content** area:
- **Homepage** — list of sections, drag to reorder, toggle active, schedule
  window, edit items (image upload, title, subtitle, CTA, link), live preview
  link. Section-type-aware item editors.
- Product form gains **badge**.

## Design rules (unchanged)

Chikbo palette and type from `docs/design-system.md`; Atelier motion from
`docs/design-uplift.md`. Denser than the current storefront — this is a
shopping surface, not a lookbook — but keep Fraunces headings, the warm ivory
ground, brand-orange primary and gold accents. No Nykaa colours, fonts,
imagery or copy.
