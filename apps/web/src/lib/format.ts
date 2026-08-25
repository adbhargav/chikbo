import { ASSET_ORIGIN } from './api';

/** Resolve a server-relative asset URL (e.g. /uploads/..., /images/...) against the API origin. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${ASSET_ORIGIN}${url}`;
}

export function percentOff(mrpInPaise: number, priceInPaise: number): number {
  if (mrpInPaise <= 0 || priceInPaise >= mrpInPaise) return 0;
  return Math.round(((mrpInPaise - priceInPaise) / mrpInPaise) * 100);
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const PHONE_RE = /^[6-9][0-9]{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** ≥8 chars with at least one letter and one number (API contract). */
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "OUT_FOR_DELIVERY" -> "Out for delivery" */
export function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;
