'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Clock, Home, Maximize, Bed } from 'lucide-react';
import { differenceInHours, differenceInDays, fromUnixTime } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useFirestore } from '@/firebase';
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
  rooms?: number;
  image?: string;
  imageUrl?: string;
};

// ===============================
// Card anunț
// ===============================
function OwnerListingCard({ listing }: { listing: OwnerListing }) {
    const calculateTimeAgo = (timestamp: number) => {
        try {
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
        } catch (e) {
            return 'Dată invalidă';
        }
    };
    
    let displayPrice = "Preț negociabil";
    if (listing.price) {
        // Extracts only the numeric part
        const priceMatch = listing.price.match(/[\d.,\s]+/);
        if (priceMatch && priceMatch[0] && /\d/.test(priceMatch[0])) {
             displayPrice = `€ ${priceMatch[0].trim()}`;
        }
    }

    const imageToDisplay = listing.image || listing.imageUrl;

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
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105"
                />
                ) : (
                <div className="flex items-center justify-center h-full">
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
                    <span>{listing.rooms} camere</span>
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
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchListings() {
      if (!firestore) return;
      setIsLoading(true);
      try {
        const listingsCollection = collection(firestore, 'ownerListings');
        const q = query(listingsCollection, orderBy('postedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OwnerListing[];
        setListings(data);
      } catch (error) {
        console.error("Failed to fetch owner listings:", error);
        toast({
          variant: "destructive",
          title: "Eroare la încărcarea anunțurilor",
          description: "Nu am putut prelua datele de la proprietari. Vă rugăm să verificați regulile de securitate.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchListings();
  }, [firestore, toast]);

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    if (!roomsFilter) return listings;
    return listings.filter(l => l.rooms === roomsFilter);
  }, [listings, roomsFilter]);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">
                Anunțuri de la proprietari
            </h1>
            <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-5 w-1/3" />
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

      {/* FILTRE CAMERE */}
      <div className="flex gap-2">
        <Button
          variant={!roomsFilter ? "default" : "outline"}
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

      {/* GRID */}
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
