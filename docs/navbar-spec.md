# Chikbo — Navigation spec (Suta pattern)

Reference studied: suta.in (desktop + mobile) on 2026-08-20. We replicate the
**navigation behaviour**, not their branding. Chikbo palette and type throughout.

## What the reference does

**Desktop**
1. Announcement bar — rotates between messages ("Free shipping over ₹1999").
2. Main bar — wordmark left, centred top-level nav, right icons
   (account, search, cart).
3. **Quick-link strip** under the main bar: 4 flagship destinations separated by
   vertical dividers, full width.
4. Hovering a top-level item opens a dropdown of sub-links; some carry tags
   (`NEW`, `⭐ Bestsellers`). Their menus are flat lists, 4-15 links each.

**Mobile**
1. Announcement bar.
2. Header — hamburger left, centred wordmark, cart right.
3. Full-width search field under the header.
4. Horizontally scrollable quick-link strip.
5. **Fixed bottom tab bar**: Login · Categories · Search (elevated circle) ·
   New Arrivals (NEW badge) · Cart.

## What we build

All of it is driven by the real category tree from `GET /catalog/categories`,
so adding a category in the admin updates the nav with no code change.

### Desktop
- Announcement bar: keep the existing marquee.
- Main bar: wordmark, centred nav of top-level categories + "New Arrivals",
  right icons (search, wishlist, account, cart with count).
- **Mega menu on hover** (150ms open delay, 250ms close grace so a diagonal
  mouse path doesn't lose it): multi-column layout — subcategories grouped into
  columns of up to 6, plus an editorial tile on the right with a "Shop all"
  link. Keyboard: `Enter`/`Space` opens, `Escape` closes and returns focus,
  arrow keys move between items, `Tab` walks the panel naturally.
- **Quick-link strip** beneath the main bar: top categories with dividers,
  active state on the current section.
- **Search overlay**: clicking search expands a full-width panel with an input,
  live product suggestions (debounced 250ms against
  `/catalog/products?search=`), recent searches from localStorage, and quick
  category chips. `Escape` or backdrop click closes; focus is trapped.
- Sticky: the bar condenses on scroll (existing behaviour) and the quick-link
  strip hides once past ~200px to save vertical space.

### Mobile
- Hamburger opens a left drawer: search field, then top-level categories as
  **accordions** revealing subcategories, then account links (Orders, Wishlist,
  Profile) and policy links. Focus trapped, `Escape` closes, body scroll locked.
- Full-width search field under the header (opens the same overlay).
- Scrollable quick-link strip.
- **Fixed bottom tab bar**: Home · Categories · Search (elevated brand circle) ·
  Wishlist · Cart (with count badge). Hidden when a drawer/overlay is open, and
  the page gets bottom padding so nothing sits under it.

### Accessibility & motion
`aria-expanded` / `aria-controls` on every disclosure, `role="navigation"` with
labels, visible focus rings, and all panels honour `prefers-reduced-motion`
(fade only, no slide).
