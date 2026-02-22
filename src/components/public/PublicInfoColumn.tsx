'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, MapPin, FileText, Sparkles, Info } from "lucide-react";
import type { Property } from "@/lib/types";
import { RlvTab } from "@/components/properties/detail/RlvTab";
import { useState } from "react";
import { InfoDialog } from "@/components/properties/detail/InfoDialog";
import { cn } from "@/lib/utils";

export function PublicInfoColumn({ property }: { property: Property }) {
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    
    const tabButtonStyle = "flex-1 bg-transparent border border-green-500/60 shadow-[0_0_15px_-5px_rgba(74,222,128,0.7)] text-green-300 hover:bg-green-500/10 hover:text-green-200 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-200 data-[state=active]:border-green-400";

    const menuItems = [
      { value: "overview", label: "Prezentare generală", icon: <LayoutList className="h-4 w-4" /> },
      { value: "location", label: "Vezi locația", icon: <MapPin className="h-4 w-4" /> },
      { value: "rlv", label: "RLV", icon: <FileText className="h-4 w-4" /> },
      { value: "features", label: "Caracteristici", icon: <Sparkles className="h-4 w-4" /> },
    ];
    
    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-5 gap-2 bg-transparent p-0">
                    {menuItems.map(item => (
                         <TabsTrigger key={item.value} value={item.value} className={cn(tabButtonStyle, "gap-2")}>
                            {item.icon}
                            <span className="hidden md:inline">{item.label}</span>
                         </TabsTrigger>
                    ))}
                    <button
                        onClick={() => setIsInfoDialogOpen(true)}
                        className={cn(tabButtonStyle, "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2")}
                    >
                        <Info className="h-4 w-4" />
                        <span className="hidden md:inline">Informații</span>
                    </button>
                </TabsList>

                <TabsContent value="overview" className="mt-6 text-white/80">
                     <p className="whitespace-pre-wrap">{property.description || 'Nicio descriere adăugată.'}</p>
                </TabsContent>
                 <TabsContent value="location" className="mt-6">
                    <div className="aspect-video w-full">
                         <iframe
                            className="w-full h-full rounded-lg border border-white/10"
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(property.address)}`}>
                        </iframe>
                    </div>
                </TabsContent>
                <TabsContent value="rlv" className="mt-6">
                    <RlvTab property={property} />
                </TabsContent>
                <TabsContent value="features" className="mt-6">
                    {property.amenities && property.amenities.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {property.amenities.map(amenity => (
                                <div key={amenity} className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <Sparkles className="h-4 w-4 text-primary"/>
                                    <span className="text-sm text-white/90">{amenity}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-white/70">Nu sunt specificate caracteristici speciale.</p>
                    )}
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
