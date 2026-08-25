import { useState } from 'react';
import type { AddressDto } from '@chikbo/shared';
import { useAddresses, useAddressMutations } from '../../lib/queries';
import { useToast } from '../../lib/toast';
import { ApiError } from '../../lib/api';
import { usePageMeta } from '../../lib/usePageMeta';
import { AddressForm } from '../../components/AddressForm';
import { EmptyState, ErrorState } from '../../components/ui';
import { TrashIcon } from '../../components/icons';

export default function Addresses() {
  usePageMeta('Addresses', 'Manage your delivery addresses.');
  const addresses = useAddresses();
  const { update, remove } = useAddressMutations();
  const toast = useToast();
  const [formMode, setFormMode] = useState<'closed' | 'new' | AddressDto>('closed');

  const makeDefault = (address: AddressDto) => {
    update.mutate(
      { id: address.id, isDefault: true },
      {
        onSuccess: () => toast.show('Default address updated.', 'success'),
        onError: (err) =>
          toast.show(err instanceof ApiError ? err.message : 'Could not update the address.', 'error'),
      },
    );
  };

  const deleteAddress = (address: AddressDto) => {
    if (!window.confirm(`Delete the address for ${address.fullName}?`)) return;
    remove.mutate(address.id, {
      onSuccess: () => toast.show('Address deleted.', 'info'),
      onError: (err) =>
        toast.show(err instanceof ApiError ? err.message : 'Could not delete the address.', 'error'),
    });
  };

  if (addresses.isPending) {
    return (
      <div className="account-stack" aria-busy="true">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }
  if (addresses.isError) return <ErrorState onRetry={() => addresses.refetch()} />;

  const list = addresses.data;

  return (
    <div className="account-stack">
      <div className="account-section-head">
        <h2>Addresses</h2>
        {formMode === 'closed' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormMode('new')}>
            + Add address
          </button>
        )}
      </div>

      {formMode !== 'closed' && (
        <section className="card card-pad">
          <h3 className="address-form-title">{formMode === 'new' ? 'New address' : 'Edit address'}</h3>
          <AddressForm
            initial={formMode === 'new' ? undefined : formMode}
            onDone={() => setFormMode('closed')}
            onCancel={() => setFormMode('closed')}
          />
        </section>
      )}

      {list.length === 0 && formMode === 'closed' && (
        <EmptyState title="No addresses yet" body="Add a delivery address to speed through checkout." />
      )}

      <ul className="address-cards">
        {list.map((address) => (
          <li key={address.id} className="card card-pad address-card">
            <div className="address-card-head">
              <strong>{address.fullName}</strong>
              {address.isDefault && <span className="pill pill--success">Default</span>}
            </div>
            <p className="muted">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              <br />
              {address.city}, {address.state} — {address.pincode}
              <br />
              +91 {address.phone}
            </p>
            <div className="address-card-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFormMode(address)}>
                Edit
              </button>
              {!address.isDefault && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={update.isPending}
                  onClick={() => makeDefault(address)}
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete address for ${address.fullName}`}
                disabled={remove.isPending}
                onClick={() => deleteAddress(address)}
              >
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
