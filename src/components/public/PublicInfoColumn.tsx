'use client';

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Property } from "@/lib/types";
import { useState } from "react";
import { InfoDialog } from "../properties/detail/InfoDialog";
import { BedDouble, Bath, Ruler, Calendar, Layers, Building, Handshake, Maximize, Compass, AlertTriangle, Star, Paintbrush, Sofa, Thermometer, Car, ArrowUpDown } from 'lucide-react';


export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile: boolean }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 150;

    if (isMobile) {
        const InfoButton = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined | null }) => {
            if (!value && value !== 0) return null;
            return (
                <div className="bg-white/10 border border-white/20 rounded-lg p-3 text-left">
                    <div className="flex items-center gap-2 mb-1">
                        {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4 text-primary' })}
                        <p className="text-xs text-white/70">{label}</p>
                    </div>
                    <p className="font-semibold text-sm text-white">{String(value)}</p>
                </div>
            );
        }

        const detailItems = [
            { icon: <BedDouble />, label: 'Camere', value: property.rooms },
            { icon: <Bath />, label: 'Băi', value: property.bathrooms },
            { icon: <Ruler />, label: 'Suprafață Utilă', value: property.squareFootage ? `${property.squareFootage} mp` : null },
            { icon: <Calendar />, label: 'An Construcție', value: property.constructionYear },
            { icon: <Layers />, label: 'Etaj', value: property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}` : property.floor || property.totalFloors },
            { icon: <Building />, label: 'Tip Proprietate', value: property.propertyType },
            { icon: <Handshake />, label: 'Tip Tranzacție', value: property.transactionType },
            { icon: <Maximize />, label: 'Suprafață Totală', value: property.totalSurface ? `${property.totalSurface} mp` : null },
            { icon: <Compass />, label: 'Orientare', value: property.orientation },
            { icon: <Layers />, label: 'Compartimentare', value: property.partitioning },
            { icon: <AlertTriangle />, label: 'Risc Seismic', value: property.seismicRisk },
            { icon: <Star />, label: 'Confort', value: property.comfort },
            { icon: <Paintbrush />, label: 'Stare Interior', value: property.interiorState },
            { icon: <Sofa />, label: 'Mobilier', value: property.furnishing },
            { icon: <Thermometer />, label: 'Sistem Încălzire', value: property.heatingSystem },
            { icon: <Car />, label: 'Parcare', value: property.parking },
            { icon: <ArrowUpDown />, label: 'Lift', value: property.lift },
            { icon: <Building />, label: 'Stare Clădire', value: property.buildingState },
            { icon: <Sofa />, label: 'Bucătărie', value: property.kitchen },
            { icon: <Maximize />, label: 'Balcon/Terasă', value: property.balconyTerrace }
        ];

        return (
            <div className="space-y-4">
                <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader>
                        <CardTitle>Descriere</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                        {property.amenities && property.amenities.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold mb-2">Dotări</h4>
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map(amenity => (
                                        <Badge key={amenity} variant="secondary" className="bg-white/10 text-white border-none">{amenity}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader>
                        <CardTitle>Informații Detaliate</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        {detailItems.map(item => (
                            <InfoButton key={item.label} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    // Desktop view
    return (
        <>
            <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
                <CardHeader>
                    <CardTitle>Descriere & Dotări</CardTitle>
                </CardHeader>
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
                    {property.amenities && property.amenities.length > 0 && (
                        <div className="mt-6">
                            <div className="flex flex-wrap gap-2">
                                {property.amenities.map(amenity => (
                                    <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default bg-muted lg:bg-white/10 lg:border-white/20">
                                        {amenity}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-4">
                    <Button variant="outline" className="w-full mt-2" onClick={() => setIsInfoDialogOpen(true)}>Vezi toate detaliile</Button>
                </CardFooter>
            </Card>
            <InfoDialog 
                property={property}
                isOpen={isInfoDialogOpen}
                onOpenChange={setIsInfoDialogOpen}
            />
        </>
    );
}
