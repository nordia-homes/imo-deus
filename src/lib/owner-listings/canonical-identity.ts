import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { normalizeWhitespace } from '@/lib/owner-listings/utils';

function normalizeCanonicalUrl(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|ref|source)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return normalized;
  }
}

function isAggregatorUrl(value: string) {
  try {
    return /(?:^|\.)imoradar24\.ro$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isListingSpecificExternalUrl(value?: string | null) {
  const normalized = normalizeCanonicalUrl(value);
  if (!normalized || isAggregatorUrl(normalized)) return false;

  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, '');
    return Boolean(path && path !== '/');
  } catch {
    return false;
  }
}

export function getOwnerListingCanonicalIdentity(listing: Partial<OwnerListingSummary>) {
  const originUrl = normalizeCanonicalUrl(listing.originSourceUrl);
  if (isListingSpecificExternalUrl(originUrl)) return `url:${originUrl}`;

  const link = normalizeCanonicalUrl(listing.link);
  if (isListingSpecificExternalUrl(link)) return `url:${link}`;

  return `content:${listing.dedupeSignature || listing.fingerprint || link}`;
}
