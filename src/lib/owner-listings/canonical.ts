import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { normalizeWhitespace, stripUndefined } from '@/lib/owner-listings/utils';

const CANONICAL_COLLECTION = 'ownerListingCanonicalGroups';

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

export function getOwnerListingCanonicalIdentity(listing: Partial<OwnerListingSummary>) {
  const originUrl = normalizeCanonicalUrl(listing.originSourceUrl);
  if (originUrl && !isAggregatorUrl(originUrl)) return `url:${originUrl}`;

  const link = normalizeCanonicalUrl(listing.link);
  if (link && !isAggregatorUrl(link)) return `url:${link}`;

  const phone = normalizeWhitespace(listing.ownerPhone).replace(/\D/g, '');
  if (phone.length >= 8) {
    return `phone:${phone}:${listing.scopeKey || ''}:${listing.propertyType || ''}:${listing.transactionType || ''}`;
  }

  return `content:${listing.dedupeSignature || listing.fingerprint || link}`;
}

function groupIdForIdentity(identity: string) {
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function preferIncoming<T>(current: T | null | undefined, incoming: T | null | undefined) {
  if (current !== undefined && current !== null && !(typeof current === 'string' && !current.trim())) return current;
  if (incoming === undefined || incoming === null || (typeof incoming === 'string' && !incoming.trim())) return undefined;
  return incoming;
}

function mergeDuplicateIntoPrimary(
  primary: Partial<OwnerListingSummary>,
  duplicate: Partial<OwnerListingSummary>
) {
  return stripUndefined({
    title: preferIncoming(primary.title, duplicate.title),
    price: preferIncoming(primary.price, duplicate.price),
    priceValue: preferIncoming(primary.priceValue, duplicate.priceValue),
    area: preferIncoming(primary.area, duplicate.area),
    areaValue: preferIncoming(primary.areaValue, duplicate.areaValue),
    rooms: preferIncoming(primary.rooms, duplicate.rooms),
    roomsValue: preferIncoming(primary.roomsValue, duplicate.roomsValue),
    constructionYear: preferIncoming(primary.constructionYear, duplicate.constructionYear),
    constructionYearValue: preferIncoming(primary.constructionYearValue, duplicate.constructionYearValue),
    year: preferIncoming(primary.year, duplicate.year),
    location: preferIncoming(primary.location, duplicate.location),
    description: preferIncoming(primary.description, duplicate.description),
    imageUrl: preferIncoming(primary.imageUrl, duplicate.imageUrl),
    ownerName: preferIncoming(primary.ownerName, duplicate.ownerName),
    ownerPhone: preferIncoming(primary.ownerPhone, duplicate.ownerPhone),
    originSourceUrl: preferIncoming(primary.originSourceUrl, duplicate.originSourceUrl),
    originSourceLabel: preferIncoming(primary.originSourceLabel, duplicate.originSourceLabel),
    lastSeenAt: Math.max(primary.lastSeenAt || 0, duplicate.lastSeenAt || 0),
    updatedAt: new Date().toISOString(),
    firestoreUpdatedAt: FieldValue.serverTimestamp(),
  });
}

export async function registerOwnerListingCanonical(listingId: string, listing: OwnerListingSummary) {
  const identity = getOwnerListingCanonicalIdentity(listing);
  const groupId = groupIdForIdentity(identity);
  const groupRef = adminDb.collection(CANONICAL_COLLECTION).doc(groupId);
  const listingRef = adminDb.collection('ownerListings').doc(listingId);

  return adminDb.runTransaction(async (transaction) => {
    const groupSnapshot = await transaction.get(groupRef);
    const primaryListingId = groupSnapshot.exists
      ? String(groupSnapshot.data()?.primaryListingId || listingId)
      : listingId;
    const primaryRef = adminDb.collection('ownerListings').doc(primaryListingId);
    const primarySnapshot = primaryListingId === listingId ? null : await transaction.get(primaryRef);
    const isCanonical = primaryListingId === listingId;

    transaction.set(
      groupRef,
      {
        identity,
        primaryListingId,
        memberCount: FieldValue.increment(groupSnapshot.exists ? 0 : 1),
        lastSeenAt: listing.lastSeenAt,
        updatedAt: new Date().toISOString(),
        createdAt: groupSnapshot.exists ? groupSnapshot.data()?.createdAt : new Date().toISOString(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      listingRef,
      {
        canonicalIdentity: identity,
        canonicalListingId: primaryListingId,
        dedupeGroupId: groupId,
        isCanonical,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (primarySnapshot?.exists) {
      transaction.set(primaryRef, mergeDuplicateIntoPrimary(primarySnapshot.data() || {}, listing), { merge: true });
    }

    return { groupId, primaryListingId, isCanonical };
  });
}
