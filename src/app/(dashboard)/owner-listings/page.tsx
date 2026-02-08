'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ExternalLink, Clock, Home, Maximize, Bed } from 'lucide-react';
import { differenceInHours, differenceInDays, fromUnixTime } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

// ===============================
// Tipul datelor
// ===============================
type OwnerListing = {
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  rooms?: number | string;
  image?: string;
  imageUrl?: string;
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
function OwnerListingCard({ listing }: { listing: OwnerListing }) {
  const calculateTimeAgo = (timestamp: number) => {
    try {
      if (!timestamp || typeof timestamp !== 'number') {
        return 'Dată necunoscută';
      }
      const postDate = fromUnixTime(timestamp);
      const now = new Date();
      const hours = differenceInHours(now, postDate);

      if (hours < 1) return `Publicat recent`;

      if (hours < 24) {
        return `Publicat acum ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
      } else {
        const days = differenceInDays(now, postDate);
        return `Publicat acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
      }
    } catch {
      return 'Dată invalidă';
    }
  };

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
    <Card className="group overflow-hidden rounded-2xl shadow-2xl hover:shadow-xl transition-all duration-300 bg-card">
      <CardContent className="p-0">
        <div className="relative">
          <div className="block aspect-[16/10] relative overflow-hidden rounded-t-2xl bg-muted">
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
            <Link href={listing.link} target="_blank">
              <h3 className="font-semibold truncate">{listing.title}</h3>
              <p className="text-sm text-muted-foreground">
                {listing.location}
              </p>
            </Link>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {listing.rooms && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-4 w-4" />
                <span>{Number(listing.rooms)} camere</span>
              </div>
            )}

            {listing.area && (
              <div className="flex items-center gap-1.5">
                <Maximize className="h-4 w-4" />
                <span>{listing.area}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{calculateTimeAgo(listing.postedAt)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="font-bold text-xl">{displayPrice}</p>
            <Button asChild size="sm">
              <Link href={listing.link} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Vezi anunț
              </Link>
            </Button>
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

  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchListings() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/owner-listings");
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'A eșuat preluarea datelor.');
        }
        const data = await res.json();
        setListings(data);
      } catch (error: any) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Eroare la încărcare",
          description: error.message || "Nu am putut prelua anunțurile.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchListings();
  }, [toast]);

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    let result = [...listings];

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

    result.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));

    return result;
  }, [listings, roomsFilter, priceMin, priceMax]);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">
                Anunțuri de la proprietari
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-3">
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        Anunțuri de la proprietari
      </h1>

      <div className="flex flex-wrap gap-4 items-center">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredListings.length > 0 ? (
          filteredListings.map((listing, index) => (
            <OwnerListingCard
              key={listing.link || index}
              listing={listing}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-10">
            <p className="text-muted-foreground">Niciun anunț găsit.</p>
          </div>
        )}
      </div>
    </div>
  );
}
