'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, BedDouble, Ruler, Calendar, Layers, Handshake, Building } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "../ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile?: boolean }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 250;

    const details = [
        { label: 'Compartimentare', value: property.partitioning, icon: <Layers className="h-5 w-5 text-primary" /> },
        { label: 'Nr. camere', value: property.rooms, icon: <BedDouble className="h-5 w-5 text-primary" /> },
        { label: 'An construcție', value: property.constructionYear, icon: <Calendar className="h-5 w-5 text-primary" /> },
        { label: 'Etaj', value: property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors, icon: <Layers className="h-5 w-5 text-primary" /> },
        { label: 'Suprafață utilă', value: property.squareFootage ? `${property.squareFootage} mp` : null, icon: <Ruler className="h-5 w-5 text-primary" /> },
        { label: 'Suprafață cu balcon', value: property.totalSurface ? `${property.totalSurface} mp`: null, icon: <Ruler className="h-5 w-5 text-primary" /> },
        { label: 'Stare interior', value: property.interiorState, icon: <Building className="h-5 w-5 text-primary" /> },
        { label: 'Bucătărie', value: property.kitchen, icon: <BedDouble className="h-5 w-5 text-primary" /> },
        { label: 'Balcon/Terasă', value: property.balconyTerrace, icon: <BedDouble className="h-5 w-5 text-primary" /> },
        { label: 'Lift', value: property.lift, icon: <Layers className="h-5 w-5 text-primary" /> },
        { label: 'Sistem încălzire', value: property.heatingSystem, icon: <BedDouble className="h-5 w-5 text-primary" /> },
    ].filter(item => item.value);

    const cardClasses = isMobile 
        ? "bg-[#152A47] text-white border-none rounded-2xl"
        : "bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none";
    
    const mutedTextClasses = isMobile 
        ? "text-white/70"
        : "text-muted-foreground lg:text-white/70";

    if (isMobile) {
        return (
            <div className="space-y-4">
                 <Card className={cardClasses}>
                    <CardHeader>
                        <CardTitle>Descriere</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div>
                            <p className={cn("whitespace-pre-wrap", mutedTextClasses)}>
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
                 <Card className={cardClasses}>
                    <CardHeader>
                        <CardTitle>Informații Detaliate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {details.map(item => (
                            <Button key={item.label} variant="outline" className="w-full justify-between pointer-events-none bg-white/10 border-white/20">
                                <div className="flex items-center gap-2">
                                    {item.icon}
                                    <span className="text-white/80">{item.label}</span>
                                </div>
                                <span className="font-semibold text-white">{item.value}</span>
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <Card className={cardClasses}>
            <CardHeader>
                <CardTitle>Descriere</CardTitle>
            </CardHeader>
            <CardContent>
                <div>
                    <p className={cn("whitespace-pre-wrap", mutedTextClasses)}>
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
    );
}
