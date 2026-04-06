
'use client';

import type { Property } from '@/lib/types';
import { BedDouble, Ruler, Layers, Calendar, Car, MapPin } from 'lucide-react';

const DetailBadge = ({ icon, text }: { icon: React.ReactNode, text: string | number | undefined | null }) => {
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
            <span className="text-[#86efac]">
                {icon}
            </span>
            <span>{text}</span>
        </div>
    )
}

export function PublicPropertyHeader({ property }: { property: Property }) {
  const displaySurface = property.totalSurface ?? property.squareFootage;

  return (
    <header className="space-y-5 rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(16,17,19,0.98)_0%,rgba(11,13,14,0.98)_100%)] p-7 shadow-[0_30px_90px_-42px_rgba(0,0,0,0.9)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
                <div className="inline-flex rounded-full border border-[#22c55e]/20 bg-[#22c55e]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#86efac]">
                    {property.transactionType}
                </div>
                <div className="space-y-3">
                    <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-stone-50 xl:text-[2.15rem]">{property.title}</h1>
                    <div className="flex items-center gap-2 text-base text-stone-400">
                        <MapPin className="h-4 w-4 text-[#86efac]" />
                        <p>{property.address}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-white/8 pt-5">
            <DetailBadge icon={<BedDouble />} text={`${property.rooms} Camere`} />
            <DetailBadge icon={<Ruler />} text={displaySurface ? `${displaySurface} m²` : null} />
            {property.floor && <DetailBadge icon={<Layers />} text={`Etaj ${property.floor}`} />}
            {property.constructionYear && <DetailBadge icon={<Calendar />} text={`Construit în ${property.constructionYear}`} />}
            {property.parking && property.parking !== 'Fără' && <DetailBadge icon={<Car />} text="Parcare" />}
        </div>
    </header>
  );
}
