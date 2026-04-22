'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ExternalLink, Clock, Home, Maximize, Bed, Filter, Rocket, Loader2, Calendar } from 'lucide-react';
import { format, fromUnixTime, formatDistanceToNow, parse } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';


// ===============================
// Tipul datelor
// ===============================
type OwnerListing = {
  id: string;
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  rooms?: number | string;
  image?: string;
  imageUrl?: string;
  constructionYear?: number;
  year?: number;
  description?: string;
};

// extrage preț numeric
function extractPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const match = priceStr.replace(/\s/g, '').match(/[\d.]+/);
  if (!match) return null;
  return Number(match[0].replace(/\./g, ''));
}

// ===============================
// Card anunț
// ===============================
function OwnerListingCard({ listing, handleImport, isLoadingImport }: { listing: OwnerListing, handleImport: (listing: OwnerListing) => void, isLoadingImport: boolean }) {
  const calculateTimeAgo = (timestamp: number) => {
    try {
      if (!timestamp || typeof timestamp !== 'number') {
        return 'Dată necunoscută';
      }
      const postDate = fromUnixTime(timestamp);
      let timeAgo = formatDistanceToNow(postDate, { locale: ro });
      timeAgo = timeAgo.replace('circa ', '');
      timeAgo = timeAgo.replace('aproximativ ', '');
      timeAgo = timeAgo.replace('mai puțin de un minut', 'un minut');
      return timeAgo.replace('în urmă', '').trim();
    } catch {
      return 'Dată invalidă';
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
        } catch (e) {
            return listing.location.replace('Reactualizat la', 'Act.');
        }
    }
    
    return listing.location;
  }, [listing.location]);

  const year = listing.constructionYear || listing.year;

  let displayPrice = "Preț negociabil";
  if (listing.price) {
    const priceMatch = listing.price.match(/[\d.,\s]+/);
    if (priceMatch && priceMatch[0] && /\d/.test(priceMatch[0])) {
      displayPrice = `€ ${priceMatch[0].trim()}`;
    }
  }

  // Afișează doar imagini valide
  const imageToDisplay =
    listing.imageUrl && listing.imageUrl.startsWith("http")
      ? listing.imageUrl
      : listing.image && listing.image.startsWith("http")
      ? listing.image
      : null;

  return (
    <Card className="agentfinder-owner-listing-card group overflow-hidden rounded-2xl shadow-2xl hover:shadow-xl transition-all duration-300 bg-card">
      <CardContent className="p-0">
        <div className="relative">
          <div className="agentfinder-owner-listing-image block aspect-[16/10] relative overflow-hidden rounded-t-2xl bg-muted">
            {imageToDisplay ? (
              <Image
                src={imageToDisplay}
                alt={listing.title}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100">
                <Home className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold truncate">{listing.title}</h3>
            {listing.description && (
                <p className="text-sm text-muted-foreground truncate" title={listing.description}>{listing.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {locationDisplay}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {listing.rooms && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-4 w-4" />
                <span>{Number(listing.rooms)} camere</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{calculateTimeAgo(listing.postedAt)}</span>
            </div>
             {year && (
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4"/>
                    <span>{year}</span>
                </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3 pt-2">
            <Button variant="default" size="sm" className="agentfinder-owner-listing-price pointer-events-none font-bold bg-[#f8f8f9] text-foreground hover:bg-muted border border-primary shadow-lg">
                {displayPrice}
            </Button>
            <div className="flex items-center gap-2">
                <Button 
                    className="agentfinder-owner-listing-import"
                    size="sm"
                    onClick={() => handleImport(listing)}
                    disabled={isLoadingImport}
                >
                    {isLoadingImport ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Importă Anunțul
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

// ===============================
// Pagina principală
// ===============================
export default function OwnerListingsPage() {
  const [roomsFilter, setRoomsFilter] = useState<number | null>(null);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [propertyToImport, setPropertyToImport] = useState<Partial<Property> | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState<string | null>(null);

  const ownerListingsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'ownerListings'), orderBy('postedAt', 'desc'));
  }, [firestore]);

  const { data: listings, isLoading } = useCollection<OwnerListing>(ownerListingsQuery);

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

    if (sourceFilter) {
        result = result.filter(l => {
            if (!l.link) return false;
            if (sourceFilter === 'olx') return l.link.includes('olx.ro');
            if (sourceFilter === 'imobiliare') return l.link.includes('imobiliare.ro');
            return false;
        });
    }

    if (roomsFilter !== null) {
      result = result.filter(
        (l) => Number(l.rooms) === Number(roomsFilter)
      );
    }

    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    if (min !== null || max !== null) {
      result = result.filter((l) => {
        const price = extractPrice(l.price);
        if (!price) return false;

        if (min !== null && price < min) return false;
        if (max !== null && price > max) return false;

        return true;
      });
    }

    return result;
  }, [listings, roomsFilter, priceMin, priceMax, sourceFilter]);
  
  const handleImport = async (listing: OwnerListing) => {
    setIsLoadingImport(listing.id);
    toast({ title: 'Import în curs...', description: 'Se preiau datele de la sursă.' });
    
    const year = listing.constructionYear || listing.year;

    // Simulate API call and data scraping
    await new Promise(resolve => setTimeout(resolve, 1500));

    const scrapedData: Partial<Property> = {
        title: listing.title,
        price: extractPrice(listing.price) ?? 0,
        description: listing.description || `[Anunț importat de la: ${listing.link}]\n\nDescriere simulată: Acest anunț a fost preluat automat. Aici ar apărea descrierea completă de pe site-ul original.`,
        images: listing.imageUrl ? [
            { url: listing.imageUrl, alt: listing.title },
            { url: 'https://picsum.photos/seed/import2/1200/800', alt: listing.title },
            { url: 'https://picsum.photos/seed/import3/1200/800', alt: listing.title }
        ] : [],
        rooms: typeof listing.rooms === 'number' ? listing.rooms : parseInt(String(listing.rooms) || '0', 10),
        squareFootage: parseInt(listing.area?.replace('mp', '').trim() || '0', 10),
        address: listing.location,
        location: listing.location,
        constructionYear: year,
    };

    setPropertyToImport(scrapedData);
    setIsImportDialogOpen(true);
    setIsLoadingImport(null);
  };


  const FilterControls = () => (
    <div className="flex flex-col gap-6">
        <div>
            <Label className="font-semibold mb-3 block">Sursă</Label>
            <div className="flex flex-wrap gap-2">
                <Button variant={sourceFilter === null ? "default" : "outline"} onClick={() => setSourceFilter(null)}>Toate</Button>
                <Button variant={sourceFilter === 'olx' ? "default" : "outline"} onClick={() => setSourceFilter('olx')}>OLX</Button>
                <Button variant={sourceFilter === 'imobiliare' ? "default" : "outline"} onClick={() => setSourceFilter('imobiliare')}>Imobiliare.ro</Button>
            </div>
        </div>
        <div>
            <Label className="font-semibold mb-3 block">Număr camere</Label>
            <div className="flex flex-wrap gap-2">
                <Button variant={roomsFilter === null ? "default" : "outline"} onClick={() => setRoomsFilter(null)}>Toate</Button>
                {[1, 2, 3, 4].map((room) => (
                    <Button key={room} variant={roomsFilter === room ? "default" : "outline"} onClick={() => setRoomsFilter(room)}>{room} camere</Button>
                ))}
            </div>
        </div>
        <div>
            <Label className="font-semibold mb-2 block">Preț</Label>
            <div className="flex gap-2">
                <Input placeholder="Preț minim" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                <Input placeholder="Preț maxim" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
        </div>
    </div>
);

  if (isLoading) {
    return (
        <div className="agentfinder-owner-listings-page space-y-6">
            <h1 className="text-xl md:text-3xl font-headline font-bold">
                Anunțuri de la proprietari
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="agentfinder-owner-listing-card space-y-3 p-4">
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
      <h1 className="text-xl md:text-3xl font-headline font-bold">
        Anunțuri de la proprietari
      </h1>

      {/* Desktop Filters */}
      <div className="agentfinder-owner-listings-filters hidden md:flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <Button variant={sourceFilter === null ? "default" : "outline"} onClick={() => setSourceFilter(null)}>Toate sursele</Button>
          <Button variant={sourceFilter === 'olx' ? "default" : "outline"} onClick={() => setSourceFilter('olx')}>OLX</Button>
          <Button variant={sourceFilter === 'imobiliare' ? "default" : "outline"} onClick={() => setSourceFilter('imobiliare')}>Imobiliare.ro</Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={roomsFilter === null ? "default" : "outline"}
            onClick={() => setRoomsFilter(null)}
          >
            Toate
          </Button>

          {[1, 2, 3, 4].map((room) => (
            <Button
              key={room}
              variant={roomsFilter === room ? "default" : "outline"}
              onClick={() => setRoomsFilter(room)}
            >
              {room} camere
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Preț minim"
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-32"
          />
          <Input
            placeholder="Preț maxim"
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

       {/* Mobile Filter Button */}
      <div className="agentfinder-owner-listings-mobile-filter md:hidden">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                      <Filter className="mr-2 h-4 w-4" /> Filtrează anunțuri
                  </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="agentfinder-owner-listings-sheet rounded-t-2xl">
                  <SheetHeader className="text-left pb-4">
                      <SheetTitle>Filtre</SheetTitle>
                  </SheetHeader>
                  <FilterControls />
                  <SheetFooter className="pt-6">
                       <Button onClick={() => setIsSheetOpen(false)} className="w-full">Vezi {filteredListings.length} anunțuri</Button>
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
            <p className="text-muted-foreground">Niciun anunț găsit.</p>
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
