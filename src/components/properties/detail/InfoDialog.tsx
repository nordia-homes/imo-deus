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

    const InfoItem = ({ icon, label, value, tone = 'blue' }: {
        icon: React.ReactNode,
        label: string,
        value: string | number | undefined | null,
        tone?: 'blue' | 'emerald' | 'violet' | 'rose' | 'indigo' | 'cyan',
    }) => {
        if (!value && value !== 0) return null;
        return (
             <div className={`agentfinder-property-info-dialog__card agentfinder-property-info-dialog__card--${tone}`}>
                <div className="agentfinder-property-info-dialog__icon">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="agentfinder-property-info-dialog__label">{label}</p>
                    <p className="agentfinder-property-info-dialog__value">{value}</p>
                </div>
            </div>
        )
    }

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-base font-semibold text-white">{children}</h3>
    );


    if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
          "agentfinder-property-info-dialog sm:max-w-5xl",
          isMobile ? "flex h-screen w-screen max-w-full flex-col rounded-none border-none bg-[#0F1E33] text-white" : "border-none bg-[#0F1E33] text-white"
        )}>
        <DialogHeader className={cn("shrink-0", isMobile && "border-b border-white/10 text-center")}>
          <DialogTitle className="truncate text-white">{property.title}</DialogTitle>
          <DialogDescription className="whitespace-nowrap text-white/65">
            Toate detaliile proprietății într-un singur loc.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(
            "space-y-3 py-4 pr-3",
            isMobile ? "overflow-y-auto px-4" : "max-h-[70vh] overflow-y-auto"
        )}>
            <SectionTitle>Detalii Esențiale</SectionTitle>
            <div className="agentfinder-property-info-dialog__grid">
                <InfoItem tone="blue" icon={<Calendar className="h-5 w-5" />} label="An Construcție" value={property.constructionYear} />
                <InfoItem tone="violet" icon={<Layers className="h-5 w-5" />} label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors || 'N/A' } />
                <InfoItem tone="emerald" icon={<BedDouble className="h-5 w-5" />} label="Camere" value={property.rooms} />
                <InfoItem tone="rose" icon={<Bath className="h-5 w-5" />} label="Băi" value={property.bathrooms} />
                <InfoItem tone="cyan" icon={<Maximize className="h-5 w-5" />} label="Suprafață utilă" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
                <InfoItem tone="indigo" icon={<Maximize className="h-5 w-5" />} label="Suprafață cu balcon" value={property.totalSurface ? `${property.totalSurface} mp` : undefined} />
                <InfoItem tone="blue" icon={<Compass className="h-5 w-5" />} label="Orientare" value={property.orientation} />
                <InfoItem tone="violet" icon={<Layers className="h-5 w-5" />} label="Compartimentare" value={property.partitioning} />
                <InfoItem tone="rose" icon={<AlertTriangle className="h-5 w-5" />} label="Risc Seismic" value={property.seismicRisk} />
            </div>

            <div className="pt-2"> <Separator className="bg-white/10" /> </div>
            <SectionTitle>Dotări & Finisaje</SectionTitle>
            <div className="agentfinder-property-info-dialog__grid">
                <InfoItem tone="indigo" icon={<Star className="h-5 w-5" />} label="Confort" value={property.comfort} />
                <InfoItem tone="rose" icon={<Paintbrush className="h-5 w-5" />} label="Stare Interior" value={property.interiorState} />
                <InfoItem tone="violet" icon={<Sofa className="h-5 w-5" />} label="Mobilier" value={property.furnishing} />
                <InfoItem tone="cyan" icon={<Thermometer className="h-5 w-5" />} label="Sistem Încălzire" value={property.heatingSystem} />
                <InfoItem tone="blue" icon={<Car className="h-5 w-5" />} label="Parcare" value={property.parking} />
                <InfoItem tone="emerald" icon={<ArrowUpDown className="h-5 w-5" />} label="Lift" value={property.lift} />
                <InfoItem tone="indigo" icon={<Building className="h-5 w-5" />} label="Stare Clădire" value={property.buildingState} />
                <InfoItem tone="rose" icon={<Sofa className="h-5 w-5" />} label="Bucătărie" value={property.kitchen} />
                <InfoItem tone="violet" icon={<Maximize className="h-5 w-5" />} label="Balcon/Terasă" value={property.balconyTerrace} />
            </div>
            
            <div className="pt-2">
                <InfoItem tone="emerald" icon={<Key className="h-5 w-5" />} label="Caracteristici cheie" value={property.keyFeatures} />
            </div>
             <div>
                <InfoItem tone="blue" icon={<MapPin className="h-5 w-5" />} label="Oraș" value={property.city} />
            </div>
             <div>
                <InfoItem tone="violet" icon={<MapPin className="h-5 w-5" />} label="Zonă" value={property.zone} />
            </div>
             <div>
                <InfoItem tone="cyan" icon={<MapPin className="h-5 w-5" />} label="Adresă" value={property.address} />
            </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
