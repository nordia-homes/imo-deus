'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Map, FileText, ListChecks, Info } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RlvTab } from "@/components/properties/detail/RlvTab";
import React, { useState } from 'react';
import { Separator } from "@/components/ui/separator";

const InfoItem = ({ label, value }: { label: string, value: string | number | undefined | null }) => {
    if (!value && value !== 0) return null;
    return (
         <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
            <p className="text-white/70">{label}</p>
            <p className="font-semibold">{value}</p>
        </div>
    )
}

export function PublicInfoColumn({ property }: { property: Property }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 500;

    const menuItems = [
      { value: "overview", label: "Prezentare generală", icon: <LayoutList className="mr-2 h-4 w-4" /> },
      { value: "location", label: "Vezi locația", icon: <Map className="mr-2 h-4 w-4" /> },
      { value: "rlv", label: "RLV", icon: <FileText className="mr-2 h-4 w-4" /> },
      { value: "features", label: "Caracteristici", icon: <ListChecks className="mr-2 h-4 w-4" /> },
      { value: "info", label: "Informații", icon: <Info className="mr-2 h-4 w-4" /> },
    ];
    
    const hasLocation = property.latitude && property.longitude;
    const mapEmbedUrl = hasLocation
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude-0.005}%2C${property.latitude-0.005}%2C${property.longitude+0.005}%2C${property.latitude+0.005}&layer=mapnik&marker=${property.latitude}%2C${property.longitude}`
        : '';

    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-5 gap-2 bg-transparent p-0">
                    {menuItems.map(item => (
                         <TabsTrigger key={item.value} value={item.value} className="h-auto md:h-12 py-2 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl lg:bg-[#152A47] lg:text-white lg:border-white/10 lg:data-[state=active]:bg-primary flex flex-col md:flex-row gap-1 md:gap-2">
                            {item.icon}
                            <span className="text-xs text-center md:text-sm">{item.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                        <CardContent>
                             <div>
                                <p className="text-white/70 whitespace-pre-wrap">
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
                </TabsContent>
                <TabsContent value="location" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader>
                            <CardTitle>Locație pe Hartă</CardTitle>
                            <CardDescription className="text-white/70">{property.address}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasLocation ? (
                                <iframe
                                    className="w-full h-96 rounded-md border-0"
                                    loading="lazy"
                                    allowFullScreen
                                    src={mapEmbedUrl}
                                ></iframe>
                            ) : (
                                <div className="h-96 flex items-center justify-center bg-white/5 rounded-md">
                                    <p className="text-white/70">Locația nu este disponibilă pe hartă.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="rlv" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                      <CardHeader>
                        <CardTitle>Releveu Proprietate (RLV)</CardTitle>
                        <CardDescription className="text-white/70">
                          Vizualizează releveul pentru această proprietate.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                          <RlvTab property={property} />
                      </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="features" className="mt-6">
                     <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader>
                            <CardTitle>Caracteristici & Dotări</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                <InfoItem label="Tip proprietate" value={property.propertyType} />
                                <InfoItem label="Tip tranzacție" value={property.transactionType} />
                                <InfoItem label="An construcție" value={property.constructionYear} />
                                <InfoItem label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors || 'N/A' } />
                                <InfoItem label="Camere" value={property.rooms} />
                                <InfoItem label="Băi" value={property.bathrooms} />
                                <InfoItem label="Suprafață utilă" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
                                <InfoItem label="Suprafață totală" value={property.totalSurface ? `${property.totalSurface} mp` : undefined} />
                                <InfoItem label="Compartimentare" value={property.partitioning} />
                                <InfoItem label="Stare interior" value={property.interiorState} />
                                <InfoItem label="Mobilier" value={property.furnishing} />
                                <InfoItem label="Sistem încălzire" value={property.heatingSystem} />
                            </div>
                            {property.amenities && property.amenities.length > 0 && (
                                <div className="mt-6">
                                     <h4 className="font-semibold text-lg mb-3">Dotări</h4>
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
                </TabsContent>
                <TabsContent value="info" className="mt-6">
                     <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader>
                            <CardTitle>Informații Suplimentare</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                <InfoItem label="Confort" value={property.comfort} />
                                <InfoItem label="Stare clădire" value={property.buildingState} />
                                <InfoItem label="Risc seismic" value={property.seismicRisk} />
                                <InfoItem label="Balcon/Terasă" value={property.balconyTerrace} />
                                <InfoItem label="Bucătărie" value={property.kitchen} />
                                <InfoItem label="Lift" value={property.lift} />
                                <InfoItem label="Parcare" value={property.parking} />
                                <InfoItem label="Orientare" value={property.orientation} />
                            </div>
                        </CardContent>
                     </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
