'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { ClientPortal, PortalRecommendation, Property } from '@/lib/types';
import { ArrowRight, Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendedPropertyCard } from '@/components/portal/RecommendedPropertyCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function PortalContent({ portalId }: { portalId: string }) {
  const firestore = useFirestore();

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

  return (
    <div data-app-theme="agentfinder" className="agentfinder-properties-page space-y-6 px-4 pb-10 pt-6 text-white md:px-6 lg:px-8">
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

          <div className="overflow-hidden rounded-[28px] border border-[#d7e0ee] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] shadow-[0_22px_44px_rgba(37,55,88,0.10)]">
            <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="p-6 lg:p-8">
                <div className="inline-flex items-center rounded-full border border-[#d7e0ee] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#59709b]">
                  Vezi mai mult
                </div>
                <h3 className="mt-4 max-w-xl font-headline text-[clamp(1.45rem,3vw,2.15rem)] font-bold tracking-[-0.04em] text-slate-950">
                  Exploreaza tot portofoliul disponibil
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Daca vrei sa compari mai multe optiuni, intra in toate proprietatile publice si continua selectia fara sa pierzi nimic relevant.
                </p>
              </div>

              <div className="flex items-center border-t border-[#d7e0ee] bg-[linear-gradient(180deg,#eef4ff_0%,#e5eefc_100%)] p-5 lg:border-l lg:border-t-0 lg:p-8">
                <div className="w-full rounded-[22px] border border-white/70 bg-white/92 p-4 shadow-[0_16px_30px_rgba(37,55,88,0.08)]">
                  <p className="text-sm font-medium leading-6 text-slate-600">
                    Vezi rapid toate proprietatile disponibile ale agentiei si descopera mai multe variante potrivite pentru tine.
                  </p>
                  <Button
                    asChild
                    className="mt-4 h-14 w-full rounded-[16px] border-0 bg-[linear-gradient(135deg,#4b6592_0%,#3f567f_100%)] px-6 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,66,104,0.26)] hover:bg-[linear-gradient(135deg,#5672a3_0%,#47618e_100%)]"
                  >
                    <Link href={`/agencies/${portal.agencyId}/properties`} className="inline-flex items-center justify-center gap-2 text-white no-underline">
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

export default function ClientPortalPage() {
  const params = useParams();
  const portalId = params.portalId as string;

  return <PortalContent key={portalId} portalId={portalId} />;
}
