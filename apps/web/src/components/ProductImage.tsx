import { useEffect, useState } from 'react';
import { assetUrl } from '../lib/format';
import { fetchPriorityAttr } from '../lib/seo';
import { SilkArt } from './SilkArt';

interface Props {
  src: string | null | undefined;
  alt: string;
  /** Shown inside the branded fallback block / silk caption. */
  name: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** `high` for the LCP image (product gallery main, hero), else left alone. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /**
   * Intrinsic dimensions. CSS still sizes the image, but the attributes give
   * the browser an aspect ratio before the bytes arrive — belt and braces on
   * top of the `aspect-ratio` already set on every media container.
   */
  width?: number;
  height?: number;
  /**
   * Render the SilkArt woven placeholder underneath and crossfade the real
   * image in once it loads. Used for product cards, tiles and galleries.
   * When false (cart/order thumbnails), keeps the simple monogram fallback.
   */
  art?: boolean;
  /** Category slug — picks the silk hue pair. */
  category?: string | null;
  /** Deterministic seed for the silk (defaults to name). */
  seed?: string;
  /** Show the Fraunces caption on the silk. */
  showLabel?: boolean;
  /**
   * Hide the image from assistive tech — for cards and tiles whose link text
   * already names the product, so it is not announced twice.
   */
  decorative?: boolean;
}

/**
 * Product/category image that never shows a broken-image glyph. In `art`
 * mode the SilkArt system renders instantly and the real photograph
 * crossfades over it (0.6s) when it loads.
 */
export function ProductImage({
  src,
  alt,
  name,
  className,
  loading = 'lazy',
  fetchPriority,
  width,
  height,
  art = false,
  category,
  seed,
  showLabel = true,
  decorative = false,
}: Props) {
  const resolved = assetUrl(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [resolved]);

  /** Always meaningful, always falling back to the product name. */
  const label = alt?.trim() || name;

  if (art) {
    const hasImage = !!resolved && !failed;
    return (
      <div
        className={className ? `silk-media ${className}` : 'silk-media'}
        /* Once the real <img> is in the tree it carries the label itself —
           a wrapper role="img" would announce the same thing twice. The
           woven SilkArt fallback still needs one. */
        role={!decorative && !hasImage ? 'img' : undefined}
        aria-label={!decorative && !hasImage ? label : undefined}
        aria-hidden={decorative ? true : undefined}
      >
        <SilkArt seed={seed ?? name} category={category} label={name} showLabel={showLabel} className="silk-media-art" />
        {hasImage && (
          <img
            className={`silk-media-img${loaded ? ' silk-media-img--loaded' : ''}`}
            src={resolved}
            /* Real alt text even inside a decorative wrapper: `aria-hidden`
               keeps it out of the a11y tree (the link text already names the
               product) while Google Images still gets a description. */
            alt={label}
            loading={loading}
            {...fetchPriorityAttr(fetchPriority)}
            width={width}
            height={height}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  if (!resolved || failed) {
    return (
      <div
        className={className}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
      >
        <div className="img-fallback">
          <span className="img-fallback-mono" aria-hidden="true">
            C
          </span>
          <span className="img-fallback-name">{name}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={resolved}
      alt={decorative ? '' : label}
      loading={loading}
      {...fetchPriorityAttr(fetchPriority)}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}
