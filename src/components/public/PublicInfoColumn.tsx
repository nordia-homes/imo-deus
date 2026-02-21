'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Map, FileText, Info, Sparkles } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState } from 'react';
import { InfoDialog } from '@/components/properties/detail/InfoDialog';
import { PropertiesMap } from "@/components/map/PropertiesMap";
import { RlvTab } from "@/components/properties/detail/RlvTab";

export function PublicInfoColumn({ property }: { property: Property }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 500;
    
    const tabs = [
        { value: "overview", label: "Prezentare generală", icon: <LayoutList className="mr-2 h-4 w-4" /> },
        { value: "location", label: "Vezi locația", icon: <Map className="mr-2 h-4 w-4" /> },
        { value: "rlv", label: "RLV", icon: <FileText className="mr-2 h-4 w-4" /> },
        { value: "amenities", label: "Caracteristici", icon: <Sparkles className="mr-2 h-4 w-4" /> },
    ];

    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview">
                <TabsList className="hidden md:grid h-auto grid-cols-5 gap-2 bg-transparent p-0">
                    {tabs.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl lg:bg-[#152A47] lg:text-white lg:border-white/10 lg:data-[state=active]:bg-primary">
                            {tab.icon}
                            {tab.label}
                        </TabsTrigger>
                    ))}
                    <div 
                        onClick={() => setIsInfoDialogOpen(true)}
                        className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium cursor-pointer hover:bg-accent hover:shadow-xl transition-all lg:bg-[#152A47] lg:text-white lg:border-white/10 lg:hover:bg-white/5"
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Informații
                    </div>
                </TabsList>
                
                {/* Mobile tabs would go here if needed, but the prompt says desktop only */}

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <Card className="rounded-2xl shadow-2xl bg-white lg:bg-[#152A47] lg:text-white lg:border-none">
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
                </TabsContent>
                <TabsContent value="location" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-white lg:bg-[#152A47] lg:text-white lg:border-none h-[500px]">
                        <PropertiesMap properties={[property]} />
                    </Card>
                </TabsContent>
                <TabsContent value="rlv" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-white lg:bg-[#152A47] lg:text-white lg:border-none">
                      <CardHeader>
                        <CardTitle>Releveu Proprietate (RLV)</CardTitle>
                        <CardDescription className="lg:text-white/70">
                          Vizualizează releveul pentru această proprietate, dacă este disponibil.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                          <RlvTab property={property} />
                      </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="amenities" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-white lg:bg-[#152A47] lg:text-white lg:border-none">
                        <CardHeader><CardTitle>Dotări și Caracteristici</CardTitle></CardHeader>
                         <CardContent>
                             {property.amenities && property.amenities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map(amenity => (
                                        <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default bg-muted lg:bg-white/10 lg:border-white/20">
                                            {amenity}
                                        </Button>
                                    ))}
                                </div>
                             ) : <p className="text-muted-foreground lg:text-white/70">Nicio caracteristică specificată.</p>}
                         </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <InfoDialog 
                property={property}
                isOpen={isInfoDialogOpen}
                onOpenChange={setIsInfoDialogOpen}
            />
        </div>
    )
}
