
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Clock, Home, Maximize } from 'lucide-react';
import { differenceInHours, differenceInDays, fromUnixTime } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

// 1. Define the type for the listing data
type OwnerListing = {
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  imageUrl?: string;
};

// 2. Create the Card component for a single listing
function OwnerListingCard({ listing }: { listing: OwnerListing }) {
  const calculateTimeAgo = (timestamp: number) => {
    const postDate = fromUnixTime(timestamp);
    const now = new Date();
    const hours = differenceInHours(now, postDate);

    if (hours < 1) {
        return `Publicat recent`;
    }
    if (hours < 24) {
      return `Publicat acum ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
    } else {
      const days = differenceInDays(now, postDate);
      return `Publicat acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
    }
  };

  return (
    <Card className="group overflow-hidden rounded-2xl shadow-2xl hover:shadow-xl transition-all duration-300 bg-card">
        <CardContent className="p-0">
            <div className="relative">
                 <div className="block aspect-[16/10] relative overflow-hidden rounded-t-2xl bg-muted">
                   {listing.imageUrl ? (
                        <Image 
                            src={listing.imageUrl} 
                            alt={listing.title} 
                            fill 
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                   ) : (
                        <div className="flex items-center justify-center h-full">
                           <Home className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                   )}
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <Link href={listing.link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={listing.title}>
                            {listing.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{listing.location}</p>
                    </Link>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Maximize className="h-4 w-4"/>
                        <span>{listing.area}</span>
                    </div>
                     <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4"/>
                        <span>{calculateTimeAgo(listing.postedAt)}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <p className="font-bold text-xl text-foreground">
                        {listing.price}
                    </p>
                    <Button asChild size="sm">
                        <Link href={listing.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2" />
                            Vezi anunț
                        </Link>
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}


// 3. The main page component
export default function OwnerListingsPage() {
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/scrape');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        if (data.success) {
          setListings(data.listings);
        } else {
          throw new Error('API returned an error');
        }
      } catch (e) {
        setError('Nu am putut prelua anunțurile. Vă rugăm să încercați mai târziu.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
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
      );
    }
    
    if (error) {
         return <div className="text-center py-20"><p className="text-destructive">{error}</p></div>;
    }

    if (listings.length === 0) {
      return <div className="text-center py-20"><p className="text-muted-foreground">Nu au fost găsite anunțuri.</p></div>;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {listings.map((listing, index) => (
          <OwnerListingCard key={listing.link || index} listing={listing} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold">Anunțuri de la proprietari</h1>
      </div>
      {renderContent()}
    </div>
  );
}
