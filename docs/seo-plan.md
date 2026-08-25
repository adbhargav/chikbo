# Chikbo SEO — implementation plan

## Inspection findings (actual codebase, 2026-08-20)

| Assumed in brief | Reality |
|---|---|
| Next.js App Router, `generateMetadata`, Tailwind | **Vite + React 18 SPA**, react-router-dom, hand-written CSS |
| Server components / SSR | **Client-side rendering only** |
| Next.js `sitemap.ts` / `robots.ts` | Neither exists |

Present: `usePageMeta` (sets `<title>` + description client-side only), slugs on
`Product` and `Category`. Absent: robots.txt, sitemap, canonical, OG, Twitter,
JSON-LD, SEO fields, redirect handling.

## The constraint that shapes everything

Googlebot renders JavaScript; **social crawlers do not**. Facebook, WhatsApp,
X, LinkedIn and Slack read the raw HTML response. Meta tags written by React
after hydration are invisible to them, so shared product links produce no
preview card — a real commercial loss for a store that will be shared on
WhatsApp.

**Decision:** inject head tags server-side in Express, per route, from the
database, and serve the SPA through it. No framework migration, no rewrite;
crawlers get complete HTML head, users get the same SPA.

## Plan

**1 · Database** — extend existing models (no parallel SEO tables):
- `Product`: seoTitle, seoDescription, seoKeywords, canonicalUrl, metaRobots,
  ogTitle, ogDescription, ogImage, twitterTitle, twitterDescription,
  twitterImage. `ProductImage.alt` already exists → reused for image SEO.
- `Category`: same minus twitter fields.
- `SeoSettings` — singleton for site-wide defaults, organization, verification
  and analytics IDs.
- `Redirect` — source/destination/statusCode, for slug changes.
All fields nullable; generated values are **runtime fallbacks**, never stored,
so an admin edit always wins and an untouched product still gets good metadata.

**2 · API**
- `GET /robots.txt`, `GET /sitemap.xml` (index) + `GET /sitemap-:part.xml`
  (batched, DB-paginated — never loads the catalogue into memory).
- SEO resolver service: title-template, fallback chain, canonical, robots.
- JSON-LD builders: Organization, WebSite, Product, BreadcrumbList.
- **Head-injection middleware** serving `index.html` with real tags.
- Slug change → automatic 301 redirect row; loop prevention.
- Admin CRUD for SEO settings + per-entity SEO + redirects + audit.

**3 · Storefront** — canonical/OG/Twitter/JSON-LD via an extended `usePageMeta`
(for in-app navigation), visible breadcrumbs, internal linking, noindex on
cart/checkout/account/search.

**4 · Admin** — SEO panel on product & category edit with Google + social
preview and character guidance, Settings → SEO, SEO health dashboard, bulk
tools for missing titles/descriptions/alt text.

**5 · Docs + audit script** covering the 28-point checklist.

## Explicitly out of scope
No blog, brands or collections exist in this codebase, so no SEO surface is
built for them. The resolver is written so adding one later is a config entry,
not a rewrite.
