'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, CircleAlert, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import type { PricingAnalysisResult, PricingComparable } from '@/lib/pricing-analysis';
import { doc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="rounded-[1.75rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
      <CardContent className="space-y-2 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
        <p className="text-sm text-white/65">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ComparableTable({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: PricingComparable[];
}) {
  return (
    <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-white">{title}</CardTitle>
        <CardDescription className="text-white/68">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-[1.2rem] border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/68">
            Nu au fost gasite suficiente comparabile pentru aceasta sectiune.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.2rem] border border-white/8">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 bg-white/[0.03] hover:bg-white/[0.03]">
                  <TableHead className="text-white/70">Proprietate</TableHead>
                  <TableHead className="text-white/70">Locatie</TableHead>
                  <TableHead className="text-white/70">Pret</TableHead>
                  <TableHead className="text-white/70">EUR/mp</TableHead>
                  <TableHead className="text-white/70">Similaritate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.source}-${item.id}-${item.price}`} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell className="min-w-[230px]">
                      <div className="space-y-1">
                        <p className="font-medium text-white">{item.title}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-white/10 bg-white/10 text-white">{item.statusLabel}</Badge>
                          {item.rooms !== null ? <Badge variant="outline" className="border-white/10 text-white/72">{item.rooms} cam.</Badge> : null}
                          <Badge variant="outline" className="border-white/10 text-white/72">{item.squareFootage} mp</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/76">{item.locationLabel}</TableCell>
                    <TableCell className="font-medium text-white">{item.price.toLocaleString('ro-RO')} EUR</TableCell>
                    <TableCell className="text-white/82">{item.pricePerSqm.toLocaleString('ro-RO')}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-white">{item.similarityScore}/100</p>
                        <p className="text-xs text-white/60">{item.similarityReasons.join(', ')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 rounded-[2rem] bg-white/10" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[1.75rem] bg-white/10" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-[2rem] bg-white/10" />
      <Skeleton className="h-96 rounded-[2rem] bg-white/10" />
    </div>
  );
}

export default function PropertyPricingAnalysisPage() {
  const params = useParams();
  const propertyId = (params?.propertyId as string | undefined) || '';
  const { agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const [analysis, setAnalysis] = useState<PricingAnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const propertyDocRef = useMemoFirebase(() => {
    if (!agencyId || !propertyId) return null;
    return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
  }, [agencyId, firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyDocRef);

  const marketHeatLabel = useMemo(() => {
    if (!analysis) return null;
    if (analysis.marketSignals.marketHeat === 'hot') return 'Piata activa';
    if (analysis.marketSignals.marketHeat === 'soft') return 'Piata sensibila la pret';
    return 'Piata echilibrata';
  }, [analysis]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalysis() {
      if (!user || !propertyId) return;

      setIsLoadingAnalysis(true);
      setAnalysisError(null);

      try {
        const token = await user.getIdToken(true);
        const response = await fetch(`/api/properties/${propertyId}/pricing-analysis`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const payload = (await response.json()) as PricingAnalysisResult | { message?: string };
        if (!response.ok) {
          throw new Error('message' in payload ? payload.message || 'Analiza nu a putut fi generata.' : 'Analiza nu a putut fi generata.');
        }

        if (!isCancelled) {
          setAnalysis(payload as PricingAnalysisResult);
        }
      } catch (error) {
        if (!isCancelled) {
          setAnalysisError(error instanceof Error ? error.message : 'Analiza nu a putut fi generata.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAnalysis(false);
        }
      }
    }

    loadAnalysis();
    return () => {
      isCancelled = true;
    };
  }, [propertyId, refreshKey, user]);

  if (isLoadingProperty || isLoadingAnalysis) {
    return (
      <div className="space-y-6 bg-[#0F1E33] px-3 py-4 text-white">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#0F1E33] px-3 py-4 text-white">
      <Card className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.12),_transparent_32%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.72)]">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              <Link href={`/properties/${propertyId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Inapoi la proprietate
              </Link>
            </Button>
            <Badge className="rounded-full border-emerald-300/18 bg-emerald-400/12 px-3 py-1 text-emerald-50">
              Analiza dedicata de pret
            </Badge>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/72">pricing intelligence</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {property?.title || 'Analiza proprietatii'}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-white/72">
                Motorul combina tranzactii `Vandut` din toate agentiile din platforma, proprietati active din portofoliul curent si comparabile online extrase direct din portaluri imobiliare, fara API.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => {
                setIsLoadingAnalysis(true);
                setAnalysis(null);
                setAnalysisError(null);
                setRefreshKey((current) => current + 1);
              }}
              className="rounded-full border border-sky-300/16 bg-sky-500/18 px-5 text-white hover:bg-sky-500/24"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recalculeaza
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysisError ? (
        <Alert className="rounded-[1.6rem] border border-rose-400/18 bg-rose-500/10 text-rose-50">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>Analiza nu a putut fi generata</AlertTitle>
          <AlertDescription>{analysisError}</AlertDescription>
        </Alert>
      ) : null}

      {analysis ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Pret recomandat"
              value={`${analysis.recommendedListingPrice.toLocaleString('ro-RO')} EUR`}
              hint={`${analysis.recommendedListingPricePerSqm.toLocaleString('ro-RO')} EUR/mp`}
            />
            <MetricCard
              label="Interval tactic"
              value={`${analysis.conservativeMinPrice.toLocaleString('ro-RO')} - ${analysis.stretchMaxPrice.toLocaleString('ro-RO')} EUR`}
              hint="plaja utila pentru negociere si testare"
            />
            <MetricCard
              label="Incredere"
              value={`${analysis.confidenceScore}/100`}
              hint={`${analysis.marketSignals.soldCount} vandute, ${analysis.marketSignals.activeCount} active, ${analysis.marketSignals.portalCount} portal`}
            />
            <MetricCard
              label="Temperatura pietei"
              value={marketHeatLabel || 'Piata echilibrata'}
              hint={analysis.marketSignals.portalIndexPricePerSqm ? `Indice portal: ${analysis.marketSignals.portalIndexPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : 'Fara indice extern disponibil'}
            />
          </div>

          <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <BarChart3 className="h-5 w-5 text-emerald-200" />
                Recomandare executiva
              </CardTitle>
              <CardDescription className="text-white/68">
                {analysis.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/48">Benchmarks</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.1rem] border border-white/8 bg-[#10223a] p-4">
                    <p className="text-sm text-white/62">Vandute in platforma</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {analysis.soldBenchmarkPricePerSqm ? `${analysis.soldBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-white/8 bg-[#10223a] p-4">
                    <p className="text-sm text-white/62">Active in agentie</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {analysis.activeBenchmarkPricePerSqm ? `${analysis.activeBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-white/8 bg-[#10223a] p-4">
                    <p className="text-sm text-white/62">Active pe portal</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {analysis.portalBenchmarkPricePerSqm ? `${analysis.portalBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/48">Ajustari cheie</p>
                <div className="mt-4 space-y-3">
                  {analysis.adjustments.length === 0 ? (
                    <p className="text-sm text-white/68">
                      Nu au fost necesare ajustari suplimentare fata de baza comparabila.
                    </p>
                  ) : (
                    analysis.adjustments.map((adjustment) => (
                      <div key={adjustment.label} className="rounded-[1rem] border border-white/8 bg-[#10223a] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{adjustment.label}</p>
                            <p className="mt-1 text-sm text-white/62">{adjustment.reason}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-semibold ${adjustment.direction === 'negative' ? 'text-rose-200' : 'text-emerald-200'}`}>
                              {adjustment.impactPerSqm > 0 ? '+' : ''}{adjustment.impactPerSqm} EUR/mp
                            </p>
                            <p className="text-xs text-white/54">
                              {adjustment.impactTotal > 0 ? '+' : ''}{adjustment.impactTotal.toLocaleString('ro-RO')} EUR total
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <ComparableTable
            title="Tranzactii similare vandute in platforma"
            description="Aceste comparabile au cea mai mare greutate in pretul recomandat, fiind vanzari inchise centralizate din agentiile inscrise."
            items={analysis.soldComparables}
          />

          <ComparableTable
            title="Oferta activa din agentie"
            description="Aceste proprietati arata cum este pozitionat astazi portofoliul propriu fata de aceeasi categorie de produs."
            items={analysis.activeComparables}
          />

          <ComparableTable
            title="Comparabile online din portal"
            description="Aceste comparabile sunt preturi active de listare extrase direct din portaluri precum OLX/Storia si imobiliare.net si sunt folosite cu discount fata de vanzarile inchise."
            items={analysis.portalComparables}
          />

          <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
            <CardHeader>
              <CardTitle className="text-xl text-white">Cum citim recomandarea</CardTitle>
              <CardDescription className="text-white/68">
                Plaja de pret este construita pentru vanzare, nu doar pentru listare decorativa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <div className="flex items-center gap-2 text-emerald-200">
                  <TrendingUp className="h-4 w-4" />
                  <p className="font-medium">Pret recomandat</p>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Nivelul optim pentru listarea initiala, tinand cont de tranzactii vandute, concurenta si ajustarile de produs.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <div className="flex items-center gap-2 text-sky-200">
                  <BarChart3 className="h-4 w-4" />
                  <p className="font-medium">Interval tactic</p>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Limita inferioara este pragul conservator, iar limita superioara este nivelul maxim sustenabil pentru test comercial.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <div className="flex items-center gap-2 text-rose-200">
                  <TrendingDown className="h-4 w-4" />
                  <p className="font-medium">Atentie comerciala</p>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Preturile din portal sunt cereri active, nu inchideri. De aceea algoritmul le pondera mai jos decat comparabilele vandute.
                </p>
              </div>
            </CardContent>
          </Card>

          <Alert className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] text-white">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Limitari curente</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1 text-sm text-white/72">
                {analysis.limitations.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  );
}
