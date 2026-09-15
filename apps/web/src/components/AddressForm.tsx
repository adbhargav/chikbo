import { useState } from 'react';
import type { AddressDto } from '@chikbo/shared';
import { useAddressMutations } from '../lib/queries';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';
import { INDIAN_STATES, PHONE_RE, PINCODE_RE } from '../lib/format';

/** The editable fields of a delivery address, as typed by the customer. */
export interface AddressFormValues {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export const emptyAddress = (): AddressFormValues => ({
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
});

export type AddressErrors = Partial<Record<keyof AddressFormValues, string>>;

/** Client-side validation shared by the saved-address form and guest checkout. */
export function validateAddress(form: AddressFormValues): AddressErrors {
  const next: AddressErrors = {};
  if (form.fullName.trim().length < 2) next.fullName = 'Enter the recipient’s full name.';
  if (!PHONE_RE.test(form.phone.trim())) next.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (form.line1.trim().length < 3) next.line1 = 'Enter the address line.';
  if (form.city.trim().length < 2) next.city = 'Enter the city.';
  if (!form.state) next.state = 'Select a state.';
  if (!PINCODE_RE.test(form.pincode.trim())) next.pincode = 'Enter a valid 6-digit pincode.';
  return next;
}

/** Trimmed payload shape the API accepts. */
export function toAddressPayload(form: AddressFormValues) {
  return {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || null,
    city: form.city.trim(),
    state: form.state,
    pincode: form.pincode.trim(),
  };
}

interface FieldsProps {
  form: AddressFormValues;
  errors: AddressErrors;
  onChange: (next: AddressFormValues) => void;
  /** Prefix for input ids so two forms can coexist on a page. */
  idPrefix?: string;
}

/** Just the inputs — no submit, no persistence. */
export function AddressFields({ form, errors, onChange, idPrefix = 'addr' }: FieldsProps) {
  const set = (key: keyof AddressFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [key]: e.target.value });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor={id('name')}>Full name</label>
          <input
            id={id('name')}
            className="input"
            autoComplete="name"
            value={form.fullName}
            aria-invalid={!!errors.fullName}
            onChange={set('fullName')}
          />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </div>
        <div className="field">
          <label htmlFor={id('phone')}>Mobile number</label>
          <input
            id={id('phone')}
            className="input"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel-national"
            value={form.phone}
            aria-invalid={!!errors.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value.replace(/\D/g, '') })}
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </div>
      </div>

      <div className="field">
        <label htmlFor={id('line1')}>Address line 1</label>
        <input
          id={id('line1')}
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
        <label htmlFor={id('line2')}>Address line 2 (optional)</label>
        <input
          id={id('line2')}
          className="input"
          autoComplete="address-line2"
          placeholder="Landmark, apartment"
          value={form.line2}
          onChange={set('line2')}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor={id('city')}>City</label>
          <input
            id={id('city')}
            className="input"
            autoComplete="address-level2"
            value={form.city}
            aria-invalid={!!errors.city}
            onChange={set('city')}
          />
          {errors.city && <span className="field-error">{errors.city}</span>}
        </div>
        <div className="field">
          <label htmlFor={id('state')}>State</label>
          <select
            id={id('state')}
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
          <label htmlFor={id('pincode')}>Pincode</label>
          <input
            id={id('pincode')}
            className="input"
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            value={form.pincode}
            aria-invalid={!!errors.pincode}
            onChange={(e) => onChange({ ...form, pincode: e.target.value.replace(/\D/g, '') })}
          />
          {errors.pincode && <span className="field-error">{errors.pincode}</span>}
        </div>
      </div>
    </>
  );
}

interface Props {
  /** When present, edits this address instead of creating a new one. */
  initial?: AddressDto;
  onDone: (address?: AddressDto) => void;
  onCancel: () => void;
}

/** Saved-address form for signed-in customers: validates, then persists to the account. */
export function AddressForm({ initial, onDone, onCancel }: Props) {
  const { create, update } = useAddressMutations();
  const toast = useToast();
  const [form, setForm] = useState<AddressFormValues>({
    fullName: initial?.fullName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
  });
  const [errors, setErrors] = useState<AddressErrors>({});
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAddress(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = toAddressPayload(form);
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
      <AddressFields form={form} errors={errors} onChange={setForm} />
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
