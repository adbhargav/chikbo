import { GooglePreview } from './GooglePreview';
import { SeoFields, type SeoFieldPlaceholders } from './SeoFields';
import { SocialPreview } from './SocialPreview';
import {
  applyTitleTemplate,
  canonicalFor,
  resolveSeo,
  type SeoSettings,
  type SeoSubject,
  type SeoValues,
} from '../../lib/seo';

interface Props {
  idPrefix: string;
  subject: SeoSubject;
  values: SeoValues;
  onChange: (patch: Partial<SeoValues>) => void;
  settings: SeoSettings | undefined;
  /** Storefront origin; "" while unknown, in which case paths show alone. */
  origin: string;
  disabled?: boolean;
  /** "split" puts the previews beside the fields; "stacked" is for modals. */
  layout?: 'split' | 'stacked';
}

/**
 * Fields plus the two previews, sharing one resolver pass so what the operator
 * sees is exactly what the head-injection middleware will write — including the
 * fallbacks, which is the whole point: an untouched product still ships good
 * metadata and the panel should show it doing so.
 */
export function SeoPanel({
  idPrefix,
  subject,
  values,
  onChange,
  settings,
  origin,
  disabled = false,
  layout = 'split',
}: Props) {
  const resolved = resolveSeo(subject, values, settings, origin);
  const siteName = settings?.siteName || 'Chikbo';
  const template = settings?.titleTemplate || '%title% | %siteName%';

  const placeholders: SeoFieldPlaceholders = {
    title: applyTitleTemplate(template, subject.name || 'Page name', siteName),
    description: resolveSeo(subject, { ...values, seoDescription: '' }, settings, origin).description,
    ogTitle: resolved.title,
    ogDescription: resolved.description,
    twitterTitle: resolved.ogTitle,
    twitterDescription: resolved.ogDescription,
    canonical: canonicalFor(origin, `${subject.kind === 'product' ? '/p/' : '/c/'}${subject.slug || 'slug'}`),
    robots: settings?.defaultRobots || 'index,follow',
    imageAlt: subject.name ? `${subject.name} — ${siteName}` : undefined,
  };

  return (
    <div className={`seo-panel seo-panel--${layout}`}>
      <SeoFields
        idPrefix={idPrefix}
        values={values}
        onChange={onChange}
        placeholders={placeholders}
        disabled={disabled}
        showTwitter={subject.kind === 'product'}
        showImageAlt={subject.kind === 'category'}
      />
      <div className="seo-previews">
        <GooglePreview
          title={resolved.title}
          description={resolved.description}
          url={resolved.canonical}
          noindex={resolved.robots.startsWith('noindex')}
        />
        <SocialPreview
          title={resolved.ogTitle}
          description={resolved.ogDescription}
          image={resolved.ogImageRaw}
          url={resolved.canonical}
          cardType={settings?.twitterCardType}
        />
        <dl className="seo-resolved">
          <dt>Canonical</dt>
          <dd>{resolved.canonical}</dd>
          <dt>Robots</dt>
          <dd>{resolved.robots}</dd>
          <dt>Share image</dt>
          <dd>{resolved.ogImage ?? 'None — links share without a card'}</dd>
        </dl>
        <p className="seo-note">
          Empty fields are filled in at request time from the values shown here — nothing is written to the
          database, so an override you add later always wins.
        </p>
      </div>
    </div>
  );
}
