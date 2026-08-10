'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FolderKanban,
  History,
  Home,
  Loader2,
  Mail,
  MapPin,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { SaleSetupWizard } from '@/components/sales/SaleSetupWizard';
import { SalesDocumentWorkspace } from '@/components/sales/SalesDocumentWorkspace';
import { SalesEmailComposer } from '@/components/sales/SalesEmailComposer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { getSaleDocumentSummary } from '@/lib/sales-documents';
import { getSaleSetupState, participantRoleLabel, SALE_STAGE_META } from '@/lib/sales';
import { normalizeSaleForWorkspace } from '@/lib/sales-workspace';
import type { SaleChecklistItem, SalesAuditEvent, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatCurrency(value?: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function SaleDossierPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId || '';
  const firestore = useFirestore();
  const { agencyId } = useAgency();
  const saleRef = useMemoFirebase(
    () => agencyId && saleId ? doc(firestore, 'agencies', agencyId, 'sales', saleId) : null,
    [agencyId, firestore, saleId]
  );
  const { data: rawSale, isLoading, error } = useDoc<SaleTransaction>(saleRef);
  const sale = useMemo(() => rawSale ? normalizeSaleForWorkspace(rawSale) : null, [rawSale]);
  const [checklist, setChecklist] = useState<SaleChecklistItem[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    if (sale) setChecklist(sale.checklist || []);
  }, [sale?.id, sale?.updatedAt]);

  const auditQuery = useMemoFirebase(
    () => agencyId && saleId ? query(collection(firestore, 'agencies', agencyId, 'sales', saleId, 'audit'), orderBy('createdAt', 'desc')) : null,
    [agencyId, firestore, saleId]
  );
  const { data: auditEvents } = useCollection<SalesAuditEvent>(auditQuery);

  if (isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-600" /></div>;
  if (error || !sale) return <div className="mx-auto mt-16 max-w-xl rounded-[28px] border border-red-200 bg-red-50 p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-red-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Dosarul nu poate fi deschis</h1><p className="mt-2 text-sm text-slate-600">Nu există sau nu ai acces la această tranzacție.</p><Button asChild variant="outline" className="mt-5 rounded-2xl"><Link href="/sales-management">Înapoi la vânzări</Link></Button></div>;

  const stage = SALE_STAGE_META[sale.stage];
  const summary = getSaleDocumentSummary(checklist);
  const setup = getSaleSetupState({ ...sale, checklist });
  const owner = sale.participants.find((item) => item.role === 'owner');
  const buyer = sale.participants.find((item) => item.role === 'buyer');

  return (
    <main className="space-y-5 pb-12">
      <section className="overflow-hidden rounded-[32px] border border-emerald-200/70 bg-[radial-gradient(circle_at_0%_0%,rgba(167,243,208,.62),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(254,243,199,.7),transparent_28%),rgba(255,255,255,.96)] shadow-[0_28px_80px_-55px_rgba(5,150,105,.58)]">
        <div className="flex flex-col gap-4 border-b border-white/90 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Button asChild variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-white bg-white/85 shadow-sm"><Link href="/sales-management" aria-label="Înapoi la Gestionare vânzări"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-white text-emerald-600 shadow-sm"><FolderKanban className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">{stage.label}</Badge><span className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{sale.trackingCode}</span></div>
              <h1 className="mt-1 truncate text-xl font-black tracking-[-.03em] text-slate-950 lg:text-2xl">{sale.propertyTitle}</h1>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" />{sale.propertyAddress}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-12 rounded-2xl border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffffff_50%,#ecfdf5)] px-4 text-slate-800 shadow-sm hover:border-amber-300" onClick={() => setSetupOpen(true)}><Sparkles className="mr-2 h-4 w-4 text-amber-600" /><span className="font-bold">Completare ghidată</span></Button>
            <Button className="h-12 rounded-2xl bg-[linear-gradient(135deg,#10b981,#0d9488)] px-5 text-white shadow-[0_14px_28px_-16px_rgba(13,148,136,.7)] hover:brightness-105" onClick={() => setEmailOpen(true)}><Mail className="mr-2 h-4 w-4" />Trimite email</Button>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-white bg-white/78 p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Documente verificate</p><div className="mt-2 flex items-end justify-between"><p className="text-2xl font-black text-slate-900">{summary.verified}/{summary.required}</p><span className="text-sm font-bold text-emerald-700">{summary.progress}%</span></div><Progress value={summary.progress} className="mt-3 h-2 bg-slate-200" /></div>
          <div className="rounded-[22px] border border-white bg-white/78 p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">De rezolvat</p><p className="mt-2 text-2xl font-black text-slate-900">{summary.missing + summary.review}</p><p className="mt-1 text-xs text-slate-500">{summary.missing} lipsă · {summary.review} de verificat</p></div>
          <div className="rounded-[22px] border border-white bg-white/78 p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Valoare tranzacție</p><p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(sale.agreedPrice)}</p><p className="mt-1 text-xs text-slate-500">Rest contract: {formatCurrency(sale.contractBalanceAmount)}</p></div>
          <div className="rounded-[22px] border border-white bg-white/78 p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Configurare</p><p className={cn('mt-2 text-lg font-black', setup.complete ? 'text-emerald-700' : 'text-amber-700')}>{setup.complete ? 'Completă' : 'Necesită atenție'}</p><p className="mt-1 text-xs text-slate-500">{setup.complete ? 'Datele inițiale sunt finalizate.' : setup.issues.length + ' elemente rămase.'}</p></div>
        </div>
      </section>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 gap-1.5 rounded-[22px] border border-slate-200/80 bg-white/85 p-1.5 shadow-sm sm:grid-cols-5">
          <TabsTrigger value="summary" className="rounded-2xl py-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800"><Home className="mr-2 h-4 w-4" />Rezumat</TabsTrigger>
          <TabsTrigger value="participants" className="rounded-2xl py-3 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-800"><UserRound className="mr-2 h-4 w-4" />Participanți</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-2xl py-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800"><FileCheck2 className="mr-2 h-4 w-4" />Documente</TabsTrigger>
          <TabsTrigger value="communication" className="rounded-2xl py-3 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-800"><Mail className="mr-2 h-4 w-4" />Comunicare</TabsTrigger>
          <TabsTrigger value="history" className="rounded-2xl py-3 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800"><History className="mr-2 h-4 w-4" />Istoric</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="m-0 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,.5)]">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Starea dosarului</h2><p className="text-sm text-slate-500">Informațiile importante într-un singur loc.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Proprietar</p><p className="mt-2 font-bold text-slate-800">{owner?.name || 'De completat'}</p><p className="mt-1 text-xs text-slate-500">{owner?.email || 'Email necompletat'}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Cumpărător</p><p className="mt-2 font-bold text-slate-800">{buyer?.name || 'De completat'}</p><p className="mt-1 text-xs text-slate-500">{buyer?.email || 'Email necompletat'}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Notariat</p><p className="mt-2 font-bold text-slate-800">{sale.notary?.name || 'De stabilit'}</p><p className="mt-1 text-xs text-slate-500">{sale.notary?.email || sale.notary?.address || 'Date necompletate'}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Următoarea acțiune</p><p className="mt-2 font-bold text-slate-800">{sale.nextAction || stage.description}</p><p className="mt-1 text-xs text-slate-500">{formatDate(sale.nextActionAt)}</p></div>
            </div>
          </section>
          <section className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(145deg,#fffbeb,#ffffff_58%,#ecfdf5)] p-5 shadow-[0_24px_60px_-48px_rgba(217,119,6,.45)]">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200 bg-white text-amber-600"><CalendarClock className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Priorități</h2><p className="text-sm text-slate-500">Dosarul nu este blocat de informațiile lipsă.</p></div></div>
            <div className="mt-5 space-y-3">
              {summary.missing ? <div className="rounded-2xl border border-amber-200 bg-white/80 p-4"><p className="font-semibold text-amber-800">{summary.missing} documente lipsesc</p><p className="mt-1 text-xs text-slate-500">Pot fi solicitate direct din tabul Documente.</p></div> : null}
              {summary.review ? <div className="rounded-2xl border border-sky-200 bg-white/80 p-4"><p className="font-semibold text-sky-800">{summary.review} documente așteaptă verificarea</p><p className="mt-1 text-xs text-slate-500">Verificarea agentului rămâne obligatorie înainte de includerea în pachet.</p></div> : null}
              {!summary.missing && !summary.review ? <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4"><p className="font-semibold text-emerald-800">Documentele curente sunt în regulă</p><p className="mt-1 text-xs text-slate-500">Poți genera pachetul verificat pentru etapa curentă.</p></div> : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="participants" className="m-0">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sale.participants.map((participant) => <article key={participant.id} className="rounded-[26px] border border-sky-200/70 bg-[linear-gradient(145deg,#f0f9ff,#ffffff_55%,#ecfdf5)] p-5 shadow-[0_20px_48px_-40px_rgba(14,165,233,.45)]"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-200 bg-white text-sky-600"><UserRound className="h-5 w-5" /></span><div><p className="font-bold text-slate-900">{participant.name || 'Nume necompletat'}</p><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">{participantRoleLabel(participant.role)}</p></div></div><div className="mt-4 space-y-2 text-sm text-slate-600"><p>{participant.email || 'Email necompletat'}</p><p>{participant.phone || 'Telefon necompletat'}</p></div></article>)}
          </section>
        </TabsContent>

        <TabsContent value="documents" className="m-0">
          <SalesDocumentWorkspace sale={sale} checklist={checklist} participants={sale.participants} onChecklistChange={setChecklist} />
        </TabsContent>

        <TabsContent value="communication" className="m-0">
          <section className="rounded-[28px] border border-violet-200/70 bg-[linear-gradient(145deg,#f5f3ff,#ffffff_55%,#f0fdfa)] p-6 text-center shadow-[0_24px_60px_-48px_rgba(124,58,237,.45)]"><Mail className="mx-auto h-8 w-8 text-violet-600" /><h2 className="mt-4 text-xl font-bold text-slate-900">Comunicarea dosarului</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Pregătește emailuri, solicită documentele lipsă și atașează direct versiunile verificate din dosar.</p><Button className="mt-5 rounded-2xl bg-violet-600 text-white hover:bg-violet-700" onClick={() => setEmailOpen(true)}><Mail className="mr-2 h-4 w-4" />Deschide compozitorul</Button></section>
        </TabsContent>

        <TabsContent value="history" className="m-0 space-y-3">
          {auditEvents?.length ? auditEvents.map((event) => <article key={event.id} className="flex gap-3 rounded-[22px] border border-slate-200/80 bg-white/90 p-4 shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Clock3 className="h-4 w-4" /></span><div className="min-w-0"><p className="font-semibold text-slate-800">{event.summary}</p><p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt)} · {event.action}</p></div></article>) : <div className="rounded-[26px] border border-dashed border-slate-200 bg-white/80 p-10 text-center text-sm text-slate-500">Nu există încă acțiuni în istoricul dosarului.</div>}
        </TabsContent>
      </Tabs>

      <SalesEmailComposer sale={sale} open={emailOpen} initialPanel="context" onOpenSetup={() => { setEmailOpen(false); setSetupOpen(true); }} onOpenChange={setEmailOpen} />
      <SaleSetupWizard sale={setupOpen ? sale : null} open={setupOpen} onOpenChange={setSetupOpen} onSaved={(updated) => { setChecklist(updated.checklist || []); setSetupOpen(false); }} />
    </main>
  );
}