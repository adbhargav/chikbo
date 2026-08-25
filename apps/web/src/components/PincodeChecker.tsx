import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PINCODE_RE } from '../lib/format';
import { TruckIcon } from './icons';

/** `GET /catalog/serviceability` contract (docs/marketplace-redesign.md §3). */
interface ServiceabilityDto {
  serviceable: boolean;
  etaDays?: number;
  codAvailable: boolean;
  message?: string;
}

/**
 * Pincode delivery checker. The endpoint is being added in parallel — while it
 * 404s the whole block hides itself rather than showing an error, so the PDP
 * degrades silently.
 */
export function PincodeChecker() {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<ServiceabilityDto | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = pincode.trim();
    if (!PINCODE_RE.test(value)) {
      setResult(null);
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const data = await api<ServiceabilityDto>('/catalog/serviceability', {
        query: { pincode: value },
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND')) {
        setUnsupported(true);
        return;
      }
      setResult(null);
      setError('We could not check delivery just now. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (unsupported) return null;

  return (
    <section className="pincode" aria-labelledby="pincode-title">
      <h2 className="pincode-title" id="pincode-title">
        <TruckIcon size={18} />
        Delivery &amp; services
      </h2>
      <form className="pincode-form" onSubmit={check}>
        <label className="visually-hidden" htmlFor="pincode-input">
          Delivery pincode
        </label>
        <input
          id="pincode-input"
          className="input pincode-input"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Enter pincode"
          value={pincode}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setPincode(e.target.value.replace(/[^0-9]/g, ''));
            setError(null);
          }}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={checking}>
          {checking ? 'Checking…' : 'Check'}
        </button>
      </form>
      <p className="pincode-result" aria-live="polite">
        {error && <span className="pincode-error">{error}</span>}
        {!error && result && result.serviceable && (
          <>
            <span className="pincode-ok">
              Delivers to {pincode}
              {typeof result.etaDays === 'number' ? ` in ${result.etaDays} days` : ''}
            </span>
            <span className="muted">
              {' '}
              ·{' '}
              {typeof result.etaDays !== 'number' && result.message
                ? result.message
                : result.codAvailable
                  ? 'Cash on delivery available'
                  : 'Prepaid orders only'}
            </span>
          </>
        )}
        {!error && result && !result.serviceable && (
          <span className="pincode-error">
            {result.message ?? 'We do not deliver to this pincode yet.'}
          </span>
        )}
        {!error && !result && (
          <span className="muted">Pan-India shipping · dispatched in 1–2 business days</span>
        )}
      </p>
    </section>
  );
}
