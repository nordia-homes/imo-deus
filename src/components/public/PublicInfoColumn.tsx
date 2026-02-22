'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Map, FileText, Info } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RlvTab } from "../properties/detail/RlvTab";
import { useState } from "react";
import { InfoDialog } from "../properties/detail/InfoDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile: boolean }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 500;

    if (isMobile) {
        return (
            <>
                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['description']}>
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                        <AccordionItem value="description" className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Descriere & Dotări</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0">
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
                                            <Button key={amenity} variant="secondary" size="sm" className="pointer-events-none cursor-default bg-white/10 text-white border-none">{amenity}</Button>
                                        ))}
                                    </div>
                                 )}
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                        <AccordionItem value="info" className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Informații Detaliate</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0">
                                 <Button variant="outline" className="w-full mt-2 bg-white/10 border-white/20" onClick={() => setIsInfoDialogOpen(true)}>Vezi toate detaliile</Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                     <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                         <AccordionItem value="rlv" className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Releveu Proprietate (RLV)</AccordionTrigger>
                            <AccordionContent className="px-2 pb-2 pt-0">
                                <RlvTab property={property} />
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                </Accordion>
                <InfoDialog 
                    property={property}
                    isOpen={isInfoDialogOpen}
                    onOpenChange={setIsInfoDialogOpen}
                />
            </>
        );
    }
    
    // Desktop view
    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview">
                <TabsList className="grid h-auto w-full grid-cols-5 gap-2 bg-transparent p-0">
                    <TabsTrigger value="overview" className="h-10 border bg-transparent text-foreground shadow-lg hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl glow-card"><LayoutList className="mr-2 h-4 w-4" /> Prezentare generală</TabsTrigger>
                    <TabsTrigger value="location" className="h-10 border bg-transparent text-foreground shadow-lg hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl glow-card"><Map className="mr-2 h-4 w-4" /> Vezi locația</TabsTrigger>
                    <TabsTrigger value="documents" className="h-10 border bg-transparent text-foreground shadow-lg hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl glow-card"><FileText className="mr-2 h-4 w-4" /> RLV</TabsTrigger>
                    <TabsTrigger value="features" className="h-10 border bg-transparent text-foreground shadow-lg hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl glow-card"><Info className="mr-2 h-4 w-4" /> Caracteristici</TabsTrigger>
                    <div 
                        onClick={() => setIsInfoDialogOpen(true)}
                        className="h-10 border bg-transparent text-foreground shadow-lg inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer hover:bg-accent/50 hover:shadow-xl glow-card"
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Informații
                    </div>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <Card className="rounded-2xl shadow-lg bg-card text-card-foreground">
                        <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                        <CardContent>
                             <div>
                                <p className="text-muted-foreground whitespace-pre-wrap">
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
                    <Card>
                        <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                        <CardContent>
                             {(property.latitude && property.longitude) ? (
                                <iframe
                                    className="w-full aspect-video rounded-md border"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://www.google.com/maps/embed/v1/view?key=&center=${property.latitude},${property.longitude}&zoom=15`}>
                                </iframe>
                             ) : <p>Locație indisponibilă.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="documents" className="mt-6">
                    <Card><CardHeader><CardTitle>Releveu</CardTitle></CardHeader><CardContent><RlvTab property={property}/></CardContent></Card>
                </TabsContent>
                 <TabsContent value="features" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Dotări & Caracteristici</CardTitle></CardHeader>
                        <CardContent>
                            {property.amenities && property.amenities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map(amenity => (
                                        <Button key={amenity} variant="outline" className="pointer-events-none cursor-default">{amenity}</Button>
                                    ))}
                                </div>
                            ) : <p>Nicio dotare specificată.</p>}
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
