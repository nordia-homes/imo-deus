'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Building, Calendar, MapPin, Compass, Layers, Maximize, BedDouble, Bath, Star, Paintbrush, Sofa, Thermometer, Car, Handshake, User, Phone, TrendingUp, Key, AlertTriangle, ArrowUpDown } from 'lucide-react';

interface InfoDialogProps {
  property: Property;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined | null }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-3 shadow-md">
            <div className="bg-muted/20 p-2 rounded-md">
                {icon}
            </div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
            </div>
        </div>
    )
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-base font-semibold text-foreground col-span-1 sm:col-span-2 md:col-span-3">{children}</h3>
);


export function InfoDialog({ property, isOpen, onOpenChange }: InfoDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{property.title}</DialogTitle>
          <DialogDescription className="whitespace-nowrap">
            Toate detaliile proprietății într-un singur loc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:col-span-3 gap-3 py-4 max-h-[70vh] overflow-y-auto pr-3">
            <SectionTitle>Detalii Esențiale</SectionTitle>
            <InfoItem icon={<Building className="h-5 w-5 text-primary" />} label="Tip Proprietate" value={property.propertyType} />
            <InfoItem icon={<Handshake className="h-5 w-5 text-primary" />} label="Tip Tranzacție" value={property.transactionType} />
            <InfoItem icon={<Calendar className="h-5 w-5 text-primary" />} label="An Construcție" value={property.constructionYear} />
            <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors || 'N/A' } />
            <InfoItem icon={<BedDouble className="h-5 w-5 text-primary" />} label="Camere" value={property.rooms} />
            <InfoItem icon={<Bath className="h-5 w-5 text-primary" />} label="Băi" value={property.bathrooms} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață Utilă Totală (cu balcon)" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață Utilă (fără balcon)" value={property.totalSurface ? `${property.totalSurface} mp` : undefined} />
            <InfoItem icon={<Compass className="h-5 w-5 text-primary" />} label="Orientare" value={property.orientation} />
            <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Compartimentare" value={property.partitioning} />
            <InfoItem icon={<AlertTriangle className="h-5 w-5 text-primary" />} label="Risc Seismic" value={property.seismicRisk} />


            <div className="col-span-1 sm:col-span-2 md:col-span-3 pt-2"> <Separator /> </div>
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
            
            <div className="col-span-1 sm:col-span-2 md:col-span-3 pt-2"> <Separator /> </div>
            <SectionTitle>Informații Proprietar & Management</SectionTitle>
            <InfoItem icon={<User className="h-5 w-5 text-primary" />} label="Nume Proprietar" value={property.ownerName} />
            <InfoItem icon={<Phone className="h-5 w-5 text-primary" />} label="Telefon Proprietar" value={property.ownerPhone} />
            <InfoItem icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Potențial Vânzare" value={property.salesScore} />

            <div className="col-span-1 sm:col-span-2 md:col-span-3 pt-2">
                <InfoItem icon={<Key className="h-5 w-5 text-primary" />} label="Caracteristici cheie" value={property.keyFeatures} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-3">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Oraș" value={property.city} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-3">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Zonă" value={property.zone} />
            </div>
             <div className="col-span-1 sm:col-span-2 md:col-span-3">
                <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Adresă" value={property.address} />
            </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
