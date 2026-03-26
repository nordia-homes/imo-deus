'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';

export function PriceStatusCard({ property, isMobile = false }: { property: Property, isMobile?: boolean }) {

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (!isMobile) {
        return (
            <Card className={cn(
                "rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]"
            )}>
                <CardContent className="p-3 text-center flex items-baseline justify-center gap-2">
                    <span className={cn(
                        "text-xl font-bold",
                        "text-primary"
                    )}>
                        €{property.price.toLocaleString()}
                    </span>
                    {pricePerSqm && (
                        <span className={cn(
                            "text-sm font-medium",
                           "text-muted-foreground"
                        )}>
                            (€{pricePerSqm}/m²)
                        </span>
                    )}
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Dialog>
            <Card className={cn(
                "rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]"
            )}>
                <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-1">
                     <div className="flex items-baseline gap-2">
                        <span className={cn(
                            "text-xl font-bold",
                            "text-slate-950"
                        )}>
                            €{property.price.toLocaleString()}
                        </span>
                        {pricePerSqm && (
                            <span className={cn(
                                "text-sm font-medium",
                               "text-slate-500"
                            )}>
                                (€{pricePerSqm}/m²)
                            </span>
                        )}
                    </div>
                     <DialogTrigger asChild>
                        <div className="flex cursor-pointer items-center gap-1 text-primary">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                        </div>
                    </DialogTrigger>
                </CardContent>
            </Card>

            <DialogContent className="border-slate-200 bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI (Demo)</DialogTitle>
                    <DialogDescription className="text-slate-600">
                        Această funcționalitate este în curs de dezvoltare. Într-o versiune viitoare, aici veți vedea o analiză detaliată a prețului proprietății, comparat cu piața.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
