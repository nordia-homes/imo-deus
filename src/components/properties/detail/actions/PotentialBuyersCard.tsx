'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';
import type { MatchedBuyer } from '@/lib/types';
import Link from 'next/link';

interface PotentialBuyersCardProps {
  matchedBuyers: MatchedBuyer[];
}

const toneClass = (label: 'exact' | 'adjacent' | 'cluster' | 'macro' | 'penalty', value: number) => {
  if (label === 'penalty') {
    if (value <= 0.35) return 'text-rose-300';
    if (value < 1) return 'text-amber-300';
    return 'text-emerald-300';
  }

  if (value >= 0.95) return 'text-emerald-300';
  if (value >= 0.55) return 'text-sky-300';
  if (value > 0) return 'text-violet-300';
  return 'text-white/40';
};

export function PotentialBuyersCard({ matchedBuyers }: PotentialBuyersCardProps) {
  return (
    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
      <CardHeader className="px-3 pt-3 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Cumpărători Potriviți ({matchedBuyers.length})
        </CardTitle>
        <Button asChild variant="link" size="sm" className="text-white text-xs px-0">
          <Link href="/leads" aria-label="Vezi toți cumpărătorii">
            Vezi toți
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {matchedBuyers.length > 0 ? (
          <div className="space-y-2">
            {matchedBuyers.slice(0, 3).map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-white/10 hover:bg-white/20 group">
                <div className="min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary truncate">{lead.name}</p>
                  <p className="text-xs text-white/70">Buget: €{lead.budget?.toLocaleString()} · Scor {lead.matchScore}/100</p>
                  {lead.zoneReasoning && <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300/90 truncate">{lead.zoneReasoning}</p>}
                  {lead.zoneDebug && (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] truncate">
                      <span className={toneClass('exact', lead.zoneDebug.exact)}>E {lead.zoneDebug.exact}</span>
                      <span className={toneClass('adjacent', lead.zoneDebug.adjacent)}>A {lead.zoneDebug.adjacent}</span>
                      <span className={toneClass('cluster', lead.zoneDebug.cluster)}>C {lead.zoneDebug.cluster}</span>
                      <span className={toneClass('macro', lead.zoneDebug.macro)}>M {lead.zoneDebug.macro}</span>
                      <span className={toneClass('penalty', lead.zoneDebug.penalty)}>P {lead.zoneDebug.penalty}</span>
                    </div>
                  )}
                  <p className="text-xs text-white/60 truncate">{lead.reasoning}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/70 group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-4 text-white/70">Niciun cumpărător potrivit.</p>
        )}
      </CardContent>
    </Card>
  );
}
