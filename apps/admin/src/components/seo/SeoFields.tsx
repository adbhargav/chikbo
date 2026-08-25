import { ImageInput } from '../ImageInput';
import { assetUrl } from '../../lib/api';
import {
  DESCRIPTION_RANGE,
  ROBOTS_LABELS,
  ROBOTS_VALUES,
  TITLE_RANGE,
  adviseLength,
  type SeoValues,
} from '../../lib/seo';

/**
 * Live character guidance. Purely advisory: it colours a hint and nothing more.
 * Search engines truncate by pixel width, not character count, so a hard limit
 * here would be both wrong and rude — the operator's copy is never trimmed or
 * rejected on our say-so.
 */
function CharCount({
  value,
  min,
  max,
  kind,
}: {
  value: string;
  min: number;
  max: number;
  kind: 'title' | 'description';
}) {
  const length = value.trim().length;
  const advice = adviseLength(length, min, max, kind);
  return (
    <span className={`charcount charcount--${advice.tone}`}>
      <span className="charcount-n">{length}</span>
      <span className="charcount-range">
        / {min}–{max}
      </span>
      <span className="charcount-msg">{advice.message}</span>
    </span>
  );
}

/**
 * ImageInput is an editor with no read-only mode, so a viewer without write
 * access gets the value shown plainly rather than an upload box that will 403.
 */
function ImageSlot({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  disabled: boolean;
}) {
  if (!disabled) {
    return (
      <ImageInput
        compact
        label={label}
        hint={hint}
        previewAspect="1.91 / 1"
        max={1}
        value={value ? [value] : []}
        onChange={(urls) => onChange(urls[0] ?? '')}
      />
    );
  }
  return (
    <div className="imgin">
      <span className="imgin-label">{label}</span>
      {value ? (
        <>
          <img src={assetUrl(value) ?? value} alt="" className="seo-image-ro" />
          <p className="imgin-hint">{value}</p>
        </>
      ) : (
        <p className="imgin-hint">Not set.</p>
      )}
    </div>
  );
}

export interface SeoFieldPlaceholders {
  /** What the server will emit when the matching field is left empty. */
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  canonical: string;
  /** e.g. "index,follow" — the site-wide default this entity inherits. */
  robots: string;
  imageAlt?: string;
}

interface Props {
  /** Unique per instance so labels bind to their own inputs. */
  idPrefix: string;
  values: SeoValues;
  onChange: (patch: Partial<SeoValues>) => void;
  placeholders: SeoFieldPlaceholders;
  disabled?: boolean;
  /** Products carry their own Twitter overrides; categories mirror the OG ones. */
  showTwitter?: boolean;
  /** Categories have one image, and it needs alt text. */
  showImageAlt?: boolean;
}

/**
 * The shared SEO field group behind both the product and the category editors.
 * Every field is optional — leaving one empty is a valid choice that hands the
 * value back to the resolver, which is why each shows its fallback as the
 * placeholder rather than an empty box.
 */
export function SeoFields({
  idPrefix,
  values,
  onChange,
  placeholders,
  disabled = false,
  showTwitter = false,
  showImageAlt = false,
}: Props) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="seo-fields">
      <section>
        <h4 className="seo-group">Search result</h4>

        <div className="field">
          <label className="seo-label" htmlFor={id('title')}>
            Meta title
            <CharCount value={values.seoTitle} {...TITLE_RANGE} kind="title" />
          </label>
          <input
            id={id('title')}
            type="text"
            value={values.seoTitle}
            placeholder={placeholders.title}
            onChange={(e) => onChange({ seoTitle: e.target.value })}
            disabled={disabled}
          />
          <span className="hint">Empty uses the title template: {placeholders.title}</span>
        </div>

        <div className="field">
          <label className="seo-label" htmlFor={id('description')}>
            Meta description
            <CharCount value={values.seoDescription} {...DESCRIPTION_RANGE} kind="description" />
          </label>
          <textarea
            id={id('description')}
            rows={3}
            value={values.seoDescription}
            placeholder={placeholders.description}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
            disabled={disabled}
          />
          <span className="hint">The snippet under the link. Write for a reader, not a crawler.</span>
        </div>

        <div className="field">
          <label htmlFor={id('keywords')}>Keywords</label>
          <input
            id={id('keywords')}
            type="text"
            value={values.seoKeywords}
            placeholder="banarasi saree, silk saree, wedding saree"
            onChange={(e) => onChange({ seoKeywords: e.target.value })}
            disabled={disabled}
          />
          <span className="hint">Comma separated. Google ignores these; some other engines still read them.</span>
        </div>

        {showImageAlt && (
          <div className="field">
            <label htmlFor={id('imageAlt')}>Image alt text</label>
            <input
              id={id('imageAlt')}
              type="text"
              value={values.imageAlt}
              placeholder={placeholders.imageAlt ?? 'Describe the category image'}
              onChange={(e) => onChange({ imageAlt: e.target.value })}
              disabled={disabled}
            />
            <span className="hint">Read aloud by screen readers and indexed by image search.</span>
          </div>
        )}
      </section>

      <section>
        <h4 className="seo-group">Social sharing</h4>

        <div className="field">
          <label htmlFor={id('ogTitle')}>Share title</label>
          <input
            id={id('ogTitle')}
            type="text"
            value={values.ogTitle}
            placeholder={placeholders.ogTitle}
            onChange={(e) => onChange({ ogTitle: e.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label htmlFor={id('ogDescription')}>Share description</label>
          <textarea
            id={id('ogDescription')}
            rows={2}
            value={values.ogDescription}
            placeholder={placeholders.ogDescription}
            onChange={(e) => onChange({ ogDescription: e.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <ImageSlot
            label="Share image"
            hint="1200 × 630 works everywhere. Empty falls back to this page's own image, then the site default."
            value={values.ogImage}
            onChange={(url) => onChange({ ogImage: url })}
            disabled={disabled}
          />
        </div>

        {showTwitter && (
          <>
            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor={id('twitterTitle')}>X (Twitter) title</label>
                <input
                  id={id('twitterTitle')}
                  type="text"
                  value={values.twitterTitle}
                  placeholder={placeholders.twitterTitle}
                  onChange={(e) => onChange({ twitterTitle: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="field">
                <label htmlFor={id('twitterDescription')}>X (Twitter) description</label>
                <input
                  id={id('twitterDescription')}
                  type="text"
                  value={values.twitterDescription}
                  placeholder={placeholders.twitterDescription}
                  onChange={(e) => onChange({ twitterDescription: e.target.value })}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="field">
              <ImageSlot
                label="X (Twitter) image"
                hint="Only needed when X should differ from the share image above."
                value={values.twitterImage}
                onChange={(url) => onChange({ twitterImage: url })}
                disabled={disabled}
              />
            </div>
          </>
        )}
      </section>

      <section>
        <h4 className="seo-group">Indexing</h4>

        <div className="field">
          <label htmlFor={id('robots')}>Robots</label>
          <select
            id={id('robots')}
            value={values.metaRobots}
            onChange={(e) => onChange({ metaRobots: e.target.value })}
            disabled={disabled}
          >
            <option value="">Site default — {placeholders.robots}</option>
            {ROBOTS_VALUES.map((v) => (
              <option key={v} value={v}>
                {ROBOTS_LABELS[v]}
              </option>
            ))}
          </select>
          <span className="hint">Choose "no index" only to keep a page out of search entirely.</span>
        </div>

        <div className="field">
          <label htmlFor={id('canonical')}>Canonical URL</label>
          <input
            id={id('canonical')}
            type="text"
            value={values.canonicalUrl}
            placeholder={placeholders.canonical}
            onChange={(e) => onChange({ canonicalUrl: e.target.value })}
            disabled={disabled}
          />
          <span className="hint">
            Leave empty unless this page duplicates another one — then point it at the original.
          </span>
        </div>
      </section>
    </div>
  );
}
