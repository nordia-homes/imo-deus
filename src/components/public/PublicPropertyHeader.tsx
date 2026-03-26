
'use client';

import { Badge } from '@/components/ui/badge';
import type { Property } from '@/lib/types';
import { BedDouble, Ruler, Layers, Calendar, Car } from 'lucide-react';

const DetailBadge = ({ icon, text }: { icon: React.ReactNode, text: string | number | undefined | null }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#18191d] px-3 py-1.5 text-sm font-medium text-stone-300 shadow-sm">
            {icon}
            <span>{text}</span>
        </div>
    )
}

export function PublicPropertyHeader({ property }: { property: Property }) {

  return (
    <header className="space-y-4 rounded-[2rem] border border-white/10 bg-[#101113]/95 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)]">
        <div className="inline-flex rounded-full border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-1.5 text-sm font-semibold text-[#f2d27a]">
            {property.transactionType}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-50">{property.title}</h1>
        <p className="text-base text-stone-400">{property.address}</p>
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
