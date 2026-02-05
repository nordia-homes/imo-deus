'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { Building, Calendar, MapPin, Compass, Layers, Maximize, BedDouble, Bath } from 'lucide-react';

interface InfoDialogProps {
  property: Property;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined | null }) => {
    if (!value && value !== 0) return null;
    return (
        <Button variant="outline" className="h-auto w-full justify-start p-3 text-left pointer-events-none bg-muted/50">
            <div className="flex items-center gap-3">
                <div className="bg-background p-2 rounded-md">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold text-sm">{value}</p>
                </div>
            </div>
        </Button>
    )
}

export function InfoDialog({ property, isOpen, onOpenChange }: InfoDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Informații Esențiale: {property.title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            <InfoItem icon={<Building className="h-5 w-5 text-primary" />} label="Tip Proprietate" value={property.propertyType} />
            <InfoItem icon={<Calendar className="h-5 w-5 text-primary" />} label="An Construcție" value={property.constructionYear} />
            <InfoItem icon={<Layers className="h-5 w-5 text-primary" />} label="Etaj" value={property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}`: property.floor || property.totalFloors || 'N/A' } />
            <InfoItem icon={<BedDouble className="h-5 w-5 text-primary" />} label="Camere" value={property.rooms} />
            <InfoItem icon={<Bath className="h-5 w-5 text-primary" />} label="Băi" value={property.bathrooms} />
            <InfoItem icon={<Maximize className="h-5 w-5 text-primary" />} label="Suprafață Utilă" value={property.squareFootage ? `${property.squareFootage} mp` : undefined} />
            <InfoItem icon={<Compass className="h-5 w-5 text-primary" />} label="Orientare" value={property.orientation} />
            <InfoItem icon={<MapPin className="h-5 w-5 text-primary" />} label="Adresă" value={property.address} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
