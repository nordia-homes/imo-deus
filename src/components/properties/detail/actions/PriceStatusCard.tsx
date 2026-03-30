'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp } from 'lucide-react';

export function PriceStatusCard({
    property,
    isMobile = false,
    variant = 'public',
}: {
    property: Property,
    isMobile?: boolean,
    variant?: 'public' | 'admin',
}) {
    const publicCardClassName = "relative isolate overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent bg-[#0b0f0d] before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-white/10 before:content-[''] after:absolute after:bottom-0 after:left-8 after:right-8 after:h-px after:bg-white/10 after:content-['']";
    const adminCardClassName = isMobile
        ? "overflow-hidden rounded-[1.75rem] border border-primary/20 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_35%),linear-gradient(180deg,#193253_0%,#152A47_58%,#12233b_100%)] text-white shadow-[0_28px_60px_-28px_rgba(0,0,0,0.65)]"
        : "overflow-hidden rounded-2xl border-none bg-[#152A47] text-white shadow-xl";

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (variant === 'admin') {
        return (
            <Dialog>
                <Card className={adminCardClassName}>
                    <CardContent className="flex flex-col items-center justify-center gap-1 p-4 text-center">
                        <div className="flex items-baseline gap-2">
                            <span className={isMobile ? "text-[2rem] font-bold text-primary" : "text-2xl font-bold text-primary"}>
                                €{property.price.toLocaleString()}
                            </span>
                            {pricePerSqm && (
                                <span className={isMobile ? "text-base font-medium text-white/80" : "text-sm font-medium text-white/70"}>
                                    (€{pricePerSqm}/m²)
                                </span>
                            )}
                        </div>
                        <DialogTrigger asChild>
                            <div className={isMobile ? "flex cursor-pointer items-center gap-1.5 text-primary" : "flex cursor-pointer items-center gap-1 text-primary"}>
                                <TrendingUp className={isMobile ? "h-4.5 w-4.5" : "h-4 w-4"} />
                                <span className={isMobile ? "text-sm font-semibold tracking-[0.01em]" : "text-sm font-semibold"}>Evalueaza Pretul cu ImoDeus.ai</span>
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

    if (!isMobile) {
        return (
            <Card className={publicCardClassName}>
                <CardContent className="relative flex items-baseline justify-center gap-2 p-3 text-center">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_42%)]" />
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
            <Card className={publicCardClassName}>
                <CardContent className="relative flex flex-col items-center justify-center gap-1 p-4 text-center">
                     <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_42%)]" />
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
