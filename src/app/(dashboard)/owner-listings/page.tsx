'use client';

import { useEffect, useMemo, useState } from 'react';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { OwnerListingCard } from '@/components/owner-listings/owner-listing-card';
import { OwnerListingHeader } from '@/components/owner-listings/owner-listing-header';
import type { OwnerListing, OwnerListingFavorite, PropertyTypeFilter, SourceFilterValue } from '@/components/owner-listings/types';
import {
  extractPrice,
  extractRoomsValue,
  matchesPropertyType,
  matchesSourceFilter,
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
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type { Property } from '@/lib/types';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { Filter } from 'lucide-react';

const LISTINGS_PER_PAGE = 100;

export default function OwnerListingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roomsFilter, setRoomsFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyTypeFilter>('apartamente');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency, agencyId } = useAgency();
  const currentScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);

  const ownerListingsQuery = useMemoFirebase(() => query(collection(firestore, 'ownerListings'), orderBy('firstDiscoveredAt', 'desc')), [firestore]);
  const favoritesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'ownerListingFavorites'), orderBy('updatedAt', 'desc')) : null),
    [agencyId, firestore],
  );

  const { data: listings, isLoading } = useCollection<OwnerListing>(ownerListingsQuery);
  const { data: favorites } = useCollection<OwnerListingFavorite>(favoritesQuery);

  const favoritesByListingId = useMemo(() => {
    const map = new Map<string, OwnerListingFavorite>();
    for (const favorite of favorites ?? []) {
      map.set(favorite.ownerListingId, favorite);
    }
    return map;
  }, [favorites]);

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

    if (currentScope) {
      result = result.filter((listing) => listing.scopeKey === currentScope.key);
    }

    result = result.filter((listing) => matchesSourceFilter(listing, sourceFilter));

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

    if (roomsFilter !== 'all') {
      result = result.filter((listing) => extractRoomsValue(listing.rooms) === Number(roomsFilter));
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
  }, [currentScope, listings, priceMax, priceMin, propertyTypeFilter, roomsFilter, searchQuery, sourceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roomsFilter, propertyTypeFilter, priceMin, priceMax, sourceFilter, currentScope?.key]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / LISTINGS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * LISTINGS_PER_PAGE;
    return filteredListings.slice(startIndex, startIndex + LISTINGS_PER_PAGE);
  }, [filteredListings, safeCurrentPage]);

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

    if (existingFavorite) {
      deleteDocumentNonBlocking(favoriteRef);
      toast({ title: 'Scos din Favorite', description: 'Anuntul nu mai apare in lista de contact manual.' });
      return;
    }

    const timestamp = new Date().toISOString();
    setDocumentNonBlocking(
      favoriteRef,
      {
        ownerListingId: listing.id,
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

  const FilterControls = () => (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="mb-2 block font-semibold">Cautare</Label>
        <Input placeholder="Cauta dupa titlu, zona, telefon sau pret" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
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
        <Label className="mb-2 block font-semibold">Tip proprietate</Label>
        <Select value={propertyTypeFilter} onValueChange={(value) => setPropertyTypeFilter(value as PropertyTypeFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartamente">Apartamente</SelectItem>
            <SelectItem value="case">Case</SelectItem>
            <SelectItem value="terenuri">Terenuri</SelectItem>
            <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block font-semibold">Numar camere</Label>
        <Select value={roomsFilter} onValueChange={setRoomsFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            {[1, 2, 3, 4].map((room) => (
              <SelectItem key={room} value={String(room)}>
                {room} camere
              </SelectItem>
            ))}
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
        favoriteCount={favorites?.length ?? 0}
        listingCount={null}
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
        favoriteCount={favorites?.length ?? 0}
        listingCount={filteredListings.length}
      />

      <div className="sticky top-20 z-20 hidden md:block">
        <div className="rounded-[1.75rem] border border-white/50 bg-white/82 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl md:flex md:flex-wrap md:items-center md:gap-4">
          <Input
            placeholder="Cauta dupa titlu, zona, telefon sau pret"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-12 w-full max-w-md rounded-2xl border-slate-200/80 bg-white/90 text-base"
          />

          <div className="flex gap-2">
            <Select value={sourceFilter ?? 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? null : (value as SourceFilterValue))}>
              <SelectTrigger className="h-12 w-[180px] rounded-2xl border-slate-200/80 bg-white/90 text-base">
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
              <SelectTrigger className="h-12 w-[190px] rounded-2xl border-slate-200/80 bg-white/90 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamente">Apartamente</SelectItem>
                <SelectItem value="case">Case</SelectItem>
                <SelectItem value="terenuri">Terenuri</SelectItem>
                <SelectItem value="spatii-comerciale">Spatii comerciale</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger className="h-12 w-[160px] rounded-2xl border-slate-200/80 bg-white/90 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                {[1, 2, 3, 4].map((room) => (
                  <SelectItem key={room} value={String(room)}>
                    {room} camere
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Pret minim" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} className="w-32" />
            <Input placeholder="Pret maxim" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} className="w-32" />
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="mr-2 h-4 w-4" /> Filtreaza anunturi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="pb-4 text-left">
              <SheetTitle>Filtre</SheetTitle>
            </SheetHeader>
            <FilterControls />
            <SheetFooter className="pt-6">
              <Button onClick={() => setIsSheetOpen(false)} className="w-full">
                Vezi {filteredListings.length} anunturi
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredListings.length > 0 ? (
          paginatedListings.map((listing, index) => {
            const favorite = favoritesByListingId.get(listing.id);
            return (
              <OwnerListingCard
                key={listing.id || index}
                listing={listing}
                onImport={handleImport}
                onToggleFavorite={handleToggleFavorite}
                isFavorite={Boolean(favorite)}
                collaborationStatus={favorite?.collaborationStatus ?? null}
                collaborationMode={favorite?.collaborationStatus ? 'readonly' : 'hidden'}
                isLoadingImport={isLoadingImport === listing.id}
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
    </div>
  );
}
