'use client';

import type { Property } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import Link from 'next/link';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicPath } from '@/context/PublicAgencyContext';


function SimilarPropertyCard({ property }: { property: Property }) {
  const publicPath = usePublicPath();
  const href = publicPath(`/properties/${property.id}`);
  const financeCardClassName = "flex h-full flex-col overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] text-stone-100 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]";

  return (
    <div className="p-1">
      <Card className={financeCardClassName}>
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
            <p className="flex items-center gap-1 text-xs text-stone-400">
              <MapPin className="h-3 w-3" /> {property.location}
            </p>
            <div className="flex items-center gap-4 pt-1 text-xs text-stone-400">
              <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {property.rooms}</span>
              <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
              <span className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {property.squareFootage} mp</span>
            </div>
            <p className="pt-2 text-xl font-bold text-[#4ade80]">
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
        <h2 className="text-center text-xl font-bold text-stone-50">Proprietati similare</h2>
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
                    <CarouselPrevious className="left-2 border-white/10 bg-black/70 text-stone-100 hover:bg-black/85" />
                    <CarouselNext className="right-2 border-white/10 bg-black/70 text-stone-100 hover:bg-black/85" />
                </>
            )}
        </Carousel>
    </div>
  );
}
