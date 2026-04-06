'use client';

import type { Property } from '@/lib/types';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import React from 'react';
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
    BedDouble,
    Bath,
    Ruler,
    Building,
    CalendarDays,
    Layers,
    Thermometer,
    Car,
    Sparkles,
    CheckCircle2,
    MapPin,
    Tag,
    HandCoins
} from "lucide-react";

const FeatureItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value?: string | number | null }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-3 rounded-lg p-3 bg-muted/50">
            <div className="text-primary pt-1">{icon}</div>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold text-card-foreground">{value}</p>
            </div>
        </div>
    );
};


export function PropertyClientView({ property }: { property: Property }) {
  const { agency } = usePublicAgency();
  const displaySurface = property.totalSurface ?? property.squareFootage;
  
  const propertyImages = (property.images || []).map(img => img.url).filter(Boolean);
  const allImages = propertyImages.length > 0 ? propertyImages : ['https://placehold.co/1200x800?text=Imagine+lipsa'];
  const agentEmail = agency?.email;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-2">
            <div>
                 <h1 className="text-3xl font-headline font-bold">{property.title}</h1>
                 <p className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> {property.address}</p>
            </div>
            <PropertyGallery images={allImages} title={property.title || 'Proprietate'} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                 <Card>
                     <CardHeader>
                         <CardTitle>Descriere</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                     </CardContent>
                 </Card>

                 <Card>
                     <CardHeader><CardTitle>Caracteristici Esențiale</CardTitle></CardHeader>
                     <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                         <FeatureItem icon={<HandCoins />} label="Tip tranzacție" value={property.transactionType} />
                         <FeatureItem icon={<Building />} label="Tip proprietate" value={property.propertyType} />
                         <FeatureItem icon={<Ruler />} label="Suprafață" value={displaySurface ? `${displaySurface} mp` : undefined} />
                         <FeatureItem icon={<BedDouble />} label="Dormitoare" value={property.bedrooms} />
                         <FeatureItem icon={<Bath />} label="Băi" value={property.bathrooms} />
                         <FeatureItem icon={<CalendarDays />} label="An construcție" value={property.constructionYear} />
                         <FeatureItem icon={<Layers />} label="Etaj" value={property.floor} />
                         <FeatureItem icon={<Sparkles />} label="Stare interior" value={property.interiorState} />
                         <FeatureItem icon={<Tag />} label="Confort" value={property.comfort} />
                         <FeatureItem icon={<Thermometer />} label="Sistem încălzire" value={property.heatingSystem} />
                         <FeatureItem icon={<Car />} label="Parcare" value={property.parking} />
                     </CardContent>
                 </Card>

                  {property.amenities && property.amenities.length > 0 && (
                    <Card>
                        <CardHeader><CardTitle>Dotări și Facilități</CardTitle></CardHeader>
                        <CardContent>
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-2">
                                {property.amenities.map(amenity => (
                                    <div key={amenity} className="flex items-center gap-2 break-inside-avoid">
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                        <span className="text-sm">{amenity}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                  )}


                 <Card>
                    <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                    <CardContent>
                        {(property.latitude && property.longitude) ? (
                            <iframe
                                className="w-full aspect-video rounded-md"
                                loading="lazy"
                                allowFullScreen
                                src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=ro&z=15&output=embed`}
                            >
                            </iframe>
                        ) : (
                            <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center">
                                <p className="text-muted-foreground">
                                    Coordonatele GPS nu sunt disponibile pentru această proprietate.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1">
                 <Card className="sticky top-24">
                     <CardHeader>
                         <CardTitle className="text-3xl font-bold">€{property.price.toLocaleString()}</CardTitle>
                         <CardDescription>{property.transactionType === 'Închiriere' ? 'pe lună' : 'preț de vânzare'}</CardDescription>
                     </CardHeader>
                    <CardContent className="space-y-4">
                         {property.agent && (
                            <div className="flex items-center gap-4">
                                <Avatar className="h-14 w-14">
                                    <AvatarFallback>{property.agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{property.agent.name}</p>
                                    <p className="text-sm text-muted-foreground">Agent imobiliar</p>
                                </div>
                            </div>
                         )}
                         <Button size="lg" className="w-full" asChild disabled={!agentEmail}>
                            <a href={`mailto:${agentEmail}?subject=Interes%20pentru%20proprietatea%20${encodeURIComponent(property.title || '')}`}>
                                Contactează Agentul
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  )
}
