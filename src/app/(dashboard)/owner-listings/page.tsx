'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Clock, Home, BedDouble, Filter, Loader2, Calendar, RefreshCw, Ruler, Rocket } from 'lucide-react';
import { format, fromUnixTime, formatDistanceToNow, parse } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import type { OwnerListingSource } from '@/lib/owner-listings/types';
import { useAgency } from '@/context/AgencyContext';
import { resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import { Badge } from '@/components/ui/badge';

type OwnerListing = {
  id: string;
  scopeKey?: string;
  scopeCity?: string;
  source: OwnerListingSource;
  sourceLabel: string;
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  rooms?: number | string;
  image?: string;
  imageUrl?: string;
  constructionYear?: number | string;
  year?: number | string;
  description?: string;
  ownerPhone?: string;
};

function extractPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const match = priceStr.replace(/\s/g, '').match(/[\d.]+/);
  if (!match) return null;
  return Number(match[0].replace(/\./g, ''));
}

function formatPriceNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function extractRoomsValue(rooms: number | string | null | undefined): number | null {
  if (typeof rooms === 'number') {
    return Number.isFinite(rooms) ? rooms : null;
  }

  if (typeof rooms !== 'string') {
    return null;
  }

  const match = rooms.match(/\d+/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAreaValue(area: string | null | undefined): string | null {
  if (!area) return null;
  const match = area.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return `${match[0].replace('.', ',')} mp`;
}

function OwnerListingCard({
  listing,
  handleImport,
  isLoadingImport,
}: {
  listing: OwnerListing;
  handleImport: (listing: OwnerListing) => void;
  isLoadingImport: boolean;
}) {
  const calculateTimeAgo = (timestamp: number) => {
    try {
      if (!timestamp || typeof timestamp !== 'number') {
        return 'Data necunoscuta';
      }
      const postDate = fromUnixTime(timestamp);
      let timeAgo = formatDistanceToNow(postDate, { locale: ro });
      timeAgo = timeAgo.replace('circa ', '');
      timeAgo = timeAgo.replace('aproximativ ', '');
      timeAgo = timeAgo.replace('mai putin de un minut', 'un minut');
      return timeAgo.replace('in urma', '').trim();
    } catch {
      return 'Data invalida';
    }
  };

  const locationDisplay = useMemo(() => {
    if (!listing.location) {
      return '';
    }

    if (listing.location.includes(' - Reactualizat azi la ')) {
      const locationPart = listing.location.split(' - Reactualizat azi la ')[0];
      return `${locationPart} - Act. azi`;
    }

    const parts = listing.location.split(' - Reactualizat la ');
    if (parts.length === 2) {
      const locationPart = parts[0];
      const datePart = parts[1];
      try {
        const date = parse(datePart, 'dd MMMM yyyy', new Date(), { locale: ro });
        const formattedDate = format(date, 'dd/MM/yyyy');
        return `${locationPart} - Act. ${formattedDate}`;
      } catch {
        return listing.location.replace('Reactualizat la', 'Act.');
      }
    }

    return listing.location;
  }, [listing.location]);

  const year = listing.constructionYear || listing.year;
  const roomsValue = extractRoomsValue(listing.rooms);
  const areaValue = formatAreaValue(listing.area);

  let displayPrice = 'Pret negociabil';
  if (listing.price) {
    const numericPrice = extractPrice(listing.price);
    if (numericPrice !== null) {
      displayPrice = `EUR ${formatPriceNumber(numericPrice)}`;
    }
  }

  const imageToDisplay =
    listing.imageUrl && listing.imageUrl.startsWith('http')
      ? listing.imageUrl
      : listing.image && listing.image.startsWith('http')
        ? listing.image
        : null;

  return (
    <Card className="agentfinder-owner-listing-card group overflow-hidden rounded-[1.75rem] border-none bg-[#152A47] text-white shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <CardContent className="p-0">
        <div className="relative">
          <Link
            href={listing.link}
            target="_blank"
            rel="noreferrer"
            className="agentfinder-owner-listing-image block aspect-[16/10] relative overflow-hidden rounded-t-[1.75rem] bg-muted"
          >
            {imageToDisplay ? (
              <Image
                src={imageToDisplay}
                alt={listing.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100">
                <Home className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </Link>
          <div className="absolute left-3 top-3">
            <Badge variant="outline" className="bg-white/90 text-black font-semibold border-white/30">
              {listing.sourceLabel}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="min-w-0 flex-1">
              <Link href={listing.link} target="_blank" rel="noreferrer" className="block min-w-0">
                <h3 className="truncate font-semibold text-white group-hover:text-primary/90" title={listing.title}>
                  {listing.title}
                </h3>
                {listing.description ? (
                  <p className="truncate text-sm text-white/70" title={listing.description}>
                    {listing.description}
                  </p>
                ) : null}
                <p className="truncate text-sm text-white/70" title={locationDisplay}>
                  {locationDisplay}
                </p>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap text-[13px] text-white/70">
            {roomsValue !== null ? (
              <div className="flex shrink-0 items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 shrink-0" />
                <span>{roomsValue}</span>
              </div>
            ) : null}

            {areaValue ? (
              <div className="flex shrink-0 items-center gap-1">
                <Ruler className="h-3.5 w-3.5 shrink-0" />
                <span>{areaValue}</span>
              </div>
            ) : null}

            <div className="flex shrink-0 items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{calculateTimeAgo(listing.postedAt)}</span>
            </div>

            {year ? (
              <div className="flex shrink-0 items-center gap-1 text-white/85">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{year}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="min-w-0 flex-1 text-[1.05rem] font-bold leading-none tracking-[-0.01em] text-white sm:text-lg">
              {displayPrice}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="agentfinder-owner-listing-import rounded-full border border-primary/15 bg-[linear-gradient(135deg,rgba(39,66,104,0.95)_0%,rgba(27,52,86,0.98)_100%)] px-4 text-white shadow-[0_18px_38px_-22px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-[linear-gradient(135deg,rgba(46,77,120,0.98)_0%,rgba(31,59,96,1)_100%)]" size="sm" onClick={() => handleImport(listing)} disabled={isLoadingImport}>
                {isLoadingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Importa anuntul
              </Button>
              <Button asChild size="icon" className="agentfinder-owner-listing-link bg-green-500 hover:bg-green-600 text-white">
                <Link href={listing.link} target="_blank">
                  <Rocket className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerListingsPage() {
  const [roomsFilter, setRoomsFilter] = useState<number | null>(null);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sourceFilter, setSourceFilter] = useState<OwnerListingSource | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { agency } = useAgency();
  const currentScope = useMemo(() => resolveAgencyOwnerListingScope(agency), [agency]);

  const ownerListingsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'ownerListings'), orderBy('postedAt', 'desc'));
  }, [currentScope, firestore]);
  const { data: listings, isLoading } = useCollection<OwnerListing>(ownerListingsQuery);

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

    if (currentScope) {
      const scopeTerms = ['bucuresti', 'sector', 'ilfov', 'popesti', 'voluntari', 'otopeni', 'bragadiru', 'chiajna'];
      result = result.filter((listing) => {
        if (listing.scopeKey === currentScope.key) {
          return true;
        }

        const text = `${listing.location || ''} ${listing.title || ''} ${listing.description || ''}`.toLowerCase();
        return scopeTerms.some((term) => text.includes(term));
      });
    }

    if (sourceFilter) {
      result = result.filter((listing) => listing.source === sourceFilter);
    }

    if (roomsFilter !== null) {
      result = result.filter((listing) => extractRoomsValue(listing.rooms) === roomsFilter);
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

    return result;
  }, [currentScope, listings, priceMax, priceMin, roomsFilter, sourceFilter]);

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

  const handleSync = async () => {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru sincronizare.' });
      return;
    }

    if (!currentScope) {
      toast({ title: 'Oras lipsa', description: 'Seteaza orasul agentiei din Setari inainte de sincronizare.' });
      return;
    }

    setIsSyncing(true);
    toast({ title: 'Sincronizare pornita', description: 'Cautam anunturi noi de la proprietari.' });

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/owner-listings/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sources: sourceFilter ? [sourceFilter] : ['olx', 'imoradar24', 'publi24'],
          maxPages: null,
          hardPageLimit: 250,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Sincronizarea a esuat.');
      }

      toast({
        title: 'Sincronizare finalizata',
        description: payload.summary
          ? `Scanate: ${payload.summary.scanned || 0}, salvate: ${payload.summary.stored || 0}, erori: ${payload.summary.errors || 0}.`
          : `Job ${payload.jobId || ''} finalizat.`,
      });
    } catch (error) {
      toast({
        title: 'Sincronizare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut sincroniza anunturile.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="font-semibold mb-3 block">Sursa</Label>
        <div className="flex flex-wrap gap-2">
          <Button variant={sourceFilter === null ? 'default' : 'outline'} onClick={() => setSourceFilter(null)}>Toate</Button>
          <Button variant={sourceFilter === 'olx' ? 'default' : 'outline'} onClick={() => setSourceFilter('olx')}>OLX</Button>
          <Button variant={sourceFilter === 'imoradar24' ? 'default' : 'outline'} onClick={() => setSourceFilter('imoradar24')}>Imoradar24</Button>
          <Button variant={sourceFilter === 'publi24' ? 'default' : 'outline'} onClick={() => setSourceFilter('publi24')}>Publi24</Button>
        </div>
      </div>

      <div>
        <Label className="font-semibold mb-3 block">Numar camere</Label>
        <div className="flex flex-wrap gap-2">
          <Button variant={roomsFilter === null ? 'default' : 'outline'} onClick={() => setRoomsFilter(null)}>Toate</Button>
          {[1, 2, 3, 4].map((room) => (
            <Button key={room} variant={roomsFilter === room ? 'default' : 'outline'} onClick={() => setRoomsFilter(room)}>
              {room} camere
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Pret</Label>
        <div className="flex gap-2">
          <Input placeholder="Pret minim" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
          <Input placeholder="Pret maxim" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="agentfinder-owner-listings-page space-y-6">
        <h1 className="text-xl md:text-3xl font-headline font-bold">Anunturi de la proprietari</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="agentfinder-owner-listing-card space-y-3 p-4">
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
    <div className="agentfinder-owner-listings-page space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-headline font-bold">Anunturi de la proprietari</h1>
          <p className="text-sm text-white/60 mt-1">
            {currentScope ? `Scop activ: ${currentScope.displayName}` : 'Momentan scraping-ul este configurat doar pentru agentii setate pe Bucuresti-Ilfov.'}
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing || !currentScope}>
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizeaza anunturi
        </Button>
      </div>

      <div className="agentfinder-owner-listings-filters hidden md:flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <Button variant={sourceFilter === null ? 'default' : 'outline'} onClick={() => setSourceFilter(null)}>Toate sursele</Button>
          <Button variant={sourceFilter === 'olx' ? 'default' : 'outline'} onClick={() => setSourceFilter('olx')}>OLX</Button>
          <Button variant={sourceFilter === 'imoradar24' ? 'default' : 'outline'} onClick={() => setSourceFilter('imoradar24')}>Imoradar24</Button>
          <Button variant={sourceFilter === 'publi24' ? 'default' : 'outline'} onClick={() => setSourceFilter('publi24')}>Publi24</Button>
        </div>

        <div className="flex gap-2">
          <Button variant={roomsFilter === null ? 'default' : 'outline'} onClick={() => setRoomsFilter(null)}>Toate</Button>
          {[1, 2, 3, 4].map((room) => (
            <Button key={room} variant={roomsFilter === room ? 'default' : 'outline'} onClick={() => setRoomsFilter(room)}>
              {room} camere
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input placeholder="Pret minim" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} className="w-32" />
          <Input placeholder="Pret maxim" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} className="w-32" />
        </div>
      </div>

      <div className="agentfinder-owner-listings-mobile-filter md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="mr-2 h-4 w-4" /> Filtreaza anunturi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="agentfinder-owner-listings-sheet rounded-t-2xl">
            <SheetHeader className="text-left pb-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredListings.length > 0 ? (
          filteredListings.map((listing, index) => (
            <OwnerListingCard
              key={listing.id || index}
              listing={listing}
              handleImport={handleImport}
              isLoadingImport={isLoadingImport === listing.id}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-10">
            <p className="text-muted-foreground">Niciun anunt gasit.</p>
          </div>
        )}
      </div>

      <AddPropertyDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        property={propertyToImport as Property | null}
      />
    </div>
  );
}
