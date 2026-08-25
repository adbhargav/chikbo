import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { assetUrl } from './format';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  absoluteUrl,
  canonicalFor,
  clampText,
  robotsFor,
} from './seo';

export interface PageMetaOptions {
  /** Social card image — server-relative (`/uploads/…`) or absolute. */
  ogImage?: string | null;
  /** `website` (default), `product`, `article`… */
  ogType?: string;
  /** Override the path-derived robots directive, e.g. `noindex,follow` on 404. */
  robots?: string;
  /** Override the canonical path when the route is not the canonical one. */
  canonicalPath?: string;
  /** Defaults to `summary_large_image`. */
  twitterCard?: string;
}

/** A DOM mutation plus the function that puts the head back the way it was. */
type Restore = () => void;

function setMeta(attr: 'name' | 'property', key: string, content: string, undo: Restore[]): void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (existing) {
    // Adopt a tag that index.html — or the API's head-injection middleware —
    // already rendered, and hand it back untouched on the way out.
    const original = existing.getAttribute('content');
    existing.setAttribute('content', content);
    undo.push(() => {
      if (original === null) existing.removeAttribute('content');
      else existing.setAttribute('content', original);
    });
    return;
  }
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  el.setAttribute('data-seo', 'managed');
  document.head.appendChild(el);
  undo.push(() => el.remove());
}

function setLink(rel: string, href: string, undo: Restore[]): void {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existing) {
    const original = existing.getAttribute('href');
    existing.setAttribute('href', href);
    undo.push(() => {
      if (original === null) existing.removeAttribute('href');
      else existing.setAttribute('href', original);
    });
    return;
  }
  const el = document.createElement('link');
  el.setAttribute('rel', rel);
  el.setAttribute('href', href);
  el.setAttribute('data-seo', 'managed');
  document.head.appendChild(el);
  undo.push(() => el.remove());
}

/** Resolve an image reference to an absolute URL crawlers can fetch. */
function absoluteImage(src: string | null | undefined): string {
  const resolved = assetUrl(src) ?? src ?? null;
  return absoluteUrl(resolved) ?? absoluteUrl(DEFAULT_OG_IMAGE) ?? '';
}

/**
 * Full client-side head manager: title, description, canonical, robots, Open
 * Graph and Twitter cards.
 *
 * Every tag is written on every run and reverted on unmount, so nothing can
 * leak from one route into the next. The two-argument call signature is
 * unchanged — `usePageMeta(title, description)` still works everywhere.
 */
export function usePageMeta(
  title?: string,
  description?: string,
  options: PageMetaOptions = {},
): void {
  const { pathname } = useLocation();
  const {
    ogImage,
    ogType = 'website',
    robots,
    canonicalPath,
    twitterCard = 'summary_large_image',
  } = options;

  useEffect(() => {
    const undo: Restore[] = [];

    const fullTitle =
      title && title.trim()
        ? title.includes(SITE_NAME)
          ? title
          : `${title} — ${SITE_NAME}`
        : DEFAULT_TITLE;
    const desc = clampText(description, 300) || DEFAULT_DESCRIPTION;
    const canonical = canonicalFor(canonicalPath ?? pathname);
    const image = absoluteImage(ogImage);

    const previousTitle = document.title;
    document.title = fullTitle;
    undo.push(() => {
      document.title = previousTitle;
    });

    setMeta('name', 'description', desc, undo);
    setMeta('name', 'robots', robots ?? robotsFor(pathname), undo);
    setLink('canonical', canonical, undo);

    setMeta('property', 'og:title', fullTitle, undo);
    setMeta('property', 'og:description', desc, undo);
    setMeta('property', 'og:url', canonical, undo);
    setMeta('property', 'og:type', ogType, undo);
    setMeta('property', 'og:site_name', SITE_NAME, undo);
    setMeta('property', 'og:locale', 'en_IN', undo);
    if (image) {
      setMeta('property', 'og:image', image, undo);
      setMeta('property', 'og:image:alt', fullTitle, undo);
    }

    setMeta('name', 'twitter:card', twitterCard, undo);
    setMeta('name', 'twitter:title', fullTitle, undo);
    setMeta('name', 'twitter:description', desc, undo);
    if (image) setMeta('name', 'twitter:image', image, undo);

    return () => {
      // Reverse order so adopted tags unwind exactly as they were wound.
      for (let i = undo.length - 1; i >= 0; i--) undo[i]!();
    };
  }, [title, description, pathname, ogImage, ogType, robots, canonicalPath, twitterCard]);
}
