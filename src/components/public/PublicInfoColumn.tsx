'use client';

import { useState } from 'react';
import type { Property } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RlvTab } from '@/components/properties/detail/RlvTab';
import { InfoDialog } from '@/components/properties/detail/InfoDialog';
import { Info, LayoutList, Map, FileText, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile: boolean }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 500;

    const descriptionContent = (
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
            {property.amenities && property.amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {property.amenities.map(amenity => (
                        <Badge key={amenity} variant="secondary" className="bg-white/10 text-white border-none">{amenity}</Badge>
                    ))}
                </div>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <>
                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['description']}>
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                        <AccordionItem value="description" className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold">Descriere & Dotări</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0">
                                {descriptionContent}
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                        <AccordionItem value="info" className="border-b-0">
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold">Informații Detaliate</AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0">
                                <Button variant="outline" className="w-full mt-2 bg-white/10 border-white/20" onClick={() => setIsInfoDialogOpen(true)}>Vezi toate detaliile</Button>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                        <AccordionItem value="rlv" className="border-b-0">
                           <AccordionTrigger className="p-4 hover:no-underline font-semibold">Releveu Proprietate (RLV)</AccordionTrigger>
                           <AccordionContent className="px-2 pb-2 pt-0">
                               <RlvTab property={property} />
                           </AccordionContent>
                       </AccordionItem>
                   </Card>
                </Accordion>
                <InfoDialog property={property} isOpen={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen} />
            </>
        );
    }
    
    // Desktop View
    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto bg-transparent p-0 gap-2">
                    <TabsTrigger value="overview" className="h-10 rounded-lg border-cyan-400/50 glow-card text-white bg-transparent hover:bg-cyan-400/10 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-xl transition-all">
                        <LayoutList className="mr-2 h-4 w-4" /> Prezentare generală
                    </TabsTrigger>
                    <TabsTrigger value="location" className="h-10 rounded-lg border-cyan-400/50 glow-card text-white bg-transparent hover:bg-cyan-400/10 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-xl transition-all">
                        <Map className="mr-2 h-4 w-4" /> Vezi locația
                    </TabsTrigger>
                     <TabsTrigger value="rlv" className="h-10 rounded-lg border-cyan-400/50 glow-card text-white bg-transparent hover:bg-cyan-400/10 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-xl transition-all">
                        <FileText className="mr-2 h-4 w-4" /> RLV
                    </TabsTrigger>
                     <TabsTrigger value="features" className="h-10 rounded-lg border-cyan-400/50 glow-card text-white bg-transparent hover:bg-cyan-400/10 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-xl transition-all">
                        <Star className="mr-2 h-4 w-4" /> Caracteristici
                    </TabsTrigger>
                    <Button onClick={() => setIsInfoDialogOpen(true)} className="h-10 rounded-lg border-cyan-400/50 glow-card text-white bg-transparent hover:bg-cyan-400/10 active:bg-cyan-400/20 transition-all">
                        <Info className="mr-2 h-4 w-4" /> Informații
                    </Button>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                        <CardContent>{descriptionContent}</CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="location" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader><CardTitle>Locație pe Hartă</CardTitle></CardHeader>
                         <CardContent>
                            {property.address && (
                                <iframe
                                    className="w-full aspect-video rounded-md border"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(property.address)}`}>
                                </iframe>
                            )}
                         </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="rlv" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader><CardTitle>Releveu Proprietate (RLV)</CardTitle></CardHeader>
                        <CardContent><RlvTab property={property} /></CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="features" className="mt-6">
                     <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                         <CardHeader><CardTitle>Caracteristici & Dotări</CardTitle></CardHeader>
                         <CardContent>
                            {property.amenities && property.amenities.length > 0 ? (
                                 <div className="flex flex-wrap gap-2">
                                    {property.amenities.map(amenity => (
                                        <Badge key={amenity} variant="secondary" className="bg-white/10 text-white border-none">{amenity}</Badge>
                                    ))}
                                </div>
                            ) : <p className="text-white/70">Nicio caracteristică specificată.</p>}
                         </CardContent>
                     </Card>
                 </TabsContent>
            </Tabs>
            <InfoDialog property={property} isOpen={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen} />
        </div>
    );
}
