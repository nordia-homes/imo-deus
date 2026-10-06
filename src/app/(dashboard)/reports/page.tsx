'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { BuyerSourceData, Contact, Property, SalesData, Viewing } from '@/lib/types';
import { summarizeReport } from '@/ai/flows/report-summarizer';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { calculateCrmReport } from '@/lib/crm/report-metrics';
import type { ForecastItem, SectionSignalItem, ScoreCardItem, AlertItem, DetailMetricItem, ComparisonItem, BlockerItem } from '@/lib/crm/report-metrics';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  Home,
  Lightbulb,
  Loader2,
  Minus,
  Sparkles,
  Users,
} from 'lucide-react';

type AiReport = Awaited<ReturnType<typeof summarizeReport>>;
const euro = (value: number) => `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
const pct = (value: number) => `${value.toFixed(1)}%`;
export default function ReportsPage() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const contactsQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'contacts') : null
  ), [firestore, agencyId]);
  const propertiesQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'properties') : null
  ), [firestore, agencyId]);
  const viewingsQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'viewings') : null
  ), [firestore, agencyId]);

  const { data: contacts, isLoading: contactsLoading } = useCollection<Contact>(contactsQuery);
  const { data: properties, isLoading: propertiesLoading } = useCollection<Property>(propertiesQuery);
  const { data: viewings, isLoading: viewingsLoading } = useCollection<Viewing>(viewingsQuery);
  const isLoading = contactsLoading || propertiesLoading || viewingsLoading;

  const metrics = useMemo(() => calculateCrmReport(contacts, properties, viewings), [contacts, properties, viewings]);

  const generateAiReport = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const result = await summarizeReport({
        salesData: metrics.salesData,
        leadSourceData: metrics.buyerSourceData,
        kpis: {
          totalWonLeads: metrics.totalWonBuyers,
          conversionRate: metrics.conversionRate,
          averageDealSize: metrics.averageDealSize,
        },
        additionalMetrics: {
          totalLeads: metrics.totalLeads,
          activeLeads: metrics.activeLeads,
          lostLeads: metrics.lostLeads,
          totalProperties: metrics.totalProperties,
          activeProperties: metrics.activeProperties,
          soldProperties: metrics.soldProperties,
          reservedProperties: metrics.reservedProperties,
          inactiveProperties: metrics.inactiveProperties,
          totalSalesVolume: metrics.totalSalesVolume,
          activeInventoryValue: metrics.activeInventoryValue,
          totalViewings: metrics.totalViewings,
          completedViewings: metrics.completedViewings,
          scheduledViewings: metrics.scheduledViewings,
          cancelledViewings: metrics.cancelledViewings,
          viewingCompletionRate: metrics.viewingCompletionRate,
          propertiesNeedingOptimization: metrics.propertiesNeedingOptimization,
          leadsWithoutFollowUp: metrics.leadsWithoutFollowUp,
          leadsWithoutBudget: metrics.leadsWithoutBudget,
          dataQualityScore: metrics.dataQualityScore,
          leadsMissingCreatedAt: metrics.leadsMissingCreatedAt,
          propertiesMissingCreatedAt: metrics.propertiesMissingCreatedAt,
          propertiesLowMedia: metrics.propertiesLowMedia,
          propertiesWeakDescription: metrics.propertiesWeakDescription,
          highRiskLeads: metrics.highRiskLeads,
          contactedWithoutViewing: metrics.contactedWithoutViewing,
          negotiationStalled: metrics.negotiationStalled,
          activeWithoutViewings: metrics.activeWithoutViewings,
          reservedStale: metrics.reservedStale,
          avgHoursToFirstContact: metrics.avgHoursToFirstContact,
          avgDaysToViewing: metrics.avgDaysToViewing,
          avgDaysLeadToWin: metrics.avgDaysLeadToWin,
        },
        topSources: metrics.sourceRows.slice(0, 5).map((item) => ({
          source: item.source,
          count: item.count,
          share: item.share,
        })),
        statusBreakdown: metrics.statusRows.map((item) => ({ label: item.label, value: item.value })),
        scoreSummary: metrics.scoreRows.map((item) => ({
          title: item.title,
          score: item.score,
          trend: item.trend,
          summary: item.summary,
          factors: item.factors,
        })),
        alerts: metrics.alertRows.map((item) => ({
          title: item.title,
          description: item.description,
          tone: item.tone,
        })),
        forecast: metrics.forecastRows,
        funnelBreakdown: metrics.funnelRows.map((item) => ({
          label: item.label,
          reached: item.reached,
          rateFromPrevious: item.rateFromPrevious,
          rateFromStart: item.rateFromStart,
        })),
        dataConfidenceLabel: metrics.dataConfidenceLabel,
      });
      setAiReport(result);
      toast({
        title: 'Analiză completă!',
        description: 'Raportul AI a fost generat cu OpenAI.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'A apărut o eroare',
        description: 'Nu am putut genera analiza AI. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const recommendations = (aiReport?.recommendations || '')
    .split('\n')
    .map((item) => item.replace(/^-/, '').trim())
    .filter(Boolean);

  return (
    <div className="agentfinder-reports-page space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
      <div className="tt-design settings-tiktok">
        <style>{`
          .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
        `}</style>
        <header className="tt-hero">
          <div>
            <div className="tt-hero-kicker">
              <Activity size={17} />
              <span className="tt-eyebrow">RAPOARTE</span>
            </div>
            <h1>Rapoarte de <em>Performanță</em></h1>
            <p className="tt-hero-lead">
              O vedere completă asupra businessului.
              <br />
              <strong>Lead-uri, portofoliu, vizionări și performanță comercială.</strong>
            </p>
            <p>
              Analizează rapid sursele, conversiile, blocajele și tendințele agenției.
            </p>
          </div>
          <div className="tt-scene" aria-hidden="true">
            <div className="tt-scene-halo" />
            <div className="tt-scene-sheet tt-scene-sheet--back">
              <span>RAPOARTE CRM</span>
              <div className="flex h-full items-center justify-center">
                <div className="rounded-2xl border border-white/60 bg-white/80 p-4 text-slate-700">
                  <Activity size={30} />
                </div>
              </div>
            </div>
            <div className="tt-scene-sheet tt-scene-sheet--front">
              <span className="tt-scene-brand">
                <Sparkles size={12} /> ANALIZĂ
              </span>
              <div className="flex h-full items-center justify-center">
                <div className="w-28 rounded-[2rem] border border-white bg-white/85 p-4 text-center shadow-xl">
                  <Sparkles className="mx-auto text-emerald-700" size={28} />
                  <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Business
                  </span>
                  <strong className="block text-sm text-slate-900">Performanță clară</strong>
                </div>
              </div>
              <div className="tt-scene-caption">
                <small>URMĂTOAREA DECIZIE</small>
                <strong>Pe date, nu pe presupuneri.</strong>
                <span>lead-uri, portofoliu și conversii</span>
              </div>
            </div>
            <div className="tt-scene-tag tt-scene-tag--video">
              <Activity size={16} />
              <span>
                Raport
                <br />
                <strong>operațional</strong>
              </span>
            </div>
            <div className="tt-scene-tag tt-scene-tag--spark">
              <Sparkles size={16} />
              <span>OpenAI activ</span>
            </div>
          </div>
        </header>
      </div>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Lightbulb className="text-primary" />
                Analiză și Recomandări AI
              </CardTitle>
              <CardDescription className="text-white/70">
                Sinteză executivă, puncte forte, riscuri și oportunități generate acum cu OpenAI.
              </CardDescription>
            </div>
            <Button onClick={generateAiReport} disabled={isLoading || isGenerating} className="bg-primary hover:bg-primary/90">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiReport ? 'Regenerează Analiza' : 'Generează Analiza AI'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/70">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              OpenAI analizează datele din CRM...
            </div>
          )}
          {!isGenerating && aiReport && (
            <>
              <Alert className="border-white/10 bg-white/5 text-white">
                <AlertTitle>Sinteză Executivă</AlertTitle>
                <AlertDescription className="text-white/90">{aiReport.summary}</AlertDescription>
              </Alert>
              <div className="grid gap-4 lg:grid-cols-2">
                <ExecutivePanel
                  title="Ce se întâmplă"
                  text={aiReport.whatIsHappening}
                  subtitle="Lectura scurtă a situației actuale din business."
                />
                <ExecutivePanel
                  title="De ce se întâmplă"
                  text={aiReport.whyItIsHappening}
                  subtitle="Cauza dominantă sau explicația operațională cea mai probabilă."
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="font-semibold text-emerald-300">Puncte forte</p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.strengths.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="flex items-center gap-2 font-semibold text-rose-300">
                    <CircleAlert className="h-4 w-4" />
                    Riscuri
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.risks.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                  <p className="font-semibold text-sky-300">Oportunități</p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.opportunities.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
              </div>
              <Alert className="border-primary/20 bg-primary/10 text-white">
                <AlertTitle className="text-primary">Acțiuni recomandate</AlertTitle>
                <AlertDescription className="text-white/90">
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 lg:grid-cols-3">
                <ExecutivePanel title="Prioritatea #1" text={aiReport.priority} subtitle="Cea mai importantă intervenție imediată." />
                <ExecutivePanel title="Cea mai mare pierdere" text={aiReport.biggestLoss} subtitle="Zona care trage cel mai mult în jos performanța." />
                <ExecutivePanel title="Ce facem azi" text={aiReport.todayFocus} subtitle="Acțiunea operațională de azi pentru a crea mișcare rapidă." />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <ExecutivePanel title="Ce nu facem acum" text={aiReport.notNow} subtitle="Lucrurile care nu merită să consume focusul imediat." />
                <ExecutivePanel title="Focus 7 zile" text={aiReport.next7DaysFocus} subtitle="Direcția recomandată pentru următoarea săptămână." />
                <ExecutivePanel title="KPI săptămâna viitoare" text={aiReport.nextWeekKpi} subtitle="Indicatorul principal care merită urmărit săptămâna viitoare." />
              </div>
              <Card className="border border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">KPI-uri influențate</CardTitle>
                  <CardDescription className="text-white/65">
                    Indicatorii care ar trebui să se îmbunătățească dacă planul este executat bine.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {aiReport.affectedKpis.map((item, index) => (
                      <Badge key={`${item}-${index}`} variant="outline" className="border-white/15 bg-white/5 text-white/90">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {!isGenerating && !aiReport && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/70">
              Apasă pe buton pentru a genera analiza OpenAI pe baza datelor curente.
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0 text-xs text-white/45">
          Raportul AI din această pagină nu mai folosește Gemini.
        </CardFooter>
      </Card>

      <SectionHeader
        eyebrow="Decizie"
        title="Unde merită să intervii prima dată"
        description="Zona executivă a paginii: concluzie AI, scoruri explicabile, alerte relative și forecast simplu pentru finalul lunii."
      />

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Scoreboard Executiv</CardTitle>
          <CardDescription className="text-white/70">
            Patru semnale rapide pentru a înțelege în câteva secunde starea generală a business-ului și de ce arată așa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
            </>
          ) : (
            metrics.scoreRows.map((item) => (
              <ScoreboardCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Alerte Proactive</CardTitle>
          <CardDescription className="text-white/70">
            Semnale care merită atenție imediată înainte să se transforme în pierdere de conversie sau de încredere în date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-[92px] bg-white/10" />
              <Skeleton className="h-[92px] bg-white/10" />
            </>
          ) : metrics.alertRows.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-white/85">
              Nu există alerte majore în acest moment. Indicatorii urmăriți sunt într-o zonă acceptabilă.
            </div>
          ) : (
            metrics.alertRows.map((item, index) => (
              <AlertRow key={`${item.title}-${index}`} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Blocaje Majore</CardTitle>
          <CardDescription className="text-white/70">
            Zonele care cer intervenție rapidă pentru a nu frâna conversia și viteza comercială.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
            </>
          ) : (
            metrics.blockerRows.map((item) => (
              <BlockerCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Forecast Executiv</CardTitle>
          <CardDescription className="text-white/70">
            Estimare simplă de final de lună pe baza ritmului actual din CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
            </>
          ) : (
            metrics.forecastRows.map((item) => (
              <ForecastCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Comparație în Timp</CardTitle>
          <CardDescription className="text-white/70">
            Ultimele 30 de zile versus cele 30 anterioare, ca să vezi direcția business-ului, nu doar fotografia de moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
            </>
          ) : (
            metrics.comparisonRows.map((item) => (
              <ComparisonCard key={item.label} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <SectionHeader
        eyebrow="Proces"
        title="Cum curge pipeline-ul"
        description="Blocaje, viteză, funnel și semnale de stagnare care arată unde se pierde momentum comercial."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <MetricSectionCard
          title="Viteză Proces"
          description="Cât de repede reacționează agenția și cât durează trecerea prin etapele importante."
          items={metrics.speedRows}
          isLoading={isLoading}
        />
        <MetricSectionCard
          title="Risc Comercial"
          description="Semnale de stagnare sau probabilitate mare de pierdere în pipeline și portofoliu."
          items={metrics.riskRows}
          isLoading={isLoading}
        />
      </div>

      <SectionHeader
        eyebrow="Output"
        title="Output detaliat și canale"
        description="Volumul comercial, performanța surselor și rezultatele care merită urmărite mai în profunzime."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#183557_0%,#132B49_100%)] text-white shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white">Volum Vânzări Lunare</CardTitle>
                <CardDescription className="mt-1 text-white/70">Evoluția valorii vânzărilor înregistrate în CRM.</CardDescription>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary/80">
                Trend
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-7">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <SalesChart data={metrics.salesData} />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#183557_0%,#132B49_100%)] text-white shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white">Distribuție Surse Cumpărători</CardTitle>
                <CardDescription className="mt-1 text-white/70">Canalele care aduc volum în pipeline.</CardDescription>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary/80">
                Top surse
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-7">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <LeadSourceChart data={metrics.buyerSourceData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-primary" /> Funnel Lead-uri</CardTitle>
            <CardDescription className="text-white/70">
              Conversii inferate din dovezi istorice deja existente în CRM: interacțiuni, vizionări, oferte și status final.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10" /> : metrics.funnelRows.map((item) => (
              <div key={item.label} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-white/70">{item.reached} lead-uri</span>
                </div>
                <Progress value={item.rateFromStart} className="h-2 bg-white/10 [&>div]:bg-primary" />
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>din startul funnel-ului: {pct(item.rateFromStart)}</span>
                  <span>din etapa anterioară: {pct(item.rateFromPrevious)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Home className="h-5 w-5 text-primary" /> Portofoliu</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10 sm:col-span-2" /> : (
              <>
                <MiniMetric label="Active" value={metrics.activeProperties} text="listări disponibile" />
                <MiniMetric label="De optimizat" value={metrics.propertiesNeedingOptimization} text="prezentare incompletă" />
                <MiniMetric label="Rezervate" value={metrics.reservedProperties} text="aproape de închidere" />
                <MiniMetric label="Vândute" value={metrics.soldProperties} text="tranzacții finalizate" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Activity className="h-5 w-5 text-primary" /> Operațional</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10 sm:col-span-2" /> : (
              <>
                <MiniMetric label="Follow-up restant" value={metrics.leadsWithoutFollowUp} text="lead-uri reci" />
                <MiniMetric label="Fără buget" value={metrics.leadsWithoutBudget} text="calificare slabă" />
                <MiniMetric label="Vizionări" value={metrics.scheduledViewings} text="programate" />
                <MiniMetric label="Rată activare" value={pct(metrics.viewingCompletionRate)} text={`${metrics.completedViewings} finalizate`} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[140px] bg-white/10" />
            <Skeleton className="h-[140px] bg-white/10" />
            <Skeleton className="h-[140px] bg-white/10" />
          </>
        ) : (
          metrics.outputRows.map((item) => <SignalCard key={item.title} item={item} />)
        )}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="min-w-0 border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Surse și Conversie</CardTitle>
            <CardDescription className="text-white/70">
              Nu doar volum, ci și cât de departe avansează lead-urile fiecărei surse spre câștig.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : (
              <div className="min-w-0 overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">Sursă</TableHead>
                      <TableHead className="text-right text-white/50">Lead-uri</TableHead>
                      <TableHead className="text-right text-white/50">În vizionare+</TableHead>
                      <TableHead className="text-right text-white/50">Câștigate</TableHead>
                      <TableHead className="text-right text-white/50">Conv.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.sourceConversionRows.slice(0, 6).map((item) => (
                      <TableRow key={item.source} className="border-white/10 hover:bg-white/5">
                        <TableCell className="font-medium text-white">{item.source}</TableCell>
                        <TableCell className="text-right text-white/80">{item.leads}</TableCell>
                        <TableCell className="text-right text-white/80">{item.viewings}</TableCell>
                        <TableCell className="text-right text-white/80">{item.won}</TableCell>
                        <TableCell className="text-right text-white/80">{pct(item.winRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Instantaneu Business</CardTitle>
            <CardDescription className="text-white/70">Indicatori rapizi pentru decizii comerciale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : (
              <>
                <MiniPanel title="Volum total vânzări" value={euro(metrics.totalSalesVolume)} subtitle={`${metrics.soldProperties} proprietăți vândute`} />
                <MiniPanel title="Lead-uri active" value={`${metrics.activeLeads} / ${metrics.totalLeads}`} subtitle={`${metrics.archivedLeads} arhivate, ${metrics.lostLeads} pierdute`} />
                <MiniPanel title="Vizionări totale" value={String(metrics.totalViewings)} subtitle={`${metrics.completedViewings} finalizate, ${metrics.cancelledViewings} anulate`} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function MiniMetric({ label, value, text }: { label: string; value: number | string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/70">{text}</p>
    </div>
  );
}

function MiniPanel({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function ExecutivePanel({ title, text, subtitle }: { title: string; text: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-white">{text}</p>
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.28em] text-primary/80">{eyebrow}</p>
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/65">{description}</p>
      </div>
    </div>
  );
}

function ForecastCard({ item }: { item: ForecastItem }) {
  const formatValue = (value: number) => item.type === 'currency' ? euro(value) : value.toLocaleString('ro-RO');
  const delta = item.projectedValue - item.currentValue;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-white/55">Acum</p>
          <p className="text-2xl font-semibold text-white">{formatValue(item.currentValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/55">Forecast</p>
          <p className="text-2xl font-semibold text-primary">{formatValue(item.projectedValue)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-white/70">{item.helper}</p>
      <p className="mt-2 text-xs text-white/50">Delta estimată: {formatValue(delta)}</p>
    </div>
  );
}

function SignalCard({ item }: { item: SectionSignalItem }) {
  const content = (
    <div className="rounded-3xl border border-white/10 bg-[#10243D] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#132B49]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{item.title}</p>
          <p className="mt-3 text-4xl font-semibold leading-none text-white">{item.value}</p>
        </div>
        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary/80" />
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm leading-6 text-white/68">{item.helper}</p>
      </div>
    </div>
  );

  if (!item.href) return content;

  return <Link href={item.href}>{content}</Link>;
}

function ScoreboardCard({ item }: { item: ScoreCardItem }) {
  const tone =
    item.score >= 75 ? 'good' : item.score >= 55 ? 'medium' : 'high';
  const toneClass =
    tone === 'good'
      ? 'border-emerald-400/25 bg-emerald-400/10'
      : tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-rose-400/25 bg-rose-400/10';
  const textClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'medium'
        ? 'text-amber-300'
        : 'text-rose-300';
  const trendColor = item.trend >= 0 ? 'text-emerald-300' : 'text-rose-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-colors hover:bg-white/10 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <p className={`mt-2 text-4xl font-semibold ${textClass}`}>{Math.round(item.score)}</p>
      <Progress value={item.score} className={`mt-4 h-2 bg-white/10 ${textClass} [&>div]:bg-current`} />
      <p className="mt-4 text-sm leading-6 text-white/80">{item.summary}</p>
      <p className={`mt-3 text-xs font-medium ${trendColor}`}>
        Trend: {item.trend >= 0 ? '+' : ''}{item.trend.toFixed(1)}%
      </p>
      <div className="mt-3 space-y-1 text-xs text-white/55">
        {item.factors.slice(0, 3).map((factor, index) => (
          <p key={`${item.title}-${index}`}>{factor}</p>
        ))}
      </div>
    </Link>
  );
}

function AlertRow({ item }: { item: AlertItem }) {
  const toneClass =
    item.tone === 'high'
      ? 'border-rose-400/25 bg-rose-400/10'
      : item.tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-emerald-400/25 bg-emerald-400/10';
  const titleClass =
    item.tone === 'high'
      ? 'text-rose-300'
      : item.tone === 'medium'
        ? 'text-amber-300'
        : 'text-emerald-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-colors hover:bg-white/10 ${toneClass}`}>
      <p className={`text-sm font-semibold ${titleClass}`}>{item.title}</p>
      <p className="mt-2 text-sm leading-6 text-white/85">{item.description}</p>
    </Link>
  );
}

function MetricSectionCard({
  title,
  description,
  items,
  isLoading,
}: {
  title: string;
  description: string;
  items: DetailMetricItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="border-none bg-[#152A47] text-white shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-white">{title}</CardTitle>
            <CardDescription className="max-w-xl text-white/70">{description}</CardDescription>
          </div>
          <div className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/5 lg:flex lg:items-center lg:justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full bg-white/10" />
        ) : (
          items.map((item, index) => (
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-0 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:from-white/12 hover:via-white/7 hover:to-transparent"
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white/75">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                        <p className="mt-3 text-sm leading-6 text-white/72">{item.helper}</p>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-right">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-primary/75">Metrică</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
            <div
              key={item.label}
              className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-0"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white/75">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                      <p className="mt-3 text-sm leading-6 text-white/72">{item.helper}</p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Metrică</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ item }: { item: ComparisonItem }) {
  const isUp = item.delta > 0;
  const isDown = item.delta < 0;
  const DeltaIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const deltaColor = isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-white/60';
  const formatValue = (value: number) => item.type === 'currency' ? euro(value) : value.toLocaleString('ro-RO');
  const deltaLabel = `${item.delta > 0 ? '+' : ''}${item.type === 'currency' ? euro(item.delta).replace('€', '') : item.delta.toLocaleString('ro-RO')}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{formatValue(item.currentValue)}</p>
      <p className="mt-1 text-sm text-white/60">
        {item.currentLabel}: {formatValue(item.currentValue)}
      </p>
      <p className="text-sm text-white/60">
        {item.previousLabel}: {formatValue(item.previousValue)}
      </p>
      <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${deltaColor}`}>
        <DeltaIcon className="h-4 w-4" />
        <span>Delta: {deltaLabel}</span>
      </div>
    </div>
  );
}

function BlockerCard({ item }: { item: BlockerItem }) {
  const toneClass =
    item.tone === 'high'
      ? 'border-rose-400/25 bg-rose-400/10'
      : item.tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-emerald-400/25 bg-emerald-400/10';
  const textClass =
    item.tone === 'high'
      ? 'text-rose-300'
      : item.tone === 'medium'
        ? 'text-amber-300'
        : 'text-emerald-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <p className={`mt-2 text-3xl font-semibold ${textClass}`}>{item.value}</p>
      <p className="mt-3 text-sm leading-6 text-white/80">{item.description}</p>
      <p className="mt-4 text-xs font-medium text-white/55">Deschide lista afectata</p>
    </Link>
  );
}
