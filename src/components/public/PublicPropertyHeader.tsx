'use client';

import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Calendar, BedDouble, Bath, Ruler, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PublicPropertyHeader({ property }: { property: Property; }) {
  return (
    <header className="sticky top-[72px] z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-4 border-b lg:bg-[#0F1E33]/95 lg:border-white/10 lg:mb-4 lg:top-[65px]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 h-full">
            <div className="min-w-0">
                <h1 className="text-2xl lg:text-3xl font-bold truncate text-foreground lg:text-white" title={property.title}>
                    {property.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground lg:text-white/70 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{property.location}</span>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-base lg:bg-white/10 lg:text-white/90 lg:border-none">
                    <BedDouble className="mr-2 h-4 w-4" /> {property.rooms} Camere
                </Badge>
                <Badge variant="secondary" className="text-base lg:bg-white/10 lg:text-white/90 lg:border-none">
                    <Bath className="mr-2 h-4 w-4" /> {property.bathrooms} {property.bathrooms === 1 ? 'Baie' : 'Băi'}
                </Badge>
                <Badge variant="secondary" className="text-base lg:bg-white/10 lg:text-white/90 lg:border-none">
                    <Ruler className="mr-2 h-4 w-4" /> {property.squareFootage} m²
                </Badge>
                {property.constructionYear && (
                    <Badge variant="secondary" className="text-base lg:bg-white/10 lg:text-white/90 lg:border-none">
                        <Calendar className="mr-2 h-4 w-4" /> {property.constructionYear}
                    </Badge>
                )}
            </div>
        </div>
    </header>
  );
}
