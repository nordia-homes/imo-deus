'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, CircleAlert, ExternalLink, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import type { PricingAnalysisResult, PricingComparable, PricingSourceDiagnostic } from '@/lib/pricing-analysis';
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
  currentAgencyId,
}: {
  title: string;
  description: string;
  items: PricingComparable[];
  currentAgencyId?: string | null;
}) {
  const getComparableHref = (item: PricingComparable) => {
    if (item.url) return item.url;
    if (item.agencyId && item.agencyId === currentAgencyId) return `/properties/${item.id}`;
    return null;
  };

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
                  <TableHead className="text-right text-white/70">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const comparableHref = getComparableHref(item);

                  return (
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
                      <TableCell className="text-right">
                        {comparableHref ? (
                          <Button asChild size="icon" variant="outline" className="h-8 w-8 rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                            <a href={comparableHref} target="_blank" rel="noreferrer" aria-label="Deschide comparabila in tab nou">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-white/42">Privat</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
      if (!propertyId) {
        setIsLoadingAnalysis(false);
        return;
      }

      if (!user) {
        setIsLoadingAnalysis(false);
        setAnalysisError('Autentificarea nu este disponibila momentan. Reincarca pagina sau autentifica-te din nou.');
        return;
      }

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

  const pricingStrategy = analysis?.pricingStrategy ?? {
    fastSalePrice: analysis?.conservativeMinPrice ?? 0,
    fastSalePricePerSqm: analysis?.subject?.squareFootage ? Math.round((analysis?.conservativeMinPrice ?? 0) / analysis.subject.squareFootage) : 0,
    recommendedPrice: analysis?.recommendedListingPrice ?? 0,
    recommendedPricePerSqm: analysis?.recommendedListingPricePerSqm ?? 0,
    stretchPrice: analysis?.stretchMaxPrice ?? 0,
    stretchPricePerSqm: analysis?.subject?.squareFootage ? Math.round((analysis?.stretchMaxPrice ?? 0) / analysis.subject.squareFootage) : 0,
    overpricedThreshold: Math.round((analysis?.stretchMaxPrice ?? analysis?.recommendedListingPrice ?? 0) * 1.01),
    overpricedThresholdPerSqm: analysis?.subject?.squareFootage ? Math.round(((analysis?.stretchMaxPrice ?? analysis?.recommendedListingPrice ?? 0) * 1.01) / analysis.subject.squareFootage) : 0,
    expectedSaleWindowDays: {
      fast: '21-45 zile',
      recommended: '45-90 zile',
      stretch: '90+ zile',
    },
    negotiationRoomPercent: analysis?.confidenceScore && analysis.confidenceScore >= 82 ? 3.5 : analysis?.confidenceScore && analysis.confidenceScore >= 68 ? 5 : 6.5,
    ownerConversation: [],
  };
  const marketEvidence = analysis?.marketEvidence ?? {
    tier: 'listing_led',
    soldComparableCount: analysis?.marketSignals.soldCount ?? 0,
    activeComparableCount: analysis?.marketSignals.activeCount ?? 0,
    portalComparableCount: analysis?.marketSignals.portalCount ?? 0,
    averageSoldComparableAgeDays: null,
    directMicrozoneSoldCount: 0,
    evidenceScore: analysis ? Math.min(72, analysis.confidenceScore) : 0,
    sourceMix: {
      soldWeight: analysis?.marketSignals.soldCount ? 60 : 0,
      activeWeight: analysis?.marketSignals.activeCount ? 80 : 0,
      portalWeight: analysis?.marketSignals.portalCount ? 20 : 0,
    },
    verdict: 'Analiza foloseste formatul anterior al motorului; recalculeaza pentru evidenta extinsa.',
  };
  const dataQuality = analysis?.dataQuality ?? {
    score: analysis ? 70 : 0,
    level: 'medium',
    missingFields: [],
    strengths: [],
    warnings: ['Recalculeaza analiza pentru scorul complet de calitate a datelor.'],
  };
  const backtest = analysis?.backtest ?? {
    available: false,
    sampleSize: 0,
    meanAbsoluteErrorPercent: null,
    medianAbsoluteErrorPercent: null,
    biasPercent: null,
    verdict: 'Recalculeaza analiza pentru integrarea cu memoria si backtesting-ul.',
    latestBacktest: null,
  };
  const sourceDiagnostics: PricingSourceDiagnostic[] = analysis?.sourceDiagnostics ?? [];
  const riskFlags = analysis?.riskFlags ?? [];

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
                Motorul combina tranzactii `Vandut` din toate agentiile din platforma, proprietati active din portofoliul curent si comparabile active deja salvate in ownerListings.
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
              hint={`${analysis.marketSignals.soldCount} vandute, ${analysis.marketSignals.activeCount} active, ${analysis.marketSignals.portalCount} ownerListings`}
            />
            <MetricCard
              label="Temperatura pietei"
              value={marketHeatLabel || 'Piata echilibrata'}
              hint="Fara scraping live; surse locale controlate"
            />
          </div>

          <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-white">Strategie si incredere comerciala</CardTitle>
              <CardDescription className="text-white/68">
                Motorul separa pretul de vanzare rapida, pretul recomandat, limita de test si calitatea dovezilor folosite.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-4">
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm text-white/62">Vanzare rapida</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {pricingStrategy.fastSalePrice.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-white/54">{pricingStrategy.expectedSaleWindowDays.fast}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm text-white/62">Prag supraevaluare</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {pricingStrategy.overpricedThreshold.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-white/54">negociere normala ~{pricingStrategy.negotiationRoomPercent}%</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm text-white/62">Dovezi de piata</p>
                <p className="mt-2 text-2xl font-semibold text-white">{marketEvidence.evidenceScore}/100</p>
                <p className="mt-1 text-xs text-white/54">
                  {marketEvidence.sourceMix.soldWeight}% vandute, {marketEvidence.sourceMix.activeWeight}% active, {marketEvidence.sourceMix.portalWeight}% ownerListings
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm text-white/62">Calitate date</p>
                <p className="mt-2 text-2xl font-semibold text-white">{dataQuality.score}/100</p>
                <p className="mt-1 text-xs text-white/54">
                  {dataQuality.missingFields.length ? `Lipsesc: ${dataQuality.missingFields.join(', ')}` : 'Date complete pentru evaluare'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-white">Auditul surselor si riscuri</CardTitle>
              <CardDescription className="text-white/68">
                Analiza arata ce surse au alimentat pretul si ce semnale pot limita increderea comerciala.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-3 md:grid-cols-2">
                {sourceDiagnostics.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4 text-sm text-white/64">
                    Recalculeaza analiza pentru auditul complet al surselor.
                  </div>
                ) : (
                  sourceDiagnostics.map((item) => (
                    <div key={item.source} className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{item.source.replace(/_/g, ' ')}</p>
                          <p className="mt-1 text-xs leading-5 text-white/56">{item.message}</p>
                        </div>
                        <Badge className={item.status === 'ok' ? 'bg-emerald-400/15 text-emerald-100' : item.status === 'failed' ? 'bg-rose-400/15 text-rose-100' : 'bg-amber-400/15 text-amber-100'}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs text-white/48">
                        {item.acceptedCount} acceptate / {item.rejectedCount} respinse
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                {riskFlags.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4 text-sm text-white/64">
                    Nu exista riscuri explicite in aceasta rulare.
                  </div>
                ) : (
                  riskFlags.map((flag) => (
                    <div key={`${flag.label}-${flag.reason}`} className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{flag.label}</p>
                        <Badge className={flag.severity === 'critical' ? 'bg-rose-400/15 text-rose-100' : flag.severity === 'warning' ? 'bg-amber-400/15 text-amber-100' : 'bg-sky-400/15 text-sky-100'}>
                          {flag.severity}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/62">{flag.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

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
                    <p className="text-sm text-white/62">Active din ownerListings</p>
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

          <Card className="rounded-[1.9rem] border border-white/10 bg-[#152A47] text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.68)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-white">Memorie si backtesting</CardTitle>
              <CardDescription className="text-white/68">
                Fiecare analiza este salvata ca snapshot, iar tranzactiile vandute pot fi comparate cu recomandarile istorice.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm text-white/62">Precizie istorica</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {backtest.available && backtest.medianAbsoluteErrorPercent !== null
                    ? `${backtest.medianAbsoluteErrorPercent}%`
                    : 'In formare'}
                </p>
                <p className="mt-1 text-xs text-white/54">
                  {backtest.sampleSize} tranzactii cu analiza anterioara
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <p className="text-sm font-medium text-white">{backtest.verdict}</p>
                <p className="mt-2 text-sm leading-6 text-white/62">{marketEvidence.verdict}</p>
                {backtest.segment ? (
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    Segment: {backtest.segment.sampleSize} exemple, factor calibrare {backtest.segment.calibrationFactor.toLocaleString('ro-RO')}. {backtest.segment.verdict}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <ComparableTable
            title="Tranzactii similare vandute in platforma"
            description="Aceste comparabile au cea mai mare greutate in pretul recomandat, fiind vanzari inchise centralizate din agentiile inscrise."
            items={analysis.soldComparables}
            currentAgencyId={agencyId}
          />

          <ComparableTable
            title="Oferta activa din agentie"
            description="Aceste proprietati arata cum este pozitionat astazi portofoliul propriu fata de aceeasi categorie de produs."
            items={analysis.activeComparables}
            currentAgencyId={agencyId}
          />

          <ComparableTable
            title="Comparabile active din ownerListings"
            description="Aceste comparabile sunt anunturi deja colectate si normalizate in ownerListings; motorul nu face scraping live in timpul analizei."
            items={analysis.portalComparables}
            currentAgencyId={agencyId}
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
                  Pretul recomandat ramane sub limita de test; cand reperele nu sustin distanta, motorul coboara recomandarea.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-[#10223a] p-4">
                <div className="flex items-center gap-2 text-rose-200">
                  <TrendingDown className="h-4 w-4" />
                  <p className="font-medium">Atentie comerciala</p>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  Preturile din ownerListings sunt cereri active, nu inchideri. De aceea algoritmul le pondera mai jos decat comparabilele vandute.
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
