import type { HomeSectionDto } from '../../lib/home';
import { sortedItems } from '../../lib/home';
import { Carousel } from '../Carousel';
import { CmsImage } from './CmsImage';
import { SmartLink } from '../SmartLink';

/** Editorial category cards — image with a caption plate, in a carousel. */
export function CategoryCards({ section }: { section: HomeSectionDto }) {
  const items = sortedItems(section);
  if (items.length === 0) return null;
  const label = section.title?.trim() || 'Categories';

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
        <Carousel ariaLabel={label} trackClassName="crsl-track--cards">
          {items.map((item, i) => {
            const body = (
              <>
                <CmsImage
                  url={item.imageUrl}
                  mobileUrl={item.mobileImageUrl}
                  alt={item.title ? `${item.title} at Chikbo` : 'Chikbo collection'}
                  decorative
                  seed={item.id || `card-${i}`}
                  category={item.href?.replace('/c/', '') ?? item.title}
                  className="cat-card-art"
                />
                <span className="card-sheen" aria-hidden="true" />
                <span className="cat-card-plate">
                  <span className="cat-card-title">{item.title ?? 'Explore'}</span>
                  {item.subtitle && <span className="cat-card-sub">{item.subtitle}</span>}
                  {item.ctaLabel && (
                    <span className="cat-card-cta">
                      {item.ctaLabel} <span aria-hidden="true">→</span>
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <div className="crsl-item crsl-item--card" key={item.id || i}>
                {item.href ? (
                  <SmartLink href={item.href} className="cat-card">
                    {body}
                  </SmartLink>
                ) : (
                  <span className="cat-card">{body}</span>
                )}
              </div>
            );
          })}
        </Carousel>
      </div>
    </section>
  );
}
