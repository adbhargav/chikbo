import type { HomeSectionDto } from '../../lib/home';
import { configString, sortedItems } from '../../lib/home';
import { Reveal } from '../../lib/motion';
import { CmsImage } from './CmsImage';
import { SmartLink } from '../SmartLink';

/** Image + copy + CTA strip. `config.align = "right"` flips the image side. */
export function EditorialStrip({ section }: { section: HomeSectionDto }) {
  const item = sortedItems(section)[0] ?? null;
  const title = section.title ?? item?.title ?? null;
  const subtitle = section.subtitle ?? item?.subtitle ?? null;
  if (!title && !subtitle && !item) return null;
  const flipped = configString(section.config, 'align') === 'right';

  return (
    <section className={`home-band editorial-strip${flipped ? ' editorial-strip--flip' : ''}`}>
      <div className="container editorial-strip-inner">
        <div className="editorial-strip-media">
          <CmsImage
            url={item?.imageUrl ?? null}
            mobileUrl={item?.mobileImageUrl ?? null}
            alt={item?.title || title || 'Chikbo editorial'}
            decorative
            seed={item?.id || section.id || 'editorial'}
            category={item?.href?.replace('/c/', '') ?? title}
            className="editorial-strip-art"
          />
        </div>
        <Reveal className="editorial-strip-copy">
          {title && <h2 className="band-title">{title}</h2>}
          {subtitle && <p className="band-sub">{subtitle}</p>}
          {item?.title && item.title !== title && <p className="editorial-strip-lede">{item.title}</p>}
          {item?.href && (
            <SmartLink href={item.href} className="btn btn-secondary">
              {item.ctaLabel ?? 'Explore'}
            </SmartLink>
          )}
        </Reveal>
      </div>
    </section>
  );
}
