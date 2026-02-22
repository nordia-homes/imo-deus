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
                "rounded-2xl shadow-2xl",
                "border border-primary bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none"
            )}>
                <CardContent className="p-3 text-center flex items-baseline justify-center gap-2">
                    <span className={cn(
                        "text-xl font-bold",
                        "text-primary lg:text-white"
                    )}>
                        €{property.price.toLocaleString()}
                    </span>
                    {pricePerSqm && (
                        <span className={cn(
                            "text-sm font-medium",
                           "text-muted-foreground lg:text-white/70"
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
                "rounded-2xl shadow-2xl",
                "bg-[#0F1E33] border border-cyan-400/50 shadow-[0_0_25px_-5px_rgba(100,220,255,0.6)]"
            )}>
                <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-1">
                     <div className="flex items-baseline gap-2">
                        <span className={cn(
                            "text-xl font-bold",
                            "text-white"
                        )}>
                            €{property.price.toLocaleString()}
                        </span>
                        {pricePerSqm && (
                            <span className={cn(
                                "text-sm font-medium",
                               "text-white/70"
                            )}>
                                (€{pricePerSqm}/m²)
                            </span>
                        )}
                    </div>
                     <DialogTrigger asChild>
                        <div className="flex items-center gap-1 cursor-pointer" style={{color: '#67E8F9'}}>
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                        </div>
                    </DialogTrigger>
                </CardContent>
            </Card>

            <DialogContent className="bg-[#0F1E33] text-white border-white/20">
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI (Demo)</DialogTitle>
                    <DialogDescription className="text-white/70">
                        Această funcționalitate este în curs de dezvoltare. Într-o versiune viitoare, aici veți vedea o analiză detaliată a prețului proprietății, comparat cu piața.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
