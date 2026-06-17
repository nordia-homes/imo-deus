'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';
import type { MatchedBuyer } from '@/lib/types';
import Link from 'next/link';
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME } from './cardStyles';

interface PotentialBuyersCardProps {
  matchedBuyers: MatchedBuyer[];
  onRequestMatches?: () => void;
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

const formatZoneReasoning = (zoneReasoning?: string | null) => {
  if (!zoneReasoning) {
    return '';
  }

  const rawParts = zoneReasoning
    .split(/·|Â·/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const parts: string[] = [];
  let hasExactMatch = false;

  for (const part of rawParts) {
    const normalized = part.toLowerCase();
    const isExactVariant =
      normalized.includes('locație exactă imobiliare.ro') ||
      normalized.includes('locatie exacta imobiliare.ro') ||
      normalized.includes('zonă exactă') ||
      normalized.includes('zona exacta');

    if (isExactVariant) {
      hasExactMatch = true;
      continue;
    }

    if (!parts.includes(part)) {
      parts.push(part);
    }
  }

  return (hasExactMatch ? ['Exact Match', ...parts] : parts).join(' · ');
};

export function PotentialBuyersCard({ matchedBuyers, onRequestMatches }: PotentialBuyersCardProps) {
  return (
    <Card className={ACTION_CARD_CLASSNAME}>
      <CardHeader className="px-3 pt-3 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Cumpărători Potriviți ({matchedBuyers.length})
        </CardTitle>
        {onRequestMatches ? (
          <Button type="button" variant="link" size="sm" className="text-white text-xs px-0" onClick={onRequestMatches}>
            Calculeaza
          </Button>
        ) : (
          <Button asChild variant="link" size="sm" className="text-white text-xs px-0">
            <Link href="/leads" aria-label="Vezi toți cumpărătorii">
              Vezi toți
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {matchedBuyers.length > 0 ? (
          <div className="space-y-2">
            {matchedBuyers.slice(0, 3).map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className={`${ACTION_CARD_INNER_CLASSNAME} group flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-white/[0.06]`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary truncate">{lead.name}</p>
                  <p className="text-xs text-white/70">Buget: €{lead.budget?.toLocaleString()} · Scor {lead.matchScore}/100</p>
                  {lead.zoneReasoning && <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300/90 truncate">{formatZoneReasoning(lead.zoneReasoning)}</p>}
                  {lead.zoneDebug && (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] truncate">
                      <span className={toneClass('exact', lead.zoneDebug.exact)}>I {lead.zoneDebug.exact}</span>
                      <span className={toneClass('exact', lead.zoneDebug.semanticExact || 0)}>Z {lead.zoneDebug.semanticExact || 0}</span>
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
