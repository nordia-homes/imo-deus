'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Clock, Home, BedDouble, Filter, Loader2, Calendar, Ruler, Rocket } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LISTINGS_PER_PAGE = 100;

type PropertyTypeFilter = 'apartamente' | 'case' | 'terenuri' | 'spatii-comerciale';
type SourceFilterValue = OwnerListingSource | 'imobiliare';

type OwnerListing = {
  id: string;
  scopeKey?: string;
  scopeCity?: string;
  source: OwnerListingSource;
  sourceLabel: string;
  originSourceUrl?: string;
  originSourceLabel?: string;
  isNew?: boolean;
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
  propertyType?: string;
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

function normalizeText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

function matchesPropertyType(listing: OwnerListing, propertyTypeFilter: PropertyTypeFilter) {
  const listingType = normalizeText(listing.propertyType);
  const listingText = normalizeText(`${listing.title || ''} ${listing.description || ''}`);
  const searchableText = `${listingType} ${listingText}`;

  switch (propertyTypeFilter) {
    case 'apartamente':
      return searchableText.includes('apartament') || searchableText.includes('garsoniera') || searchableText.includes('studio');
    case 'case':
      return searchableText.includes('casa') || searchableText.includes('vila') || searchableText.includes('duplex') || searchableText.includes('triplex');
    case 'terenuri':
      return searchableText.includes('teren');
    case 'spatii-comerciale':
      return searchableText.includes('spatiu comercial') || searchableText.includes('spatii comerciale') || searchableText.includes('birou') || searchableText.includes('hala') || searchableText.includes('magazin');
    default:
      return true;
  }
}

function matchesSourceFilter(listing: OwnerListing, sourceFilter: SourceFilterValue | null) {
  if (!sourceFilter) {
    return true;
  }

  if (sourceFilter === 'imobiliare') {
    return normalizeText(listing.originSourceLabel) === 'imobiliare.ro';
  }

  return listing.source === sourceFilter;
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
  const badgeLabel = listing.originSourceLabel || listing.sourceLabel;

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
              {badgeLabel}
            </Badge>
          </div>
          {listing.isNew ? (
            <div className="absolute right-3 top-3">
              <Badge className="border-0 bg-emerald-500 text-white shadow-[0_10px_24px_-14px_rgba(16,185,129,0.95)]">
                NOU
              </Badge>
            </div>
          ) : null}
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

    result = result.filter((listing) => matchesSourceFilter(listing, sourceFilter));

    const normalizedSearchQuery = normalizeText(searchQuery);
    const numericSearchQuery = normalizeDigits(searchQuery);

    if (normalizedSearchQuery) {
      const searchTerms = normalizedSearchQuery.split(' ').filter(Boolean);
      result = result.filter((listing) => {
        const numericPrice = extractPrice(listing.price);
        const searchableText = normalizeText([
          listing.title,
          listing.location,
          listing.ownerPhone,
          listing.price,
          numericPrice !== null ? String(numericPrice) : '',
        ].join(' '));
        const searchableDigits = [
          normalizeDigits(listing.ownerPhone),
          normalizeDigits(listing.price),
          numericPrice !== null ? String(numericPrice) : '',
        ]
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

  const totalListingsCount = Array.isArray(listings) ? filteredListings.length : 0;
  const pageStart = filteredListings.length === 0 ? 0 : (safeCurrentPage - 1) * LISTINGS_PER_PAGE + 1;
  const pageEnd = Math.min(safeCurrentPage * LISTINGS_PER_PAGE, filteredListings.length);

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

  const FilterControls = () => (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="font-semibold mb-2 block">Cautare</Label>
        <Input
          placeholder="Cauta dupa titlu, zona, telefon sau pret"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Sursa</Label>
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
        <Label className="font-semibold mb-2 block">Tip proprietate</Label>
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
        <Label className="font-semibold mb-2 block">Numar camere</Label>
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
      <div className="rounded-[1.5rem] border border-white/50 bg-white/78 px-6 py-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-300/90 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
              Owner listings
            </Badge>
            {currentScope ? (
              <Badge variant="outline" className="border-slate-300/90 bg-slate-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                {currentScope.displayName}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-slate-950">Anunturi de la proprietari</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                {currentScope
                  ? 'Lista centralizata cu anunturile noi din zona activa, gata pentru cautare, filtrare si import in CRM.'
                  : 'Momentan scraping-ul este configurat doar pentru agentii setate pe Bucuresti-Ilfov.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <span className="font-medium text-slate-500">Gasite:</span>{' '}
                <span className="font-semibold text-slate-950">{totalListingsCount}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <span className="font-medium text-slate-500">Pagina:</span>{' '}
                <span className="font-semibold text-slate-950">{safeCurrentPage} / {totalPages}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <span className="font-medium text-slate-500">Afisare:</span>{' '}
                <span className="font-semibold text-slate-950">
                  {filteredListings.length > 0 ? `${pageStart}-${pageEnd} din ${filteredListings.length}` : 'Niciun rezultat'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-20 z-20 hidden md:block">
        <div className="agentfinder-owner-listings-filters rounded-[1.75rem] border border-white/50 bg-white/82 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl md:flex md:flex-wrap md:items-center md:gap-4">
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

      {filteredListings.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-white/65">
            Afisezi {pageStart}-{pageEnd} din {filteredListings.length} anunturi
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
            >
              Anterioara
            </Button>
            <span className="text-sm text-white/75">
              Pagina {safeCurrentPage} din {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage === totalPages}
            >
              Urmatoare
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredListings.length > 0 ? (
          paginatedListings.map((listing, index) => (
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

      {filteredListings.length > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            Anterioara
          </Button>
          <span className="text-sm text-white/75">
            Pagina {safeCurrentPage} din {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage === totalPages}
          >
            Urmatoare
          </Button>
        </div>
      ) : null}

      <AddPropertyDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        property={propertyToImport as Property | null}
      />
    </div>
  );
}
