'use client';

import {
  Building,
  Calendar,
  Layers,
  BedDouble,
  Bath,
  Ruler,
  Paintbrush,
  Sofa,
  Thermometer,
  ArrowUpDown,
} from 'lucide-react';
import type { Property } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '../ui/button';

export function PublicInfoColumn({
  property,
  isMobile = false,
}: {
  property: Property;
  isMobile?: boolean;
}) {
  const details = [
    { icon: <BedDouble className="h-5 w-5 text-primary" />, label: "Nr. Camere", value: property.rooms },
    { icon: <Bath className="h-5 w-5 text-primary" />, label: "Nr. Băi", value: property.bathrooms },
    { icon: <Layers className="h-5 w-5 text-primary" />, label: "Compartimentare", value: property.partitioning },
    { icon: <Calendar className="h-5 w-5 text-primary" />, label: "An construcție", value: property.constructionYear },
    { icon: <Layers className="h-5 w-5 text-primary" />, label: "Etaj", value: property.floor && property.totalFloors ? `${property.floor} / ${property.totalFloors}` : property.floor },
    { icon: <Ruler className="h-5 w-5 text-primary" />, label: "Suprafață utilă", value: property.squareFootage ? `${property.squareFootage} mp` : undefined },
    { icon: <Ruler className="h-5 w-5 text-primary" />, label: "Suprafață cu balcon", value: property.totalSurface ? `${property.totalSurface} mp` : undefined },
    { icon: <Paintbrush className="h-5 w-5 text-primary" />, label: "Stare interior", value: property.interiorState },
    { icon: <Sofa className="h-5 w-5 text-primary" />, label: "Bucătărie", value: property.kitchen },
    { icon: <Building className="h-5 w-5 text-primary" />, label: "Balcon / Terasă", value: property.balconyTerrace },
    { icon: <ArrowUpDown className="h-5 w-5 text-primary" />, label: "Lift", value: property.lift },
    { icon: <Thermometer className="h-5 w-5 text-primary" />, label: "Sistem încălzire", value: property.heatingSystem },
  ];
  
  const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number | undefined | null }) => {
    if (!value && value !== 0) return null;
    return (
        <Button
            variant="outline"
            className="w-full justify-between pointer-events-none h-auto py-3 px-4 text-left bg-[#0F1E33] border border-cyan-400/50"
        >
            <div className="flex items-center gap-3">
                {icon}
                <span className="text-white/70">{label}</span>
            </div>
            <span className="font-semibold text-white">{value}</span>
        </Button>
    );
};


  if (isMobile) {
      return (
          <Card className="bg-transparent border-none text-white shadow-none">
              <CardHeader className="p-2 pt-6">
                <CardTitle>Informații detaliate</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                 {details.map((item, index) => (
                    <InfoItem key={index} {...item} />
                 ))}
              </CardContent>
          </Card>
      );
  }

  // Desktop view (or future implementation)
  return (
    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:bg-transparent lg:shadow-none lg:border-none">
      <CardHeader>
        <CardTitle>Informații Generale</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {details.map((item, index) => {
            if (!item.value && item.value !== 0) return null;
            return (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted lg:bg-white/5">
                    <div className="text-primary">{item.icon}</div>
                    <div>
                        <p className="text-sm text-muted-foreground lg:text-white/70">{item.label}</p>
                        <p className="font-semibold">{item.value}</p>
                    </div>
                </div>
            )
        })}
      </CardContent>
    </Card>
  );
}
