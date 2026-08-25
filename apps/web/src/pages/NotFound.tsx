import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/usePageMeta';

export default function NotFound() {
  // A soft 404 must never be indexed, whatever path led here.
  usePageMeta('Page not found', 'The page you are looking for could not be found.', {
    robots: 'noindex,follow',
  });
  return (
    <div className="container page" style={{ textAlign: 'center', paddingBlock: 96 }}>
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 88,
          fontWeight: 600,
          color: 'var(--gold-500)',
          opacity: 0.4,
          lineHeight: 1,
          display: 'block',
        }}
      >
        404
      </span>
      <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', marginTop: 16 }}>
        This thread leads nowhere
      </h1>
      <p className="muted" style={{ maxWidth: 420, margin: '12px auto 28px' }}>
        The page you are looking for has been moved, retired or never woven. Let us take you back
        to the collection.
      </p>
      <Link to="/" className="btn btn-primary btn-lg">
        Back to home
      </Link>
    </div>
  );
}
