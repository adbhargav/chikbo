import { randomInt } from 'crypto';

/**
 * Human-friendly, unique-enough order number, e.g. CHK-260819-48213.
 * Uniqueness is ultimately enforced by the DB unique constraint; the
 * checkout service retries on collision.
 */
export function generateOrderNumber(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `CHK-${yy}${mm}${dd}-${randomInt(10_000, 99_999)}`;
}
