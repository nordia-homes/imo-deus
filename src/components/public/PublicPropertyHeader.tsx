'use client';

import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Calendar, BedDouble, Ruler, Layers } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function PublicPropertyHeader({ property }: { property: Property }) {
    const isMobile = useIsMobile();

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (isMobile) {
        return null;
    }
  
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-6 py-3 border-b hidden lg:block">
        <div className="flex items-center justify-between gap-4 h-full">
            <div className="min-w-0">
                <h1 className="text-xl font-bold truncate" title={property.title}>
                    {property.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground lg:text-white/70 text-sm mt-2">
                    <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none">
                        <BedDouble className="mr-1.5 h-3.5 w-3.5" /> {property.rooms} {property.rooms === 1 ? 'cameră' : 'camere'}
                    </Badge>
                    <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none">
                        <Ruler className="mr-1.5 h-3.5 w-3.5" /> {property.squareFootage} mp
                    </Badge>
                    {property.floor && (
                        <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none">
                            <Layers className="mr-1.5 h-3.5 w-3.5" /> Et. {property.floor}
                        </Badge>
                    )}
                    {property.constructionYear && (
                        <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none">
                            <Calendar className="mr-1.5 h-3.5 w-3.5" /> {property.constructionYear}
                        </Badge>
                    )}
                </div>
            </div>
             <div className="flex items-center gap-2 flex-shrink-0">
                 <Button variant="outline" className="pointer-events-none text-white bg-primary/10 border-primary">
                    €{property.price.toLocaleString()}
                    {pricePerSqm && <span className="text-xs text-white/70 ml-2">(€{pricePerSqm}/m²)</span>}
                 </Button>
            </div>
        </div>
    </header>
  );
}
