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
                <Card className="rounded-[2rem] border-slate-200/80 bg-white/90 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.32)]">
                    <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                    <CardContent>
                        <div>
                            <p className="whitespace-pre-wrap text-slate-600">
                                {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded)
                                    ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                    : property.description || 'Nicio descriere adăugată.'
                                }
                            </p>
                            {property.description && property.description.length > TRUNCATION_LENGTH && (
                                <Button
                                    variant="link"
                                    className="p-0 h-auto mt-2 text-primary"
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                >
                                    {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-4">
             <Card className="rounded-[1.75rem] border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-slate-950">Descriere</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div>
                        <p className="whitespace-pre-wrap text-sm text-slate-600">
                            {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded)
                                ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                : property.description || 'Nicio descriere adăugată.'
                            }
                        </p>
                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                            <Button
                                variant="link"
                                className="p-0 h-auto mt-2 text-primary"
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            >
                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-slate-200/80 bg-white/95 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)]">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-slate-950">Informații detaliate</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2">
                    {infoItems.map(item => {
                        if (!item.value && item.value !== 0) return null;
                        return (
                            <Button key={item.label} variant="outline" className="h-auto w-full pointer-events-none justify-between rounded-2xl border-slate-200 bg-slate-50 px-4 py-4 shadow-none">
                                <span className="text-slate-500">{item.label}</span>
                                <span className="font-bold text-slate-950">{item.value}</span>
                            </Button>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
