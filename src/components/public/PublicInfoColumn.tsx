'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, FileText, Info, Map, CheckSquare } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RlvTab } from "./RlvTab";
import { useState } from "react";
import { InfoDialog } from "./InfoDialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

export function PublicInfoColumn({ property }: { property: Property }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const TRUNCATION_LENGTH = 500;

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setIsSheetOpen(false);
    };

    const menuItems = [
      { value: "overview", label: "Prezentare generală", icon: <LayoutList className="mr-2 h-4 w-4" /> },
      { value: "location", label: "Vezi locația", icon: <Map className="mr-2 h-4 w-4" /> },
      { value: "rlv", label: "RLV", icon: <FileText className="mr-2 h-4 w-4" /> },
      { value: "features", label: "Caracteristici", icon: <CheckSquare className="mr-2 h-4 w-4" /> },
    ];
    
    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="hidden md:grid h-auto grid-cols-5 gap-2 bg-transparent p-0">
                    {menuItems.map(item => (
                         <Button
                            key={item.value}
                            variant="outline"
                            className="h-10 rounded-lg border-primary/50 text-primary bg-transparent hover:bg-primary/10 glow-card"
                            onClick={() => handleTabChange(item.value)}
                            data-state={activeTab === item.value ? 'active' : 'inactive'}
                         >
                            {item.icon}
                            {item.label}
                        </Button>
                    ))}
                    <Button 
                        variant="outline"
                        className="h-10 rounded-lg border-primary/50 text-primary bg-transparent hover:bg-primary/10 glow-card"
                        onClick={() => setIsInfoDialogOpen(true)}
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Informații
                    </Button>
                </div>

                {/* Mobile Menu Trigger */}
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
                    <p className="text-muted-foreground lg:text-white/70 whitespace-pre-wrap">
                        {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded) 
                            ? `${'\'\'\''}${property.description.substring(0, TRUNCATION_LENGTH)}...`
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
                </TabsContent>
                <TabsContent value="location" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader>
                            <CardTitle>Locație pe Hartă</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {property.latitude && property.longitude ? (
                                <iframe
                                    className="w-full aspect-video rounded-md border"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude-0.01},${property.latitude-0.01},${property.longitude+0.01},${property.latitude+0.01}&layer=mapnik&marker=${property.latitude},${property.longitude}`}>
                                </iframe>
                            ) : (
                                <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                    <p className="text-sm text-muted-foreground">Coordonatele hărții nu sunt disponibile.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="rlv" className="mt-6">
                    <RlvTab property={property} />
                </TabsContent>
                <TabsContent value="features" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                        <CardHeader>
                            <CardTitle>Caracteristici & Dotări</CardTitle>
                        </CardHeader>
                         {property.amenities && property.amenities.length > 0 && (
                            <CardContent>
                                 <div className="flex flex-wrap gap-2">
                                    {property.amenities.map(amenity => (
                                        <Button key={amenity} variant="secondary" className="pointer-events-none cursor-default bg-white/10 border-none text-white">
                                            {amenity}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                         )}
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
