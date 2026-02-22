'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Property } from "@/lib/types";
import { Button } from "../ui/button";
import { useState } from "react";
import { Info, Building, Calendar, MapPin, Compass, Layers, Maximize, BedDouble, Bath, Star, Paintbrush, Sofa, Thermometer, Car, Key, AlertTriangle, ArrowUpDown, Handshake } from 'lucide-react';
import { InfoDialog } from "./InfoDialog";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile?: boolean }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const TRUNCATION_LENGTH = 250;

    const infoItems = [
        { icon: <Layers className="h-5 w-5" />, label: "Compartimentare", value: property.partitioning },
        { icon: <BedDouble className="h-5 w-5" />, label: "Nr. camere", value: property.rooms },
        { icon: <Calendar className="h-5 w-5" />, label: "An construcție", value: property.constructionYear },
        { icon: <Layers className="h-5 w-5" />, label: "Etaj", value: property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}` : property.floor || property.totalFloors || 'N/A' },
        { icon: <Maximize className="h-5 w-5" />, label: "Suprafață utilă", value: property.squareFootage ? `${property.squareFootage} mp` : undefined },
        { icon: <Maximize className="h-5 w-5" />, label: "Suprafață cu balcon", value: property.totalSurface ? `${property.totalSurface} mp` : undefined },
        { icon: <Paintbrush className="h-5 w-5" />, label: "Stare interior", value: property.interiorState },
        { icon: <Sofa className="h-5 w-5" />, label: "Bucătărie", value: property.kitchen },
        { icon: <Maximize className="h-5 w-5" />, label: "Balcon", value: property.balconyTerrace },
        { icon: <ArrowUpDown className="h-5 w-5" />, label: "Lift", value: property.lift },
        { icon: <Thermometer className="h-5 w-5" />, label: "Sistem încălzire", value: property.heatingSystem },
    ];

    if (isMobile) {
        return (
            <div className="space-y-4">
                 <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                     <CardHeader>
                         <CardTitle className="text-white">Descriere</CardTitle>
                     </CardHeader>
                     <CardContent>
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
                          {property.amenities && property.amenities.length > 0 && (
                             <div className="mt-4 flex flex-wrap gap-2">
                                 {property.amenities.map(amenity => (
                                     <Badge key={amenity} variant="secondary" className="bg-white/10 text-white border-none">{amenity}</Badge>
                                 ))}
                             </div>
                          )}
                     </CardContent>
                 </Card>
                <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-white">Informații detaliate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {infoItems.map((item, index) => {
                             if (!item.value && item.value !== 0) return null;
                             return (
                                <div key={index} className="flex items-center justify-between p-3 rounded-lg border-cyan-400/50 bg-[#0F1E33] border shadow-[0_0_15px_-5px_rgba(100,220,255,0.6)]">
                                    <div className="flex items-center gap-3">
                                        <div className="text-cyan-400">{item.icon}</div>
                                        <p className="text-sm text-white/80">{item.label}</p>
                                    </div>
                                    <p className="font-semibold text-sm">{item.value}</p>
                                </div>
                             )
                        })}
                    </CardContent>
                </Card>
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
            <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
                <CardHeader>
                    <CardTitle>Descriere</CardTitle>
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
            </Card>

            <Button variant="outline" className="w-full lg:bg-white/10 lg:border-white/20 lg:text-white" onClick={() => setIsInfoDialogOpen(true)}>
                <Info className="mr-2 h-4 w-4" />
                Vezi toate informațiile detaliate
            </Button>
            
            <InfoDialog 
                property={property}
                isOpen={isInfoDialogOpen}
                onOpenChange={setIsInfoDialogOpen}
            />
        </div>
    )
}
