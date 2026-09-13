'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import type { NearbyObjective } from '@/lib/property-presentations/nearby-google';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ACTION_CARD_CLASSNAME } from './cardStyles';

export function NearbyObjectivesCard({ property }: { property: Property }) {
  const { user } = useUser();
  const [objectives, setObjectives] = useState<NearbyObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!user || !property.id) {
      setIsLoading(false);
      return;
    }
    const activeUser = user;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch(
          `/api/properties/${encodeURIComponent(property.id)}/nearby-objectives`,
          {
            cache: 'no-store',
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Obiectivele apropiate nu au putut fi încărcate.');
        if (!cancelled) setObjectives(Array.isArray(payload.objectives) ? payload.objectives : []);
      } catch (loadError) {
        if (!cancelled) {
          setObjectives([]);
          setError(loadError instanceof Error ? loadError.message : 'Obiectivele apropiate nu au putut fi încărcate.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [property.id, reloadKey, user]);

  return (
    <Card className={cn(ACTION_CARD_CLASSNAME, 'agentfinder-property-nearby-card')}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/85">Facilități apropiate</p>
            <CardTitle className="mt-1 text-xl font-semibold text-white">Obiective importante în apropiere</CardTitle>
          </div>
          {!isLoading && error ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setReloadKey((current) => current + 1)}
              aria-label="Reîncarcă obiectivele apropiate"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Se calculează timpii reali de mers pe jos…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/5 px-4 py-5 text-sm text-rose-100/85">{error}</div>
        ) : objectives.length ? (
          objectives.map((objective) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200/85">{objective.label}</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-white">{objective.name}</span>
                  {objective.address ? <span className="mt-0.5 block truncate text-xs text-white/55">{objective.address}</span> : null}
                </span>
                <span className="ml-3 shrink-0 rounded-full bg-emerald-300/16 px-3 py-2 text-xs font-semibold text-emerald-100">
                  {objective.walkingText}
                </span>
              </>
            );

            return objective.mapsUrl ? (
              <a
                key={objective.kind}
                href={objective.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-3 transition hover:border-emerald-200/25 hover:bg-white/[0.075]"
              >
                {content}
              </a>
            ) : (
              <div key={objective.kind} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                {content}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/60">
            Nu au fost găsite suficiente obiective pentru această adresă.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
