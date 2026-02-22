
'use client';

import { Badge } from '@/components/ui/badge';
import type { Property } from '@/lib/types';
import { BedDouble, Ruler, Layers, Calendar, Car } from 'lucide-react';

const DetailBadge = ({ icon, text }: { icon: React.ReactNode, text: string | number | undefined | null }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80">
            {icon}
            <span>{text}</span>
        </div>
    )
}

export function PublicPropertyHeader({ property }: { property: Property }) {

  return (
    <header className="space-y-3">
        <h1 className="text-3xl font-bold text-white">{property.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
            <DetailBadge icon={<BedDouble />} text={`${property.rooms} Camere`} />
            <DetailBadge icon={<Ruler />} text={`${property.squareFootage} m²`} />
            {property.floor && <DetailBadge icon={<Layers />} text={`Etaj ${property.floor}`} />}
            {property.constructionYear && <DetailBadge icon={<Calendar />} text={`Construit în ${property.constructionYear}`} />}
            {property.parking && property.parking !== 'Fără' && <DetailBadge icon={<Car />} text="Parcare" />}
        </div>
    </header>
  );
}
