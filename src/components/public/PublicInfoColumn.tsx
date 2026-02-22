'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Property } from "@/lib/types";
import { Building, Calendar, MapPin, Compass, Layers, Maximize, BedDouble, Bath, Star, Paintbrush, Sofa, Thermometer, Car, Key, AlertTriangle, ArrowUpDown, Handshake } from 'lucide-react';
import { Button } from "../ui/button";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile: boolean }) {

    const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined | null }) => {
        if (!value && value !== 0) return null;
        return (
             <Button variant="outline" className="w-full justify-between pointer-events-none h-16 bg-[#0F1E33] border-cyan-400/50 shadow-[0_0_15px_-10px_rgba(100,220,255,0.6)]">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="text-white/70">{label}</span>
                </div>
                <span className="font-semibold">{value}</span>
            </Button>
        )
    }

    if (isMobile) {
        return (
            <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                 <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg font-bold">Informații detaliate</CardTitle>
                 </CardHeader>
                 <CardContent className="p-4 pt-0 space-y-2">
                    <InfoItem icon={<ArrowUpDown className="h-5 w-5 text-primary" />} label="Compartimentare" value={property.partitioning} />
                    <InfoItem icon={<BedDouble className="h-5 w-5 text-primary" />} label="Nr. Camere" value={property.rooms} />
                    <InfoItem icon={<Calendar className="h-5 w-5 text-primary" />} label="An Construcție" value={property.constructionYear} />
                    <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}` : property.floor || 'N/A'} />
                    <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață Utilă" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
                    <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață cu Balcon" value={property.totalSurface ? `${property.totalSurface} mp` : undefined} />
                    <InfoItem icon={<Paintbrush className="h-5 w-5 text-primary" />} label="Stare Interior" value={property.interiorState} />
                    <InfoItem icon={<Sofa className="h-5 w-5 text-primary" />} label="Bucătărie" value={property.kitchen} />
                    <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Balcon/Terasă" value={property.balconyTerrace} />
                    <InfoItem icon={<ArrowUpDown className="h-5 w-5 text-primary" />} label="Lift" value={property.lift} />
                    <InfoItem icon={<Thermometer className="h-5 w-5 text-primary" />} label="Sistem Încălzire" value={property.heatingSystem} />
                 </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-[#152A47] lg:text-white lg:border-none">
            <CardHeader>
                <CardTitle>Informații Detaliate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Compartimentare:</span>
                        <span className="font-semibold">{property.partitioning || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">An construcție:</span>
                        <span className="font-semibold">{property.constructionYear || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Suprafață utilă:</span>
                        <span className="font-semibold">{property.squareFootage} mp</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Suprafață totală:</span>
                        <span className="font-semibold">{property.totalSurface || '-'} mp</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Etaj:</span>
                        <span className="font-semibold">{property.floor || '-'} / {property.totalFloors || '-'}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Orientare:</span>
                        <span className="font-semibold">{property.orientation || '-'}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Stare interior:</span>
                        <span className="font-semibold">{property.interiorState || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Stare mobilier:</span>
                        <span className="font-semibold">{property.furnishing || '-'}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Sistem încălzire:</span>
                        <span className="font-semibold">{property.heatingSystem || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted lg:bg-white/10">
                        <span className="text-muted-foreground lg:text-white/70">Parcare:</span>
                        <span className="font-semibold">{property.parking || '-'}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
