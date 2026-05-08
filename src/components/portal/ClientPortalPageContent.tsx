'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMemo } from 'react';
import { doc, collection, query, where } from 'firebase/firestore';
import { ArrowRight, Home } from 'lucide-react';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import type { ClientPortal, PortalRecommendation, Property } from '@/lib/types';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendedPropertyCard } from '@/components/portal/RecommendedPropertyCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAgencyThemePreset } from '@/lib/theme';

export function ClientPortalPageContent({ portalId }: { portalId: string }) {
  const firestore = useFirestore();
  const { isCustomDomain, agency } = usePublicAgency();
  const publicPath = usePublicPath();
  const themePreset = getAgencyThemePreset(agency);
  const isAgentfinderTheme = themePreset === 'agentfinder';

  const portalDocRef = useMemoFirebase(() => doc(firestore, 'portals', portalId), [firestore, portalId]);
  const { data: portal, isLoading: isPortalLoading, error: portalError } = useDoc<ClientPortal>(portalDocRef);

  const recommendationsQuery = useMemoFirebase(
    () => collection(firestore, 'portals', portalId, 'recommendations'),
    [firestore, portalId]
  );
  const { data: recommendations, isLoading: areRecsLoading } = useCollection<PortalRecommendation>(recommendationsQuery);

  const propertyIds = useMemo(() => {
    if (!recommendations) return [];
    return recommendations.map((rec) => rec.propertyId);
  }, [recommendations]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!portal || propertyIds.length === 0) return null;
    return query(collection(firestore, 'agencies', portal.agencyId, 'properties'), where('__name__', 'in', propertyIds));
  }, [firestore, portal, propertyIds]);
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  const propertiesById = useMemo(() => {
    if (!properties) return new Map();
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  const isLoading = isPortalLoading || areRecsLoading || arePropertiesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 pb-8 pt-6 md:px-6 lg:px-8">
        <div className="space-y-4 rounded-[2rem] border border-white/10 bg-[#10131a] p-8 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)]">
          <Skeleton className="h-8 w-40 bg-white/10" />
          <Skeleton className="h-14 w-2/3 bg-white/10" />
          <Skeleton className="h-6 w-1/2 bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
          <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
          <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-[520px] rounded-[2rem] bg-white/10" />
          <Skeleton className="h-[520px] rounded-[2rem] bg-white/10" />
          <Skeleton className="h-[520px] rounded-[2rem] bg-white/10" />
        </div>
      </div>
    );
  }

  if (portalError || !portal) {
    notFound();
    return null;
  }

  const allPropertiesHref = isCustomDomain
    ? publicPath('/properties')
    : `/agencies/${portal.agencyId}/properties`;

  return (
    <div data-app-theme={themePreset} className="agentfinder-properties-page space-y-6 px-4 pb-10 pt-6 text-white md:px-6 lg:px-8">
      <section className="agentfinder-properties-hero-card overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] text-white shadow-[0_28px_70px_-34px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-6 px-7 py-6 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="min-w-0">
            <div className="agentfinder-properties-eyebrow mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/85 lg:mx-0">
              Portal client
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Recomandari pentru {portal.contactName}
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-white/68 lg:max-w-2xl">
              {portal.agentName} a selectat proprietatile cu cel mai bun potential pentru tine. Intra in detalii si lasa feedback direct sub fiecare proprietate.
            </p>
          </div>
          <div className="agentfinder-properties-count-card mx-auto shrink-0 rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:mx-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Total</p>
            <p className="mt-1 text-3xl font-semibold text-white">{recommendations?.length || 0}</p>
          </div>
        </div>
      </section>

      {!recommendations || recommendations.length === 0 ? (
        <Alert className="rounded-[1.8rem] border-white/10 bg-[#10131a] text-stone-100 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)]">
          <Home className="h-5 w-5 text-emerald-200" />
          <AlertTitle>Nicio proprietate recomandata momentan</AlertTitle>
          <AlertDescription className="text-stone-300">
            Agentul tau nu a adaugat inca proprietati in portal. Revino putin mai tarziu sau contacteaza-l pentru o selectie actualizata.
          </AlertDescription>
        </Alert>
      ) : (
        <section id="recomandari" className="space-y-4">
          <div className="agentfinder-properties-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((rec) => {
              const property = propertiesById.get(rec.propertyId);
              if (!property) return null;

              return (
                <RecommendedPropertyCard
                  key={rec.id}
                  property={property}
                  recommendation={rec}
                  portalId={portalId}
                  agencyId={portal.agencyId}
                  contactId={portal.contactId}
                />
              );
            })}
          </div>

          <div
            className={cn(
              'relative overflow-hidden rounded-[30px] shadow-[0_38px_110px_rgba(6,16,31,0.42)]',
              isAgentfinderTheme
                ? 'border border-[#0f223e] bg-[linear-gradient(135deg,#06101f_0%,#0c1d36_46%,#14345c_100%)] ring-1 ring-[#d8e7ff]/12'
                : 'border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14)_0%,rgba(34,197,94,0)_28%),linear-gradient(135deg,#0d1018_0%,#111522_52%,#171d2b_100%)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.72)]'
            )}
          >
            <div
              className={cn(
                'absolute inset-0',
                isAgentfinderTheme
                  ? 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0)_24%),radial-gradient(circle_at_78%_50%,rgba(96,165,250,0.34)_0%,rgba(96,165,250,0)_22%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.24)_0%,rgba(52,211,153,0)_20%)]'
                  : 'bg-[radial-gradient(circle_at_14%_18%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_20%),radial-gradient(circle_at_86%_50%,rgba(74,222,128,0.18)_0%,rgba(74,222,128,0)_18%),radial-gradient(circle_at_30%_100%,rgba(59,130,246,0.14)_0%,rgba(59,130,246,0)_22%)]'
              )}
            />
            <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.92),rgba(255,255,255,0))]" />
            <div className={cn('absolute inset-y-5 left-5 right-5 hidden rounded-[24px] lg:block', isAgentfinderTheme ? 'border border-white/8' : 'border border-white/6')} />

            <div
              className={cn(
                'relative flex flex-col gap-8 p-7 lg:px-10 lg:py-9',
                isAgentfinderTheme ? 'lg:flex-row lg:items-center lg:justify-between' : 'lg:flex-row lg:items-center lg:gap-10'
              )}
            >
              <div className="min-w-0 flex-1 text-center lg:text-left">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] shadow-[0_10px_24px_rgba(7,13,24,0.18)] backdrop-blur-sm',
                    isAgentfinderTheme
                      ? 'border border-white/14 bg-white/10 text-white/78'
                      : 'border border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                  )}
                >
                  <Home className="h-3.5 w-3.5" />
                  Portofoliu extins
                </div>
                <h3
                  className={cn(
                    'mt-5 text-[clamp(1.85rem,2.55vw,2.7rem)] font-bold tracking-[-0.05em] lg:whitespace-nowrap',
                    isAgentfinderTheme ? 'font-headline text-white' : 'text-white'
                  )}
                >
                  Exploreaza tot portofoliul disponibil.
                </h3>
                <p
                  className={cn(
                    'mx-auto mt-4 max-w-2xl text-[15px] leading-8 md:text-base lg:mx-0',
                    isAgentfinderTheme ? 'text-slate-200/84' : 'text-stone-300'
                  )}
                >
                  Daca vrei mai mult context inainte de decizie, vezi toate proprietatile publice ale agentiei intr-o
                  experienta mai ampla, clara si usor de comparat.
                </p>
              </div>

              <div className={cn('w-full shrink-0 lg:self-center', isAgentfinderTheme ? 'lg:max-w-[360px]' : 'lg:max-w-[320px]')}>
                <div
                  className={cn(
                    'p-0',
                    isAgentfinderTheme
                      ? 'lg:rounded-[26px] lg:border lg:border-white/16 lg:bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.08)_100%)] lg:p-4 lg:shadow-[0_30px_54px_rgba(3,8,18,0.34)] lg:ring-1 lg:ring-white/12 lg:backdrop-blur-md'
                      : 'lg:rounded-[22px] lg:border lg:border-white/8 lg:bg-transparent lg:p-0 lg:shadow-none'
                  )}
                >
                  <Button
                    asChild
                    className={cn(
                      'relative h-16 w-full overflow-visible rounded-[18px] px-6 text-base font-semibold transition-all duration-200 hover:scale-[1.01]',
                      isAgentfinderTheme
                        ? 'border border-[#f8fbff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_100%)] text-[#0f2747] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_22px_38px_rgba(2,6,16,0.30)] hover:bg-[linear-gradient(135deg,#ffffff_0%,#e8f0ff_100%)] before:absolute before:inset-[-10px] before:-z-10 before:rounded-[28px] before:border before:border-[#dbe8ff]/70 before:opacity-70 before:content-[\'\'] before:animate-ping after:absolute after:inset-[-20px] after:-z-20 after:rounded-[38px] after:bg-[radial-gradient(circle,rgba(255,255,255,0.32)_0%,rgba(160,199,255,0.18)_38%,rgba(160,199,255,0)_72%)] after:content-[\'\']'
                        : 'border border-emerald-300/25 bg-[linear-gradient(135deg,#22c55e_0%,#16a34a_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_34px_rgba(22,163,74,0.28)] hover:bg-[linear-gradient(135deg,#2dd468_0%,#17924a_100%)] before:hidden after:hidden'
                    )}
                  >
                    <Link href={allPropertiesHref} className="inline-flex items-center justify-center gap-2 no-underline">
                      Vezi toate proprietatile
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
