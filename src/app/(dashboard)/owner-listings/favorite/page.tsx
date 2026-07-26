'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, query } from 'firebase/firestore';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingFavoriteEditor } from '@/components/owner-listings/owner-listing-favorite-editor';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import { OlxConnectionBanner } from '@/components/owner-listings/olx-connection-banner';
import type { CollaborationStatus, OwnerListing, OwnerListingFavorite } from '@/components/owner-listings/types';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { getAgencyThemePreset } from '@/lib/theme';
import { matchesScopeLocation, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type { Property } from '@/lib/types';

const RESERVATION_TTL_MS = 4 * 60 * 60 * 1000;

export default function FavoriteOwnerListingsPage() {
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isFavoriteListingsLoading, setIsFavoriteListingsLoading] = useState(true);
  const [favoriteListingsError, setFavoriteListingsError] = useState<string | null>(null);
  const [missingFavoriteListingsCount, setMissingFavoriteListingsCount] = useState(0);
  const [favoriteReloadKey, setFavoriteReloadKey] = useState(0);
  const [phoneRetryListingId, setPhoneRetryListingId] = useState<string | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency, agencyId, userProfile, isAgencyLoading } = useAgency();
  const isClassicTheme = getAgencyThemePreset(agency) === 'classic';
  const currentScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);
  const currentAgentName = userProfile?.name || user?.displayName || user?.email || 'Agent neatribuit';

  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites')) : null),
    [agencyId, firestore],
  );

  const {
    data: favorites,
    isLoading: isFavoritesLoading,
    error: favoritesError,
  } = useCollection<OwnerListingFavorite>(favoritesQuery);
  const activeFavorites = useMemo(
    () => (favorites ?? []).filter((favorite) => favorite.isFavoriteActive !== false),
    [favorites],
  );
  const activeFavoriteIdsKey = useMemo(
    () => activeFavorites
      .map((favorite) => favorite.ownerListingId || favorite.id)
      .filter(Boolean)
      .sort()
      .join('|'),
    [activeFavorites],
  );

  useEffect(() => {
    if (isAgencyLoading || isFavoritesLoading) return;

    if (!user || !agencyId) {
      setListings([]);
      setMissingFavoriteListingsCount(0);
      setFavoriteListingsError('Utilizatorul nu este asociat unei agentii.');
      setIsFavoriteListingsLoading(false);
      return;
    }

    if (!activeFavoriteIdsKey) {
      setListings([]);
      setFavoriteListingsError(null);
      setMissingFavoriteListingsCount(0);
      setIsFavoriteListingsLoading(false);
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsFavoriteListingsLoading(true);
      setFavoriteListingsError(null);

      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams();
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
          throw new Error(payload.message || 'Nu am putut incarca anunturile din Prospectare.');
        }

        setListings(Array.isArray(payload.listings) ? payload.listings : []);
        setMissingFavoriteListingsCount(
          typeof payload.missingListingsCount === 'number' ? payload.missingListingsCount : 0,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setListings([]);
        setMissingFavoriteListingsCount(0);
        setFavoriteListingsError(
          error instanceof Error ? error.message : 'Nu am putut incarca anunturile din Prospectare.',
        );
      } finally {
        if (!controller.signal.aborted) setIsFavoriteListingsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [
    activeFavoriteIdsKey,
    agencyId,
    currentScope?.key,
    favoriteReloadKey,
    isAgencyLoading,
    isFavoritesLoading,
    user,
  ]);

  const listingsById = useMemo(() => {
    const map = new Map<string, OwnerListing>();

    for (const listing of listings ?? []) {
      if (currentScope && listing.scopeKey !== currentScope.key) {
        continue;
      }

      if (currentScope?.key === 'iasi' && !matchesScopeLocation(currentScope, [listing.location, listing.title, listing.description].join(' '))) {
        continue;
      }

      map.set(listing.id, listing);
    }

    return map;
  }, [currentScope, listings]);

  const favoriteEntries = useMemo(() => {
    return [...activeFavorites]
      .sort((left, right) => {
        const leftTimestamp = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTimestamp = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTimestamp - leftTimestamp;
      })
      .map((favorite) => {
        const listing = listingsById.get(favorite.ownerListingId || favorite.id);
        return listing ? { favorite, listing } : null;
      })
      .filter((entry): entry is { favorite: OwnerListingFavorite; listing: OwnerListing } => Boolean(entry));
  }, [activeFavorites, listingsById]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const canCurrentAgentUpdateStatus = (favorite?: OwnerListingFavorite | null) => {
    if (!favorite) return true;

    const now = Date.now();
    const reservationExpiresAt = favorite.reservedAt ? new Date(favorite.reservedAt).getTime() + RESERVATION_TTL_MS : null;
    const reservationExpired = Boolean(
      favorite.reservedByAgentId && !favorite.takenByAgentId && !favorite.contactOutcome && reservationExpiresAt && now >= reservationExpiresAt,
    );

    if (reservationExpired) return true;
    if (favorite.takenByAgentId) return favorite.takenByAgentId === user?.uid;
    if (favorite.contactOutcomeByAgentId && favorite.contactOutcome) return favorite.contactOutcomeByAgentId === user?.uid;
    if (favorite.reservedByAgentId) return favorite.reservedByAgentId === user?.uid;
    return true;
  };

  const updateProspecting = async (listingId: string, action: 'remove' | 'retry') => {
    if (!user) return;
    if (action === 'retry') setPhoneRetryListingId(listingId);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/prospecting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, action }),
      });
      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        phoneExtractionMessage?: string;
      };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut actualiza Prospectarea.');
      if (action === 'retry') {
        toast({
          title: 'Preluare relansata',
          description: payload.phoneExtractionMessage || 'Telefonul va fi reincercat automat.',
        });
      } else {
        toast({
          title: 'Scos din Prospectare',
          description: 'Istoricul si statusurile anuntului au fost pastrate.',
        });
      }
    } catch (error) {
      toast({
        title: 'Actualizare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut actualiza Prospectarea.',
        variant: 'destructive',
      });
    } finally {
      if (action === 'retry') setPhoneRetryListingId(null);
    }
  };

  const handleToggleFavorite = (listing: OwnerListing) => {
    if (!agencyId) {
      toast({ title: 'Agentia nu este disponibila', description: 'Mai incearca dupa ce se incarca profilul agentiei.' });
      return;
    }
    void updateProspecting(listing.id, 'remove');
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

  const handleImport = async (listing: OwnerListing) => {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru import.' });
      return;
    }

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
          ownerPhone: listing.ownerPhone || '',
          sourceDescription: listing.description || '',
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Importul anuntului a esuat.');
      }

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

  const handleSaveFavorite = (listingId: string, updates: Partial<OwnerListingFavorite>) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listingId);
    updateDocumentNonBlocking(favoriteRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.uid ?? null,
    });
  };

  const handleSetReserved = (listingId: string) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listingId);
    const timestamp = new Date().toISOString();
    const existingFavorite = favorites?.find((entry) => entry.ownerListingId === listingId);
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    updateDocumentNonBlocking(favoriteRef, {
      isFavoriteActive: true,
      wasRemovedFromFavorites: existingFavorite?.wasRemovedFromFavorites ?? false,
      removedAt: null,
      removedBy: null,
      removedByName: null,
      reservedByAgentId: user?.uid ?? null,
      reservedByAgentName: currentAgentName,
      reservedAt: timestamp,
      takenByAgentId: null,
      takenByAgentName: null,
      takenAt: null,
      contactOutcome: null,
      contactOutcomeAt: null,
      contactOutcomeByAgentId: null,
      contactOutcomeByAgentName: null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Status actualizat', description: 'Anuntul este marcat ca rezervat.' });
  };

  const handleSetTaken = (listingId: string) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listingId);
    const timestamp = new Date().toISOString();
    const existingFavorite = favorites?.find((entry) => entry.ownerListingId === listingId);
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    updateDocumentNonBlocking(favoriteRef, {
      isFavoriteActive: true,
      reservedByAgentId: existingFavorite?.reservedByAgentId ?? user?.uid ?? null,
      reservedByAgentName: existingFavorite?.reservedByAgentName ?? currentAgentName,
      reservedAt: existingFavorite?.reservedAt ?? timestamp,
      takenByAgentId: user?.uid ?? null,
      takenByAgentName: currentAgentName,
      takenAt: timestamp,
      contactOutcome: null,
      contactOutcomeAt: null,
      contactOutcomeByAgentId: null,
      contactOutcomeByAgentName: null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Lead preluat', description: 'Anuntul este marcat ca preluat de agent.' });
  };

  const handleSetOutcome = (listingId: string, outcome: 'negative' | 'follow_up') => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listingId);
    const timestamp = new Date().toISOString();
    const existingFavorite = favorites?.find((entry) => entry.ownerListingId === listingId);
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    updateDocumentNonBlocking(favoriteRef, {
      isFavoriteActive: true,
      takenByAgentId: null,
      takenByAgentName: null,
      takenAt: null,
      contactOutcome: outcome,
      contactOutcomeAt: timestamp,
      contactOutcomeByAgentId: user?.uid ?? null,
      contactOutcomeByAgentName: currentAgentName,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({
      title: 'Status actualizat',
      description: outcome === 'negative' ? 'Anuntul a fost marcat negativ.' : 'Anuntul a fost trecut in follow-up.',
    });
  };

  if (isAgencyLoading || isFavoriteListingsLoading || isFavoritesLoading) {
    return (
      <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
        <OwnerListingHeader
          title="Prospectare"
          subtitle="Pregatim proprietatile selectate si statusurile numerelor de telefon."
          currentScopeLabel={currentScope?.displayName}
          activeTab="prospecting"
          favoriteCount={activeFavorites.length}
          adminClassic={isClassicTheme}
        />
        <OlxConnectionBanner adminClassic={isClassicTheme} />
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
    <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Prospectare"
        subtitle="Proprietatile selectate de agent, cu preluarea automata a numerelor OLX, status de colaborare, comision si notite."
        currentScopeLabel={currentScope?.displayName}
        activeTab="prospecting"
        favoriteCount={favoriteEntries.length}
        adminClassic={isClassicTheme}
      />
      <OlxConnectionBanner adminClassic={isClassicTheme} />

      {favoriteEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {favoriteEntries.map(({ favorite, listing }) => (
            <div key={favorite.id} className="space-y-3">
              <OwnerListingCard
                listing={{ ...listing, ownerPhone: favorite.ownerPhone || listing.ownerPhone }}
                adminClassic={isClassicTheme}
                favoriteMeta={favorite}
                currentAgentId={user?.uid ?? null}
                currentTimestamp={currentTimestamp}
                isFavorite
                onImport={handleImport}
                onToggleFavorite={handleToggleFavorite}
                onSetReserved={() => handleSetReserved(listing.id)}
                onSetTaken={() => handleSetTaken(listing.id)}
                onSetOutcome={(selectedListing, outcome) => handleSetOutcome(selectedListing.id, outcome)}
                collaborationStatus={favorite.collaborationStatus ?? null}
                collaborationMode="interactive"
                onSetCollaborationStatus={handleSetCollaborationStatus}
                isLoadingImport={isLoadingImport === listing.id}
              />
              {!listing.ownerPhone &&
              ['failed', 'unavailable', 'awaiting_connection'].includes(
                favorite.phoneExtractionStatus || ''
              ) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full"
                  disabled={phoneRetryListingId === listing.id}
                  onClick={() => void updateProspecting(listing.id, 'retry')}
                >
                  {phoneRetryListingId === listing.id
                    ? 'Relansam preluarea...'
                    : 'Reincearca preluarea telefonului'}
                </Button>
              ) : null}
              <OwnerListingFavoriteEditor favorite={favorite} onSave={(updates) => handleSaveFavorite(listing.id, updates)} />
            </div>
          ))}
        </div>
      ) : favoriteListingsError || favoritesError ? (
        <div className="rounded-[1.75rem] border border-red-300/25 bg-red-950/20 px-6 py-14 text-center text-white/78">
          <p className="text-lg font-semibold text-white">Prospectarea nu a putut fi incarcata.</p>
          <p className="mt-2 text-sm text-white/65">
            {favoriteListingsError || favoritesError?.message || 'A aparut o eroare temporara.'}
          </p>
          <Button type="button" onClick={() => setFavoriteReloadKey((value) => value + 1)} className="mt-5 rounded-full">
            Incearca din nou
          </Button>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-white/20 bg-white/8 px-6 py-14 text-center text-white/78">
          <p className="text-lg font-semibold text-white">Nu ai anunturi in Prospectare inca.</p>
          <p className="mt-2 text-sm text-white/60">
            Din pagina Anunturi de la proprietari, selecteaza anunturile pe care vrei sa le contactezi.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/owner-listings">Mergi la Anunturi de la proprietari</Link>
          </Button>
        </div>
      )}

      {missingFavoriteListingsCount > 0 ? (
        <p className="text-center text-sm text-white/60">
          {missingFavoriteListingsCount} anunturi din Prospectare nu mai exista in inventar si nu pot fi afisate.
        </p>
      ) : null}

      <AddPropertyDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} property={propertyToImport as Property | null} />
    </div>
  );
}
