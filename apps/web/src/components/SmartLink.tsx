import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  /** `/c/sarees`, `/p/<slug>` or an absolute URL — CMS authored. */
  href: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

const EXTERNAL = /^(https?:)?\/\//i;
const PROTOCOL = /^(mailto:|tel:)/i;

/** Routes internal CMS links through the router; sends absolute ones out. */
export function SmartLink({ href, className, children, ...rest }: Props) {
  if (EXTERNAL.test(href) || PROTOCOL.test(href)) {
    return (
      <a
        href={href}
        className={className}
        target={PROTOCOL.test(href) ? undefined : '_blank'}
        rel="noreferrer noopener"
        aria-label={rest['aria-label']}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={href.startsWith('/') ? href : `/${href}`} className={className} aria-label={rest['aria-label']}>
      {children}
    </Link>
  );
}
