'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Property } from "@/lib/types";
import { ArrowUpDown, Bath, BedDouble, Building, Calendar, Compass, Key, Layers, Maximize, Paintbrush, Car, Star, Sofa, Thermometer, AlertTriangle, Handshake, Lift } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile?: boolean }) {

    const details = [
        { label: 'Compartimentare', value: property.partitioning },
        { label: 'Nr. Camere', value: property.rooms },
        { label: 'An Construcție', value: property.constructionYear },
        { label: 'Etaj', value: property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}` : property.floor || property.totalFloors || 'N/A' },
        { label: 'Suprafață Utilă', value: property.squareFootage ? `${property.squareFootage} mp` : undefined },
        { label: 'Suprafață cu Balcon', value: property.totalSurface ? `${property.totalSurface} mp` : undefined },
        { label: 'Stare Interior', value: property.interiorState },
        { label: 'Bucătărie', value: property.kitchen },
        { label: 'Balcon/Terasă', value: property.balconyTerrace },
        { label: 'Lift', value: property.lift },
        { label: 'Sistem Încălzire', value: property.heatingSystem },
    ];
    
    const InfoItem = ({ label, value }: { label: string, value: string | number | undefined | null }) => {
        if (!value && value !== 0) return null;
        return (
            <Button variant="outline" className="w-full justify-between pointer-events-none bg-white/10 border-white/20 text-white h-auto py-3">
                <span className="text-white/70">{label}</span>
                <span className="font-semibold text-base">{value}</span>
            </Button>
        )
    };

    if (isMobile) {
        return (
            <div className="space-y-4 px-2">
                <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xl font-bold">Descriere</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                          {property.description || 'Nicio descriere adăugată.'}
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xl font-bold">Detalii Proprietate</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                        {details.map(item => (
                            <InfoItem key={item.label} label={item.label} value={item.value} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Desktop view remains unchanged
    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
            <CardHeader>
                <CardTitle>Descriere</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-white/80 whitespace-pre-wrap">
                    {property.description || 'Nicio descriere adăugată.'}
                </p>
                {property.amenities && property.amenities.length > 0 && (
                    <div className="mt-6">
                        <h4 className="font-semibold mb-3">Dotări și Facilități</h4>
                        <div className="flex flex-wrap gap-2">
                            {property.amenities.map(amenity => (
                                <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default bg-white/10 border-white/20">
                                    {amenity}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
