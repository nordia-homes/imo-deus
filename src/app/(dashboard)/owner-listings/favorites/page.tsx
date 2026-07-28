'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, query } from 'firebase/firestore';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import type { OwnerListing, OwnerListingFavorite } from '@/components/owner-listings/types';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { matchesScopeLocation, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import { getAgencyThemePreset } from '@/lib/theme';
import type { Property } from '@/lib/types';

export default function SavedOwnerListingsPage() {
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const [isUpdatingProspecting, setIsUpdatingProspecting] = useState<string | null>(null);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState<string | null>(null);
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isListingsLoading, setIsListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [missingListingsCount, setMissingListingsCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency, agencyId, isAgencyLoading } = useAgency();
  const isClassicTheme = getAgencyThemePreset(agency) === 'classic';
  const currentScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);

  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites')) : null),
    [agencyId, firestore],
  );
  const {
    data: favorites,
    isLoading: isFavoritesLoading,
    error: favoritesError,
  } = useCollection<OwnerListingFavorite>(favoritesQuery);

  const savedFavorites = useMemo(
    () => (favorites ?? []).filter((favorite) => favorite.isSavedFavorite === true),
    [favorites],
  );
  const prospectingCount = useMemo(
    () => (favorites ?? []).filter((favorite) => favorite.isFavoriteActive !== false).length,
    [favorites],
  );
  const savedFavoriteIdsKey = useMemo(
    () => savedFavorites
      .map((favorite) => favorite.ownerListingId || favorite.id)
      .filter(Boolean)
      .sort()
      .join('|'),
    [savedFavorites],
  );

  useEffect(() => {
    if (isAgencyLoading || isFavoritesLoading) return;

    if (!user || !agencyId) {
      setListings([]);
      setListingsError('Utilizatorul nu este asociat unei agentii.');
      setMissingListingsCount(0);
      setIsListingsLoading(false);
      return;
    }

    if (!savedFavoriteIdsKey) {
      setListings([]);
      setListingsError(null);
      setMissingListingsCount(0);
      setIsListingsLoading(false);
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsListingsLoading(true);
      setListingsError(null);

      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ mode: 'saved' });
        if (currentScope?.key) params.set('scopeKey', currentScope.key);
        const response = await fetch(`/api/owner-listings/favorites?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({})) as {
          listings?: OwnerListing[];
          missingListingsCount?: number;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || 'Nu am putut incarca anunturile Favorite.');
        }

        setListings(Array.isArray(payload.listings) ? payload.listings : []);
        setMissingListingsCount(
          typeof payload.missingListingsCount === 'number' ? payload.missingListingsCount : 0,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setListings([]);
        setMissingListingsCount(0);
        setListingsError(
          error instanceof Error ? error.message : 'Nu am putut incarca anunturile Favorite.',
        );
      } finally {
        if (!controller.signal.aborted) setIsListingsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [
    agencyId,
    currentScope?.key,
    isAgencyLoading,
    isFavoritesLoading,
    reloadKey,
    savedFavoriteIdsKey,
    user,
  ]);

  const listingsById = useMemo(() => {
    const map = new Map<string, OwnerListing>();

    for (const listing of listings) {
      if (currentScope && listing.scopeKey !== currentScope.key) continue;
      if (
        currentScope?.key === 'iasi' &&
        !matchesScopeLocation(currentScope, [listing.location, listing.title, listing.description].join(' '))
      ) {
        continue;
      }
      map.set(listing.id, listing);
    }

    return map;
  }, [currentScope, listings]);

  const favoriteEntries = useMemo(
    () => [...savedFavorites]
      .sort((left, right) => {
        const leftTimestamp = new Date(left.favoriteSavedAt || left.updatedAt || left.createdAt || 0).getTime();
        const rightTimestamp = new Date(right.favoriteSavedAt || right.updatedAt || right.createdAt || 0).getTime();
        return rightTimestamp - leftTimestamp;
      })
      .map((favorite) => {
        const listing = listingsById.get(favorite.ownerListingId || favorite.id);
        return listing ? { favorite, listing } : null;
      })
      .filter((entry): entry is { favorite: OwnerListingFavorite; listing: OwnerListing } => Boolean(entry)),
    [listingsById, savedFavorites],
  );

  const handleToggleFavorite = async (listing: OwnerListing) => {
    if (!user) return;
    setIsUpdatingFavorite(listing.id);

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId: listing.id, action: 'remove' }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut actualiza Favoritele.');
      toast({ title: 'Scos de la Favorite', description: 'Anuntul a fost eliminat din lista Favorite.' });
    } catch (error) {
      toast({
        title: 'Actualizare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut actualiza Favoritele.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingFavorite(null);
    }
  };

  const handleToggleProspecting = async (listing: OwnerListing) => {
    if (!user) return;
    const favorite = favorites?.find((entry) => (entry.ownerListingId || entry.id) === listing.id);
    const isProspecting = Boolean(favorite && favorite.isFavoriteActive !== false);
    setIsUpdatingProspecting(listing.id);

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/prospecting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          action: isProspecting ? 'remove' : 'add',
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        phoneExtractionMessage?: string;
      };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut actualiza Prospectarea.');
      toast({
        title: isProspecting ? 'Scos din Prospectare' : 'Adaugat in Prospectare',
        description: isProspecting
          ? 'Anuntul ramane disponibil in Favorite.'
          : payload.phoneExtractionMessage || 'Anuntul a fost adaugat in Prospectare WhatsApp.',
      });
    } catch (error) {
      toast({
        title: 'Actualizare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut actualiza Prospectarea.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProspecting(null);
    }
  };

  const handleImport = async (listing: OwnerListing) => {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru import.' });
      return;
    }

    const favorite = favorites?.find((entry) => (entry.ownerListingId || entry.id) === listing.id);
    const isProspecting = Boolean(favorite && favorite.isFavoriteActive !== false);
    setIsLoadingImport(listing.id);
    toast({ title: 'Import in curs...', description: 'Se preiau datele reale din anunt.' });

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: listing.source,
          url: listing.link,
          listingId: listing.id,
          ownerPhone: isProspecting ? normalizeRomanianPhone(favorite?.ownerPhone) : '',
          sourceDescription: listing.description || '',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Importul anuntului a esuat.');

      setPropertyToImport(payload.property as Partial<Property>);
      setIsImportDialogOpen(true);
      toast({ title: 'Anunt importat', description: 'Datele reale au fost pregatite pentru adaugare.' });
    } catch (error) {
      toast({
        title: 'Import esuat',
        description: error instanceof Error ? error.message : 'Nu am putut importa anuntul.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingImport(null);
    }
  };

  if (isAgencyLoading || isFavoritesLoading || isListingsLoading) {
    return (
      <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
        <OwnerListingHeader
          title="Favorite"
          subtitle="Pregatim anunturile salvate."
          currentScopeLabel={currentScope?.displayName}
          activeTab="favorites"
          prospectingCount={prospectingCount}
          favoriteCount={savedFavorites.length}
          adminClassic={isClassicTheme}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full rounded-[1.75rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Favorite"
        subtitle="Anunturile salvate pentru a le revedea rapid, independent de Prospectarea WhatsApp."
        currentScopeLabel={currentScope?.displayName}
        activeTab="favorites"
        prospectingCount={prospectingCount}
        favoriteCount={savedFavorites.length}
        adminClassic={isClassicTheme}
      />

      {favoriteEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favoriteEntries.map(({ favorite, listing }) => {
            const isProspecting = favorite.isFavoriteActive !== false;
            return (
              <OwnerListingCard
                key={favorite.id}
                listing={{
                  ...listing,
                  ownerPhone: isProspecting ? normalizeRomanianPhone(favorite.ownerPhone) : '',
                }}
                favoriteMeta={favorite}
                adminClassic={isClassicTheme}
                isProspecting={isProspecting}
                isFavorite
                onImport={handleImport}
                onToggleProspecting={handleToggleProspecting}
                onToggleFavorite={handleToggleFavorite}
                collaborationStatus={favorite.collaborationStatus ?? null}
                collaborationMode={favorite.collaborationStatus ? 'readonly' : 'hidden'}
                isLoadingImport={isLoadingImport === listing.id}
                isUpdatingProspecting={isUpdatingProspecting === listing.id}
                isUpdatingFavorite={isUpdatingFavorite === listing.id}
              />
            );
          })}
        </div>
      ) : listingsError || favoritesError ? (
        <div className="rounded-[1.75rem] border border-red-300/25 bg-red-950/20 px-6 py-14 text-center text-white/78">
          <p className="text-lg font-semibold text-white">Favoritele nu au putut fi incarcate.</p>
          <p className="mt-2 text-sm text-white/65">
            {listingsError || favoritesError?.message || 'A aparut o eroare temporara.'}
          </p>
          <Button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-5 rounded-full">
            Incearca din nou
          </Button>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-white/20 bg-white/8 px-6 py-14 text-center text-white/78">
          <p className="text-lg font-semibold text-white">Nu ai anunturi Favorite inca.</p>
          <p className="mt-2 text-sm text-white/60">
            Apasa inimioara unui anunt pentru a-l salva aici.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/owner-listings">Mergi la Anunturi de la proprietari</Link>
          </Button>
        </div>
      )}

      {missingListingsCount > 0 ? (
        <p className="text-center text-sm text-white/60">
          {missingListingsCount} anunturi Favorite nu mai exista in inventar si nu pot fi afisate.
        </p>
      ) : null}

      <AddPropertyDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        property={propertyToImport as Property | null}
      />
    </div>
  );
}
