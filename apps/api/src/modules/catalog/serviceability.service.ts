/**
 * Pincode delivery check for the PDP.
 *
 * Backed by Shiprocket's courier serviceability API when credentials are
 * configured; otherwise it answers with Chikbo's pan-India default so the
 * storefront always has something honest to render. COD is never available —
 * Chikbo is prepaid only. Results are cached in-process for 24h because
 * courier coverage barely moves day to day and the upstream call is slow.
 */
import type { ServiceabilityDto } from '@chikbo/shared';
import { logger } from '../../lib/logger';
import { shiprocket } from '../../lib/shiprocket';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ETA_DAYS = 5;

interface CacheEntry {
  value: ServiceabilityDto;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test/ops helper — drops every cached pincode answer. */
export function clearServiceabilityCache(): void {
  cache.clear();
}

function panIndiaDefault(pincode: string): ServiceabilityDto {
  return {
    pincode,
    serviceable: true,
    etaDays: DEFAULT_ETA_DAYS,
    codAvailable: false,
    message: 'Pan-India delivery, usually 3-7 days. Prepaid only — no cash on delivery.',
  };
}

export async function checkPincodeServiceability(pincode: string): Promise<ServiceabilityDto> {
  const cached = cache.get(pincode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let result: ServiceabilityDto;
  if (!shiprocket.isConfigured) {
    result = panIndiaDefault(pincode);
  } else {
    try {
      const check = await shiprocket.checkServiceability({ deliveryPincode: pincode });
      result = check.serviceable
        ? {
            pincode,
            serviceable: true,
            etaDays: check.etaDays,
            codAvailable: false,
            message: check.etaDays
              ? `Delivery to ${pincode} in about ${check.etaDays} ${check.etaDays === 1 ? 'day' : 'days'}. Prepaid only — no cash on delivery.`
              : `We deliver to ${pincode}. Prepaid only — no cash on delivery.`,
          }
        : {
            pincode,
            serviceable: false,
            etaDays: null,
            codAvailable: false,
            message: `Sorry, we can't deliver to ${pincode} yet. Try a nearby pincode.`,
          };
    } catch (err) {
      // Never fail the PDP on a courier API wobble — fall back to the default.
      logger.warn({ err, pincode }, 'Shiprocket serviceability check failed; using pan-India default');
      result = panIndiaDefault(pincode);
    }
  }

  cache.set(pincode, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
