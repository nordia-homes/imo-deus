'use client';

import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { BedDouble, Bath, Ruler, MapPin, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function PublicPropertyHeader({ property }: { property: Property }) {
  return (
    <header className="lg:sticky lg:top-[65px] lg:z-20 lg:bg-[#0F1E33]/95 lg:backdrop-blur-sm lg:border-white/10 lg:mb-4 px-4 py-4 md:px-6 lg:px-0 lg:py-4 border-b lg:border-b-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 h-full">
            <div className="min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 flex-wrap">
                    <div className="inline-block h-auto w-full md:max-w-lg truncate p-3 rounded-lg border bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none lg:text-white text-card-foreground shadow-lg text-xl font-bold" title={property.title}>
                        {property.title}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground lg:text-white/70 text-sm mt-2">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> 
                        <span>{property.address}</span>
                    </div>
                    <span className="hidden sm:inline text-gray-400">•</span>
                    <div className="flex items-center gap-1.5">
                        <BedDouble className="h-3.5 w-3.5"/>
                        <span>{property.rooms} camere</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center gap-1.5">
                        <Bath className="h-3.5 w-3.5"/>
                        <span>{property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center gap-1.5">
                        <Ruler className="h-3.5 w-3.5"/>
                        <span>{property.squareFootage} mp</span>
                    </div>
                    {property.constructionYear && (
                        <>
                            <span className="hidden sm:inline text-gray-400">•</span>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5"/>
                                <span>{property.constructionYear}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-center">
                <Badge variant={property.transactionType === 'Vânzare' ? 'default' : 'secondary'} className="text-base">{property.transactionType}</Badge>
                <p className="text-3xl font-bold text-primary">€{property.price.toLocaleString()}</p>
            </div>
        </div>
    </header>
  );
}
