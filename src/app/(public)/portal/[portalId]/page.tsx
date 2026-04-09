'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { ClientPortal, PortalRecommendation, Property } from '@/lib/types';
import { ArrowRight, Building2, HeartHandshake, Home, MessageSquareHeart, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendedPropertyCard } from '@/components/portal/RecommendedPropertyCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function PortalContent({ portalId }: { portalId: string }) {
  const firestore = useFirestore();

  const portalDocRef = useMemoFirebase(() => doc(firestore, 'portals', portalId), [firestore, portalId]);
  const { data: portal, isLoading: isPortalLoading, error: portalError } = useDoc<ClientPortal>(portalDocRef);

  const recommendationsQuery = useMemoFirebase(() => collection(firestore, 'portals', portalId, 'recommendations'), [firestore, portalId]);
  const { data: recommendations, isLoading: areRecsLoading } = useCollection<PortalRecommendation>(recommendationsQuery);

  const propertyIds = useMemo(() => {
    if (!recommendations) return [];
    return recommendations.map(rec => rec.propertyId);
  }, [recommendations]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!portal || propertyIds.length === 0) return null;
    return query(collection(firestore, 'agencies', portal.agencyId, 'properties'), where('__name__', 'in', propertyIds));
  }, [firestore, portal, propertyIds]);
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  const propertiesById = useMemo(() => {
    if (!properties) return new Map();
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  const likedCount = useMemo(
    () => recommendations?.filter((rec) => rec.clientFeedback === 'liked').length || 0,
    [recommendations]
  );
  const commentedCount = useMemo(
    () => recommendations?.filter((rec) => Boolean(rec.clientComment?.trim())).length || 0,
    [recommendations]
  );

  const isLoading = isPortalLoading || areRecsLoading || arePropertiesLoading;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#08100d_0%,#0d1312_38%,#0a0c0d_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_24%)]" />
        <div className="container relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-black/20 p-8 backdrop-blur-xl">
            <Skeleton className="h-8 w-40 bg-white/10" />
            <Skeleton className="h-14 w-2/3 bg-white/10" />
            <Skeleton className="h-6 w-1/2 bg-white/10" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
            <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
            <Skeleton className="h-32 rounded-[1.7rem] bg-white/10" />
          </div>
          <div className="mt-10 grid gap-8 xl:grid-cols-2">
            <Skeleton className="h-[720px] rounded-[2rem] bg-white/10" />
            <Skeleton className="h-[720px] rounded-[2rem] bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (portalError || !portal) {
    notFound();
    return null;
  }

  return (
    <div className="relative overflow-hidden bg-[linear-gradient(180deg,#08100d_0%,#0d1312_38%,#0a0c0d_100%)] text-stone-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.16),transparent_26%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />

      <div className="container relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,18,17,0.88)_0%,rgba(8,10,10,0.94)_100%)] shadow-[0_34px_110px_-48px_rgba(0,0,0,0.96)] backdrop-blur-xl">
          <div className="grid gap-8 p-7 md:p-10 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-emerald-300/18 bg-emerald-400/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                <Sparkles className="mr-2 h-4 w-4" />
                Selecție personalizată
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-[clamp(2.3rem,5vw,4.5rem)] font-semibold tracking-[-0.045em] text-white">
                  Portalul tău de proprietăți, pregătit special pentru {portal.contactName}.
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-300 md:text-lg">
                  {portal.agentName} a selectat proprietățile cu cel mai bun potențial pentru ce cauți. Poți să le compari, să notezi ce simți despre fiecare și să trimiți feedback direct din pagină.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="rounded-full bg-emerald-400 px-6 text-black hover:bg-emerald-300">
                  <a href="#recomandari">
                    Vezi recomandările
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-stone-300">
                  Feedbackul tău ajunge direct la agent
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Proprietăți selectate</p>
                    <p className="text-3xl font-semibold text-white">{recommendations?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Proprietăți apreciate</p>
                    <p className="text-3xl font-semibold text-white">{likedCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                    <MessageSquareHeart className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Comentarii trimise</p>
                    <p className="text-3xl font-semibold text-white">{commentedCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {(!recommendations || recommendations.length === 0) ? (
          <Alert className="mt-10 rounded-[1.8rem] border-white/10 bg-white/[0.04] text-stone-100">
            <Home className="h-5 w-5 text-emerald-200" />
            <AlertTitle>Nicio proprietate recomandată momentan</AlertTitle>
            <AlertDescription className="text-stone-300">
              Agentul tău nu a adăugat încă proprietăți în portal. Revino puțin mai târziu sau contactează-l pentru o selecție actualizată.
            </AlertDescription>
          </Alert>
        ) : (
          <section id="recomandari" className="mt-10 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">Recomandări active</p>
                <h2 className="text-3xl font-semibold tracking-tight text-white">Compară rapid și trimite feedback clar</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-stone-400">
                Fiecare card este gândit să te ajute să decizi repede: vezi esențialul, deschizi detaliile complete și notezi imediat ce ți se potrivește.
              </p>
            </div>

            <div className="grid gap-8 xl:grid-cols-2">
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
          </section>
        )}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const params = useParams();
  const portalId = params.portalId as string;

  return <PortalContent key={portalId} portalId={portalId} />;
}
