'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { FileText, Rocket, MoreVertical, BedDouble, Bath, Ruler, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '../ui/badge';

export function PublicPropertyHeader({ property }: { property: Property }) {
    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

  return (
    <header className="sticky top-0 z-20 bg-background lg:bg-[#0F1E33]/95 backdrop-blur-sm px-4 md:px-6 lg:px-6 py-4 border-b lg:border-white/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 h-full">
            <div className="min-w-0">
                <h1 className="text-xl lg:text-2xl font-bold truncate" title={property.title}>
                    {property.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground lg:text-white/70 text-sm mt-2">
                    <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none"><BedDouble className="mr-1.5 h-3.5 w-3.5" /> {property.rooms}</Badge>
                    <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none"><Bath className="mr-1.5 h-3.5 w-3.5" /> {property.bathrooms}</Badge>
                    <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none"><Ruler className="mr-1.5 h-3.5 w-3.5" /> {property.squareFootage} mp</Badge>
                    {property.constructionYear && <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {property.constructionYear}</Badge>}
                    {property.floor && <Badge variant="outline" className="font-normal lg:bg-white/10 lg:text-white lg:border-none">Et. {property.floor}</Badge>}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" className="w-full sm:w-auto flex-1 sm:flex-initial lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
                    <span className="text-lg font-bold">€{property.price.toLocaleString()}</span>
                     {pricePerSqm && (
                        <span className="text-xs ml-2 text-muted-foreground lg:text-white/70">(€{pricePerSqm}/m²)</span>
                    )}
                </Button>
            </div>
        </div>
    </header>
  );
}
