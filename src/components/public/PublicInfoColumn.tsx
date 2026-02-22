'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, FileText, Info, CalendarCheck, ArrowRight, Menu, Map, Car, Building } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RlvTab } from "../properties/detail/RlvTab";
import { useState } from "react";
import { InfoDialog } from "../properties/detail/InfoDialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export function PublicInfoColumn({ property }: { property: Property }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    
    const menuItems = [
      { value: "overview", label: "Prezentare generală", icon: <LayoutList className="mr-2 h-4 w-4" /> },
      { value: "location", label: "Vezi locația", icon: <Map className="mr-2 h-4 w-4" /> },
      { value: "rlv", label: "RLV", icon: <FileText className="mr-2 h-4 w-4" /> },
      { value: "features", label: "Caracteristici", icon: <Building className="mr-2 h-4 w-4" /> },
    ];

    const glowClasses = "border border-green-400/50 bg-transparent text-green-300 hover:bg-green-900/50 hover:text-green-200 hover:border-green-400 shadow-[0_0_10px_0] shadow-green-500/30 transition-all duration-300";

    const renderTabsContent = () => (
        <>
            <TabsContent value="overview">
                <Card className="bg-transparent border-none shadow-none">
                    <CardContent className="text-white/80 whitespace-pre-wrap p-0 pt-6">
                        {property.description || 'Nicio descriere adăugată.'}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="location">
                 <Card className="bg-transparent border-none shadow-none">
                    <CardContent className="p-0 pt-6">
                        <iframe
                            className="w-full aspect-video rounded-md border"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(property.address)}`}>
                        </iframe>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="rlv">
                <Card className="bg-transparent border-none shadow-none">
                    <CardContent className="p-0 pt-6">
                        <RlvTab property={property} />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="features">
                 <Card className="bg-transparent border-none shadow-none">
                    <CardContent className="p-0 pt-6">
                        {property.amenities && property.amenities.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {property.amenities.map(amenity => (
                                    <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default bg-white/10 text-white border-white/20">
                                        {amenity}
                                    </Button>
                                ))}
                            </div>
                        ) : <p className="text-white/70">Nicio caracteristică specificată.</p>}
                    </CardContent>
                </Card>
            </TabsContent>
        </>
    )

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-transparent p-0 gap-2">
                    {menuItems.map(item => (
                         <TabsTrigger key={item.value} value={item.value} className={`${glowClasses} h-16`}>
                            {item.icon}
                            {item.label}
                        </TabsTrigger>
                    ))}
                     <Button 
                        onClick={() => setIsInfoDialogOpen(true)}
                        className={`${glowClasses} h-16`}
                    >
                        <Info className="mr-2 h-4 w-4" />
                        Informații
                    </Button>
                </TabsList>

                {renderTabsContent()}
            </Tabs>
            <InfoDialog 
                property={property}
                isOpen={isInfoDialogOpen}
                onOpenChange={setIsInfoDialogOpen}
            />
        </div>
    )
}
