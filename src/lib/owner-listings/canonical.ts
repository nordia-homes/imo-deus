import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { getOwnerListingCanonicalIdentity } from '@/lib/owner-listings/canonical-identity';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { stripUndefined } from '@/lib/owner-listings/utils';

const CANONICAL_COLLECTION = 'ownerListingCanonicalGroups';

export { getOwnerListingCanonicalIdentity, isListingSpecificExternalUrl } from '@/lib/owner-listings/canonical-identity';

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
