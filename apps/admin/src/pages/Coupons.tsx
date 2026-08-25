import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CouponType } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { AdminCoupon } from '../lib/types';
import { formatDate, formatPaise, paiseToRupees, rupeesToPaise } from '../lib/format';
import { PermissionGate } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, PageHead, TableSkeleton } from '../components/ui';

interface CouponForm {
  id?: string;
  code: string;
  type: CouponType;
  value: string; // PERCENT: basis points; FLAT: rupees
  minOrder: string; // rupees
  maxDiscount: string; // rupees, optional
  validFrom: string; // datetime-local
  validUntil: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = (): CouponForm => ({
  code: '',
  type: 'PERCENT',
  value: '',
  minOrder: '0',
  maxDiscount: '',
  validFrom: toLocalInput(new Date().toISOString()),
  validUntil: '',
  usageLimit: '',
  perUserLimit: '1',
  isActive: true,
});

function couponValueLabel(c: AdminCoupon): string {
  return c.type === 'PERCENT' ? `${(c.value / 100).toLocaleString('en-IN')}% off` : `${formatPaise(c.value)} off`;
}

export function Coupons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CouponForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api<AdminCoupon[]>('/admin/coupons'),
  });

  const save = useMutation({
    mutationFn: (state: CouponForm) => {
      const value =
        state.type === 'PERCENT' ? Math.round(Number(state.value)) : rupeesToPaise(state.value) ?? 0;
      const body: Record<string, unknown> = {
        type: state.type,
        value,
        minOrderInPaise: rupeesToPaise(state.minOrder) ?? 0,
        maxDiscountInPaise: state.maxDiscount.trim() === '' ? null : rupeesToPaise(state.maxDiscount),
        validFrom: new Date(state.validFrom).toISOString(),
        validUntil: new Date(state.validUntil).toISOString(),
        usageLimit: state.usageLimit.trim() === '' ? null : Math.round(Number(state.usageLimit)),
        perUserLimit: Math.max(1, Math.round(Number(state.perUserLimit) || 1)),
        isActive: state.isActive,
      };
      if (state.id) {
        return api<AdminCoupon>(`/admin/coupons/${state.id}`, { method: 'PATCH', body });
      }
      return api<AdminCoupon>('/admin/coupons', { method: 'POST', body: { ...body, code: state.code } });
    },
    onSuccess: (_d, state) => {
      toast(state.id ? 'Coupon saved' : 'Coupon created', 'success');
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const openEdit = (c: AdminCoupon) => {
    setFormError(null);
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.type === 'PERCENT' ? String(c.value) : paiseToRupees(c.value),
      minOrder: paiseToRupees(c.minOrderInPaise) || '0',
      maxDiscount: paiseToRupees(c.maxDiscountInPaise),
      validFrom: toLocalInput(c.validFrom),
      validUntil: toLocalInput(c.validUntil),
      usageLimit: c.usageLimit === null ? '' : String(c.usageLimit),
      perUserLimit: String(c.perUserLimit),
      isActive: c.isActive,
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    if (!form.id && !/^[A-Z0-9]{3,20}$/.test(form.code)) {
      return setFormError('Code must be 3–20 uppercase letters or digits');
    }
    if (form.type === 'PERCENT') {
      const bp = Number(form.value);
      if (!Number.isInteger(bp) || bp < 1 || bp > 10_000) {
        return setFormError('Percent value is in basis points: 1–10000 (1000 = 10%)');
      }
    } else {
      const p = rupeesToPaise(form.value);
      if (p === null || p < 1) return setFormError('Flat discount must be a positive rupee amount');
    }
    if (!form.validFrom || !form.validUntil) return setFormError('Set the validity window');
    if (new Date(form.validUntil) <= new Date(form.validFrom)) {
      return setFormError('Valid-until must be after valid-from');
    }
    save.mutate(form);
  };

  const bpPreview =
    form && form.type === 'PERCENT' && form.value.trim() !== '' && Number.isFinite(Number(form.value))
      ? `${(Number(form.value) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`
      : null;

  return (
    <main className="page">
      <PageHead
        overline="People"
        title="Coupons"
        sub="Codes, windows and usage."
        actions={
          <PermissionGate permission="coupons.write">
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormError(null);
                setForm(emptyForm());
              }}
            >
              + New coupon
            </button>
          </PermissionGate>
        }
      />

      {coupons.isError ? (
        <ErrorState error={coupons.error} onRetry={() => coupons.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th className="num">Min order</th>
                <th className="num">Max discount</th>
                <th>Validity</th>
                <th className="num">Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            {coupons.isPending ? (
              <TableSkeleton cols={8} rows={6} />
            ) : coupons.data.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No coupons yet" message="Create a code for the next festive drop." />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {coupons.data.map((c) => {
                  const expired = new Date(c.validUntil) < new Date();
                  return (
                    <tr key={c.id}>
                      <td className="primary mono" style={{ letterSpacing: '0.06em' }}>
                        {c.code}
                      </td>
                      <td>{couponValueLabel(c)}</td>
                      <td className="num muted">
                        {c.minOrderInPaise > 0 ? formatPaise(c.minOrderInPaise) : '—'}
                      </td>
                      <td className="num muted">
                        {c.maxDiscountInPaise !== null ? formatPaise(c.maxDiscountInPaise) : '—'}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {formatDate(c.validFrom)} → {formatDate(c.validUntil)}
                      </td>
                      <td className="num">
                        {c._count?.redemptions ?? 0}
                        {c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}
                      </td>
                      <td>
                        {expired ? (
                          <span className="pill neutral">Expired</span>
                        ) : c.isActive ? (
                          <span className="pill success">Active</span>
                        ) : (
                          <span className="pill error">Off</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <PermissionGate permission="coupons.write">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                            Edit
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? `Edit ${form.code}` : 'New coupon'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setForm(null)} disabled={save.isPending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSubmit} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : form.id ? 'Save' : 'Create'}
              </button>
            </>
          }
        >
          <form onSubmit={onSubmit}>
            {formError && (
              <div className="login-error" role="alert">
                {formError}
              </div>
            )}
            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="cp-code">Code</label>
                <input
                  id="cp-code"
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
                  }
                  disabled={Boolean(form.id)}
                  placeholder="FESTIVE10"
                  required
                />
                {form.id && <span className="hint">Codes cannot be changed after creation.</span>}
              </div>
              <div className="field">
                <label htmlFor="cp-type">Type</label>
                <select
                  id="cp-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => f && { ...f, type: e.target.value as CouponType, value: '' })}
                >
                  <option value="PERCENT">Percent off</option>
                  <option value="FLAT">Flat ₹ off</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="cp-value">{form.type === 'PERCENT' ? 'Value (basis points)' : 'Value (₹)'}</label>
              {form.type === 'PERCENT' ? (
                <>
                  <input
                    id="cp-value"
                    type="number"
                    min={1}
                    max={10000}
                    value={form.value}
                    onChange={(e) => setForm((f) => f && { ...f, value: e.target.value })}
                    placeholder="1000"
                    required
                  />
                  <span className="hint">
                    1000 = 10%.{bpPreview ? ` This coupon: ${bpPreview} off.` : ''}
                  </span>
                </>
              ) : (
                <>
                  <div className="input-prefix">
                    <span>₹</span>
                    <input
                      id="cp-value"
                      type="number"
                      min={1}
                      step="0.01"
                      value={form.value}
                      onChange={(e) => setForm((f) => f && { ...f, value: e.target.value })}
                      placeholder="200"
                      required
                    />
                  </div>
                  <span className="hint">Stored as paise; enter rupees.</span>
                </>
              )}
            </div>

            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="cp-min">Min order (₹)</label>
                <div className="input-prefix">
                  <span>₹</span>
                  <input
                    id="cp-min"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.minOrder}
                    onChange={(e) => setForm((f) => f && { ...f, minOrder: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="cp-max">Max discount (₹, optional)</label>
                <div className="input-prefix">
                  <span>₹</span>
                  <input
                    id="cp-max"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.maxDiscount}
                    onChange={(e) => setForm((f) => f && { ...f, maxDiscount: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="cp-from">Valid from</label>
                <input
                  id="cp-from"
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => f && { ...f, validFrom: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cp-until">Valid until</label>
                <input
                  id="cp-until"
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => f && { ...f, validUntil: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row cols-2">
              <div className="field">
                <label htmlFor="cp-limit">Total usage limit (optional)</label>
                <input
                  id="cp-limit"
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => f && { ...f, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="field">
                <label htmlFor="cp-per">Per-user limit</label>
                <input
                  id="cp-per"
                  type="number"
                  min={1}
                  value={form.perUserLimit}
                  onChange={(e) => setForm((f) => f && { ...f, perUserLimit: e.target.value })}
                />
              </div>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => f && { ...f, isActive: e.target.checked })}
              />
              Active
            </label>
          </form>
        </Modal>
      )}
    </main>
  );
}
