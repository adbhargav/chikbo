import { useState } from 'react';
import { fetchPriorityAttr } from '../lib/seo';
import { SilkArt } from './SilkArt';

/**
 * Editorial photography that ships with the frontend (public/images/editorial).
 *
 * Unlike ProductImage — which resolves API-hosted upload paths through
 * assetUrl() — these are bundled site assets served from the web origin, so the
 * src is used as-is. SilkArt renders underneath and the photograph crossfades
 * over it, so a section is never blank while the image loads (or if it 404s).
 */
interface Props {
  src: string;
  alt: string;
  /** Seeds the silk underlay. */
  seed: string;
  /** Picks the silk hue pair. */
  category?: string | null;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** `high` on the above-the-fold hero — it is the home page's LCP element. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** e.g. "70% center" — keeps the subject in frame on wide crops. */
  objectPosition?: string;
}

export function EditorialImage({
  src,
  alt,
  seed,
  category,
  className,
  loading = 'lazy',
  fetchPriority,
  objectPosition,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={className ? `silk-media ${className}` : 'silk-media'}
      /* The <img> below carries the label once it is in the tree; the woven
         fallback still needs one of its own. */
      role={failed && alt ? 'img' : undefined}
      aria-label={failed && alt ? alt : undefined}
    >
      <SilkArt seed={seed} category={category} showLabel={false} className="silk-media-art" />
      {!failed && (
        <img
          className={`silk-media-img${loaded ? ' silk-media-img--loaded' : ''}`}
          src={src}
          alt={alt}
          loading={loading}
          {...fetchPriorityAttr(fetchPriority)}
          style={objectPosition ? { objectPosition } : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
