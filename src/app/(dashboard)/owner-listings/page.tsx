'use client';

import { useEffect, useMemo, useState } from 'react';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { AiOutreachCallModal } from '@/components/ai-outreach/ai-outreach-call-modal';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import type { OwnerListing, OwnerListingFavorite, PropertyTypeFilter, SourceFilterValue, TransactionTypeFilter } from '@/components/owner-listings/types';
import {
  extractPrice,
  extractRoomsValue,
  matchesPropertyType,
  matchesSourceFilter,
  matchesTransactionType,
  normalizeDigits,
  normalizeText,
} from '@/components/owner-listings/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { getAgencyThemePreset } from '@/lib/theme';
import { listOwnerListingScopes, matchesScopeLocation, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { Filter, RotateCcw } from 'lucide-react';
import type { AiOutreachCall, AiOutreachOutcome } from '@/lib/ai-outreach/types';

const LISTINGS_PER_PAGE = 100;
const RESERVATION_TTL_MS = 4 * 60 * 60 * 1000;
type AiStatusFilter = 'all' | 'uncalled' | AiOutreachOutcome;

export default function OwnerListingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roomsFilter, setRoomsFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeFilter>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionTypeFilter>('all');
  const [constructionYearFilter, setConstructionYearFilter] = useState<string>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue | null>(null);
  const [aiStatusFilter, setAiStatusFilter] = useState<AiStatusFilter>('all');
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>('');
  const [hasSelectedScopeManually, setHasSelectedScopeManually] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [selectedAiListing, setSelectedAiListing] = useState<OwnerListing | null>(null);
  const [localAiCalls, setLocalAiCalls] = useState<AiOutreachCall[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency, agencyId, userProfile } = useAgency();
  const isClassicTheme = getAgencyThemePreset(agency) === 'classic';
  const agencyDefaultScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);
  const scopeOptions = useMemo(() => listOwnerListingScopes(), []);
  const currentScope = useMemo(
    () => scopeOptions.find((scope) => scope.key === selectedScopeKey) || agencyDefaultScope || scopeOptions[0] || null,
    [agencyDefaultScope, scopeOptions, selectedScopeKey],
  );
  const currentAgentName = userProfile?.name || user?.displayName || user?.email || 'Agent neatribuit';

  const ownerListingsQuery = useMemoFirebase(() => query(collection(firestore, 'ownerListings'), orderBy('firstDiscoveredAt', 'desc')), [firestore]);
  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites'), orderBy('updatedAt', 'desc')) : null),
    [agencyId, firestore],
  );
  const aiCallsQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'aiOutreachCalls'), orderBy('createdAt', 'desc')) : null),
    [agencyId, firestore],
  );

  const { data: listings, isLoading } = useCollection<OwnerListing>(ownerListingsQuery);
  const { data: favorites } = useCollection<OwnerListingFavorite>(favoritesQuery);
  const { data: aiCalls } = useCollection<AiOutreachCall>(aiCallsQuery);

  useEffect(() => {
    if (hasSelectedScopeManually) return;
    if (agencyDefaultScope?.key) {
      setSelectedScopeKey(agencyDefaultScope.key);
      return;
    }

    if (!selectedScopeKey && scopeOptions[0]?.key) {
      setSelectedScopeKey(scopeOptions[0].key);
    }
  }, [agencyDefaultScope?.key, hasSelectedScopeManually, scopeOptions, selectedScopeKey]);

  const favoritesByListingId = useMemo(() => {
    const map = new Map<string, OwnerListingFavorite>();
    for (const favorite of favorites ?? []) {
      map.set(favorite.ownerListingId, favorite);
    }
    return map;
  }, [favorites]);

  const aiCallsByListingId = useMemo(() => {
    const map = new Map<string, AiOutreachCall>();
    for (const call of [...localAiCalls, ...(aiCalls ?? [])]) {
      const existing = map.get(call.ownerListingId);
      if (!existing || new Date(call.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        map.set(call.ownerListingId, call);
      }
    }
    return map;
  }, [aiCalls, localAiCalls]);

  const validFavoriteCount = useMemo(() => {
    if (!Array.isArray(listings) || !Array.isArray(favorites)) return 0;

    const validListingIds = new Set(
      listings.filter((listing) => !currentScope || listing.scopeKey === currentScope.key).map((listing) => listing.id),
    );

    return favorites.filter((favorite) => favorite.isFavoriteActive !== false && validListingIds.has(favorite.ownerListingId)).length;
  }, [currentScope, favorites, listings]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

    if (currentScope) {
      result = result.filter((listing) => listing.scopeKey === currentScope.key);
      if (currentScope.key === 'iasi') {
        result = result.filter((listing) =>
          matchesScopeLocation(currentScope, [listing.location, listing.title, listing.description].join(' '))
        );
      }
    }

    result = result.filter((listing) => matchesSourceFilter(listing, sourceFilter));

    if (aiStatusFilter !== 'all') {
      result = result.filter((listing) => {
        const latestCall = aiCallsByListingId.get(listing.id);
        const outcome = latestCall?.outcome || 'uncalled';
        return outcome === aiStatusFilter;
      });
    }

    const normalizedSearchQuery = normalizeText(searchQuery);
    const numericSearchQuery = normalizeDigits(searchQuery);

    if (normalizedSearchQuery) {
      const searchTerms = normalizedSearchQuery.split(' ').filter(Boolean);
      result = result.filter((listing) => {
        const numericPrice = extractPrice(listing.price);
        const searchableText = normalizeText(
          [listing.title, listing.location, listing.ownerPhone, listing.price, numericPrice !== null ? String(numericPrice) : ''].join(' '),
        );
        const searchableDigits = [normalizeDigits(listing.ownerPhone), normalizeDigits(listing.price), numericPrice !== null ? String(numericPrice) : '']
          .filter(Boolean)
          .join(' ');

        const matchesText = searchTerms.every((term) => searchableText.includes(term));
        const matchesDigits = numericSearchQuery ? searchableDigits.includes(numericSearchQuery) : false;
        return matchesText || matchesDigits;
      });
    }

    result = result.filter((listing) => matchesPropertyType(listing, propertyTypeFilter));
    result = result.filter((listing) => matchesTransactionType(listing, transactionTypeFilter));

    if (roomsFilter !== 'all') {
      result = result.filter((listing) => extractRoomsValue(listing.rooms) === Number(roomsFilter));
    }

    if (constructionYearFilter !== 'all') {
      result = result.filter((listing) => {
        const year = Number(listing.constructionYear);
        if (!Number.isFinite(year)) return false;

        if (constructionYearFilter === '1977-1990') {
          return year >= 1977 && year <= 1990;
        }

        if (constructionYearFilter === '1990-2000') {
          return year >= 1990 && year <= 2000;
        }

        if (constructionYearFilter === 'after-2000') {
          return year > 2000;
        }

        return true;
      });
    }

    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    if (min !== null || max !== null) {
      result = result.filter((listing) => {
        const price = extractPrice(listing.price);
        if (!price) return false;
        if (min !== null && price < min) return false;
        if (max !== null && price > max) return false;
        return true;
      });
    }

    result.sort((left, right) => {
      const leftFirstSeen = left.firstDiscoveredAt || 0;
      const rightFirstSeen = right.firstDiscoveredAt || 0;
      if (rightFirstSeen !== leftFirstSeen) {
        return rightFirstSeen - leftFirstSeen;
      }

      return (right.postedAt || 0) - (left.postedAt || 0);
    });

    return result;
  }, [aiCallsByListingId, aiStatusFilter, constructionYearFilter, currentScope, listings, priceMax, priceMin, propertyTypeFilter, roomsFilter, searchQuery, sourceFilter, transactionTypeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roomsFilter, propertyTypeFilter, transactionTypeFilter, constructionYearFilter, priceMin, priceMax, sourceFilter, aiStatusFilter, currentScope?.key]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / LISTINGS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * LISTINGS_PER_PAGE;
    return filteredListings.slice(startIndex, startIndex + LISTINGS_PER_PAGE);
  }, [filteredListings, safeCurrentPage]);

  const resetFilters = () => {
    setSearchQuery('');
    setRoomsFilter('all');
    setPropertyTypeFilter('all');
    setTransactionTypeFilter('all');
    setConstructionYearFilter('all');
    setPriceMin('');
    setPriceMax('');
    setSourceFilter(null);
    setAiStatusFilter('all');
  };

  const handleScopeChange = (value: string) => {
    setSelectedScopeKey(value);
    setHasSelectedScopeManually(true);
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

  const handleToggleFavorite = (listing: OwnerListing) => {
    if (!agencyId) {
      toast({ title: 'Agentia nu este disponibila', description: 'Mai incearca dupa ce se incarca profilul agentiei.' });
      return;
    }

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id);
    const existingFavorite = favoritesByListingId.get(listing.id);

    if (existingFavorite?.isFavoriteActive !== false && existingFavorite) {
      updateDocumentNonBlocking(favoriteRef, {
        isFavoriteActive: false,
        wasRemovedFromFavorites: true,
        removedAt: new Date().toISOString(),
        removedBy: user?.uid ?? null,
        removedByName: currentAgentName,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid ?? null,
      });
      toast({ title: 'Scos din Favorite', description: 'Anuntul a fost scos, dar istoricul si statusul au fost pastrate.' });
      return;
    }

    const timestamp = new Date().toISOString();
    if (existingFavorite) {
      updateDocumentNonBlocking(favoriteRef, {
        isFavoriteActive: true,
        wasRemovedFromFavorites: existingFavorite.wasRemovedFromFavorites ?? true,
        removedAt: null,
        removedBy: null,
        removedByName: null,
        updatedAt: timestamp,
        updatedBy: user?.uid ?? null,
      });
      toast({ title: 'Readaugat in Favorite', description: 'Anuntul a fost reactivat in Favorite cu istoricul anterior pastrat.' });
      return;
    }

    setDocumentNonBlocking(
      favoriteRef,
      {
        ownerListingId: listing.id,
        isFavoriteActive: true,
        wasRemovedFromFavorites: false,
        removedAt: null,
        removedBy: null,
        removedByName: null,
        reservedByAgentId: user?.uid ?? null,
        reservedByAgentName: currentAgentName,
        reservedAt: timestamp,
        calledByAgentId: null,
        calledByAgentName: null,
        calledAt: null,
        takenByAgentId: null,
        takenByAgentName: null,
        takenAt: null,
        contactOutcome: null,
        contactOutcomeAt: null,
        contactOutcomeByAgentId: null,
        contactOutcomeByAgentName: null,
        collaborationStatus: null,
        commissionValue: '',
        propertyAddress: '',
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user?.uid ?? null,
        updatedBy: user?.uid ?? null,
      },
      {},
    );

    toast({ title: 'Adaugat in Favorite', description: 'Anuntul este pregatit pentru urmarire in pagina Favorite.' });
  };

  const upsertFavoriteBase = (listing: OwnerListing) => {
    if (!agencyId) return;

    const favoriteRef = doc(firestore, 'agencies', agencyId, 'ownerListingFavorites', listing.id);
    const timestamp = new Date().toISOString();
    const existingFavorite = favoritesByListingId.get(listing.id);
    return { favoriteRef, timestamp, existingFavorite };
  };

  const writeFavoriteStatus = (favoriteRef: ReturnType<typeof doc>, existingFavorite: OwnerListingFavorite | undefined, data: Record<string, unknown>) => {
    if (existingFavorite) {
      updateDocumentNonBlocking(favoriteRef, data);
      return;
    }

    setDocumentNonBlocking(
      favoriteRef,
      {
        ownerListingId: String(data.ownerListingId ?? ''),
        collaborationStatus: null,
        commissionValue: '',
        propertyAddress: '',
        notes: '',
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        createdBy: data.createdBy ?? user?.uid ?? null,
        updatedAt: String(data.updatedAt ?? new Date().toISOString()),
        updatedBy: data.updatedBy ?? user?.uid ?? null,
        ...data,
      },
      {},
    );
  };

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

  const handleSetReserved = (listing: OwnerListing) => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
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
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Status actualizat', description: 'Anuntul este marcat ca rezervat.' });
  };

  const handleSetTaken = (listing: OwnerListing) => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
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
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({ title: 'Lead preluat', description: 'Anuntul este marcat ca preluat de agent.' });
  };

  const handleSetOutcome = (listing: OwnerListing, outcome: 'negative' | 'follow_up') => {
    const base = upsertFavoriteBase(listing);
    if (!base) return;

    const { favoriteRef, timestamp, existingFavorite } = base;
    if (!canCurrentAgentUpdateStatus(existingFavorite)) {
      toast({ title: 'Status blocat', description: 'Acest anunt este deja lucrat de alt agent din agentie.', variant: 'destructive' });
      return;
    }
    writeFavoriteStatus(favoriteRef, existingFavorite, {
      ownerListingId: listing.id,
      reservedByAgentId: existingFavorite?.reservedByAgentId ?? user?.uid ?? null,
      reservedByAgentName: existingFavorite?.reservedByAgentName ?? currentAgentName,
      reservedAt: existingFavorite?.reservedAt ?? timestamp,
      takenByAgentId: null,
      takenByAgentName: null,
      takenAt: null,
      contactOutcome: outcome,
      contactOutcomeAt: timestamp,
      contactOutcomeByAgentId: user?.uid ?? null,
      contactOutcomeByAgentName: currentAgentName,
      collaborationStatus: existingFavorite?.collaborationStatus ?? null,
      commissionValue: existingFavorite?.commissionValue ?? '',
      propertyAddress: existingFavorite?.propertyAddress ?? '',
      notes: existingFavorite?.notes ?? '',
      createdAt: existingFavorite?.createdAt ?? timestamp,
      createdBy: existingFavorite?.createdBy ?? user?.uid ?? null,
      updatedAt: timestamp,
      updatedBy: user?.uid ?? null,
    });
    toast({
      title: 'Status actualizat',
      description: outcome === 'negative' ? 'Anuntul a fost marcat negativ.' : 'Anuntul a fost trecut in follow-up.',
    });
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="mb-2 block font-semibold">Cautare</Label>
        <Input placeholder="Cauta dupa titlu, zona, telefon sau pret" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Locatie</Label>
        <Select value={currentScope?.key || selectedScopeKey} onValueChange={handleScopeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((scope) => (
              <SelectItem key={scope.key} value={scope.key}>
                {scope.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Sursa</Label>
        <Select value={sourceFilter ?? 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? null : (value as SourceFilterValue))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate sursele</SelectItem>
            <SelectItem value="olx">OLX</SelectItem>
            <SelectItem value="imoradar24">Imoradar24</SelectItem>
            <SelectItem value="publi24">Publi24</SelectItem>
            <SelectItem value="imobiliare">Imobiliare.ro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Status AI</Label>
        <Select value={aiStatusFilter} onValueChange={(value) => setAiStatusFilter(value as AiStatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate statusurile AI</SelectItem>
            <SelectItem value="uncalled">Nesunate</SelectItem>
            <SelectItem value="queued">AI in asteptare</SelectItem>
            <SelectItem value="calling">In apel</SelectItem>
            <SelectItem value="collaborates">Colaboreaza</SelectItem>
            <SelectItem value="does_not_collaborate">Nu colaboreaza</SelectItem>
            <SelectItem value="call_later">Revino</SelectItem>
            <SelectItem value="no_answer">Nu a raspuns</SelectItem>
            <SelectItem value="invalid_number">Numar invalid</SelectItem>
            <SelectItem value="do_not_call">Nu mai suna</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Categorie</Label>
        <Select value={propertyTypeFilter} onValueChange={(value) => setPropertyTypeFilter(value as PropertyTypeFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate proprietatile</SelectItem>
            <SelectItem value="apartamente">Apartamente</SelectItem>
            <SelectItem value="case">Case</SelectItem>
            <SelectItem value="terenuri">Terenuri</SelectItem>
            <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Tranzactie</Label>
        <Select value={transactionTypeFilter} onValueChange={(value) => setTransactionTypeFilter(value as TransactionTypeFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vanzare si inchiriere</SelectItem>
            <SelectItem value="sale">Vanzare</SelectItem>
            <SelectItem value="rent">Inchiriere</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Nr. camere</Label>
        <Select value={roomsFilter} onValueChange={setRoomsFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Nr. camere</SelectItem>
            {[1, 2, 3, 4].map((room) => (
              <SelectItem key={room} value={String(room)}>
                {room} camere
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">An constructie</Label>
        <Select value={constructionYearFilter} onValueChange={setConstructionYearFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">An constructie</SelectItem>
            <SelectItem value="1977-1990">1977-1990</SelectItem>
            <SelectItem value="1990-2000">1990-2000</SelectItem>
            <SelectItem value="after-2000">Dupa 2000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Pret</Label>
        <div className="flex gap-2">
          <Input placeholder="Pret minim" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
          <Input placeholder="Pret maxim" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
        </div>
      </div>

    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Anunturi de la proprietari"
        subtitle="Incarcam lista de proprietati si pregatim filtrele."
        currentScopeLabel={currentScope?.displayName}
        activeTab="listings"
        favoriteCount={validFavoriteCount}
        listingCount={null}
        adminClassic={isClassicTheme}
      />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="space-y-3 p-4">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-3 pb-6 pt-2 sm:px-4 sm:pt-3 xl:px-5">
      <OwnerListingHeader
        title="Anunturi de la proprietari"
        subtitle=""
        currentScopeLabel={currentScope?.displayName}
        activeTab="listings"
        favoriteCount={validFavoriteCount}
        listingCount={filteredListings.length}
        adminClassic={isClassicTheme}
      />

      <div className="sticky top-20 z-20 hidden md:block">
        <div
          className={cn(
            "rounded-[1.75rem] p-5 backdrop-blur-xl",
            isClassicTheme
              ? "border border-white/8 bg-[#152A47] text-white shadow-2xl"
              : "border border-white/50 bg-white/82 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)]",
          )}
        >
          <div className="grid grid-cols-[minmax(220px,1fr)_160px_136px_164px_148px_124px_144px_96px_96px_44px] items-center gap-2">
            <Input
              placeholder="Cauta dupa titlu, zona, telefon sau pret"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={cn(
                "h-12 min-w-0 rounded-2xl text-base",
                isClassicTheme
                  ? "border-white/20 bg-white/10 text-white placeholder:text-white/55"
                  : "border-slate-200/80 bg-white/90",
              )}
            />

            <Select value={currentScope?.key || selectedScopeKey} onValueChange={handleScopeChange}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="Locatie" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((scope) => (
                  <SelectItem key={scope.key} value={scope.key}>
                    {scope.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter ?? 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? null : (value as SourceFilterValue))}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate sursele</SelectItem>
                <SelectItem value="olx">OLX</SelectItem>
                <SelectItem value="imoradar24">Imoradar24</SelectItem>
                <SelectItem value="publi24">Publi24</SelectItem>
                <SelectItem value="imobiliare">Imobiliare.ro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={propertyTypeFilter} onValueChange={(value) => setPropertyTypeFilter(value as PropertyTypeFilter)}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate proprietatile</SelectItem>
                <SelectItem value="apartamente">Apartamente</SelectItem>
                <SelectItem value="case">Case</SelectItem>
                <SelectItem value="terenuri">Terenuri</SelectItem>
                <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
              </SelectContent>
            </Select>

            <Select value={transactionTypeFilter} onValueChange={(value) => setTransactionTypeFilter(value as TransactionTypeFilter)}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vanzare + chirie</SelectItem>
                <SelectItem value="sale">Vanzare</SelectItem>
                <SelectItem value="rent">Inchiriere</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Nr. camere</SelectItem>
                {[1, 2, 3, 4].map((room) => (
                  <SelectItem key={room} value={String(room)}>
                    {room} camere
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={constructionYearFilter} onValueChange={setConstructionYearFilter}>
              <SelectTrigger className={cn("h-12 min-w-0 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="An constructie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">An constructie</SelectItem>
                <SelectItem value="1977-1990">1977-1990</SelectItem>
                <SelectItem value="1990-2000">1990-2000</SelectItem>
                <SelectItem value="after-2000">Dupa 2000</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Min"
              type="number"
              value={priceMin}
              onChange={(event) => setPriceMin(event.target.value)}
              className={cn("h-12 min-w-0 rounded-2xl", isClassicTheme ? "border-white/20 bg-white/10 text-white placeholder:text-white/55" : "border-slate-200/80 bg-white/90")}
            />
            <Input
              placeholder="Max"
              type="number"
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value)}
              className={cn("h-12 min-w-0 rounded-2xl", isClassicTheme ? "border-white/20 bg-white/10 text-white placeholder:text-white/55" : "border-slate-200/80 bg-white/90")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={resetFilters}
              aria-label="Reseteaza filtrele"
              className={cn(
                "h-12 w-11 rounded-2xl",
                isClassicTheme
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  : "border-slate-200/80 bg-white/90 text-slate-700 hover:bg-white",
              )}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex max-w-xs items-center gap-2">
            <Select value={aiStatusFilter} onValueChange={(value) => setAiStatusFilter(value as AiStatusFilter)}>
              <SelectTrigger className={cn("h-11 rounded-2xl text-sm", isClassicTheme ? "border-white/20 bg-white/10 text-white" : "border-slate-200/80 bg-white/90")}>
                <SelectValue placeholder="Status AI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile AI</SelectItem>
                <SelectItem value="uncalled">Nesunate</SelectItem>
                <SelectItem value="queued">AI in asteptare</SelectItem>
                <SelectItem value="calling">In apel</SelectItem>
                <SelectItem value="collaborates">Colaboreaza</SelectItem>
                <SelectItem value="does_not_collaborate">Nu colaboreaza</SelectItem>
                <SelectItem value="call_later">Revino</SelectItem>
                <SelectItem value="no_answer">Nu a raspuns</SelectItem>
                <SelectItem value="invalid_number">Numar invalid</SelectItem>
                <SelectItem value="do_not_call">Nu mai suna</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="min-w-0 flex-1">
              <Filter className="mr-2 h-4 w-4" /> Filtreaza anunturi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-2xl p-0">
            <SheetHeader className="shrink-0 px-6 pb-4 pt-6 text-left">
              <SheetTitle>Filtre</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              <FilterControls />
            </div>
            <SheetFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button onClick={() => setIsSheetOpen(false)} className="w-full">
                Vezi {filteredListings.length} anunturi
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Button type="button" variant="outline" size="icon" onClick={resetFilters} aria-label="Reseteaza filtrele" className="shrink-0">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredListings.length > 0 ? (
          paginatedListings.map((listing, index) => {
            const favorite = favoritesByListingId.get(listing.id);
            const latestAiCall = aiCallsByListingId.get(listing.id);
            const listingWithAi = latestAiCall
              ? {
                  ...listing,
                  latestAiCallId: latestAiCall.id,
                  aiOutreachStatus: latestAiCall.status,
                  aiOutreachOutcome: latestAiCall.outcome,
                  aiOutreachUpdatedAt: latestAiCall.updatedAt,
                  aiDoNotCall: latestAiCall.result?.doNotCall,
                }
              : {
                  ...listing,
                  latestAiCallId: undefined,
                  aiOutreachStatus: undefined,
                  aiOutreachOutcome: undefined,
                  aiOutreachUpdatedAt: undefined,
                  aiDoNotCall: undefined,
                };
            return (
              <OwnerListingCard
                key={listing.id || index}
                listing={listingWithAi}
                adminClassic={isClassicTheme}
                favoriteMeta={favorite ?? null}
                currentAgentId={user?.uid ?? null}
                currentTimestamp={currentTimestamp}
                onImport={handleImport}
                onToggleFavorite={handleToggleFavorite}
                onSetReserved={handleSetReserved}
                onSetTaken={handleSetTaken}
                onSetOutcome={handleSetOutcome}
                isFavorite={favorite?.isFavoriteActive !== false && Boolean(favorite)}
                collaborationStatus={favorite?.collaborationStatus ?? null}
                collaborationMode={favorite?.collaborationStatus ? 'readonly' : 'hidden'}
                isLoadingImport={isLoadingImport === listing.id}
                onAiBadgeClick={setSelectedAiListing}
              />
            );
          })
        ) : (
          <div className="col-span-full py-10 text-center">
            <p className="text-muted-foreground">Niciun anunt gasit.</p>
          </div>
        )}
      </div>

      {filteredListings.length > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage === 1}>
            Anterioara
          </Button>
          <span className="text-sm text-white/75">
            Pagina {safeCurrentPage} din {totalPages}
          </span>
          <Button variant="outline" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages}>
            Urmatoare
          </Button>
        </div>
      ) : null}

      <AddPropertyDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} property={propertyToImport as Property | null} />
      <AiOutreachCallModal
        open={Boolean(selectedAiListing)}
        onOpenChange={(open) => !open && setSelectedAiListing(null)}
        listing={selectedAiListing}
        latestCall={selectedAiListing ? aiCallsByListingId.get(selectedAiListing.id) ?? null : null}
        onCallCreated={(call) => setLocalAiCalls((current) => [call, ...current.filter((item) => item.id !== call.id)])}
      />
    </div>
  );
}
