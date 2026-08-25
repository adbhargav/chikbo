import { displayUrl } from '../../lib/seo';

/**
 * A search result as Google renders it, from the values the server would
 * actually emit. The type inside the frame is Google's own (Arial-ish sans,
 * their blue link, their grey snippet) rather than the admin's Fraunces/Inter:
 * a preview that looks like the admin is not a preview, it is decoration.
 */
export function GooglePreview({
  title,
  description,
  url,
  noindex,
}: {
  title: string;
  description: string;
  url: string;
  /** Robots says this page will not be indexed — say so instead of pretending. */
  noindex?: boolean;
}) {
  const site = (() => {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return 'chikbo';
    }
  })();

  return (
    <figure className="serp">
      <figcaption className="preview-cap">Google result</figcaption>
      {noindex ? (
        <p className="serp-noindex" role="note">
          This page is set to <strong>noindex</strong> — it will not appear in search results at all. The preview
          below is what would show if you switched it back to index.
        </p>
      ) : null}
      <div className="serp-frame" aria-label="Search result preview">
        <div className="serp-site">
          <span className="serp-favicon" aria-hidden="true">
            {site.charAt(0).toUpperCase()}
          </span>
          <span className="serp-site-text">
            <span className="serp-site-name">{site}</span>
            <span className="serp-crumb">{displayUrl(url)}</span>
          </span>
        </div>
        <div className="serp-title">{title || 'Untitled page'}</div>
        <div className="serp-snippet">{description || 'No description — Google will pick text off the page.'}</div>
      </div>
    </figure>
  );
}
