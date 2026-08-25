# Chikbo Design System — "Heritage Modern"

Chikbo has dealt in textiles since 1992: the design must feel like a premium
heritage fashion house with a modern, fast storefront. Think Sabyasachi ×
Zara online: editorial, warm, confident. Never bootstrap-generic.

## Brand
- Name: **CHIKBO** (always uppercase in the wordmark)
- Tagline: *Trust, Quality and Budget friendly*
- Heritage line: *Dealing in textiles since 1992*
- Logo: orange cart + black "C" (assets not yet provided — render the wordmark in type)

## Palette (CSS variables)
```css
--brand-600: #EA7A12;  /* primary — Chikbo orange, slightly deepened for elegance */
--brand-500: #F97316;  /* logo orange — hovers, gradients */
--brand-700: #C2610A;  /* pressed */
--brand-50:  #FFF4E8;  /* tint backgrounds, badges */
--ink-900:   #1A1714;  /* near-black warm ink — headings, footer bg */
--ink-700:   #3D3833;  /* body text */
--ink-500:   #6E675F;  /* secondary text */
--ink-300:   #B9B2A9;  /* borders, disabled */
--cream-50:  #FDFBF7;  /* page background — warm ivory, NOT pure white */
--cream-100: #F7F2EA;  /* cards, section alternation */
--gold-500:  #B08D3E;  /* accents: ratings, "since 1992", dividers */
--success:   #1E7F4F;  --error: #C0392B;  --info: #2C5F8A;
```
Dark is not required for web/admin v1; keep the warm-ivory look.

## Type
- Display/headings: **"Fraunces"** (Google Fonts), weight 500–600, tight leading,
  slight negative tracking. Fashion-editorial feel.
- UI/body: **"Inter"**, 400/500/600. 16px base, 1.6 line height.
- Wordmark: Fraunces 600 uppercase, letter-spacing 0.18em, "CHIKBO" with the O
  optionally in brand orange.
- Prices: Inter 600, tabular-nums. Strike-through MRP in --ink-500.

## Feel
- Generous whitespace; max content width 1280px; 12-col grid, 24px gutters.
- Cards: radius 12px, border 1px --ink-300 @ 40%, shadow only on hover
  (0 8px 30px rgba(26,23,20,.08)); product images ratio 3:4, object-cover,
  background --cream-100, subtle zoom on hover (scale 1.04, 600ms ease).
- Buttons: primary = --brand-600 bg, white text, radius 999px, padding 12/28,
  hover raises brightness + tiny translateY(-1px). Secondary = 1px ink border,
  transparent. Never default blue.
- Section headers: small gold overline label (uppercase, tracking .2em) above a
  Fraunces heading — e.g. "SINCE 1992 / Woven with Trust".
- Micro-interactions: 150–250ms ease-out transitions; skeleton shimmer loading
  states (no spinners on content areas); toasts bottom-center, ink-900 bg.
- Imagery placeholders: seeded product images live at `/images/products/*` which
  won't resolve in dev — always render a graceful fallback: a --cream-100 block
  with a centered subtle Chikbo monogram/category icon and the product name.
  NEVER a broken-image glyph.

## Voice
Short, warm, confident. "Woven with trust since 1992." "Free delivery over ₹999."
Empty states get one gentle line + a clear CTA, never sad-face emoji.

## Accessibility
- Contrast AA minimum (the palette above passes on cream backgrounds).
- Visible focus rings (2px --brand-600 offset 2px), full keyboard nav,
  aria-labels on icon buttons, alt text everywhere, prefers-reduced-motion
  respected (disable zoom/parallax).

## Layout blueprints
- **Web header**: top utility bar (ink-900 bg, cream text: "Pan-India shipping ·
  Free delivery over ₹999") → main bar: wordmark left, centered nav (Sarees,
  Dresses, Tops, Bottomwear, Jewellery), right: search, wishlist, account, cart
  with count badge. Sticky with backdrop blur after scroll.
- **Home**: full-bleed hero (cream gradient + editorial type + CTA), category
  tiles (5, editorial crops), "New Arrivals" rail, trust strip (Since 1992 ·
  Quality checked · Secure payments · Pan-India), featured collection banner,
  reviews strip, newsletter, rich footer (ink-900 bg, cream text, 4 columns).
- **Admin**: left sidebar (ink-900 bg, cream text, orange active pill), topbar
  with search + staff name/role chip. Content on cream. KPI cards with big
  Fraunces numbers. Tables: hairline rows, sticky header, right-aligned money.
  Status pills: soft tinted bg + dot (e.g. DELIVERED = success tint).
- **Mobile app**: same palette/typography (Fraunces via expo-google-fonts),
  bottom tabs: Home, Categories, Wishlist, Orders, Profile. Cart as header icon.
