'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import Link from 'next/link';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicAgency } from '@/context/PublicAgencyContext';


function SimilarPropertyCard({ property }: { property: Property }) {
  const { agencyId } = usePublicAgency();
  const href = `/agencies/${agencyId}/properties/${property.id}`;

  return (
    <div className="p-1">
      <Card className="rounded-2xl bg-[#152A47] border-none text-white overflow-hidden h-full flex flex-col">
        <Link href={href} className="block group">
          <div className="relative aspect-video">
            <Image
              src={property.images?.[0]?.url || 'https://placehold.co/800x600'}
              alt={property.title || 'Proprietate'}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="100vw"
            />
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-semibold truncate group-hover:underline" title={property.title}>
              {property.title}
            </h3>
            <p className="text-xs text-white/70 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {property.location}
            </p>
            <div className="flex items-center gap-4 text-xs text-white/80 pt-1">
              <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {property.rooms}</span>
              <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
              <span className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {property.squareFootage} mp</span>
            </div>
            <p className="text-xl font-bold text-primary pt-2">
              €{property.price.toLocaleString()}
            </p>
          </div>
        </Link>
      </Card>
    </div>
  );
}

export function SimilarProperties({ properties }: { properties: Property[] }) {
  if (properties.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 px-2">
        <h2 className="text-xl font-bold text-center">Proprietăți Similare</h2>
        <Carousel
            opts={{
                align: "start",
                loop: properties.length > 1,
            }}
            className="w-full"
        >
            <CarouselContent>
                {properties.map((prop) => (
                    <CarouselItem key={prop.id}>
                        <SimilarPropertyCard property={prop} />
                    </CarouselItem>
                ))}
            </CarouselContent>
            {properties.length > 1 && (
                <>
                    <CarouselPrevious className="left-2 bg-white/20 border-white/30 text-white hover:bg-white/30" />
                    <CarouselNext className="right-2 bg-white/20 border-white/30 text-white hover:bg-white/30" />
                </>
            )}
        </Carousel>
    </div>
  );
}
