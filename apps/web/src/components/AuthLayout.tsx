import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE, useMotionOK } from '../lib/motion';
import { EditorialImage } from './EditorialImage';
import { EDITORIAL } from '../lib/editorial';
import { Logo } from './Logo';
import '../styles/auth.css';

interface Props {
  /** Small gold overline above the heading. */
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Line under the card, e.g. "New to Chikbo? Create an account". */
  footer?: ReactNode;
  /** Editorial panel copy. */
  aside?: { quote: string; attribution: string };
}

const DEFAULT_ASIDE = {
  quote: 'Every weave that carries our name is chosen by hand — trust in the maker, quality in the thread, a price that respects your budget.',
  attribution: 'The Chikbo promise, since 1992',
};

/**
 * Split editorial layout shared by every auth screen: photography and brand
 * story on the left, the form on the right. Collapses to a single column below
 * 900px, where the image panel is dropped rather than shrunk.
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer, aside }: Props) {
  const ok = useMotionOK();
  const panel = aside ?? DEFAULT_ASIDE;

  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-hidden="true">
        <EditorialImage
          src={EDITORIAL.story1}
          alt=""
          seed="auth-panel"
          category="sarees"
          className="auth-aside-art"
          loading="eager"
        />
        <div className="auth-aside-scrim" />
        <div className="auth-aside-content">
          <Logo size={42} className="auth-aside-logo" to={null} />
          <blockquote className="auth-aside-quote">{panel.quote}</blockquote>
          <span className="auth-aside-attribution">{panel.attribution}</span>
        </div>
      </aside>

      <main className="auth-main">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: ok ? 18 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="auth-card-mark">
            <Logo size={40} className="auth-card-logo" />
          </div>
          <span className="overline auth-eyebrow">{eyebrow}</span>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
          {footer && <p className="auth-switch">{footer}</p>}
        </motion.div>

        <p className="auth-legal">
          Secure checkout · Pan-India delivery · <Link to="/policy/privacy">Privacy</Link>
        </p>
      </main>
    </div>
  );
}
