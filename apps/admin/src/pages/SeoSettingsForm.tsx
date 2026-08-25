import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../components/Toast';
import { ImageInput } from '../components/ImageInput';
import { CardSkeleton, ErrorState } from '../components/ui';
import { GooglePreview, SocialPreview } from '../components/seo';
import {
  ROBOTS_LABELS,
  ROBOTS_VALUES,
  useSeoAudit,
  useSeoSettings,
  type SeoSettings,
} from '../lib/seo';

/** Everything as a string so an empty box is unambiguous; nulls are built on save. */
interface Draft {
  siteName: string;
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultRobots: string;

  homeTitle: string;
  homeDescription: string;
  homeOgImage: string;

  defaultOgImage: string;
  defaultTwitterImage: string;
  twitterCardType: string;
  twitterSite: string;
  facebookAppId: string;

  organizationName: string;
  organizationLogo: string;
  organizationDescription: string;
  organizationPhone: string;
  organizationEmail: string;
  organizationAddress: string;
  organizationSocials: string[];

  googleSiteVerification: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
}

const draftFrom = (s: SeoSettings): Draft => ({
  siteName: s.siteName ?? '',
  defaultTitle: s.defaultTitle ?? '',
  titleTemplate: s.titleTemplate ?? '%title% | %siteName%',
  defaultDescription: s.defaultDescription ?? '',
  defaultRobots: s.defaultRobots ?? 'index,follow',
  homeTitle: s.homeTitle ?? '',
  homeDescription: s.homeDescription ?? '',
  homeOgImage: s.homeOgImage ?? '',
  defaultOgImage: s.defaultOgImage ?? '',
  defaultTwitterImage: s.defaultTwitterImage ?? '',
  twitterCardType: s.twitterCardType ?? 'summary_large_image',
  twitterSite: s.twitterSite ?? '',
  facebookAppId: s.facebookAppId ?? '',
  organizationName: s.organizationName ?? '',
  organizationLogo: s.organizationLogo ?? '',
  organizationDescription: s.organizationDescription ?? '',
  organizationPhone: s.organizationPhone ?? '',
  organizationEmail: s.organizationEmail ?? '',
  organizationAddress: s.organizationAddress ?? '',
  organizationSocials: Array.isArray(s.organizationSocials) ? [...s.organizationSocials] : [],
  googleSiteVerification: s.googleSiteVerification ?? '',
  googleAnalyticsId: s.googleAnalyticsId ?? '',
  googleTagManagerId: s.googleTagManagerId ?? '',
});

const orNull = (v: string) => {
  const t = v.trim();
  return t === '' ? null : t;
};

function payloadFrom(d: Draft) {
  const socials = d.organizationSocials.map((s) => s.trim()).filter(Boolean);
  return {
    siteName: d.siteName.trim(),
    defaultTitle: orNull(d.defaultTitle),
    titleTemplate: d.titleTemplate.trim() || '%title% | %siteName%',
    defaultDescription: orNull(d.defaultDescription),
    defaultRobots: d.defaultRobots,
    homeTitle: orNull(d.homeTitle),
    homeDescription: orNull(d.homeDescription),
    homeOgImage: orNull(d.homeOgImage),
    defaultOgImage: orNull(d.defaultOgImage),
    defaultTwitterImage: orNull(d.defaultTwitterImage),
    twitterCardType: d.twitterCardType,
    twitterSite: orNull(d.twitterSite),
    facebookAppId: orNull(d.facebookAppId),
    organizationName: orNull(d.organizationName),
    organizationLogo: orNull(d.organizationLogo),
    organizationDescription: orNull(d.organizationDescription),
    organizationPhone: orNull(d.organizationPhone),
    organizationEmail: orNull(d.organizationEmail),
    organizationAddress: orNull(d.organizationAddress),
    organizationSocials: socials.length > 0 ? socials : null,
    googleSiteVerification: orNull(d.googleSiteVerification),
    googleAnalyticsId: orNull(d.googleAnalyticsId),
    googleTagManagerId: orNull(d.googleTagManagerId),
  };
}

/** Mirrors the API's zod rules so a mistake is caught before the round trip. */
function validate(d: Draft): string | null {
  if (d.siteName.trim().length === 0) return 'Site name is required — it appears in every generated title.';
  if (d.titleTemplate.trim() !== '' && !d.titleTemplate.includes('%title%')) {
    return 'The title template must contain %title%, or every page gets the same title.';
  }
  const email = d.organizationEmail.trim();
  if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Organization email does not look valid.';
  const ga = d.googleAnalyticsId.trim();
  if (ga !== '' && !/^G-[A-Z0-9]+$/i.test(ga)) return 'Google Analytics ID should look like G-XXXXXXX.';
  const gtm = d.googleTagManagerId.trim();
  if (gtm !== '' && !/^GTM-[A-Z0-9]+$/i.test(gtm)) return 'Tag Manager ID should look like GTM-XXXXXXX.';
  for (const url of d.organizationSocials.map((s) => s.trim()).filter(Boolean)) {
    try {
      new URL(url);
    } catch {
      return `"${url}" is not a full URL — include https://`;
    }
  }
  if (d.organizationSocials.filter((s) => s.trim()).length > 12) return 'At most 12 social profiles.';
  return null;
}

export function SeoSettingsForm({ canWrite }: { canWrite: boolean }) {
  const settings = useSeoSettings();
  const audit = useSeoAudit();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedAt = useRef<string | null>(null);

  // Hydrate once; a background refetch must not throw away unsaved edits.
  useEffect(() => {
    const s = settings.data;
    if (!s || loadedAt.current === s.updatedAt) return;
    loadedAt.current = s.updatedAt;
    setDraft(draftFrom(s));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (d: Draft) => api<SeoSettings>('/admin/seo/settings', { method: 'PATCH', body: payloadFrom(d) }),
    onSuccess: (updated) => {
      toast('SEO settings saved', 'success');
      loadedAt.current = updated.updatedAt;
      setDraft(draftFrom(updated));
      queryClient.setQueryData(['seo-settings'], updated);
      queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (settings.isPending) return <CardSkeleton height={360} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  if (!draft) return <CardSkeleton height={360} />;

  const set = (patch: Partial<Draft>) => setDraft((d) => d && { ...d, ...patch });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = validate(draft);
    if (problem) return setError(problem);
    save.mutate(draft);
  };

  const siteName = draft.siteName.trim() || 'Chikbo';
  const homeTitle = draft.homeTitle.trim() || draft.defaultTitle.trim() || siteName;
  const homeDescription = draft.homeDescription.trim() || draft.defaultDescription.trim();
  const homeImage = draft.homeOgImage.trim() || draft.defaultOgImage.trim() || null;
  const origin = (() => {
    try {
      return audit.data ? new URL(audit.data.sitemapUrl).origin : '';
    } catch {
      return '';
    }
  })();

  return (
    <form onSubmit={onSubmit} className="stack">
      {error && (
        <div className="login-error" role="alert">
          {error}
        </div>
      )}

      <div className="card pad">
        <h3 className="card-title">General</h3>
        <p className="seo-lede">Used on every page that has no value of its own.</p>
        <div className="form-row cols-2">
          <div className="field">
            <label htmlFor="s-siteName">Site name</label>
            <input
              id="s-siteName"
              type="text"
              value={draft.siteName}
              onChange={(e) => set({ siteName: e.target.value })}
              disabled={!canWrite}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="s-template">Title template</label>
            <input
              id="s-template"
              type="text"
              value={draft.titleTemplate}
              placeholder="%title% | %siteName%"
              onChange={(e) => set({ titleTemplate: e.target.value })}
              disabled={!canWrite}
            />
            <span className="hint">
              %title% and %siteName% are substituted — currently "{draft.titleTemplate.replace('%title%', 'Blush Saree').replace('%siteName%', siteName)}".
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-defaultTitle">Default title</label>
          <input
            id="s-defaultTitle"
            type="text"
            value={draft.defaultTitle}
            placeholder={siteName}
            onChange={(e) => set({ defaultTitle: e.target.value })}
            disabled={!canWrite}
          />
          <span className="hint">Used on pages with no title of their own.</span>
        </div>
        <div className="field">
          <label htmlFor="s-defaultDescription">Default description</label>
          <textarea
            id="s-defaultDescription"
            rows={3}
            value={draft.defaultDescription}
            onChange={(e) => set({ defaultDescription: e.target.value })}
            disabled={!canWrite}
          />
        </div>
        <div className="field">
          <label htmlFor="s-robots">Default robots</label>
          <select
            id="s-robots"
            value={draft.defaultRobots}
            onChange={(e) => set({ defaultRobots: e.target.value })}
            disabled={!canWrite}
          >
            {ROBOTS_VALUES.map((v) => (
              <option key={v} value={v}>
                {ROBOTS_LABELS[v]}
              </option>
            ))}
          </select>
          <span className="hint">
            Choosing "no index" here also switches robots.txt to <code>Disallow: /</code> for the whole site.
          </span>
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Homepage</h3>
        <div className="seo-panel seo-panel--split">
          <div className="seo-fields">
            <div className="field">
              <label htmlFor="s-homeTitle">Homepage title</label>
              <input
                id="s-homeTitle"
                type="text"
                value={draft.homeTitle}
                placeholder={draft.defaultTitle || siteName}
                onChange={(e) => set({ homeTitle: e.target.value })}
                disabled={!canWrite}
              />
            </div>
            <div className="field">
              <label htmlFor="s-homeDescription">Homepage description</label>
              <textarea
                id="s-homeDescription"
                rows={3}
                value={draft.homeDescription}
                placeholder={draft.defaultDescription}
                onChange={(e) => set({ homeDescription: e.target.value })}
                disabled={!canWrite}
              />
            </div>
            {canWrite ? (
              <ImageInput
                compact
                label="Homepage share image"
                hint="Shown when the homepage link itself is shared. Falls back to the site default below."
                previewAspect="1.91 / 1"
                max={1}
                value={draft.homeOgImage ? [draft.homeOgImage] : []}
                onChange={(urls) => set({ homeOgImage: urls[0] ?? '' })}
              />
            ) : (
              <p className="imgin-hint">Homepage share image: {draft.homeOgImage || 'not set'}</p>
            )}
          </div>
          <div className="seo-previews">
            <GooglePreview
              title={homeTitle}
              description={homeDescription}
              url={origin || '/'}
              noindex={draft.defaultRobots.startsWith('noindex')}
            />
            <SocialPreview
              title={homeTitle}
              description={homeDescription}
              image={homeImage}
              url={origin || '/'}
              cardType={draft.twitterCardType}
            />
          </div>
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Social sharing defaults</h3>
        <p className="seo-lede">
          The safety net for every page that has no image of its own. Social crawlers never run JavaScript, so
          these tags are written into the HTML by the server.
        </p>
        <div className="form-row cols-2">
          <div className="field">
            {canWrite ? (
              <ImageInput
                compact
                label="Default share image"
                hint="1200 × 630."
                previewAspect="1.91 / 1"
                max={1}
                value={draft.defaultOgImage ? [draft.defaultOgImage] : []}
                onChange={(urls) => set({ defaultOgImage: urls[0] ?? '' })}
              />
            ) : (
              <p className="imgin-hint">Default share image: {draft.defaultOgImage || 'not set'}</p>
            )}
          </div>
          <div className="field">
            {canWrite ? (
              <ImageInput
                compact
                label="Default X (Twitter) image"
                hint="Only when X should differ from the default above."
                previewAspect="1.91 / 1"
                max={1}
                value={draft.defaultTwitterImage ? [draft.defaultTwitterImage] : []}
                onChange={(urls) => set({ defaultTwitterImage: urls[0] ?? '' })}
              />
            ) : (
              <p className="imgin-hint">Default X image: {draft.defaultTwitterImage || 'not set'}</p>
            )}
          </div>
        </div>
        <div className="form-row cols-3">
          <div className="field">
            <label htmlFor="s-cardType">X card type</label>
            <select
              id="s-cardType"
              value={draft.twitterCardType}
              onChange={(e) => set({ twitterCardType: e.target.value })}
              disabled={!canWrite}
            >
              <option value="summary_large_image">Large image</option>
              <option value="summary">Small summary</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-twitterSite">X handle</label>
            <input
              id="s-twitterSite"
              type="text"
              placeholder="@chikbo"
              value={draft.twitterSite}
              onChange={(e) => set({ twitterSite: e.target.value })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label htmlFor="s-fbAppId">Facebook app ID</label>
            <input
              id="s-fbAppId"
              type="text"
              value={draft.facebookAppId}
              onChange={(e) => set({ facebookAppId: e.target.value })}
              disabled={!canWrite}
            />
          </div>
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Organization</h3>
        <p className="seo-lede">
          Published as Organization structured data — this is what a knowledge panel is built from.
        </p>
        <div className="form-row cols-2">
          <div className="field">
            <label htmlFor="s-orgName">Legal / trading name</label>
            <input
              id="s-orgName"
              type="text"
              value={draft.organizationName}
              placeholder={siteName}
              onChange={(e) => set({ organizationName: e.target.value })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label htmlFor="s-orgPhone">Phone</label>
            <input
              id="s-orgPhone"
              type="text"
              placeholder="+919346060635"
              value={draft.organizationPhone}
              onChange={(e) => set({ organizationPhone: e.target.value })}
              disabled={!canWrite}
            />
          </div>
        </div>
        <div className="form-row cols-2">
          <div className="field">
            <label htmlFor="s-orgEmail">Email</label>
            <input
              id="s-orgEmail"
              type="text"
              value={draft.organizationEmail}
              onChange={(e) => set({ organizationEmail: e.target.value })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label htmlFor="s-orgAddress">Address</label>
            <input
              id="s-orgAddress"
              type="text"
              value={draft.organizationAddress}
              onChange={(e) => set({ organizationAddress: e.target.value })}
              disabled={!canWrite}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-orgDescription">Description</label>
          <textarea
            id="s-orgDescription"
            rows={2}
            value={draft.organizationDescription}
            onChange={(e) => set({ organizationDescription: e.target.value })}
            disabled={!canWrite}
          />
        </div>
        <div className="field">
          {canWrite ? (
            <ImageInput
              compact
              label="Logo"
              hint="Square works best. Used in structured data, not on the storefront."
              max={1}
              value={draft.organizationLogo ? [draft.organizationLogo] : []}
              onChange={(urls) => set({ organizationLogo: urls[0] ?? '' })}
            />
          ) : (
            <p className="imgin-hint">Logo: {draft.organizationLogo || 'not set'}</p>
          )}
        </div>

        <div className="field">
          <label>Social profiles</label>
          <span className="hint">
            Full URLs to profiles you control — Instagram, Facebook, YouTube. Published as <code>sameAs</code>,
            which is how a search engine links the site to the accounts.
          </span>
          <div className="editor-rows" style={{ marginTop: 8 }}>
            {draft.organizationSocials.map((url, i) => (
              <div className="editor-row" key={i}>
                {/* Deliberately type=text: native URL validation blocks the
                    whole form from submitting with only a browser tooltip,
                    which reads as a dead Save button. Our own check below
                    names the offending value instead. */}
                <input
                  type="text"
                  aria-label={`Social profile ${i + 1}`}
                  placeholder="https://instagram.com/chikbo"
                  value={url}
                  onChange={(e) =>
                    set({
                      organizationSocials: draft.organizationSocials.map((u, j) => (j === i ? e.target.value : u)),
                    })
                  }
                  disabled={!canWrite}
                />
                {canWrite && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={`Remove social profile ${i + 1}`}
                    onClick={() =>
                      set({ organizationSocials: draft.organizationSocials.filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {draft.organizationSocials.length === 0 && (
              <p className="muted" style={{ fontSize: 13 }}>
                No profiles linked yet.
              </p>
            )}
          </div>
          {canWrite && draft.organizationSocials.length < 12 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onClick={() => set({ organizationSocials: [...draft.organizationSocials, ''] })}
            >
              + Add profile
            </button>
          )}
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Google</h3>
        <p className="seo-lede">Public IDs only — never paste an API key or secret here.</p>
        <div className="form-row cols-3">
          <div className="field">
            <label htmlFor="s-verification">Search Console verification</label>
            <input
              id="s-verification"
              type="text"
              value={draft.googleSiteVerification}
              onChange={(e) => set({ googleSiteVerification: e.target.value })}
              disabled={!canWrite}
            />
            <span className="hint">The content value of the meta tag Google gives you.</span>
          </div>
          <div className="field">
            <label htmlFor="s-ga">Analytics measurement ID</label>
            <input
              id="s-ga"
              type="text"
              placeholder="G-XXXXXXXXXX"
              value={draft.googleAnalyticsId}
              onChange={(e) => set({ googleAnalyticsId: e.target.value })}
              disabled={!canWrite}
            />
          </div>
          <div className="field">
            <label htmlFor="s-gtm">Tag Manager container</label>
            <input
              id="s-gtm"
              type="text"
              placeholder="GTM-XXXXXXX"
              value={draft.googleTagManagerId}
              onChange={(e) => set({ googleTagManagerId: e.target.value })}
              disabled={!canWrite}
            />
          </div>
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Crawler endpoints</h3>
        {audit.isPending ? (
          <CardSkeleton height={70} />
        ) : audit.isError ? (
          <p className="seo-lede">Couldn't read the live endpoints — {errorMessage(audit.error)}</p>
        ) : (
          <>
            <p className="seo-lede">Generated from the database on every request; there is nothing to publish.</p>
            <dl className="seo-endpoints">
              <dt>robots.txt</dt>
              <dd>
                <a className="link" href={audit.data.robotsUrl} target="_blank" rel="noreferrer">
                  {audit.data.robotsUrl}
                </a>
              </dd>
              <dt>sitemap.xml</dt>
              <dd>
                <a className="link" href={audit.data.sitemapUrl} target="_blank" rel="noreferrer">
                  {audit.data.sitemapUrl}
                </a>
              </dd>
            </dl>
          </>
        )}
      </div>

      {canWrite && (
        <div className="seo-save">
          <button className="btn btn-primary" type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save SEO settings'}
          </button>
        </div>
      )}
    </form>
  );
}
