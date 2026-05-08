
'use client';

import type { Property } from '@/lib/types';
import { BedDouble, Ruler, Layers, Calendar, Car, MapPin } from 'lucide-react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

const DetailBadge = ({ icon, text, isAgentfinderTheme = false }: { icon: React.ReactNode, text: string | number | undefined | null, isAgentfinderTheme?: boolean }) => {
    if (!text) return null;
    return (
        <div className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm", isAgentfinderTheme ? "border border-slate-200 bg-white text-slate-700" : "border border-white/10 bg-white/[0.04] text-stone-200")}>
            <span className={isAgentfinderTheme ? "text-sky-700" : "text-[var(--public-accent-soft)]"}>
                {icon}
            </span>
            <span>{text}</span>
        </div>
    )
}

export function PublicPropertyHeader({ property }: { property: Property }) {
  const { agency } = usePublicAgency();
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const displaySurface = property.totalSurface ?? property.squareFootage;

  return (
    <header className={cn("space-y-5 rounded-[2rem] border p-7 shadow-[0_30px_90px_-42px_rgba(0,0,0,0.9)]", isAgentfinderTheme ? "public-premium-panel" : "border-white/10 [background:var(--public-card-bg-soft)]")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
                <div className={cn("inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]", isAgentfinderTheme ? "border border-sky-200 bg-sky-50 text-sky-700" : "border [border-color:var(--public-card-border)] bg-white/10 text-[var(--public-accent-soft)]")}>
                    {property.transactionType}
                </div>
                <div className="space-y-3">
                    <h1 className={cn("max-w-4xl text-3xl font-bold tracking-tight xl:text-[2.15rem]", isAgentfinderTheme ? "text-slate-950" : "text-stone-50")}>{property.title}</h1>
                    <div className={cn("flex items-center gap-2 text-base", isAgentfinderTheme ? "text-slate-500" : "text-stone-400")}>
                        <MapPin className={cn("h-4 w-4", isAgentfinderTheme ? "text-sky-700" : "text-[var(--public-accent-soft)]")} />
                        <p>{property.address}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className={cn("flex flex-wrap items-center gap-2.5 pt-5", isAgentfinderTheme ? "border-t border-slate-200/80" : "border-t border-white/8")}>
            <DetailBadge icon={<BedDouble />} text={`${property.rooms} Camere`} isAgentfinderTheme={isAgentfinderTheme} />
            <DetailBadge icon={<Ruler />} text={displaySurface ? `${displaySurface} m²` : null} isAgentfinderTheme={isAgentfinderTheme} />
            {property.floor && <DetailBadge icon={<Layers />} text={`Etaj ${property.floor}`} isAgentfinderTheme={isAgentfinderTheme} />}
            {property.constructionYear && <DetailBadge icon={<Calendar />} text={`Construit în ${property.constructionYear}`} isAgentfinderTheme={isAgentfinderTheme} />}
            {property.parking && property.parking !== 'Fără' && <DetailBadge icon={<Car />} text="Parcare" isAgentfinderTheme={isAgentfinderTheme} />}
        </div>
    </header>
  );
}
