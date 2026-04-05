'use client';

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp } from 'lucide-react';
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

export function PriceStatusCard({
    property,
    isMobile = false,
    variant = 'public',
}: {
    property: Property,
    isMobile?: boolean,
    variant?: 'public' | 'admin',
}) {
    const publicCardClassName = isMobile
        ? "relative isolate overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent bg-[#0b0f0d] before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-white/10 before:content-[''] after:absolute after:bottom-0 after:left-8 after:right-8 after:h-px after:bg-white/10 after:content-['']"
        : "relative isolate overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent bg-[#0b0f0d]";
    const adminCardClassName = isMobile
        ? `${ACTION_CARD_INNER_CLASSNAME} overflow-hidden rounded-[1.65rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`
        : `${ACTION_CARD_CLASSNAME} rounded-[1.85rem]`;

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (variant === 'admin') {
        return (
            <Dialog>
                <Card className={adminCardClassName}>
                    <CardContent className={isMobile ? "flex flex-col items-center justify-center gap-1 p-4 text-center" : "space-y-4 p-5"}>
                        {isMobile ? (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[2rem] font-bold text-primary">
                                €{property.price.toLocaleString()}
                              </span>
                              {pricePerSqm && (
                                <span className="text-base font-medium text-white/80">
                                    (€{pricePerSqm}/m²)
                                </span>
                              )}
                            </div>
                            <DialogTrigger asChild>
                              <div className="flex cursor-pointer items-center gap-1.5 text-primary">
                                <TrendingUp className="h-4.5 w-4.5" />
                                <span className="text-sm font-semibold tracking-[0.01em]">Evalueaza Pretul cu ImoDeus.ai</span>
                              </div>
                            </DialogTrigger>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2 text-left">
                              <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${ACTION_PILL_CLASSNAME}`}>
                                Pret listare
                              </div>
                              <div className="flex items-end justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-[2.15rem] font-bold tracking-tight text-primary">
                                    €{property.price.toLocaleString()}
                                  </div>
                                  <p className="text-sm text-white/65">
                                    Valoarea afisata in anuntul public.
                                  </p>
                                </div>
                                {pricePerSqm && (
                                  <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/78">
                                    €{pricePerSqm}/m²
                                  </div>
                                )}
                              </div>
                            </div>
                            <DialogTrigger asChild>
                              <div className={`flex cursor-pointer items-center justify-between rounded-[1.2rem] px-4 py-3 text-primary transition-colors ${ACTION_PILL_CLASSNAME}`}>
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4" />
                                  <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                                </div>
                                <span className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-100/80">
                                  Deschide
                                </span>
                              </div>
                            </DialogTrigger>
                          </>
                        )}
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
