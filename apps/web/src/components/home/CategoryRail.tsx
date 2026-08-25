import type { HomeSectionDto } from '../../lib/home';
import { sortedItems } from '../../lib/home';
import { Carousel } from '../Carousel';
import { CmsImage } from './CmsImage';
import { SmartLink } from '../SmartLink';

/** Circular category chips — image + label, horizontal scroll with arrows. */
export function CategoryRail({ section }: { section: HomeSectionDto }) {
  const items = sortedItems(section);
  if (items.length === 0) return null;
  const label = section.title?.trim() || 'Shop by category';

  return (
    <section className="home-band home-band--tight" aria-label={label}>
      <div className="container">
        {(section.title || section.subtitle) && (
          <div className="band-head">
            <div>
              {section.title && <h2 className="band-title">{section.title}</h2>}
              {section.subtitle && <p className="band-sub">{section.subtitle}</p>}
            </div>
          </div>
        )}
        <Carousel ariaLabel={label} trackClassName="crsl-track--chips">
          {items.map((item, i) => {
            const name = item.title ?? 'Category';
            const chip = (
              <>
                <span className="cat-chip-ring">
                  <CmsImage
                    url={item.imageUrl}
                    mobileUrl={item.mobileImageUrl}
                    alt={`${name} at Chikbo`}
                    decorative
                    seed={item.id || `chip-${i}`}
                    category={item.href?.replace('/c/', '') ?? item.title}
                    className="cat-chip-art"
                  />
                </span>
                <span className="cat-chip-label">{name}</span>
                {item.subtitle && <span className="cat-chip-note">{item.subtitle}</span>}
              </>
            );
            return (
              <div className="crsl-item crsl-item--chip" key={item.id || i}>
                {item.href ? (
                  <SmartLink href={item.href} className="cat-chip">
                    {chip}
                  </SmartLink>
                ) : (
                  <span className="cat-chip">{chip}</span>
                )}
              </div>
            );
          })}
        </Carousel>
      </div>
    </section>
  );
}
