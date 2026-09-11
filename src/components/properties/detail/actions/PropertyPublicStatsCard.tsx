'use client';

import { useEffect, useState } from 'react';
import { Eye, Heart, Loader2, MousePointerClick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import { ACTION_CARD_CLASSNAME } from './cardStyles';

type PublicStats = {
  views: number;
  favorites: number;
  favoriteAdds: number;
};

const numberFormatter = new Intl.NumberFormat('ro-RO');

export function PropertyPublicStatsCard({ property }: { property: Property }) {
  const { user, isUserLoading } = useUser();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isUserLoading) return () => {
      cancelled = true;
    };

    if (!user || !property.id) {
      setHasError(true);
      return () => {
        cancelled = true;
      };
    }

    const currentUser = user;

    async function loadStats() {
      try {
        setHasError(false);
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/public-property-stats?propertyId=${encodeURIComponent(property.id)}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Statisticile nu au putut fi incarcate.');
        if (!cancelled) setStats(payload as PublicStats);
      } catch {
        if (!cancelled) setHasError(true);
      }
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [isUserLoading, property.id, user]);

  const metrics = [
    { label: 'Vizite pe anunț', value: stats?.views, Icon: Eye, tone: 'text-sky-200' },
    { label: 'Adăugări la favorite', value: stats?.favoriteAdds, Icon: Heart, tone: 'text-pink-200' },
  ];

  return (
    <Card className={ACTION_CARD_CLASSNAME}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MousePointerClick className="h-4 w-4" />
          Interacțiuni website public
        </CardTitle>
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Actualizare automată</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 p-4 pt-0 sm:grid-cols-2">
        {metrics.map(({ label, value, Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <Icon className={`h-5 w-5 ${tone}`} />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">{label}</p>
              {stats ? (
                <p className="mt-1 text-xl font-semibold text-white">{numberFormatter.format(value ?? 0)}</p>
              ) : hasError ? (
                <p className="mt-1 text-sm font-medium text-white/55">Indisponibil</p>
              ) : (
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-white/55" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
