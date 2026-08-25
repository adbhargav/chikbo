/**
 * Fetch a remote image safely for the "import from URL" flow.
 *
 * A server that fetches an arbitrary user-supplied URL is an SSRF hazard: left
 * unguarded it can be pointed at localhost, the private network, or a cloud
 * metadata endpoint (169.254.169.254) and used to read secrets. Every hop is
 * therefore resolved and checked against the IP ranges below before a request
 * is made, redirects are followed manually so each new location is re-checked,
 * and the response is capped by size and content type.
 */
import dns from 'dns/promises';
import net from 'net';
import axios from 'axios';
import { ApiError } from '../middleware/error';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
]);

const MAX_REDIRECTS = 3;

/** True for addresses that must never be reachable from an import. */
function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 0) return true; // not an IP we can reason about

  if (version === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('fe80')) return true; // link-local
  // IPv4-mapped (::ffff:10.0.0.1) — re-check the embedded address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isBlockedAddress(mapped[1]);
  return false;
}

/** Resolves the host and throws unless every address is publicly routable. */
async function assertPublicHost(hostname: string): Promise<void> {
  const literal = net.isIP(hostname);
  if (literal) {
    if (isBlockedAddress(hostname)) throw ApiError.badRequest('That address is not allowed');
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw ApiError.badRequest('Could not resolve that host');
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw ApiError.badRequest('That address is not allowed');
  }
}

export interface FetchedImage {
  buffer: Buffer;
  extension: string;
  contentType: string;
}

export async function fetchRemoteImage(rawUrl: string): Promise<FetchedImage> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw ApiError.badRequest('Enter a valid image URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw ApiError.badRequest('Only http and https URLs can be imported');
    }
    await assertPublicHost(url.hostname);

    const response = await axios.get(url.toString(), {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      timeout: 15_000,
      maxContentLength: MAX_IMAGE_BYTES,
      // Resolve for redirects too so we can re-validate the next hop ourselves.
      validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
      headers: { 'User-Agent': 'Chikbo-Admin-Image-Import/1.0', Accept: 'image/*' },
    });

    if (response.status >= 300) {
      const location = response.headers.location as string | undefined;
      if (!location) throw ApiError.badRequest('That URL redirected somewhere we could not follow');
      current = new URL(location, url).toString();
      continue;
    }

    const contentType = String(response.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = ALLOWED_IMAGE_TYPES.get(contentType);
    if (!extension) {
      throw ApiError.badRequest('That link is not a JPEG, PNG, WebP or AVIF image');
    }

    const buffer = Buffer.from(response.data as ArrayBuffer);
    if (buffer.byteLength === 0) throw ApiError.badRequest('That image was empty');
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw ApiError.badRequest('That image is larger than 5 MB');

    return { buffer, extension, contentType };
  }

  throw ApiError.badRequest('That URL redirected too many times');
}
