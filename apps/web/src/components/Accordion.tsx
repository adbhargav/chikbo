import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, useMotionOK } from '../lib/motion';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Extra class on the wrapper (`acc-item--filter` on the PLP sidebar). */
  className?: string;
  /** Small count/summary shown next to the title, e.g. "2 selected". */
  hint?: string | null;
}

/**
 * Disclosure with a rotating chevron and animated height — used by the PLP
 * filter sidebar and the PDP information accordions.
 */
export function AccordionItem({ title, children, defaultOpen = false, className, hint }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const ok = useMotionOK();
  const id = useId();

  return (
    <div className={className ? `acc-item ${className}` : 'acc-item'}>
      <h3 className="acc-heading">
        <button
          type="button"
          className="acc-trigger"
          aria-expanded={open}
          aria-controls={`acc-${id}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="acc-trigger-label">
            {title}
            {hint && <span className="acc-hint">{hint}</span>}
          </span>
          <motion.span
            className="acc-chevron"
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: ok ? 0.25 : 0, ease: EASE }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 9l7 7 7-7" />
            </svg>
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`acc-${id}`}
            role="region"
            aria-label={title}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: ok ? 0.32 : 0.12, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="accordion-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
