'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { Property } from '@/lib/types';
import { Building, Calendar, MapPin, Compass, Layers, Maximize, BedDouble, Bath, Star, Paintbrush, Sofa, Thermometer, Car, Key, AlertTriangle, ArrowUpDown, Handshake } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';


interface InfoDialogProps {
  property: Property;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InfoDialog({ property, isOpen, onOpenChange }: InfoDialogProps) {
    const isMobile = useIsMobile();

    const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined | null }) => {
        if (!value && value !== 0) return null;
        return (
             <div className="flex items-start gap-3 rounded-lg border p-3 shadow-sm bg-card dark:bg-white/5 dark:border-white/10">
                <div className="p-2 rounded-md bg-muted dark:bg-white/10">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-muted-foreground dark:text-white/70">{label}</p>
                    <p className="font-semibold text-sm">{value}</p>
                </div>
            </div>
        )
    }

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-base font-semibold col-span-1 sm:col-span-2 md:col-span-4">{children}</h3>
    );


    if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
          "sm:max-w-5xl",
          isMobile ? "h-screen w-screen max-w-full rounded-none border-none bg-background flex flex-col" : "bg-[#0F1E33] text-white border-none"
        )}>
        <DialogHeader className={cn("shrink-0", isMobile && "border-b text-center")}>
          <DialogTitle className="truncate">{property.title}</DialogTitle>
          <DialogDescription className={cn(isMobile ? "text-muted-foreground" : "text-white/70", "whitespace-nowrap")}>
            Toate detaliile proprietății într-un singur loc.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 py-4 pr-3",
            isMobile ? "overflow-y-auto px-4" : "max-h-[70vh] overflow-y-auto"
        )}>
            <SectionTitle>Detalii Esențiale</SectionTitle>
            <InfoItem icon={<Building className="h-5 w-5 text-primary" />} label="Tip Proprietate" value={property.propertyType} />
            <InfoItem icon={<Handshake className="h-5 w-5 text-primary" />} label="Tip Tranzacție" value={property.transactionType} />
            <InfoItem icon={<Calendar className="h-5 w-5 text-primary" />} label="An Construcție" value={property.constructionYear} />
            <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors || 'N/A' } />
            <InfoItem icon={<BedDouble className="h-5 w-5 text-primary" />} label="Camere" value={property.rooms} />
            <InfoItem icon={<Bath className="h-5 w-5 text-primary" />} label="Băi" value={property.bathrooms} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață Utilă" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață cu Balcon" value={property.totalSurface ? `${property.totalSurface} mp` : undefined} />
            <InfoItem icon={<Compass className="h-5 w-5 text-primary" />} label="Orientare" value={property.orientation} />
            <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Compartimentare" value={property.partitioning} />
            <InfoItem icon={<AlertTriangle className="h-5 w-5 text-primary" />} label="Risc Seismic" value={property.seismicRisk} />


            <div className="col-span-1 sm:col-span-2 md:col-span-4 pt-2"> <Separator className="dark:bg-white/20" /> </div>
            <SectionTitle>Dotări & Finisaje</SectionTitle>
            <InfoItem icon={<Star className="h-5 w-5 text-primary" />} label="Confort" value={property.comfort} />
            <InfoItem icon={<Paintbrush className="h-5 w-5 text-primary" />} label="Stare Interior" value={property.interiorState} />
            <InfoItem icon={<Sofa className="h-5 w-5 text-primary" />} label="Mobilier" value={property.furnishing} />
            <InfoItem icon={<Thermometer className="h-5 w-5 text-primary" />} label="Sistem Încălzire" value={property.heatingSystem} />
            <InfoItem icon={<Car className="h-5 w-5 text-primary" />} label="Parcare" value={property.parking} />
            <InfoItem icon={<ArrowUpDown className="h-5 w-5 text-primary" />} label="Lift" value={property.lift} />
            <InfoItem icon={<Building className="h-5 w-5 text-primary" />} label="Stare Clădire" value={property.buildingState} />
            <InfoItem icon={<Sofa className="h-5 w-5 text-primary" />} label="Bucătărie" value={property.kitchen} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Balcon/Terasă" value={property.balconyTerrace} />
            
            <div className="col-span-1 sm:col-span-2 md:col-span-4 pt-2">
                <InfoItem icon={<Key className="h-5 w-5 text-primary" />} label="Caracteristici cheie" value={property.keyFeatures} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-4">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Oraș" value={property.city} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-4">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Zonă" value={property.zone} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-4">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Adresă" value={property.address} />
            </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
