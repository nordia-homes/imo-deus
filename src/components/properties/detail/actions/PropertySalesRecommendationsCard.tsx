'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Flame,
  Lightbulb,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import {
  buildPropertySalesAnalysis,
  type SalesRecommendationPriority,
} from '@/lib/property-sales-recommendations';
import type { PropertySalesContext } from '@/lib/property-sales-context';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { ACTION_CARD_CLASSNAME } from './cardStyles';

const priorityStyles: Record<SalesRecommendationPriority, string> = {
  critical: 'border-rose-200 bg-rose-100 text-rose-800',
  high: 'border-amber-200 bg-amber-100 text-amber-800',
  medium: 'border-sky-200 bg-sky-100 text-sky-800',
};

const priorityLabels: Record<SalesRecommendationPriority, string> = {
  critical: 'Acționează acum',
  high: 'Prioritate mare',
  medium: 'Optimizează',
};

const categoryIcons = {
  Conversie: Target,
  Preț: BarChart3,
  Conținut: Sparkles,
  Distribuție: Rocket,
  Date: Lightbulb,
} as const;

export function PropertySalesRecommendationsCard({ property }: { property: Property }) {
  const { user } = useUser();
  const [context, setContext] = useState<PropertySalesContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (quiet = false) => {
    if (!user || !property.id) return;
    if (!quiet) setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/properties/${encodeURIComponent(property.id)}/sales-recommendation-context`,
        {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Datele comerciale nu au putut fi încărcate.');
      setContext(payload as PropertySalesContext);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Datele comerciale nu au putut fi încărcate.');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [property.id, user]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    void loadContext();
    const timer = window.setInterval(() => void loadContext(true), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [loadContext, user]);

  const analysis = useMemo(
    () => context ? buildPropertySalesAnalysis({ property, context }) : null,
    [context, property]
  );

  const scoreTone = (analysis?.score ?? 0) >= 80
    ? 'text-emerald-200'
    : (analysis?.score ?? 0) >= 55
      ? 'text-amber-200'
      : 'text-rose-200';

  const sourceChips = context ? [
    { label: 'Website', state: context.publicStats.available ? 'live' : 'unavailable' },
    { label: 'Portaluri', state: 'stored' },
    { label: 'Facebook', state: context.facebook.syncStatus },
    { label: 'Meta Ads', state: context.metaAds.syncStatus },
    { label: 'Cumpărători', state: 'live' },
  ] : [];

  return (
    <Card className={cn(ACTION_CARD_CLASSNAME, 'property-sales-recommendations-card')}>
      <CardHeader className="space-y-4 p-4 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Flame className="h-4 w-4 text-orange-600" />
              Motor de optimizare pentru vânzare
            </CardTitle>
            <p className="mt-1 text-xs text-white/55">
              Recomandări calculate din conținut, expunere și conversie.
            </p>
          </div>
          {analysis ? <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Scor comercial</p>
              <p className={cn('text-xl font-bold', scoreTone)}>{analysis.score}/100</p>
            </div>
            <div className="h-10 w-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  'w-full rounded-full transition-[height] duration-500',
                  analysis.score >= 80 ? 'bg-emerald-400' : analysis.score >= 55 ? 'bg-amber-400' : 'bg-rose-400'
                )}
                style={{ height: `${analysis.score}%`, marginTop: `${100 - analysis.score}%` }}
              />
            </div>
          </div> : null}
        </div>
        {context ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {sourceChips.map((source) => (
                <span
                  key={source.label}
                  className={cn(
                    'rounded-full border px-2 py-1 text-[10px] font-medium',
                    source.state === 'live'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                      : source.state === 'stored'
                        ? 'border-sky-200 bg-sky-100 text-sky-800'
                        : 'border-amber-200 bg-amber-100 text-amber-800'
                  )}
                >
                  {source.label}: {source.state === 'live' ? 'actualizat' : source.state === 'stored' ? 'sincronizat' : 'indisponibil'}
                </span>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 rounded-full px-2 text-[10px] text-white/55 hover:bg-white/10 hover:text-white"
                disabled={isLoading}
                onClick={() => void loadContext()}
              >
                <RefreshCw className={cn('mr-1 h-3 w-3', isLoading && 'animate-spin')} />
                Actualizează
              </Button>
            </div>
            <p className="text-[10px] text-white/40">
              Date verificate la {new Date(context.generatedAt).toLocaleString('ro-RO')}; reîmprospătare automată la 5 minute.
            </p>
          </div>
        ) : null}
        {analysis ? (
          <p className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs leading-relaxed text-white/65">
            {analysis.summary}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {isLoading && !context ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-sm text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analizez datele reale ale proprietății…
          </div>
        ) : error && !context ? (
          <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              Analiza nu este disponibilă
            </p>
            <p className="mt-1 text-xs text-white/60">{error}</p>
            <Button type="button" size="sm" className="mt-3 rounded-full" onClick={() => void loadContext()}>
              Reîncearcă
            </Button>
          </div>
        ) : analysis && analysis.recommendations.length > 0 ? analysis.recommendations.map((recommendation, index) => {
          const Icon = categoryIcons[recommendation.category];
          return (
            <article
              key={recommendation.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      #{index + 1} · {recommendation.category}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px]', priorityStyles[recommendation.priority])}>
                      {priorityLabels[recommendation.priority]}
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold leading-snug text-white">
                    {recommendation.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{recommendation.reason}</p>
                  <div className="mt-3 rounded-xl border border-white/8 bg-black/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-200">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Acțiunea recomandată
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/75">{recommendation.action}</p>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-white/45">{recommendation.impact}</p>
                </div>
              </div>
            </article>
          );
        }) : analysis ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
            <div>
              <p className="text-sm font-semibold text-white">Anunț pregătit pentru conversie</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Nu există blocaje detectabile acum. Urmărește raportul dintre vizite, favorite și vizionări pentru următoarea optimizare.
              </p>
            </div>
          </div>
        ) : null}
        {error && context ? (
          <p className="flex items-center gap-1.5 px-1 text-[10px] text-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Ultima reîmprospătare a eșuat; sunt păstrate ultimele date valide.
          </p>
        ) : null}
        <p className="px-1 text-[10px] leading-relaxed text-white/40">
          Recomandările sunt orientative. Orice schimbare de preț trebuie validată prin analiza comparativă de piață și aprobată de proprietar.
        </p>
      </CardContent>
    </Card>
  );
}
