'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function PriceStatusCard({
    property,
    isMobile = false,
    variant = 'public',
    isAgentfinderTheme: isAgentfinderThemeProp,
}: {
    property: Property,
    isMobile?: boolean,
    variant?: 'public' | 'admin',
    isAgentfinderTheme?: boolean,
}) {
    const { agency } = usePublicAgency();
    const isAgentfinderTheme =
        variant === 'public' && (isAgentfinderThemeProp ?? getAgencyThemePreset(agency) === 'agentfinder');
    const publicCardClassName = isMobile
        ? cn("relative isolate overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:content-[''] after:absolute after:bottom-0 after:left-8 after:right-8 after:h-px after:content-['']", isAgentfinderTheme ? "bg-white before:bg-slate-200 after:bg-slate-200" : "bg-[#0b0f0d] before:bg-white/10 after:bg-white/10")
        : cn("relative isolate overflow-hidden rounded-b-[2rem] rounded-t-none border-0 border-transparent", isAgentfinderTheme ? "bg-white" : "bg-[#0b0f0d]");
    const adminCardClassName = isMobile
        ? `${ACTION_CARD_INNER_CLASSNAME} overflow-hidden rounded-[1.65rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`
        : `${ACTION_CARD_CLASSNAME} rounded-[1.85rem]`;

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    if (variant === 'admin') {
        return (
            <Card className={adminCardClassName}>
                <CardContent className={isMobile ? "flex flex-col items-center justify-center gap-1 p-4 text-center" : "space-y-4 p-5"}>
                    {isMobile ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[2rem] font-bold text-primary">
                                    EUR {property.price.toLocaleString()}
                                </span>
                                {pricePerSqm ? (
                                    <span className="text-base font-medium text-white/80">
                                        (EUR {pricePerSqm}/m²)
                                    </span>
                                ) : null}
                            </div>
                            <Link href={`/properties/${property.id}/analiza-pret`} className="flex items-center gap-1.5 text-primary">
                                <TrendingUp className="h-4.5 w-4.5" />
                                <span className="text-sm font-semibold tracking-[0.01em]">Evalueaza Pretul cu ImoDeus.ai</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2 text-left">
                                <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/90 ${ACTION_PILL_CLASSNAME}`}>
                                    Pret listare
                                </div>
                                <div className="flex items-end justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="text-[2.2rem] font-bold tracking-tight text-emerald-300">
                                            EUR {property.price.toLocaleString()}
                                        </div>
                                        <p className="text-sm text-white/58">
                                            Valoarea afisata in anuntul public.
                                        </p>
                                    </div>
                                    {pricePerSqm ? (
                                        <div className="shrink-0 rounded-full border border-white/8 bg-[#19293f] px-3 py-1.5 text-sm font-semibold text-white/78">
                                            EUR {pricePerSqm}/m²
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <Link
                                href={`/properties/${property.id}/analiza-pret`}
                                className={`flex items-center justify-between rounded-[1.2rem] px-4 py-3 text-emerald-200 transition-colors ${ACTION_PILL_CLASSNAME}`}
                            >
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                                </div>
                                <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-white/58">
                                    Deschide
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                            </Link>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (!isMobile) {
        return (
            <Card className={publicCardClassName}>
                <CardContent className="relative flex items-baseline justify-center gap-2 p-3 text-center">
                    <div className={cn("pointer-events-none absolute inset-0 z-0", isAgentfinderTheme ? "bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.10),transparent_42%)]" : "bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_42%)]")} />
                    <span className={cn("relative z-10 text-xl font-bold", isAgentfinderTheme ? "!text-slate-950" : "text-[#4ade80]")}>
                        EUR {property.price.toLocaleString()}
                    </span>
                    {pricePerSqm ? (
                        <span className={cn("relative z-10 text-sm font-medium", isAgentfinderTheme ? "!text-slate-500" : "text-stone-400")}>
                            (EUR {pricePerSqm}/m²)
                        </span>
                    ) : null}
                </CardContent>
            </Card>
        );
    }

    return (
        <Dialog>
            <Card className={publicCardClassName}>
                <CardContent className={cn("relative flex flex-col items-center justify-center gap-1 p-4 text-center", isAgentfinderTheme && "bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)]")}>
                    <div className={cn("pointer-events-none absolute inset-0 z-0", isAgentfinderTheme ? "bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.10),transparent_42%)]" : "bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_42%)]")} />
                    <div className="relative z-10 flex items-baseline gap-2">
                        <span className={cn("text-xl font-bold", isAgentfinderTheme ? "!text-slate-950" : "text-[#4ade80]")}>
                            EUR {property.price.toLocaleString()}
                        </span>
                        {pricePerSqm ? (
                            <span className={cn("text-sm font-medium", isAgentfinderTheme ? "!text-slate-500" : "text-stone-400")}>
                                (EUR {pricePerSqm}/m²)
                            </span>
                        ) : null}
                    </div>
                    <DialogTrigger asChild>
                        <div className={cn("relative z-10 flex cursor-pointer items-center gap-1", isAgentfinderTheme ? "text-sky-700" : "text-[#86efac]")}>
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-semibold">Evalueaza Pretul cu ImoDeus.ai</span>
                        </div>
                    </DialogTrigger>
                </CardContent>
            </Card>

            <DialogContent className="border-white/10 bg-[#101113] text-stone-100">
                <DialogHeader>
                    <DialogTitle>Evaluare Pret AI (Demo)</DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Aceasta functionalitate este in curs de dezvoltare. Intr-o versiune viitoare, aici vei vedea o analiza detaliata a pretului proprietatii, comparat cu piata.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
