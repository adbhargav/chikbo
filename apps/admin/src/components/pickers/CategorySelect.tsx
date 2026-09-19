import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface CategoryChoice {
  /** What gets stored: a category id or slug, depending on the caller. */
  value: string;
  name: string;
  isChild: boolean;
  /** "Sarees / Pattu Silk" — shown in the closed control and in search results. */
  path: string;
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: CategoryChoice[];
  /** Shown in the closed control when nothing is chosen. */
  placeholder?: string;
  /** When set, adds a first row that clears the choice, e.g. "All categories". */
  clearLabel?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** Above this many rows the list gets a search box. */
const SEARCH_THRESHOLD = 8;
/** Room the open list wants below the control before it flips upwards. */
const LIST_SPACE = 340;

/**
 * Category dropdown. A native <select> opens as one screen-tall list once the
 * catalogue has a few dozen subcategories; this one stays a fixed-height
 * panel, groups subcategories under their department and filters as you type.
 */
export function CategorySelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  clearLabel,
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const searchable = options.length > SEARCH_THRESHOLD;
  const query = term.trim().toLowerCase();

  const rows = useMemo(() => {
    const matches = query ? options.filter((o) => o.path.toLowerCase().includes(query)) : options;
    const clear: CategoryChoice[] =
      clearLabel && !query ? [{ value: '', name: clearLabel, isChild: false, path: clearLabel }] : [];
    return [...clear, ...matches];
  }, [options, query, clearLabel]);

  const openList = () => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < LIST_SPACE && rect.top > window.innerHeight - rect.bottom);
    setTerm('');
    // Index into the unfiltered rows: the search term is reset on open.
    const current = options.findIndex((o) => o.value === value);
    setActive(current >= 0 ? current + (clearLabel ? 1 : 0) : 0);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const pick = (row: CategoryChoice) => {
    onChange(row.value);
    close(true);
  };

  // Close when the pointer or focus leaves the control.
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  useEffect(() => {
    if (open) (searchable ? searchRef.current : listRef.current)?.focus();
  }, [open, searchable]);

  // Keep the highlighted row in view while arrowing through the list.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, rows]);

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(rows.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(true);
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openList();
    }
  };

  const activeId = rows[active] ? `${listId}-${active}` : undefined;

  return (
    <div className={`catselect${open ? ' is-open' : ''}${dropUp ? ' is-up' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="catselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`catselect-value${selected || (!value && clearLabel) ? '' : ' is-placeholder'}`}>
          {selected ? selected.path : value ? 'Unknown category' : (clearLabel ?? placeholder)}
        </span>
        <svg className="catselect-caret" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="catselect-panel" onKeyDown={onPanelKeyDown}>
          {searchable && (
            <input
              ref={searchRef}
              type="search"
              className="catselect-search"
              value={term}
              placeholder="Search categories…"
              aria-label="Search categories"
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              onChange={(e) => {
                setTerm(e.target.value);
                setActive(0);
              }}
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            className="catselect-list"
            role="listbox"
            aria-label={ariaLabel ?? 'Categories'}
            aria-activedescendant={activeId}
            tabIndex={searchable ? -1 : 0}
          >
            {rows.length === 0 ? (
              <li className="catselect-empty">No categories match “{term.trim()}”.</li>
            ) : (
              rows.map((row, i) => {
                const isSelected = row.value === value;
                const nested = row.isChild && !query;
                return (
                  <li
                    key={row.value || '__clear'}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={i === active}
                    className={`catselect-option${nested ? ' is-child' : ''}${
                      !row.isChild && row.value ? ' is-parent' : ''
                    }`}
                    onMouseMove={() => setActive(i)}
                    // mousedown would blur the search box before click lands
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(row)}
                  >
                    <span className="catselect-option-name">{query ? row.path : row.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 7.5l2.8 2.8L11 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
