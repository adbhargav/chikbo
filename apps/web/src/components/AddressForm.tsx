import { useState } from 'react';
import type { AddressDto } from '@chikbo/shared';
import { useAddressMutations } from '../lib/queries';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';
import { INDIAN_STATES, PHONE_RE, PINCODE_RE } from '../lib/format';

interface Props {
  /** When present, edits this address instead of creating a new one. */
  initial?: AddressDto;
  onDone: (address?: AddressDto) => void;
  onCancel: () => void;
}

export function AddressForm({ initial, onDone, onCancel }: Props) {
  const { create, update } = useAddressMutations();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = create.isPending || update.isPending;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Enter the recipient’s full name.';
    if (!PHONE_RE.test(form.phone.trim())) next.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (form.line1.trim().length < 3) next.line1 = 'Enter the address line.';
    if (form.city.trim().length < 2) next.city = 'Enter the city.';
    if (!form.state) next.state = 'Select a state.';
    if (!PINCODE_RE.test(form.pincode.trim())) next.pincode = 'Enter a valid 6-digit pincode.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || null,
      city: form.city.trim(),
      state: form.state,
      pincode: form.pincode.trim(),
    };

    try {
      let saved: AddressDto;
      if (initial) {
        saved = await update.mutateAsync({ id: initial.id, ...payload });
        toast.show('Address updated.', 'success');
      } else {
        saved = await create.mutateAsync(payload);
        toast.show('Address saved.', 'success');
      }
      onDone(saved);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not save the address.', 'error');
    }
  };

  return (
    <form className="address-form" onSubmit={submit} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="addr-name">Full name</label>
          <input
            id="addr-name"
            className="input"
            autoComplete="name"
            value={form.fullName}
            aria-invalid={!!errors.fullName}
            onChange={set('fullName')}
          />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </div>
        <div className="field">
          <label htmlFor="addr-phone">Mobile number</label>
          <input
            id="addr-phone"
            className="input"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel-national"
            value={form.phone}
            aria-invalid={!!errors.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="addr-line1">Address line 1</label>
        <input
          id="addr-line1"
          className="input"
          autoComplete="address-line1"
          placeholder="House no., street, area"
          value={form.line1}
          aria-invalid={!!errors.line1}
          onChange={set('line1')}
        />
        {errors.line1 && <span className="field-error">{errors.line1}</span>}
      </div>

      <div className="field">
        <label htmlFor="addr-line2">Address line 2 (optional)</label>
        <input
          id="addr-line2"
          className="input"
          autoComplete="address-line2"
          placeholder="Landmark, apartment"
          value={form.line2}
          onChange={set('line2')}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="addr-city">City</label>
          <input
            id="addr-city"
            className="input"
            autoComplete="address-level2"
            value={form.city}
            aria-invalid={!!errors.city}
            onChange={set('city')}
          />
          {errors.city && <span className="field-error">{errors.city}</span>}
        </div>
        <div className="field">
          <label htmlFor="addr-state">State</label>
          <select
            id="addr-state"
            className="select"
            value={form.state}
            aria-invalid={!!errors.state}
            onChange={set('state')}
          >
            <option value="">Select state…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.state && <span className="field-error">{errors.state}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="addr-pincode">Pincode</label>
          <input
            id="addr-pincode"
            className="input"
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            value={form.pincode}
            aria-invalid={!!errors.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))}
          />
          {errors.pincode && <span className="field-error">{errors.pincode}</span>}
        </div>
      </div>

      <div className="address-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Save address'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
