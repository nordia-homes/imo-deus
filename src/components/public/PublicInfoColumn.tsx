'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Layers, BedDouble, Calendar, Ruler, Paintbrush, Sofa, Maximize, ArrowUpDown, Thermometer } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from 'react';


export function PublicInfoColumn({ property, isMobile = false }: { property: Property, isMobile?: boolean }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 250;

    const infoItems = [
        { icon: <Layers className="h-5 w-5" />, label: 'Compartimentare', value: property.partitioning },
        { icon: <BedDouble className="h-5 w-5" />, label: 'Nr. Camere', value: property.rooms },
        { icon: <Calendar className="h-5 w-5" />, label: 'An Construcție', value: property.constructionYear },
        { icon: <Layers className="h-5 w-5" />, label: 'Etaj', value: property.floor },
        { icon: <Ruler className="h-5 w-5" />, label: 'Suprafață Utilă', value: property.squareFootage ? `${property.squareFootage} mp` : undefined },
        { icon: <Ruler className="h-5 w-5" />, label: 'Suprafață cu Balcon', value: property.totalSurface ? `${property.totalSurface} mp` : undefined },
        { icon: <Paintbrush className="h-5 w-5" />, label: 'Stare Interior', value: property.interiorState },
        { icon: <Sofa className="h-5 w-5" />, label: 'Bucătărie', value: property.kitchen },
        { icon: <Maximize className="h-5 w-5" />, label: 'Balcon/Terasă', value: property.balconyTerrace },
        { icon: <ArrowUpDown className="h-5 w-5" />, label: 'Lift', value: property.lift },
        { icon: <Thermometer className="h-5 w-5" />, label: 'Sistem Încălzire', value: property.heatingSystem },
    ];

    const CreditBrokerCard = () => (
        <Card className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]">
            <CardContent className="p-0">
                <div className="relative overflow-hidden p-6 md:p-7">
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(134,239,172,0.16),transparent_48%)]" />
                    <div className="relative space-y-4">
                        <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                            Finantare premium
                        </div>
                        <div className="space-y-2">
                            <h3 className="max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                Proprietatea potrivita merita si finantarea potrivita.
                            </h3>
                            <p className="max-w-2xl text-sm leading-7 text-emerald-50/85 md:text-base">
                                Iti oferim acces la servicii de broker de credite, astfel incat sa compari rapid variantele bancare,
                                sa intelegi costul real al finantarii si sa alegi solutia care iti protejeaza bugetul pe termen lung.
                            </p>
                        </div>
                        <div className="grid gap-3 text-sm text-emerald-100/90 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                Analiza gratuita a eligibilitatii
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                Oferte comparate din mai multe banci
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                                Suport complet pana la semnare
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between">
                            <p className="max-w-xl text-sm text-stone-300">
                                Daca vrei, te punem in legatura cu un partener de incredere care te poate ghida de la preaprobare pana la aprobare finala.
                            </p>
                            <div className="inline-flex items-center rounded-full border border-emerald-300/25 bg-emerald-400/12 px-5 py-2 text-sm font-semibold text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                Cere consultanta financiara
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (!isMobile) {
        return (
            <div className="space-y-6">
                <Card className="rounded-[2rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                    <CardHeader><CardTitle className="text-stone-50">Descriere</CardTitle></CardHeader>
                    <CardContent>
                        <div>
                            <p className="whitespace-pre-wrap text-stone-300">
                                {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded)
                                    ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                    : property.description || 'Nicio descriere adăugată.'
                                }
                            </p>
                            {property.description && property.description.length > TRUNCATION_LENGTH && (
                                <Button
                                    variant="link"
                                    className="mt-2 h-auto p-0 text-[#22c55e] hover:text-[#86efac]"
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                >
                                    {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <CreditBrokerCard />

                {property.amenities && property.amenities.length > 0 && (
                    <Card className="rounded-[2rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                        <CardHeader>
                            <CardTitle className="text-stone-50">Dotari</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {property.amenities.map((amenity) => (
                                <Button key={amenity} variant="outline" size="sm" className="pointer-events-none rounded-full border-white/10 bg-[#18191d] text-stone-200 shadow-none">
                                    {amenity}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-[2rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                    <CardHeader>
                        <CardTitle className="text-stone-50">Informatii detaliate</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {infoItems.map(item => {
                            if (!item.value && item.value !== 0) return null;
                            return (
                                <Button key={item.label} variant="outline" className="h-auto w-full pointer-events-none justify-between rounded-2xl border-white/10 bg-[#18191d] px-4 py-4 shadow-none">
                                    <span className="flex items-center gap-2 text-stone-400">
                                        <span className="text-[#86efac]">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </span>
                                    <span className="font-bold text-stone-50">{item.value}</span>
                                </Button>
                            )
                        })}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-4">
             <Card className="rounded-[1.75rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-stone-50">Descriere</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div>
                        <p className="whitespace-pre-wrap text-sm text-stone-300">
                            {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded)
                                ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                : property.description || 'Nicio descriere adăugată.'
                            }
                        </p>
                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                            <Button
                                variant="link"
                                className="mt-2 h-auto p-0 text-[#22c55e] hover:text-[#86efac]"
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            >
                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <CreditBrokerCard />

            <Card className="rounded-[1.75rem] border border-white/10 bg-[#101113]/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-stone-50">Informatii detaliate</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2">
                    {infoItems.map(item => {
                        if (!item.value && item.value !== 0) return null;
                        return (
                            <Button key={item.label} variant="outline" className="h-auto w-full pointer-events-none justify-between rounded-2xl border-white/10 bg-[#18191d] px-4 py-4 shadow-none">
                                <span className="flex items-center gap-2 text-stone-400">
                                    <span className="text-[#86efac]">{item.icon}</span>
                                    <span>{item.label}</span>
                                </span>
                                <span className="font-bold text-stone-50">{item.value}</span>
                            </Button>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
