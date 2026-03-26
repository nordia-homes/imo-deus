'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp } from 'lucide-react';

export function PriceStatusCard({ property, isMobile = false }: { property: Property, isMobile?: boolean }) {

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (!isMobile) {
        return (
            <Card className="rounded-[2rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                <CardContent className="flex items-baseline justify-center gap-2 p-3 text-center">
                    <span className="text-xl font-bold text-[#4ade80]">
                        €{property.price.toLocaleString()}
                    </span>
                    {pricePerSqm && (
                        <span className="text-sm font-medium text-stone-400">
                            (€{pricePerSqm}/m²)
                        </span>
                    )}
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Dialog>
            <Card className="rounded-[1.75rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-1">
                     <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-[#4ade80]">
                            €{property.price.toLocaleString()}
                        </span>
                        {pricePerSqm && (
                            <span className="text-sm font-medium text-stone-400">
                               (€{pricePerSqm}/m²)
                            </span>
                        )}
                    </div>
                     <DialogTrigger asChild>
                        <div className="flex cursor-pointer items-center gap-1 text-[#86efac]">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                        </div>
                    </DialogTrigger>
                </CardContent>
            </Card>

            <DialogContent className="border-white/10 bg-[#101113] text-stone-100">
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI (Demo)</DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Această funcționalitate este în curs de dezvoltare. Într-o versiune viitoare, aici veți vedea o analiză detaliată a prețului proprietății, comparat cu piața.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
