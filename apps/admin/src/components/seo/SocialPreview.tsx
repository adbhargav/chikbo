import { useEffect, useState } from 'react';
import { assetUrl } from '../../lib/api';

/**
 * The share card WhatsApp, Facebook and X build from the OG tags.
 *
 * This is the surface the whole server-side head injection exists for, so the
 * missing-image case is drawn loudly rather than hidden: a shared link with no
 * image is the difference between a card and a bare blue URL.
 */
export function SocialPreview({
  title,
  description,
  image,
  url,
  cardType = 'summary_large_image',
}: {
  title: string;
  description: string;
  image: string | null;
  url: string;
  cardType?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = image ? (assetUrl(image) ?? image) : null;
  useEffect(() => setFailed(false), [src]);

  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, '').toUpperCase();
    } catch {
      return 'CHIKBO';
    }
  })();

  const small = cardType === 'summary';

  return (
    <figure className="social-prev">
      <figcaption className="preview-cap">Shared link card</figcaption>
      <div className={`social-card${small ? ' social-card--small' : ''}`}>
        <div className="social-media">
          {src && !failed ? (
            <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <span className="social-media-empty">{failed ? 'Image did not load' : 'No image'}</span>
          )}
        </div>
        <div className="social-body">
          <span className="social-host">{host}</span>
          <span className="social-title">{title || 'Untitled'}</span>
          <span className="social-desc">{description}</span>
        </div>
      </div>
      {!src && (
        <p className="preview-warn">
          Without an image, links shared on WhatsApp show as plain text. Set one here or a site-wide default under
          Settings → SEO.
        </p>
      )}
    </figure>
  );
}
