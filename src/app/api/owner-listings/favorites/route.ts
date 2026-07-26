import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';

export const runtime = 'nodejs';

const FAVORITE_READ_BATCH_SIZE = 250;

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Nu am putut incarca anunturile din Prospectare.',
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Nu am putut incarca anunturile din Prospectare.',
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const scopeKey = request.nextUrl.searchParams.get('scopeKey')?.trim() || null;
    const favoritesSnapshot = await authContext.adminDb
      .collection('agencies')
      .doc(authContext.agencyId)
      .collection('ownerListingFavorites')
      .get();
    const activeFavoriteIds = [...new Set(
      favoritesSnapshot.docs
        .filter((snapshot) => snapshot.data().isFavoriteActive !== false)
        .map((snapshot) => String(snapshot.data().ownerListingId || snapshot.id).trim())
        .filter(Boolean),
    )];
    const listings: Array<OwnerListingSummary & { id: string }> = [];
    let missingListingsCount = 0;
    let recoveredListingsCount = 0;

    for (let index = 0; index < activeFavoriteIds.length; index += FAVORITE_READ_BATCH_SIZE) {
      const batchIds = activeFavoriteIds.slice(index, index + FAVORITE_READ_BATCH_SIZE);
      const snapshots = await authContext.adminDb.getAll(
        ...batchIds.map((listingId) => authContext.adminDb.collection('ownerListings').doc(listingId)),
      );

      for (const [snapshotIndex, snapshot] of snapshots.entries()) {
        const favoriteListingId = batchIds[snapshotIndex];
        let listing = snapshot.exists ? snapshot.data() as OwnerListingSummary : null;

        if (!listing) {
          const replacementSnapshot = await authContext.adminDb
            .collection('ownerListings')
            .where('canonicalListingId', '==', favoriteListingId)
            .get();
          const replacement = replacementSnapshot.docs
            .map((document) => document.data() as OwnerListingSummary)
            .find((candidate) => candidate.publicationStatus === 'ready')
            || replacementSnapshot.docs[0]?.data() as OwnerListingSummary | undefined;

          if (!replacement) {
            missingListingsCount += 1;
            continue;
          }

          listing = replacement;
          recoveredListingsCount += 1;
        }

        if (scopeKey && listing.scopeKey !== scopeKey) continue;
        const { ownerPhone: _globalOwnerPhone, ...safeListing } = listing;
        listings.push({ ...safeListing, id: favoriteListingId });
      }
    }

    return NextResponse.json({
      listings,
      activeFavoriteCount: activeFavoriteIds.length,
      displayableFavoriteCount: listings.length,
      missingListingsCount,
      recoveredListingsCount,
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
