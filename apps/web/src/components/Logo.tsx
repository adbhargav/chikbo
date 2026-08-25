/**
 * Brand lockup.
 *
 * `LOGO_SRC` is the single place the artwork lives — swap that one path to
 * use the original supplied logo file (drop it in apps/web/public/brand/ and
 * point this at it) and every surface updates: header, footer, auth screens.
 */
import { Link } from 'react-router-dom';

export const LOGO_SRC = '/brand/chikbo-logo.png';
export const MARK_SRC = '/brand/chikbo-mark-only.png';

interface Props {
  /** Render full logo with wordmark or mark only. */
  withWordmark?: boolean;
  /** Mark height in px. */
  size?: number;
  className?: string;
  /** Wrap in a link to the homepage. */
  to?: string | null;
}

export function Logo({ withWordmark = true, size = 38, className, to = '/' }: Props) {
  const imgSrc = withWordmark ? LOGO_SRC : MARK_SRC;
  const inner = (
    <img
      src={imgSrc}
      alt="Chikbo"
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
      className="logo-mark"
    />
  );

  const classes = className ? `logo ${className}` : 'logo';

  if (to === null) {
    return (
      <span className={classes} role="img" aria-label="Chikbo">
        {inner}
      </span>
    );
  }
  return (
    <Link to={to} className={classes} aria-label="Chikbo home">
      {inner}
    </Link>
  );
}
