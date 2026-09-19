import { STOREFRONT_URL, slugify } from '../lib/format';

interface Props {
  id: string;
  /** Which storefront path the address lives under: /p/… or /c/…. */
  kind: 'product' | 'category';
  value: string;
  onChange: (value: string) => void;
  /** Storefront origin, e.g. "https://chikbo.in"; empty while unknown. */
  origin: string;
  disabled?: boolean;
  /** Products: the address is fixed after creation so shared links keep working. */
  locked?: boolean;
}

/**
 * The page's web address (technically its "slug"), shown the way a shopper
 * sees it: the store's domain, then the part the admin controls. It is filled
 * in from the name automatically, so most staff never need to touch it.
 */
export function WebAddressField({ id, kind, value, onChange, origin, disabled, locked }: Props) {
  let host = '';
  try {
    host = new URL(origin || STOREFRONT_URL).host;
  } catch {
    host = '';
  }
  const prefix = `${host}/${kind === 'product' ? 'p' : 'c'}/`;
  const noun = kind === 'product' ? 'product' : 'category';

  return (
    <div className="field">
      <label htmlFor={id}>Web address</label>
      <div className={`webaddr${disabled || locked ? ' webaddr--disabled' : ''}`}>
        <span className="webaddr-prefix" aria-hidden="true">
          {prefix}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(slugify(e.target.value))}
          disabled={disabled || locked}
          placeholder={kind === 'product' ? 'silk-saree-maroon' : 'silk-sarees'}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <span className="hint" id={`${id}-hint`}>
        {locked
          ? `The link to this ${noun}. It can't be changed after the ${noun} is created, so links customers have shared keep working.`
          : kind === 'category'
            ? `The link to this ${noun} on your store. It fills in from the name automatically, so you usually don't need to change it. If you change it later, old links still work.`
            : `The link to this ${noun} on your store. It fills in from the name automatically, so you usually don't need to change it.`}
      </span>
    </div>
  );
}

/** Plain-language check for a web address; returns an error message or null. */
export function webAddressError(value: string): string | null {
  if (!value) {
    return 'Add a web address. Use English letters in the name, or type one yourself, e.g. "silk-sarees".';
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return 'The web address can only use lowercase English letters, numbers and dashes.';
  }
  return null;
}
