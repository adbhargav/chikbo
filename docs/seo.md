# Chikbo SEO

## Architecture

Chikbo's storefront is a client-rendered React SPA. Googlebot executes
JavaScript, but **social crawlers do not** — Facebook, WhatsApp, X, LinkedIn
and Slack read the raw HTML response. Meta tags written by React after
hydration are invisible to them, so a shared product link would show no
preview card at all.

SEO is therefore resolved **server-side**, in the API:

```
request  →  redirect check  →  SEO resolver  →  index.html + injected <head>  →  SPA hydrates
```

| Layer | File | Responsibility |
|---|---|---|
| Config & helpers | `apps/api/src/modules/seo/seo.config.ts` | canonical URLs, robots values, slug generation, noindex paths |
| Resolver | `apps/api/src/modules/seo/seo.service.ts` | per-page metadata + JSON-LD, fallback chain, slug-change redirects |
| Head injection | `apps/api/src/modules/seo/seo.ssr.ts` | serves the built SPA with a real `<head>` |
| robots + sitemap | `apps/api/src/modules/seo/seo.public.routes.ts` | `/robots.txt`, `/sitemap.xml`, partitioned children |
| Admin APIs | `apps/api/src/modules/seo/seo.admin.routes.ts` | settings, redirects, audit, bulk fill |
| Client head | `apps/web/src/lib/usePageMeta.ts` | keeps tags correct during in-app navigation |

### The fallback chain

Every field resolves in this order, **at request time**:

1. the admin's override (`seoTitle`, `ogImage`, …)
2. the entity's own content (product name, description, first image)
3. global defaults from `SeoSettings`

Generated values are **never written back to the database**. An untouched
product still gets good metadata, and an admin who later types a title always
wins. This is why every SEO column is nullable — empty means "derive it", not
"broken".

## Database

SEO fields were added to the existing `Product` and `Category` models rather
than in a parallel SEO table, plus two new models:

- **`SeoSettings`** — a singleton (`id = "default"`, created on first read)
  holding site name, title template, defaults, organization details, and the
  Google verification / analytics IDs.
- **`Redirect`** — `source` → `destination` with a status code. Rows are
  created automatically when a slug changes.

All changes are additive; no existing column was altered or dropped.

## Admin workflow

**Products / Categories → SEO section.** Leave a field empty and the site
derives it. Fill it in and yours is used. The Google and social previews show
the *resolved* result, so what you see is what a searcher sees.

Character guidance (titles ~50–60, descriptions ~140–160) is **advisory** —
it never blocks saving, because a good 65-character title beats a truncated
55-character one.

**Settings → SEO** covers site-wide values: title template
(`%title% | %siteName%`), defaults, organization details that feed the
Organization schema, and the Google verification / GA4 / GTM IDs.

**Slugs.** Auto-generated from the name, editable by hand. Renaming a slug
**creates a 301 automatically**, so existing links and their ranking survive.
Renaming back repoints the old row instead of chaining, so loops cannot form.

## Structured data

Emitted as one `@graph`: `Organization`, `WebSite` (with a `SearchAction`
pointing at the real `/search?q=` route), plus `Product` + `BreadcrumbList` on
product pages and `CollectionPage` + `BreadcrumbList` on categories.

Two rules are enforced in code, not left to discipline:

- **Availability mirrors real stock** — `InStock` only when a variant has
  stock, otherwise `OutOfStock`.
- **`aggregateRating` is emitted only when real reviews exist.** Inventing
  ratings is the fastest route to a manual structured-data penalty.

## Sitemap & robots

`/sitemap.xml` is an index; children are `/sitemap-pages.xml`,
`/sitemap-categories.xml` and `/sitemap-products-N.xml`, batched 5,000 per file
and paginated in the database — the catalogue is never loaded into memory.

Excluded: noindex pages, inactive products, cart/checkout/account/login/search,
and **categories with no products** (thin pages dilute the crawl).

`robots.txt` blocks `/admin`, `/api`, the checkout funnel and sort/page
parameters, and points at the sitemap. A site-wide `noindex` default flips it
to `Disallow: /`.

## Environment

```
WEB_APP_URL=https://chikbo.in     # API: canonical origin for all SEO URLs
VITE_SITE_URL=https://chikbo.in   # storefront: client-side canonicals
```

**Set these before launch.** Canonicals, sitemap entries and JSON-LD URLs all
derive from `WEB_APP_URL` — leave it on localhost and you publish localhost
canonicals, which de-indexes the site.

## Google Search Console

1. Search Console → add property → HTML tag method.
2. Copy the `content` value into **Settings → SEO → Google verification**.
3. Verify. The tag is rendered server-side, so it is visible immediately.
4. Submit `https://chikbo.in/sitemap.xml`.

Analytics is opt-in: with no GA4/GTM id configured, **no tracking script is
emitted at all**. Set GTM and it takes precedence over GA4 so events are not
double-counted.

## Maintenance

Run the audit against a live environment — it exits non-zero, so it can gate a
deploy:

```bash
npx tsx apps/api/scripts/seo-audit.ts https://chikbo.in
```

It checks robots, the sitemap chain, canonicals, per-page metadata, schema
validity, noindex rules and 404 behaviour (39 checks today).

**Monthly:** check the SEO dashboard's health score, fill gaps flagged for
missing titles/descriptions/alt text, review Search Console coverage, and check
the redirects table for chains worth flattening.

**Writing good metadata.** Titles: what it is plus why it is worth clicking —
"Kanchipuram Pattu Silk Saree — Maroon Zari | Chikbo" beats "Saree". Put the
distinguishing words first; Google truncates the end. Descriptions are ad copy,
not keyword lists — they do not affect ranking directly, only whether someone
clicks. Never repeat a title or description across products: duplicates make
Google pick one page and ignore the rest.
