'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, CircleAlert, ExternalLink, FileDown, ImageIcon, Loader2, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Contact, MatchedBuyer, Property } from '@/lib/types';
import type { PricingAnalysisResult, PricingComparable } from '@/lib/pricing-analysis';
import { getDeterministicMatchedBuyers } from '@/lib/matching-engine';
import { collection, doc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

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
    <Card className="rounded-[1.9rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
        <CardDescription className="text-slate-600">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Nu au fost gasite suficiente comparabile pentru aceasta sectiune.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.2rem] border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-slate-600">Proprietate</TableHead>
                  <TableHead className="text-slate-600">Locatie</TableHead>
                  <TableHead className="text-slate-600">Pret</TableHead>
                  <TableHead className="text-slate-600">EUR/mp</TableHead>
                  <TableHead className="text-slate-600">Similaritate</TableHead>
                  <TableHead className="text-right text-slate-600">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const comparableHref = getComparableHref(item);

                  return (
                    <TableRow key={`${item.source}-${item.id}-${item.price}`} className="border-slate-200 hover:bg-slate-50/70">
                      <TableCell className="min-w-[320px]">
                        <div className="flex items-center gap-3">
                          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="line-clamp-2 font-medium leading-5 text-slate-950">{item.title}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="border-teal-200 bg-teal-50 text-teal-800">{item.statusLabel}</Badge>
                              {item.rooms !== null ? <Badge variant="outline" className="border-slate-200 text-slate-600">{item.rooms} cam.</Badge> : null}
                              <Badge variant="outline" className="border-slate-200 text-slate-600">{item.squareFootage} mp</Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{item.locationLabel}</TableCell>
                      <TableCell className="font-medium text-slate-950">{item.price.toLocaleString('ro-RO')} EUR</TableCell>
                      <TableCell className="text-slate-700">{item.pricePerSqm.toLocaleString('ro-RO')}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-950">{item.similarityScore}/100</p>
                          <p className="text-xs text-slate-500">{item.similarityReasons.join(', ')}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {comparableHref ? (
                          <Button asChild size="icon" variant="outline" className="h-8 w-8 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                            <a href={comparableHref} target="_blank" rel="noreferrer" aria-label="Deschide comparabila in tab nou">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Privat</span>
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
      <Skeleton className="h-28 rounded-[2rem] bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[1.75rem] bg-slate-200" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-[2rem] bg-slate-200" />
      <Skeleton className="h-96 rounded-[2rem] bg-slate-200" />
    </div>
  );
}

function parseManualPrice(value: string, fallback: number) {
  const normalized = value.replace(/[^\d]/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function formatEditablePrice(value: number) {
  return Math.round(value).toLocaleString('ro-RO');
}

function formatBuyerBudget(buyer: Pick<Contact, 'budget' | 'preferences'>) {
  const min = buyer.preferences?.desiredPriceRangeMin;
  const max = buyer.preferences?.desiredPriceRangeMax || buyer.budget;

  if (min && max) return `${min.toLocaleString('ro-RO')} - ${max.toLocaleString('ro-RO')} EUR`;
  if (max) return `pana la ${max.toLocaleString('ro-RO')} EUR`;
  return 'Buget nespecificat';
}

function buyerLocationLabel(buyer: Pick<Contact, 'city' | 'zones' | 'generalZone'>) {
  const zones = buyer.zones?.filter(Boolean).slice(0, 2) ?? [];
  if (buyer.city && zones.length) return `${buyer.city} · ${zones.join(', ')}`;
  if (buyer.city) return buyer.city;
  if (zones.length) return zones.join(', ');
  return buyer.generalZone || 'Zona flexibila';
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'analiza-pret';
}

export default function PropertyPricingAnalysisPage() {
  const params = useParams();
  const propertyId = (params?.propertyId as string | undefined) || '';
  const { agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const [analysis, setAnalysis] = useState<PricingAnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [manualMinPrice, setManualMinPrice] = useState('');
  const [manualRecommendedPrice, setManualRecommendedPrice] = useState('');

  const propertyDocRef = useMemoFirebase(() => {
    if (!agencyId || !propertyId) return null;
    return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
  }, [agencyId, firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyDocRef);
  const contactsQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'contacts');
  }, [firestore, agencyId]);
  const { data: contacts } = useCollection<Contact>(contactsQuery);

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

  useEffect(() => {
    if (!analysis) return;
    setManualMinPrice(formatEditablePrice(analysis.conservativeMinPrice));
    setManualRecommendedPrice(formatEditablePrice(analysis.recommendedListingPrice));
  }, [analysis]);

  if (isLoadingProperty || isLoadingAnalysis) {
    return (
      <div className="space-y-6 bg-slate-50 px-3 py-4 text-slate-950">
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
      fast: '30 zile',
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
  const manualMinPriceValue = parseManualPrice(manualMinPrice, pricingStrategy.fastSalePrice);
  const manualRecommendedPriceValue = parseManualPrice(manualRecommendedPrice, pricingStrategy.recommendedPrice);
  const pricingSurface = analysis?.subject.squareFootage || property?.squareFootage || 1;
  const manualMinPricePerSqm = Math.round(manualMinPriceValue / pricingSurface);
  const manualRecommendedPricePerSqm = Math.round(manualRecommendedPriceValue / pricingSurface);
  const hasInvalidManualPrices = manualMinPriceValue > manualRecommendedPriceValue;
  const visibleAdjustmentPerSqm = analysis?.adjustments.reduce((sum, adjustment) => sum + adjustment.impactPerSqm, 0) ?? 0;
  const visibleAdjustmentTotal = analysis?.adjustments.reduce((sum, adjustment) => sum + adjustment.impactTotal, 0) ?? 0;
  const estimatedBasePerSqm = manualRecommendedPricePerSqm - visibleAdjustmentPerSqm;
  const estimatedBaseTotal = estimatedBasePerSqm * pricingSurface;
  const missingForOwner = [...dataQuality.missingFields, ...dataQuality.warnings].slice(0, 3);
  const matchedBuyers: MatchedBuyer[] = property && contacts?.length ? getDeterministicMatchedBuyers(property, contacts, 20) : [];

  const handleExportPricingPdf = async () => {
    if (!user || !analysis || isExportingPdf) return;

    if (hasInvalidManualPrices) {
      toast({
        variant: 'destructive',
        title: 'Preturi invalide',
        description: 'Pretul minim trebuie sa fie mai mic sau egal cu pretul recomandat.',
      });
      return;
    }

    setIsExportingPdf(true);

    try {
      const token = await user.getIdToken(true);

      if (typeof window !== 'undefined' && window.imodeusDesktop?.generatePropertyPresentationPdf) {
        const url = new URL(`/api/properties/${propertyId}/pricing-analysis/pdf`, window.location.origin);
        url.searchParams.set('format', 'html');
        const result = await window.imodeusDesktop.generatePropertyPresentationPdf({
          url: url.toString(),
          token,
          method: 'POST',
          body: {
            minPrice: manualMinPriceValue,
            recommendedPrice: manualRecommendedPriceValue,
          },
          fileName: `${sanitizeFileName(property?.title || analysis.subject.title)}-analiza-pret.pdf`,
        });

        if (!result.canceled) {
          toast({
            title: 'PDF generat',
            description: 'Analiza de pret pentru proprietar a fost salvata local.',
          });
        }
        return;
      }

      const response = await fetch(`/api/properties/${propertyId}/pricing-analysis/pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minPrice: manualMinPriceValue,
          recommendedPrice: manualRecommendedPriceValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'Nu am putut genera PDF-ul de analiza pret.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(property?.title || analysis.subject.title)}-analiza-pret.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'PDF generat',
        description: 'Analiza de pret pentru proprietar a fost descarcata.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Exportul a esuat',
        description: error instanceof Error ? error.message : 'Nu am putut genera PDF-ul de analiza pret.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 bg-slate-50 px-3 py-4 text-slate-950">
      <Card className="overflow-hidden rounded-[2rem] border border-teal-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link href={`/properties/${propertyId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Inapoi la proprietate
              </Link>
            </Button>
            <Badge className="rounded-full border-teal-200 bg-teal-50 px-3 py-1 text-teal-800">
              Analiza dedicata de pret
            </Badge>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-teal-700">pricing intelligence</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {property?.title || 'Analiza proprietatii'}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
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
              className="rounded-full border border-sky-200 bg-sky-50 px-5 text-sky-800 hover:bg-sky-100"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recalculeaza
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysisError ? (
        <Alert className="rounded-[1.6rem] border border-rose-200 bg-rose-50 text-rose-800">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>Analiza nu a putut fi generata</AlertTitle>
          <AlertDescription>{analysisError}</AlertDescription>
        </Alert>
      ) : null}

      {analysis ? (
        <>
          <Card className="rounded-[1.9rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl text-slate-950">Strategie si incredere comerciala</CardTitle>
                  <CardDescription className="text-slate-600">
                    Ajusteaza preturile pentru discutia cu proprietarul, apoi exporta analiza PDF pentru prezentare.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  onClick={handleExportPricingPdf}
                  disabled={isExportingPdf || hasInvalidManualPrices}
                  className="rounded-full border border-emerald-200 bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                >
                  {isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  Exporta PDF analiza pret
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="manual-min-price" className="text-sm font-medium text-slate-700">
                    Pret minim
                  </label>
                  <div className="relative">
                    <Input
                      id="manual-min-price"
                      inputMode="numeric"
                      value={manualMinPrice}
                      onChange={(event) => setManualMinPrice(event.target.value)}
                      className="h-12 rounded-xl border-orange-200 bg-white pr-12 text-lg font-semibold text-slate-950"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">EUR</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="manual-recommended-price" className="text-sm font-medium text-slate-700">
                    Pret recomandat
                  </label>
                  <div className="relative">
                    <Input
                      id="manual-recommended-price"
                      inputMode="numeric"
                      value={manualRecommendedPrice}
                      onChange={(event) => setManualRecommendedPrice(event.target.value)}
                      className="h-12 rounded-xl border-emerald-200 bg-white pr-12 text-lg font-semibold text-slate-950"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">EUR</span>
                  </div>
                </div>
                {hasInvalidManualPrices ? (
                  <p className="text-sm text-rose-700 md:col-span-2">
                    Pretul minim trebuie sa fie mai mic sau egal cu pretul recomandat.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.2rem] border border-orange-200 bg-orange-50 p-4 shadow-[inset_4px_0_0_rgba(234,88,12,0.52)]">
                <p className="text-sm text-orange-800/76">Vanzare rapida</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {manualMinPriceValue.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {manualMinPricePerSqm.toLocaleString('ro-RO')} EUR/mp · {pricingStrategy.expectedSaleWindowDays.fast}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-sky-200 bg-sky-50 p-4 shadow-[inset_4px_0_0_rgba(2,132,199,0.42)]">
                <p className="text-sm text-sky-800/72">Interval tactic</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {analysis.conservativeMinPrice.toLocaleString('ro-RO')} - {analysis.stretchMaxPrice.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-slate-600">plaja utila pentru negociere si testare</p>
              </div>
              <div className="rounded-[1.2rem] border border-emerald-300 bg-emerald-100 p-4 shadow-[0_18px_42px_-30px_rgba(5,150,105,0.72),inset_4px_0_0_rgba(5,150,105,0.62)]">
                <p className="text-sm text-emerald-900/78">Pret recomandat</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-950">
                  {manualRecommendedPriceValue.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-slate-600">{manualRecommendedPricePerSqm.toLocaleString('ro-RO')} EUR/mp</p>
              </div>
              <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4 shadow-[inset_4px_0_0_rgba(217,119,6,0.45)]">
                <p className="text-sm text-amber-800/72">Prag supraevaluare</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {pricingStrategy.overpricedThreshold.toLocaleString('ro-RO')} EUR
                </p>
                <p className="mt-1 text-xs text-slate-600">negociere normala ~{pricingStrategy.negotiationRoomPercent}%</p>
              </div>
              <div className="rounded-[1.2rem] border border-indigo-200 bg-indigo-50 p-4 shadow-[inset_4px_0_0_rgba(79,70,229,0.38)]">
                <p className="text-sm text-indigo-800/72">Incredere</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{analysis.confidenceScore}/100</p>
                <p className="mt-1 text-xs text-slate-600">
                  {analysis.marketSignals.soldCount} vandute, {analysis.marketSignals.activeCount} active, {analysis.marketSignals.portalCount} ownerListings
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-cyan-200 bg-cyan-50 p-4 shadow-[inset_4px_0_0_rgba(8,145,178,0.38)]">
                <p className="text-sm text-cyan-800/72">Dovezi de piata</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{marketEvidence.evidenceScore}/100</p>
                <p className="mt-1 text-xs text-slate-600">
                  {marketEvidence.sourceMix.soldWeight}% vandute, {marketEvidence.sourceMix.activeWeight}% active, {marketEvidence.sourceMix.portalWeight}% ownerListings
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-violet-200 bg-violet-50 p-4 shadow-[inset_4px_0_0_rgba(124,58,237,0.34)]">
                <p className="text-sm text-violet-800/72">Calitatea datelor</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{dataQuality.score}/100</p>
                <p className="mt-1 text-xs text-slate-600">
                  {dataQuality.missingFields.length ? `Lipsesc: ${dataQuality.missingFields.join(', ')}` : 'Date complete pentru evaluare'}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4 shadow-[inset_4px_0_0_rgba(225,29,72,0.34)]">
                <p className="text-sm text-rose-800/72">Temperatura pietei</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{marketHeatLabel || 'Piata echilibrata'}</p>
                <p className="mt-1 text-xs text-slate-600">Fara scraping live; surse locale controlate</p>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.9rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <BarChart3 className="h-5 w-5 text-teal-700" />
                Recomandare executiva
              </CardTitle>
              <CardDescription className="max-w-6xl text-base leading-7 text-slate-600">
                {analysis.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">Benchmarks</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Vandute in platforma</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {analysis.soldBenchmarkPricePerSqm ? `${analysis.soldBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Active in agentie</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {analysis.activeBenchmarkPricePerSqm ? `${analysis.activeBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Active din ownerListings</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {analysis.portalBenchmarkPricePerSqm ? `${analysis.portalBenchmarkPricePerSqm.toLocaleString('ro-RO')} EUR/mp` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">Ajustari cheie</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Baza comparabila</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{estimatedBasePerSqm.toLocaleString('ro-RO')} EUR/mp</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {estimatedBaseTotal.toLocaleString('ro-RO')} EUR pentru {pricingSurface.toLocaleString('ro-RO')} mp
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Ajustari vizibile</p>
                    <p className={`mt-2 text-2xl font-semibold ${visibleAdjustmentPerSqm < 0 ? 'text-rose-700' : 'text-teal-800'}`}>
                      {visibleAdjustmentPerSqm > 0 ? '+' : ''}{visibleAdjustmentPerSqm.toLocaleString('ro-RO')} EUR/mp
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {visibleAdjustmentTotal > 0 ? '+' : visibleAdjustmentTotal < 0 ? '-' : ''}{Math.abs(visibleAdjustmentTotal).toLocaleString('ro-RO')} EUR impact total
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Pret rezultat</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{manualRecommendedPricePerSqm.toLocaleString('ro-RO')} EUR/mp</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {manualRecommendedPriceValue.toLocaleString('ro-RO')} EUR pret recomandat
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-[1rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-900">Ce mai poate rafina pretul: </span>
                  {missingForOwner.length > 0
                    ? missingForOwner.join('; ')
                    : 'datele principale sunt complete pentru o recomandare comerciala coerenta.'}
                </div>
                <div className="mt-4 space-y-3">
                  {analysis.adjustments.length === 0 ? (
                    <p className="rounded-[1rem] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      Nu au fost necesare ajustari suplimentare fata de baza comparabila.
                    </p>
                  ) : (
                    analysis.adjustments.map((adjustment) => (
                      <div key={adjustment.label} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-950">{adjustment.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{adjustment.reason}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              Calcul: {adjustment.impactPerSqm > 0 ? '+' : ''}{adjustment.impactPerSqm.toLocaleString('ro-RO')} EUR/mp x {pricingSurface.toLocaleString('ro-RO')} mp = {adjustment.impactTotal > 0 ? '+' : adjustment.impactTotal < 0 ? '-' : ''}{Math.abs(adjustment.impactTotal).toLocaleString('ro-RO')} EUR
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-semibold ${adjustment.direction === 'negative' ? 'text-rose-700' : 'text-teal-700'}`}>
                              {adjustment.impactPerSqm > 0 ? '+' : ''}{adjustment.impactPerSqm} EUR/mp
                            </p>
                            <p className="text-xs text-slate-500">
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

          <Card className="rounded-[1.9rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-slate-950">Cumparatori potriviti</CardTitle>
              <CardDescription className="text-slate-600">
                Maxim 20 de lead-uri active din baza agentiei, ordonate dupa compatibilitatea cu proprietatea.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matchedBuyers.length === 0 ? (
                <p className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nu au fost gasiti cumparatori potriviti pentru criteriile acestei proprietati.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {matchedBuyers.map((buyer) => (
                    <div key={buyer.id} className="rounded-[1.15rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{buyer.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{buyer.status} - {buyer.source || 'sursa necunoscuta'}</p>
                        </div>
                        <Badge className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                          {buyer.matchScore}/100
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-800">{formatBuyerBudget(buyer)}</p>
                      <p className="mt-1 text-xs text-slate-500">{buyerLocationLabel(buyer)}</p>
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{buyer.reasoning}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        {buyer.phone ? <span>{buyer.phone}</span> : null}
                        {buyer.email ? <span>{buyer.email}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.9rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_70px_-46px_rgba(15,30,51,0.45)]">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Cum citim recomandarea</CardTitle>
              <CardDescription className="text-slate-600">
                Plaja de pret este construita pentru vanzare, nu doar pentru listare decorativa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-4 shadow-[inset_4px_0_0_rgba(5,150,105,0.42)]">
                <div className="flex items-center gap-2 text-emerald-800">
                  <TrendingUp className="h-4 w-4" />
                  <p className="font-medium">Pret recomandat</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Nivelul optim pentru listarea initiala, tinand cont de tranzactii vandute, concurenta si ajustarile de produs.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-sky-200 bg-sky-50 p-4 shadow-[inset_4px_0_0_rgba(2,132,199,0.38)]">
                <div className="flex items-center gap-2 text-sky-800">
                  <BarChart3 className="h-4 w-4" />
                  <p className="font-medium">Interval tactic</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Pretul recomandat ramane sub limita de test; cand reperele nu sustin distanta, motorul coboara recomandarea.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4 shadow-[inset_4px_0_0_rgba(225,29,72,0.34)]">
                <div className="flex items-center gap-2 text-rose-800">
                  <TrendingDown className="h-4 w-4" />
                  <p className="font-medium">Atentie comerciala</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Preturile din ownerListings sunt cereri active, nu inchideri. De aceea algoritmul le pondera mai jos decat comparabilele vandute.
                </p>
              </div>
            </CardContent>
          </Card>

          <Alert className="rounded-[1.6rem] border border-amber-200 bg-amber-50 text-amber-900">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>Limitari curente</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1 text-sm text-slate-700">
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
