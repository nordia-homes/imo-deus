
'use client';

import { Badge } from '@/components/ui/badge';
import type { Property } from '@/lib/types';
import { BedDouble, Ruler, Layers, Calendar, Car } from 'lucide-react';

const DetailBadge = ({ icon, text }: { icon: React.ReactNode, text: string | number | undefined | null }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            {icon}
            <span>{text}</span>
        </div>
    )
}

export function PublicPropertyHeader({ property }: { property: Property }) {

  return (
    <header className="space-y-4 rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.35)]">
        <div className="inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            {property.transactionType}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{property.title}</h1>
        <p className="text-base text-slate-500">{property.address}</p>
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
