# Chikbo — Imagery

## The rule

There are two kinds of images on this site, and they are handled differently
**on purpose**.

| | Editorial / atmosphere | Product photography |
|---|---|---|
| Where | Hero, category tiles, brand-story panels | Product cards, product pages, cart, orders |
| What it shows | Mood, craft, the world of the brand | The exact garment the customer will receive |
| Today | Licensed stock photography (`apps/web/public/images/editorial/`) | Licensed stock photography on the **16 demo products** (`apps/api/uploads/products/`) |
| Can it be stock? | Yes — standard practice for every fashion brand | Only while the catalogue is demo data. **Never for real stock.** |

> **Before you go live:** the 16 seeded products are sample data, not Chikbo's
> real inventory, so representative stock photography is fine for demos and
> pitches. The moment a product is something a customer can actually buy and
> receive, its photograph must be of that exact garment — see "Adding real
> product photos" below. Selling item A while showing photo B is
> misrepresentation: it drives returns and payment disputes, breaches the
> Consumer Protection Act 2019 e-commerce rules on accurate product
> information, and reusing another brand's catalogue shots invites copyright
> claims.

**Why product photos can never be stock images.** A customer who buys
"Kanchipuram Pattu Silk Saree — Maroon Zari" for ₹9,999 must receive the saree
in the photograph. Showing a different garment is misrepresentation: it drives
returns and payment disputes, it breaches the Consumer Protection Act 2019
(e-commerce rules on accurate product information), and most attractive garment
photos online are owned by other brands, so reusing them invites copyright
claims. This is why every product still shows generated art rather than a
borrowed photograph — the placeholder is honest, a wrong photo is not.

## Editorial images in use

Source: **Unsplash** — [Unsplash License](https://unsplash.com/license): free
for commercial use, no attribution required, no permission needed.

| File | Used for |
|---|---|
| `hero.jpg` | Home hero — model in a Banarasi saree, landscape crop |
| `cat-sarees.jpg` | Sarees category tile |
| `cat-dresses.jpg` | Dresses category tile |
| `cat-tops.jpg` | Tops category tile |
| `cat-bottomwear.jpg` | Bottomwear category tile |
| `cat-jewellery.jpg` | Antique Imitation Jewellery tile |
| `story-1.jpg`, `story-2.jpg` | Brand-story parallax panels |

Total weight ~2.3 MB. Paths are mapped in
[`apps/web/src/lib/editorial.ts`](../apps/web/src/lib/editorial.ts).

## Demo product photography

All 16 seeded products carry a **3-image gallery** — 48 photographs, 1000×1333
(3:4 portrait), ~9.6 MB total — stored in `apps/api/uploads/products/` and
served by the API at `/uploads/products/`. They live with the API rather than
the frontend because catalogue images are data: the same URLs must work for the
web storefront, the admin dashboard and the mobile app.

**Naming convention:** `<product-slug>-<n>.jpg`, e.g.
`long-kurti-navy-chikankari-1.jpg` … `-3.jpg`. Image `-1` is the card
thumbnail and the first frame in the product-page gallery; the rest become
carousel slides and thumbnails.

The seed **discovers whatever files are present** (`<slug>-<n>.<jpg|png|webp|avif>`,
sorted numerically) and rewrites each product's gallery on every run. So:

- adding `…-4.jpg` and re-seeding extends that product's gallery — no code change;
- replacing a file in place changes the photo with no re-seed at all;
- a product with no matching files falls back to generated SilkArt.

Re-seed with `npm run prisma:seed --workspace apps/api`.

**To use your own campaign photography**, drop a file with the same name into
`apps/web/public/images/editorial/`. No code change needed. Landscape suits the
hero; portrait (3:4) suits the tiles and story panels.

## Adding real product photos

The plumbing is already built and waiting — nothing needs coding:

1. Photograph each variant against a plain, evenly-lit background. Shoot
   portrait 3:4 (e.g. 1200×1600). Two to four angles per product is plenty.
2. In the **admin dashboard** → Products → edit a product → the images field
   uploads via `POST /uploads` (JPEG/PNG/WebP/AVIF, ≤5 MB, up to 6 per product).
3. The moment a product has an image URL, `ProductImage` crossfades the
   photograph over the SilkArt in 0.6s — storefront, mobile app and admin all
   pick it up automatically.

Photography order of priority: best-sellers first, then one hero shot per
category, then the long tail. The site looks complete with roughly 15–20 real
photographs.

## SilkArt (the placeholder system)

[`apps/web/src/components/SilkArt.tsx`](../apps/web/src/components/SilkArt.tsx)
generates deterministic "woven silk" artwork — a colour pair per product family
(maroon/gold sarees, rose dresses, sage tops, indigo bottomwear, antique-gold
jewellery), an SVG thread crosshatch and a slow drifting sheen, seeded by slug
so a product always weaves the same silk. It exists so the catalogue reads as
art-directed while photography is pending, and so a failed image load never
shows a broken-image icon.
