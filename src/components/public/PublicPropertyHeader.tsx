'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { MapPin } from 'lucide-react';

export function PublicPropertyHeader({ property }: { property: Property }) {

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    return (
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm lg:bg-[#0F1E33]/95 lg:border-b lg:border-white/10 px-4 py-3 md:py-0 md:h-20 flex items-center">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 h-full w-full max-w-7xl mx-auto">
                {/* Left side: Title and details */}
                <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-bold text-foreground lg:text-white truncate" title={property.title}>
                        {property.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground lg:text-white/70 text-xs md:text-sm mt-1">
                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{property.location}</span>
                    </div>
                </div>

                {/* Right side: Price - DESKTOP ONLY */}
                <div className="hidden md:block">
                     <Button
                        className="h-auto pointer-events-none bg-[#152A47] hover:bg-[#152A47]/90 text-white border border-white/20"
                    >
                        <div className="flex items-baseline gap-2 px-3 py-2">
                            <span className="text-xl font-bold">
                                €{property.price.toLocaleString()}
                            </span>
                            {pricePerSqm && (
                                <span className="text-sm font-medium text-white/80">
                                    (€{pricePerSqm}/m²)
                                </span>
                            )}
                        </div>
                    </Button>
                </div>
            </div>
        </header>
    );
}