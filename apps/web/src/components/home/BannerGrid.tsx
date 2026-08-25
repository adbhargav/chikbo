import type { CSSProperties } from 'react';
import type { HomeSectionDto } from '../../lib/home';
import { configNumber, sortedItems } from '../../lib/home';
import { CmsImage } from './CmsImage';
import { SmartLink } from '../SmartLink';

/** 2–4 offer tiles with a big deal label ("Up to 70% off"). */
export function BannerGrid({ section }: { section: HomeSectionDto }) {
  const items = sortedItems(section).slice(0, 4);
  if (items.length === 0) return null;
  const columns = Math.min(4, Math.max(1, configNumber(section.config, 'columns') ?? items.length));
  const label = section.title?.trim() || 'Offers';

  return (
    <section className="home-band" aria-label={label}>
      <div className="container">
        {(section.title || section.subtitle) && (
          <div className="band-head">
            <div>
              {section.title && <h2 className="band-title">{section.title}</h2>}
              {section.subtitle && <p className="band-sub">{section.subtitle}</p>}
            </div>
          </div>
        )}
        <div
          className="banner-grid"
          style={{ '--banner-cols': String(columns) } as CSSProperties}
        >
          {items.map((item, i) => {
            const body = (
              <>
                <CmsImage
                  url={item.imageUrl}
                  mobileUrl={item.mobileImageUrl}
                  alt={item.title ? `${item.title} — Chikbo offer` : 'Chikbo offer'}
                  decorative
                  seed={item.id || `banner-${i}`}
                  category={item.href?.replace('/c/', '') ?? item.title}
                  className="banner-art"
                />
                <span className="banner-scrim" aria-hidden="true" />
                <span className="banner-copy">
                  {item.subtitle && <span className="banner-deal">{item.subtitle}</span>}
                  {item.title && <span className="banner-title">{item.title}</span>}
                  {item.ctaLabel && (
                    <span className="banner-cta">
                      {item.ctaLabel} <span aria-hidden="true">→</span>
                    </span>
                  )}
                </span>
              </>
            );
            return item.href ? (
              <SmartLink href={item.href} className="banner-tile" key={item.id || i}>
                {body}
              </SmartLink>
            ) : (
              <div className="banner-tile" key={item.id || i}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
