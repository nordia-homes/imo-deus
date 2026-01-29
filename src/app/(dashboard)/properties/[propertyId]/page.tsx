
import { properties } from "@/lib/data";
import { Property } from "@/lib/types";
import { notFound } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyContractsTab } from "@/components/properties/PropertyContractsTab";
import { PropertyPromotionsTab } from "@/components/properties/PropertyPromotionsTab";
import { PropertyPresentationsTab } from "@/components/properties/PropertyPresentationsTab";
import AiInsightCard from "@/components/ai/AiInsightCard";

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
import React from "react";


const getPropertyById = async (id: string): Promise<Property | undefined> => {
    return properties.find(p => p.id === id);
}

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

export default async function PropertyDetailPage({ params }: { params: { propertyId: string } }) {
    const property = await getPropertyById(params.propertyId);

    if (!property) {
        notFound();
    }
    
    const allImages = property.images.map(img => img.url);

    // Placeholder for AI Insights
    const aiInsights = {
        marketScore: 85,
        pricingFeedback: 'Prețul este cu 5% peste media pieței pentru proprietăți similare în această zonă, dar se justifică prin finisajele de lux.',
        buyerProfile: 'Ideal pentru cupluri tinere sau profesioniști din domeniul IT, care caută o locuință modernă, conectată la oraș.'
    };

    return (
        <div className="space-y-6">
            <header className="space-y-2">
                <div>
                     <h1 className="text-3xl font-headline font-bold">{property.title}</h1>
                     <p className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> {property.address}</p>
                </div>
                <PropertyGallery images={allImages} title={property.title} />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                     <Tabs defaultValue="details">
                        <TabsList className="mb-4">
                            <TabsTrigger value="details">Detalii Proprietate</TabsTrigger>
                            <TabsTrigger value="contracts">Contracte</TabsTrigger>
                            <TabsTrigger value="presentations">Prezentări</TabsTrigger>
                            <TabsTrigger value="promotions">Promovare</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details">
                           <div className="space-y-6">
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
                                     <FeatureItem icon={<Ruler />} label="Suprafață utilă" value={`${property.squareFootage} mp`} />
                                     {property.totalSurface && <FeatureItem icon={<Ruler />} label="Suprafață construită" value={`${property.totalSurface} mp`} />}
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

                             <Card>
                                 <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                                 <CardContent>
                                      <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center">
                                          <p className="text-muted-foreground">
                                              Placeholder hartă (iframe) pentru {property.latitude}, {property.longitude}
                                          </p>
                                      </div>
                                 </CardContent>
                             </Card>
                           </div>
                        </TabsContent>
                         <TabsContent value="contracts"><PropertyContractsTab propertyId={property.id} /></TabsContent>
                         <TabsContent value="presentations"><PropertyPresentationsTab propertyId={property.id} /></TabsContent>
                         <TabsContent value="promotions"><PropertyPromotionsTab propertyId={property.id} /></TabsContent>
                     </Tabs>

                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card className="sticky top-20">
                         <CardHeader>
                             <CardTitle className="text-3xl font-bold">€{property.price.toLocaleString()}</CardTitle>
                             <CardDescription>{property.transactionType}</CardDescription>
                         </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center gap-4">
                                 <Avatar className="h-14 w-14">
                                     <AvatarFallback>{property.agent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                 </Avatar>
                                 <div>
                                     <p className="font-semibold">{property.agent.name}</p>
                                     <p className="text-sm text-muted-foreground">Agent imobiliar</p>
                                 </div>
                             </div>
                             <Button size="lg" className="w-full">Contactează Agentul</Button>
                        </CardContent>
                    </Card>
                    
                    <AiInsightCard insights={aiInsights} />
                </div>
            </div>
        </div>
    )
}
