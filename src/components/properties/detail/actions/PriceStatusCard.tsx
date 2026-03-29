'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp } from 'lucide-react';

export function PriceStatusCard({ property, isMobile = false }: { property: Property, isMobile?: boolean }) {
    const financeCardClassName = "overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent ring-0 bg-[radial-gradient(circle_at_top_center,rgba(74,222,128,0.08),transparent_30%),linear-gradient(160deg,rgba(10,13,11,0.99)_0%,rgba(10,13,11,0.99)_100%)] shadow-none";

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (!isMobile) {
        return (
            <Card className={financeCardClassName}>
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
            <Card className={financeCardClassName}>
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
