# Chikbo Storefront — "Atelier" Uplift Spec

The current storefront is clean but static. The target is an **award-site,
luxury-fashion-house experience** — the level of a Sabyasachi / Raw Mango /
Aesop / Jacquemus site. Cinematic, editorial, alive. Every scroll and hover
should feel choreographed. This spec overrides the visual/motion parts of
design-system.md; the palette, fonts and accessibility rules there still hold.

Installed and ready: `framer-motion` v11 and `lenis` v1 in apps/web.

## Non-negotiables
- KEEP all existing functionality, routes, API wiring, auth, a11y semantics.
  This is a presentation overhaul, not a rewrite of logic.
- 60fps: animate only `transform`, `opacity`, `clip-path`, `filter`. No layout
  thrash. `will-change` sparingly.
- `prefers-reduced-motion`: every effect collapses to simple fades/none.
- Typecheck + build must stay clean.

## Global atmosphere
1. **Lenis smooth scroll** (lerp ~0.1) wired into a single provider; anchor
   scrolls use it.
2. **Film grain**: fixed full-screen SVG feTurbulence noise overlay at ~3%
   opacity, mix-blend overlay — gives the ivory pages a paper/textile feel.
3. **Intro reveal** (first visit per session only, ~1.2s max): ivory curtain
   splits vertically while the CHIKBO wordmark letter-staggers in, then curtain
   lifts to reveal the hero. Sessionstorage-gated, skippable by scroll/click.
4. **Route transitions**: framer-motion `AnimatePresence` — outgoing page fades
   /2% scales down, incoming fades up 12px with a 0.4s custom ease
   `[0.22, 1, 0.36, 1]`. Scroll restored to top via Lenis.
5. **Selection & scrollbar**: brand-orange text selection; slim ink scrollbar.
6. **Reveal system**: a `<Reveal>` component (whileInView, once, stagger
   support) used for every section: headlines split into lines that slide up
   from behind `overflow:hidden` masks; body copy and cards fade-rise with
   60-90ms stagger.

## Signature visual system — "woven silk" art direction
There is no product photography yet, so BUILD the imagery:
- `SilkArt` component: deterministic per-seed (product slug / category slug)
  generated art — layered CSS/SVG: a rich two-tone silk gradient (pick hue
  pairs per category: sarees = maroon/gold, dresses = rose/blush, tops =
  ivory/sage, bottomwear = indigo/steel, jewellery = antique gold/ink),
  a woven texture (SVG pattern of fine crosshatch threads), a soft radial
  sheen that MOVES slowly (8s ease-in-out infinite alternate), and the product
  name set small in Fraunces italic at the bottom. Product cards, category
  tiles, hero panels and banners all use SilkArt — the site must look
  art-directed, never "missing images". When a real image URL loads
  successfully, it replaces the art with a 0.6s crossfade.
- **Paisley/zari accents**: subtle inline-SVG paisley line-art motifs (stroke
  gold, 1px, ~12% opacity) floating in section backgrounds with slow parallax.

## Header
- Over the hero: transparent, ink text. After 80px: morphs (0.3s) to frosted
  ivory glass (backdrop-blur 16px, hairline bottom border), height shrinks
  88→64px, wordmark scales down slightly.
- Category nav items: hover underline that draws left→right (scaleX origin
  left); active category keeps it.
- **Mega-menu**: hovering a top category opens a full-width panel (fade+6px
  rise, 0.25s): left = subcategory list with per-item slide-in stagger,
  right = SilkArt editorial tile of that category with a "Shop all" arrow-link
  whose arrow nudges on hover.
- **Cart drawer**: cart icon opens a right slide-in drawer (spring, 420px)
  with line items, qty steppers, free-shipping progress bar and checkout CTA;
  backdrop blurs. Adding to cart: the button morphs to a check, the cart badge
  does a pop (scale 1→1.4→1) and the drawer peeks open. Keep /cart page too.
- Announcement bar becomes a slow **marquee** when content overflows:
  "Pan-India shipping · Free delivery over ₹999 · Trusted since 1992 · Woven
  with pride ·" looping.

## Home page (rebuild it section by section)
1. **Hero (100svh)**: full-bleed SilkArt (sarees palette) with slow ken-burns
   + mouse-parallax (±8px, spring). Content: gold overline "SINCE 1992 ·
   HYDERABAD", then a massive Fraunces display (clamp 3.5–7rem) "Woven with
   trust, worn with pride." revealed line-by-line from masks (0.9s stagger
   0.12), sub-copy fade, two CTAs (primary magnetic — the button translates
   toward the cursor within 20px and springs back). Bottom: thin scroll cue
   line animating downward. Hero art parallaxes at 0.85 scroll speed
   (useScroll + useTransform).
2. **Heritage marquee**: infinite CSS marquee, two rows opposite directions,
   Fraunces italic ghost-outline words: "Pattu Silk — Banarasi — Kanjivaram —
   Since 1992 — Handpicked — ..." pausing on hover.
3. **Categories — editorial asymmetric grid**: 5 SilkArt tiles in a broken
   grid (one tall 2-row tile, others varied), each with index number "01",
   name in Fraunces, hover: art scales 1.06 + sheen sweeps across (diagonal
   white gradient translate), arrow chip appears. Whole grid staggers in.
4. **Stats strip**: ink-900 band, 4 count-up numbers (34+ years of textiles,
   5000+ happy drapes, 25+ cities served, 4.9 rating) triggered in view,
   Fraunces numerals in gold.
5. **New Arrivals rail**: horizontal drag-scroll (framer-motion drag="x" with
   constraints) + snap, custom progress bar underneath that fills as you
   scroll the rail; cards tilt ±2° subtly while dragging.
6. **Split editorial banner**: sticky-ish two-column — left column text pins
   (position sticky) while right column SilkArt panels scroll past with
   parallax; copy about the 1992 heritage, gold divider draws in.
7. **Testimonials**: auto-advancing crossfade quotes (6s), big Fraunces
   quotes, small gold stars, progress dots.
8. **Newsletter**: full-width, giant input with animated focus underline that
   draws across; submit button magnetic.
9. **Footer**: ink-900; a GIANT ghost CHIKBO wordmark (10-14vw, 6% cream
   opacity) that rises slightly into view; links get slide-right hover with
   gold arrow; top hairline draws in on view.

## Catalog & PDP
- Grid items: staggered entrance; hover lifts card 4px with soft shadow +
  SilkArt sheen sweep + "Quick view ➔ product" CTA bar sliding up from the
  bottom of the tile. Wishlist heart: burst micro-animation (scale + 6 tiny
  gold particles).
- Filters open in an animated slide-down panel; applied filter chips pop in.
- Skeletons keep the shimmer but tinted warm.
- PDP: gallery crossfades between thumbs; main image has hover parallax-tilt
  (rotateX/Y ≤3°); buy box is sticky on desktop; size chips have a
  spring-scale select; Add to Cart = magnetic + morphs to "Added ✓" then cart
  badge pops + drawer peeks. Accordion chevrons rotate; content height
  animates (framer-motion).
- Breadcrumbs slide in; page title uses the mask-reveal.

## Checkout/account
Keep current layouts but apply: Reveal on section entry, animated form focus
states (label float + gold underline), button magnetism, order status timeline
draws its connector line downward as steps appear, status pills get a soft
pulse on the active step.

## QA checklist before finishing
- Desktop 1280+ AND ~800px AND 390px mobile all composed (test via viewport).
- No animation on reduced-motion. No horizontal overflow anywhere.
- Lighthouse-sane: hero LCP is text, art is CSS/SVG (cheap).
- `npm run typecheck -w apps/web` and `npm run build -w apps/web` clean.
