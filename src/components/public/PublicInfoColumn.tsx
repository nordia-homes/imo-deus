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
                <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
                    <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                    <CardContent>
                        <div>
                            <p className="text-muted-foreground lg:text-white/70 whitespace-pre-wrap">
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
             <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-white">Descriere</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div>
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
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

            <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                <CardHeader className="p-4">
                    <CardTitle className="font-semibold text-white">Informații detaliate</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                    {infoItems.map(item => {
                        if (!item.value && item.value !== 0) return null;
                        return (
                            <Button key={item.label} variant="outline" className="w-full justify-between pointer-events-none h-14 bg-[#0F1E33] border-cyan-400/50 shadow-[0_0_25px_-10px_rgba(100,220,255,0.6)]">
                                <span className="text-white/70">{item.label}</span>
                                <span className="font-bold">{item.value}</span>
                            </Button>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
