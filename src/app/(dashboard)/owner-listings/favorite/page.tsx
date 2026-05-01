'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingFavoriteEditor } from '@/components/owner-listings/owner-listing-favorite-editor';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import type { CollaborationStatus, OwnerListing, OwnerListingFavorite } from '@/components/owner-listings/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';

export default function FavoriteOwnerListingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { agency, agencyId, user } = useAgency();
  const currentScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);

  const ownerListingsQuery = useMemoFirebase(() => query(collection(firestore, 'ownerListings'), orderBy('postedAt', 'desc')), [firestore]);
  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites'), orderBy('createdAt', 'desc')) : null),
    [agencyId, firestore],
  );

  const { data: listings, isLoading: isListingsLoading } = useCollection<OwnerListing>(ownerListingsQuery);
  const { data: favorites, isLoading: isFavoritesLoading } = useCollection<OwnerListingFavorite>(favoritesQuery);

  const listingsById = useMemo(() => {
    const map = new Map<string, OwnerListing>();

    for (const listing of listings ?? []) {
      if (
        currentScope &&
        listing.scopeKey !== currentScope.key &&
        !['bucuresti', 'sector', 'ilfov', 'popesti', 'voluntari', 'otopeni', 'bragadiru', 'chiajna'].some((term) =>
          `${listing.location || ''} ${listing.title || ''} ${listing.description || ''}`.toLowerCase().includes(term),
        )
      ) {
        continue;
      }

      map.set(listing.id, listing);
    }

    return map;
  }, [currentScope, listings]);

  const favoriteEntries = useMemo(() => {
    return (favorites ?? [])
      .map((favorite) => {
        const listing = listingsById.get(favorite.ownerListingId);
        return listing ? { favorite, listing } : null;
      })
      .filter((entry): entry is { favorite: OwnerListingFavorite; listing: OwnerListing } => Boolean(entry));
  }, [favorites, listingsById]);

  const collaborationYesCount = favoriteEntries.filter((entry) => entry.favorite.collaborationStatus === 'collaborates').length;
  const collaborationNoCount = favoriteEntries.filter((entry) => entry.favorite.collaborationStatus === 'does_not_collaborate').length;

  const handleToggleFavorite = (listing: OwnerListing) => {
    if (!agencyId) {
      toast({ title: 'Agentia nu este disponibila', description: 'Mai incearca dupa ce se incarca profilul agentiei.' });
      return;
    }

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id);
    deleteDocumentNonBlocking(favoriteRef);
    toast({ title: 'Scos din Favorite', description: 'Anuntul nu mai apare in lista de contact manual.' });
  };

  const handleSetCollaborationStatus = (listing: OwnerListing, status: CollaborationStatus | null) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id);
    const timestamp = new Date().toISOString();
    updateDocumentNonBlocking(favoriteRef, {
      collaborationStatus: status,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
  };

  const handleSaveFavorite = (listingId: string, updates: Partial<OwnerListingFavorite>) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listingId);
    updateDocumentNonBlocking(favoriteRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.uid ?? null,
    });
  };

  if (isListingsLoading || isFavoritesLoading) {
    return (
      <div className="space-y-6 px-3 pb-6 sm:px-4 xl:px-5">
        <OwnerListingHeader
          title="Favorite"
          subtitle="Pregatim lista agentului cu anunturile salvate pentru contact manual."
          currentScopeLabel={currentScope?.displayName}
          activeTab="favorite"
          stats={[
            { label: 'Favorite', value: '...' },
            { label: 'Colaboreaza', value: '...' },
            { label: 'Nu colaboreaza', value: '...' },
          ]}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-3 pb-6 sm:px-4 xl:px-5">
      <OwnerListingHeader
        title="Favorite"
        subtitle="Lista de lucru a agentilor pentru apeluri manuale, cu status de colaborare, comision si notite direct sub fiecare card."
        currentScopeLabel={currentScope?.displayName}
        activeTab="favorite"
        stats={[
          { label: 'Favorite', value: String(favoriteEntries.length) },
          { label: 'Colaboreaza', value: String(collaborationYesCount) },
          { label: 'Nu colaboreaza', value: String(collaborationNoCount) },
        ]}
      />

      {favoriteEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {favoriteEntries.map(({ favorite, listing }) => (
            <div key={favorite.id} className="space-y-3">
              <OwnerListingCard
                listing={listing}
                isFavorite
                onToggleFavorite={handleToggleFavorite}
                collaborationStatus={favorite.collaborationStatus ?? null}
                collaborationMode="interactive"
                onSetCollaborationStatus={handleSetCollaborationStatus}
                showImportAction={false}
              />
              <OwnerListingFavoriteEditor favorite={favorite} onSave={(updates) => handleSaveFavorite(listing.id, updates)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-white/20 bg-white/8 px-6 py-14 text-center text-white/78">
          <p className="text-lg font-semibold text-white">Nu ai anunturi in Favorite inca.</p>
          <p className="mt-2 text-sm text-white/60">
            Din pagina Anunturi de la proprietari, apasa inimioara de pe card ca sa-ti construiesti lista de contact.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/owner-listings">Mergi la Anunturi de la proprietari</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
