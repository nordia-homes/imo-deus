'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Euro,
  FileCheck2,
  FileText,
  FolderKanban,
  Handshake,
  History,
  Home,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

import { SaleSetupWizard } from '@/components/sales/SaleSetupWizard';
import { SalesDocumentWorkspace } from '@/components/sales/SalesDocumentWorkspace';
import { SalesEmailComposer } from '@/components/sales/SalesEmailComposer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { getSaleDocumentSummary } from '@/lib/sales-documents';
import { getSaleSetupState, participantRoleLabel, SALE_STAGE_META } from '@/lib/sales';
import { normalizeSaleForWorkspace } from '@/lib/sales-workspace';
import type { SaleChecklistItem, SalesAuditEvent, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDay(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function initials(name?: string) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const participantRoleMeta = {
  owner: {
    icon: Home,
    gradient: 'from-amber-400 via-orange-400 to-orange-500',
    ring: 'ring-amber-200',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    glow: 'shadow-amber-500/25',
  },
  buyer: {
    icon: Handshake,
    gradient: 'from-emerald-400 via-emerald-500 to-teal-500',
    ring: 'ring-emerald-200',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    glow: 'shadow-emerald-500/25',
  },
  notary: {
    icon: Landmark,
    gradient: 'from-violet-400 via-violet-500 to-purple-500',
    ring: 'ring-violet-200',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    glow: 'shadow-violet-500/25',
  },
  collaborator: {
    icon: Users,
    gradient: 'from-sky-400 via-sky-500 to-blue-500',
    ring: 'ring-sky-200',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    glow: 'shadow-sky-500/25',
  },
} as const;

const auditEventMeta = {
  sale: { icon: FolderKanban, tile: 'bg-amber-50 text-amber-600 ring-amber-100' },
  message: { icon: Mail, tile: 'bg-violet-50 text-violet-600 ring-violet-100' },
  document: { icon: FileCheck2, tile: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  template: { icon: FileText, tile: 'bg-sky-50 text-sky-600 ring-sky-100' },
  settings: { icon: Sparkles, tile: 'bg-slate-100 text-slate-600 ring-slate-200' },
} as const;

const channelMeta = {
  email: { label: 'Email', icon: Mail },
  phone: { label: 'Telefon', icon: Phone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
} as const;

function formatCurrency(value?: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function HeaderMetric({
  accent,
  icon,
  label,
  caption,
  children,
}: {
  accent: 'cyan' | 'violet' | 'pink' | 'amber';
  icon: ReactNode;
  label: string;
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className={`tt-metric tt-metric--${accent}`}>
      <div className="tt-metric-top">
        <span className="tt-icon-tile">{icon}</span>
        <span className="tt-metric-dot" aria-hidden="true" />
      </div>
      <p>{label}</p>
      {children}
      {caption ? <span className="tt-metric-caption">{caption}</span> : null}
    </article>
  );
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
  const [emailInitialPanel, setEmailInitialPanel] = useState<'context' | 'documents'>('context');
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (sale) setChecklist(sale.checklist || []);
  }, [sale?.id, sale?.updatedAt]);

  const auditQuery = useMemoFirebase(
    () => agencyId && saleId ? query(collection(firestore, 'agencies', agencyId, 'sales', saleId, 'audit'), orderBy('createdAt', 'desc')) : null,
    [agencyId, firestore, saleId]
  );
  const { data: auditEvents } = useCollection<SalesAuditEvent>(auditQuery);

  if (isLoading) return (
    <main className="space-y-5 pb-12">
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-[22px]" />)}
        </div>
      </section>
      <Skeleton className="h-14 rounded-[22px]" />
      <Skeleton className="h-72 rounded-[28px]" />
    </main>
  );
  if (error || !sale) return <div className="mx-auto mt-16 max-w-xl rounded-[28px] border border-red-200 bg-red-50 p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-red-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Dosarul nu poate fi deschis</h1><p className="mt-2 text-sm text-slate-600">Nu există sau nu ai acces la această tranzacție.</p><Button asChild variant="outline" className="mt-5 rounded-2xl"><Link href="/sales-management">Înapoi la vânzări</Link></Button></div>;

  const stage = SALE_STAGE_META[sale.stage];
  const summary = getSaleDocumentSummary(checklist);
  const setup = getSaleSetupState({ ...sale, checklist });
  const owner = sale.participants.find((item) => item.role === 'owner');
  const buyer = sale.participants.find((item) => item.role === 'buyer');

  const openEmail = (panel: 'context' | 'documents' = 'context') => {
    setEmailInitialPanel(panel);
    setEmailOpen(true);
  };

  return (
    <main className="space-y-5 pb-12">
      <section className="tt-design settings-tiktok tt-panel overflow-hidden rounded-[32px] border border-slate-200 !bg-[radial-gradient(circle_at_85%_30%,#d9f4ed_0%,transparent_48%),radial-gradient(circle_at_45%_100%,#fae8f2_0%,transparent_55%),#ffffff] shadow-[0_28px_80px_-55px_rgba(5,150,105,.4)]">
        <div className="flex flex-col gap-4 border-b border-white/90 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Button asChild variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-white bg-white/85 shadow-sm"><Link href="/sales-management" aria-label="Înapoi la Gestionare vânzări"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-white text-emerald-600 shadow-sm"><FolderKanban className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">{stage.label}</Badge><span className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{sale.trackingCode}</span></div>
              <h1 className="mt-1 truncate text-xl font-black tracking-[-.03em] text-slate-950 lg:text-2xl">{sale.propertyTitle}</h1>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" />{sale.propertyAddress}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="h-12 rounded-2xl border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffffff_50%,#ecfdf5)] px-4 text-slate-800 shadow-sm hover:border-amber-300" onClick={() => setSetupOpen(true)}><Sparkles className="mr-2 h-4 w-4 text-amber-600" /><span className="font-bold">Completare ghidată</span></Button>
            <Button className="h-12 rounded-2xl bg-emerald-600 px-5 text-white shadow-[0_14px_28px_-16px_rgba(16,185,129,.55)] hover:bg-emerald-700" onClick={() => openEmail('context')}><Mail className="mr-2 h-4 w-4" />Trimite email</Button>
          </div>
        </div>

        <div className="grid gap-3 px-5 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderMetric accent="cyan" icon={<FileCheck2 />} label="Documente verificate" caption={`${summary.progress}% verificate`}>
            <strong>{summary.verified}/{summary.required}</strong>
          </HeaderMetric>
          <HeaderMetric accent="amber" icon={<Clock3 />} label="De rezolvat" caption={`${summary.missing} lipsă · ${summary.review} de verificat`}>
            <strong>{summary.missing + summary.review}</strong>
          </HeaderMetric>
          <HeaderMetric accent="cyan" icon={<Banknote />} label="Valoare tranzacție" caption="Total convenit">
            <strong>{formatCurrency(sale.agreedPrice)}</strong>
          </HeaderMetric>
          <HeaderMetric accent="violet" icon={<Sparkles />} label="Configurare" caption={setup.complete ? 'Datele inițiale sunt finalizate.' : `${setup.issues.length} elemente rămase.`}>
            <strong className={cn('!text-2xl', setup.complete ? '!text-emerald-700' : '!text-amber-700')}>{setup.complete ? 'Completă' : 'Necesită atenție'}</strong>
          </HeaderMetric>
        </div>

        <div className="grid gap-3 px-5 pb-5 pt-3 sm:grid-cols-3">
          <HeaderMetric accent="violet" icon={<Wallet />} label="Valoare rezervare" caption="Plătită la rezervare">
            <strong>{formatCurrency(sale.reservationAmount ?? 0)}</strong>
          </HeaderMetric>
          <HeaderMetric accent="pink" icon={<CreditCard />} label="Valoare antecontract" caption="Plătită la antecontract">
            <strong>{formatCurrency(sale.precontractAmount ?? 0)}</strong>
          </HeaderMetric>
          <HeaderMetric accent="amber" icon={<Euro />} label="Valoare restantă contract" caption="De achitat la final">
            <strong>{formatCurrency(sale.contractBalanceAmount ?? 0)}</strong>
          </HeaderMetric>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto w-full items-stretch gap-1.5 overflow-x-auto rounded-[22px] border border-slate-200/80 bg-white/85 p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="summary" className="flex-1 rounded-2xl px-3 py-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800"><Home className="mr-2 h-4 w-4" />Rezumat</TabsTrigger>
          <TabsTrigger value="participants" className="flex-1 rounded-2xl px-3 py-3 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-800"><UserRound className="mr-2 h-4 w-4" />Participanți</TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 rounded-2xl px-3 py-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800"><FileCheck2 className="mr-2 h-4 w-4" />Documente</TabsTrigger>
          <TabsTrigger value="communication" className="flex-1 rounded-2xl px-3 py-3 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-800"><Mail className="mr-2 h-4 w-4" />Comunicare</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 rounded-2xl px-3 py-3 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800"><History className="mr-2 h-4 w-4" />Istoric</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="m-0 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,.5)]">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_12px_28px_-14px_rgba(16,185,129,0.7)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-[-0.02em] text-slate-900">Starea dosarului</h2>
                <p className="text-sm text-slate-500">Informațiile importante într-un singur loc.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-amber-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><Home className="h-4 w-4" /></span>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Proprietar</p>
                </div>
                <p className="mt-3 truncate text-lg font-extrabold tracking-[-0.02em] text-slate-900">{owner?.name || 'De completat'}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{owner?.email || 'Email necompletat'}</p>
              </div>
              <div className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-emerald-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><Handshake className="h-4 w-4" /></span>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Cumpărător</p>
                </div>
                <p className="mt-3 truncate text-lg font-extrabold tracking-[-0.02em] text-slate-900">{buyer?.name || 'De completat'}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{buyer?.email || 'Email necompletat'}</p>
              </div>
              <div className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-violet-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100"><Landmark className="h-4 w-4" /></span>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Notariat</p>
                </div>
                <p className="mt-3 truncate text-lg font-extrabold tracking-[-0.02em] text-slate-900">{sale.notary?.name || 'De stabilit'}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{sale.notary?.email || sale.notary?.address || 'Date necompletate'}</p>
              </div>
              <div className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-sky-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/10">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100"><CalendarClock className="h-4 w-4" /></span>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Următoarea acțiune</p>
                </div>
                <p className="mt-3 truncate text-lg font-extrabold tracking-[-0.02em] text-slate-900">{sale.nextAction || stage.description}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{formatDate(sale.nextActionAt)}</p>
              </div>
            </div>
          </section>
          <section className="rounded-[28px] border border-amber-200/70 bg-[linear-gradient(150deg,#fffbeb,#ffffff_55%,#ecfdf5)] p-5 shadow-[0_24px_60px_-48px_rgba(217,119,6,.4)]">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_12px_28px_-14px_rgba(245,158,11,0.7)]">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-[-0.02em] text-slate-900">Priorități</h2>
                <p className="text-sm text-slate-500">Dosarul nu este blocat de informațiile lipsă.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {summary.missing ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><ShieldAlert className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-bold text-amber-900">{summary.missing} documente lipsesc</p>
                    <p className="mt-0.5 text-xs text-slate-500">Pot fi solicitate direct din tabul Documente.</p>
                  </div>
                </div>
              ) : null}
              {summary.review ? (
                <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-white/90 p-4 shadow-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100"><Clock3 className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-bold text-sky-900">{summary.review} documente așteaptă verificarea</p>
                    <p className="mt-0.5 text-xs text-slate-500">Verificarea agentului rămâne obligatorie înainte de includerea în pachet.</p>
                  </div>
                </div>
              ) : null}
              {!summary.missing && !summary.review ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white/90 p-4 shadow-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><CheckCircle2 className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-emerald-900">Documentele curente sunt în regulă</p>
                    <p className="mt-0.5 text-xs text-slate-500">Poți genera pachetul verificat pentru etapa curentă.</p>
                    <Button variant="outline" size="sm" className="mt-3 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => setActiveTab('documents')}><FileCheck2 className="mr-1.5 h-4 w-4" />Generează pachet</Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="participants" className="m-0">
          <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.55)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-[linear-gradient(120deg,#eff6ff_0%,#ffffff_45%,#ecfdf5_100%)] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-[0_16px_36px_-16px_rgba(14,165,233,0.65)]">
                  <Users className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-[-0.02em] text-slate-950">Participanții dosarului</h2>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">Persoanele implicate în această tranzacție.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge variant="outline" className="gap-1.5 rounded-full border-sky-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-sky-800 shadow-sm">
                  <Users className="h-3.5 w-3.5" />
                  {sale.participants.length} participanți
                </Badge>
                <Button variant="outline" className="h-10 rounded-2xl border-sky-200 bg-white/80 px-3.5 text-sky-800 shadow-sm hover:border-sky-300" onClick={() => setSetupOpen(true)}><UserRound className="mr-1.5 h-4 w-4" />Editează</Button>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Participant</TableHead>
                  <TableHead className="py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Rol</TableHead>
                  <TableHead className="py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Email</TableHead>
                  <TableHead className="py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Telefon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.participants.map((participant) => {
                  const meta = participantRoleMeta[participant.role];
                  const RoleIcon = meta.icon;
                  return (
                    <TableRow key={participant.id} className="group border-slate-100 transition-colors hover:bg-[linear-gradient(90deg,#f0f9ff_0%,#ffffff_55%,#ecfdf5_100%)]">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-4">
                          <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-sm font-black text-white shadow-lg ring-1', meta.gradient, meta.ring, meta.glow)}>
                            {initials(participant.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-base font-extrabold tracking-[-0.02em] text-slate-950">{participant.name || 'Nume necompletat'}</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-400">{participant.contactId ? 'Contact sincronizat' : 'Adăugat manual'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className={cn('gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm', meta.badge)}>
                          <RoleIcon className="h-3.5 w-3.5" />
                          {participantRoleLabel(participant.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        {participant.email ? (
                          <a href={`mailto:${participant.email}`} className="inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700">
                            <Mail className="h-4 w-4 shrink-0 text-sky-500" />
                            <span className="truncate">{participant.email}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-slate-400">
                            <Mail className="h-4 w-4 shrink-0" />
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {participant.phone ? (
                          <a href={`tel:${participant.phone}`} className="inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700">
                            <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="truncate">{participant.phone}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-slate-400">
                            <Phone className="h-4 w-4 shrink-0" />
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {!sale.participants.length ? (
              <div className="border-t border-slate-100 p-10 text-center text-sm text-slate-500">Nu există încă participanți adăugați în dosar.</div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="documents" className="m-0">
          <SalesDocumentWorkspace sale={sale} checklist={checklist} participants={sale.participants} onChecklistChange={setChecklist} />
        </TabsContent>

        <TabsContent value="communication" className="m-0">
          <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.55)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-[linear-gradient(120deg,#f5f3ff_0%,#ffffff_45%,#ecfdf5_100%)] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_16px_36px_-16px_rgba(139,92,246,0.65)]">
                  <Mail className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-[-0.02em] text-slate-950">Comunicarea dosarului</h2>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">Scrie emailuri și solicită documentele lipsă.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <Button className="h-11 rounded-2xl bg-[#eaf8f3] px-4 text-[#216b57] shadow-[0_14px_28px_-16px_rgba(16,185,129,.35)] hover:bg-[#dff1eb]" onClick={() => openEmail('context')}><Mail className="mr-2 h-4 w-4" />Scrie email</Button>
                <Button variant="outline" className="h-11 rounded-2xl border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffffff_50%,#ecfdf5)] px-4 text-slate-800 shadow-sm hover:border-amber-300" onClick={() => openEmail('documents')}><ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />Solicită documentele lipsă</Button>
              </div>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2">
              {sale.participants.map((participant) => {
                const meta = participantRoleMeta[participant.role];
                const channel = participant.preferredChannel ? channelMeta[participant.preferredChannel] : null;
                const ChannelIcon = channel?.icon;
                return (
                  <div key={participant.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition-colors hover:border-slate-200 hover:bg-white">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-black text-white shadow-md', meta.gradient)}>{initials(participant.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{participant.name || 'Nume necompletat'}</p>
                      <p className="truncate text-xs text-slate-500">{participant.email || participant.phone || 'Fără date de contact'}</p>
                    </div>
                    {channel && ChannelIcon ? (
                      <Badge variant="outline" className={cn('shrink-0 gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', meta.badge)}>
                        <ChannelIcon className="h-3.5 w-3.5" />
                        {channel.label}
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
              {!sale.participants.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 sm:col-span-2">Nu există încă participanți pentru comunicare.</div>
              ) : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="history" className="m-0">
          {auditEvents?.length ? (
            <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.55)]">
              <div className="border-b border-slate-100 bg-[linear-gradient(120deg,#fffbeb_0%,#ffffff_45%,#ecfdf5_100%)] p-6">
                <div className="flex items-center gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_16px_36px_-16px_rgba(245,158,11,0.65)]">
                    <History className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.02em] text-slate-950">Istoricul dosarului</h2>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">Acțiunile și comunicările, în ordine cronologică.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1 p-6">
                {auditEvents.map((event, index) => {
                  const meta = auditEventMeta[event.entityType] ?? auditEventMeta.sale;
                  const EventIcon = meta.icon;
                  const showDay = index === 0 || formatDay(event.createdAt) !== formatDay(auditEvents[index - 1].createdAt);
                  return (
                    <div key={event.id}>
                      {showDay ? (
                        <div className={cn('flex items-center gap-3 pb-3', index === 0 ? 'pt-0' : 'pt-4')}>
                          <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{formatDay(event.createdAt)}</span>
                          <span className="h-px flex-1 bg-slate-100" />
                        </div>
                      ) : null}
                      <article className="flex items-start gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50/60">
                        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', meta.tile)}>
                          <EventIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800">{event.summary}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt)} · {event.action}</p>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="rounded-[26px] border border-dashed border-slate-200 bg-white/80 p-10 text-center text-sm text-slate-500">Nu există încă acțiuni în istoricul dosarului.</div>
          )}
        </TabsContent>
      </Tabs>

      <SalesEmailComposer sale={sale} open={emailOpen} initialPanel={emailInitialPanel} onOpenSetup={() => { setEmailOpen(false); setSetupOpen(true); }} onOpenChange={setEmailOpen} />
      <SaleSetupWizard sale={setupOpen ? sale : null} open={setupOpen} onOpenChange={setSetupOpen} onSaved={(updated) => { setChecklist(updated.checklist || []); setSetupOpen(false); }} />
    </main>
  );
}
