'use client';

import { useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyGallery } from "@/components/properties/PropertyGallery";
import { PropertyContractsTab } from "@/components/properties/PropertyContractsTab";
import { PropertyPromotionsTab } from "@/components/properties/PropertyPromotionsTab";
import { PropertyPresentationsTab } from "@/components/properties/PropertyPresentationsTab";
import AiInsightCard from "@/components/ai/AiInsightCard";
import { generatePropertyInsights, type PropertyInsightsOutput } from '@/ai/flows/property-insights-generator';
import { useToast } from '@/hooks/use-toast';

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

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { toast } = useToast();

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [insights, setInsights] = useState<PropertyInsightsOutput | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const propertyDocRef = useMemoFirebase(() => {
        if (!user || !propertyId) return null;
        return doc(firestore, 'users', user.uid, 'properties', propertyId);
    }, [firestore, user, propertyId]);

    const { data: property, isLoading: isDocLoading, error } = useDoc<Property>(propertyDocRef);

    const handleGenerateInsights = async () => {
        if (!property) return;
        setIsGenerating(true);
        try {
            const result = await generatePropertyInsights({
                propertyType: property.propertyType,
                location: property.location,
                price: property.price,
                bedrooms: property.bedrooms,
                squareFootage: property.squareFootage,
                constructionYear: property.constructionYear,
                keyFeatures: property.keyFeatures || '',
            });
            setInsights(result);
            toast({
                title: "Perspective AI generate!",
                description: "Analiza de piață pentru proprietate este gata.",
            });
        } catch (error) {
            console.error("Failed to generate AI insights:", error);
            toast({
                variant: "destructive",
                title: "A apărut o eroare",
                description: "Nu am putut genera perspectivele AI. Încercați din nou.",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const isLoading = isUserLoading || isDocLoading;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-[550px] w-full rounded-lg" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                    <div className="lg:col-span-1">
                        <Skeleton className="h-48 w-full" />
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        return <div className="text-center text-red-500">A apărut o eroare la încărcarea proprietății.</div>;
    }

    if (!user || !property) {
        notFound();
        return null;
    }
    
    const propertyImages = (property.images || [])
        .map(img => {
            // Case 1: img is an object with a 'url' property
            if (typeof img === 'object' && img !== null && 'url' in img && typeof (img as any).url === 'string') {
                return (img as any).url;
            }
            // Case 2: img is already a string
            if (typeof img === 'string') {
                return img;
            }
            return null;
        })
        .filter(Boolean) as string[];

    const allImages = propertyImages.length > 0 ? propertyImages : (property.imageUrl ? [property.imageUrl] : ['https://placehold.co/1200x800']);
    const agentEmail = user?.email;

    return (
        <div className="space-y-6">
            <header className="space-y-2">
                <div>
                     <h1 className="text-3xl font-headline font-bold">{property.title}</h1>
                     <p className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> {property.address}</p>
                </div>
                <PropertyGallery images={allImages} title={property.title || 'Proprietate'} />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                     <Tabs defaultValue="details">
                        <TabsList className="mb-4">
                            <TabsTrigger value="details">Detalii Proprietate</TabsTrigger>
                            <TabsTrigger value="promotions">Promovare</TabsTrigger>
                            <TabsTrigger value="contracts">Contracte</TabsTrigger>
                            <TabsTrigger value="presentations">Prezentări</TabsTrigger>
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
                                      <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center">
                                          <p className="text-muted-foreground">
                                              Placeholder hartă (iframe) pentru {property.latitude || 'lat'}, {property.longitude || 'long'}
                                          </p>
                                      </div>
                                 </CardContent>
                             </Card>
                           </div>
                        </TabsContent>
                         <TabsContent value="promotions"><PropertyPromotionsTab property={property} /></TabsContent>
                         <TabsContent value="contracts"><PropertyContractsTab propertyId={property.id} /></TabsContent>
                         <TabsContent value="presentations"><PropertyPresentationsTab propertyId={property.id} /></TabsContent>
                     </Tabs>

                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card className="sticky top-20">
                         <CardHeader>
                             <CardTitle className="text-3xl font-bold">€{property.price.toLocaleString()}</CardTitle>
                             <CardDescription>{property.transactionType}</CardDescription>
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
                    
                    <AiInsightCard 
                        insights={insights}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerateInsights}
                    />
                </div>
            </div>
        </div>
    )
}
