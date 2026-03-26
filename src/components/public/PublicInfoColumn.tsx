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
