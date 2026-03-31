'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, FileText, Info, CalendarCheck, ArrowRight, Menu } from "lucide-react";
import type { Property, Contact, Viewing } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MatchedLeadsTab } from "./MatchedLeadsTab";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import Link from 'next/link';
import { RlvTab } from "./RlvTab";
import { useState } from 'react';
import { InfoDialog } from './InfoDialog';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PropertyNotesCard } from "./actions/PropertyNotesCard";
import { PropertiesMap } from "@/components/map/PropertiesMap";

export function InfoColumn({ property, allContacts, viewings }: { property: Property, allContacts: Contact[], viewings: Viewing[] }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const TRUNCATION_LENGTH = 250;
    
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());
    
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setIsSheetOpen(false);
    };
    
    const menuItems = [
      { value: "overview", label: "Prezentare generală", icon: <LayoutList className="mr-2 h-4 w-4" /> },
      { value: "leads", label: "Cumpărători", icon: <Users className="mr-2 h-4 w-4" /> },
      { value: "viewings", label: "Vizionări", icon: <CalendarCheck className="mr-2 h-4 w-4" /> },
      { value: "documents", label: "RLV", icon: <FileText className="mr-2 h-4 w-4" /> },
    ];

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="hidden md:grid h-auto grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-3 md:grid-cols-5">
                    {menuItems.map(item => (
                         <TabsTrigger
                            key={item.value}
                            value={item.value}
                            className="h-12 rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200 shadow-none transition-colors hover:bg-emerald-400/14 hover:text-emerald-100 data-[state=active]:bg-emerald-400/18 data-[state=active]:text-white data-[state=active]:shadow-none"
                         >
                            {item.icon}
                            {item.label}
                        </TabsTrigger>
                    ))}
                    <div 
                        onClick={() => setIsInfoDialogOpen(true)}
                        className="inline-flex h-12 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-400/14 hover:text-emerald-100"
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Informații
                    </div>
                </TabsList>

                <div className="md:hidden">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Menu className="mr-2 h-4 w-4" />
                                Meniu Secțiune
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl bg-[#f8f8f9] text-black p-0">
                            <div className="flex flex-col gap-1 p-4">
                                {menuItems.map(item => (
                                     <Button key={item.value} variant={activeTab === item.value ? 'default' : 'ghost'} className="justify-start text-base py-6" onClick={() => handleTabChange(item.value)}>
                                        {item.icon}
                                        {item.label}
                                    </Button>
                                ))}
                                <Separator className="my-2" />
                                <Button variant='ghost' className="justify-start text-base py-6" onClick={() => { setIsInfoDialogOpen(true); setIsSheetOpen(false); }}>
                                    <Info className="mr-2 h-4 w-4" />
                                    Informații Detaliate
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
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
                    <div className="hidden lg:block h-[320px]">
                        <PropertiesMap properties={[property]} zoomMode="close" />
                    </div>
                    <div className="hidden lg:block">
                        <PropertyNotesCard property={property} />
                    </div>
                </TabsContent>
                <TabsContent value="leads" className="mt-6">
                    <MatchedLeadsTab property={property} allContacts={allContacts} />
                </TabsContent>
                <TabsContent value="viewings" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
                        <CardHeader><CardTitle>Vizionări Programate</CardTitle></CardHeader>
                        <CardContent>
                            {scheduledViewings.length > 0 ? (
                                <div className="space-y-3">
                                    {scheduledViewings.map(viewing => (
                                        <div key={viewing.id} className="flex items-center justify-between p-3 rounded-lg border lg:border-white/10">
                                            <div>
                                                <p className="font-semibold text-sm">{viewing.contactName}</p>
                                                <p className="text-xs text-muted-foreground lg:text-white/70">
                                                    {format(parseISO(viewing.viewingDate), "eeee, d MMMM yyyy 'la' HH:mm", { locale: ro })}
                                                </p>
                                            </div>
                                            <Button asChild variant="ghost" size="sm" className="lg:text-white/90 lg:hover:bg-white/20">
                                                <Link href={`/leads/${viewing.contactId}`}>
                                                    Vezi Cumpărător
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground lg:text-white/70 text-center py-8">Nicio vizionare programată pentru această proprietate.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="documents" className="mt-6">
                    <div className="space-y-6">
                        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
                          <CardHeader>
                            <CardTitle>Releveu Proprietate (RLV)</CardTitle>
                            <CardDescription className="lg:text-white/70">
                              Vizualizează sau încarcă releveul pentru această proprietate. Fișierul poate fi PDF sau imagine (JPG, PNG).
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                              <RlvTab property={property} />
                          </CardContent>
                        </Card>
                        <div className="h-[320px] lg:hidden">
                            <PropertiesMap properties={[property]} zoomMode="close" />
                        </div>
                    </div>
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
