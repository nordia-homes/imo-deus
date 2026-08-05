'use client';

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { collection, doc, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  FolderKanban,
  Handshake,
  Inbox,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { SalesEmailComposer } from '@/components/sales/SalesEmailComposer';
import { SaleSetupWizard } from '@/components/sales/SaleSetupWizard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  createSaleFromProperty,
  isReservedProperty,
  isSoldProperty,
  SALE_STAGE_META,
} from '@/lib/sales';
import { normalizeSaleForWorkspace } from '@/lib/sales-workspace';
import type { Property, SaleStage, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';

const STAGE_ORDER: SaleStage[] = ['preparing', 'documents', 'notary_scheduling', 'ready_to_sign', 'completed'];
const STAGE_COLORS: Record<SaleStage, string> = {
  preparing: 'border-sky-500/25 bg-sky-500/10 text-sky-600',
  documents: 'border-amber-500/25 bg-amber-500/10 text-amber-600',
  notary_scheduling: 'border-violet-500/25 bg-violet-500/10 text-violet-600',
  ready_to_sign: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
  completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
  blocked: 'border-red-500/25 bg-red-500/10 text-red-600',
  cancelled: 'border-slate-500/25 bg-slate-500/10 text-slate-500',
};

function formatCurrency(value?: number | null) {
  if (!value) return 'Preț necompletat';
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function documentProgress(sale: SaleTransaction) {
  const required = (sale.checklist || []).filter((item) => item.required);
  if (!required.length) return 0;
  const complete = required.filter((item) => item.status === 'verified').length;
  return Math.round((complete / required.length) * 100);
}

function nextStage(stage: SaleStage): SaleStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0 || index === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1];
}

function SaleCard({ sale, onEmail, onDossier, onStageChange }: { sale: SaleTransaction; onEmail: () => void; onDossier: () => void; onStageChange: (stage: SaleStage) => void }) {
  const progress = documentProgress(sale);
  const buyer = sale.participants?.find((item) => item.role === 'buyer');
  const owner = sale.participants?.find((item) => item.role === 'owner');
  const followingStage = nextStage(sale.stage);
  const runAction = (event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault(); event.stopPropagation(); action();
  };
  return (
    <article data-testid={`sale-card-${sale.id}`} className="group overflow-hidden rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] shadow-[0_24px_70px_-52px_rgba(15,23,42,.9)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_80px_-48px_rgba(15,23,42,.85)]">
      <div className="grid min-h-[270px] md:grid-cols-[220px_minmax(0,1fr)_240px]">
        <div
          className="relative min-h-[190px] overflow-hidden bg-[linear-gradient(145deg,#12304c,#0e6c58)] bg-cover bg-center md:min-h-full"
          style={sale.propertyImageUrl ? { backgroundImage: `linear-gradient(180deg,transparent 45%,rgba(2,6,23,.72)),url("${sale.propertyImageUrl.replace(/"/g, '%22')}")` } : undefined}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,.28),transparent_40%)]" />
          <div className="absolute left-4 top-4"><Badge className={cn('rounded-full border px-3 py-1 shadow-sm backdrop-blur-md', STAGE_COLORS[sale.stage])}>{SALE_STAGE_META[sale.stage].label}</Badge></div>
          <div className="absolute inset-x-4 bottom-4 text-white"><p className="text-xs font-medium uppercase tracking-[.16em] text-white/65">Valoare tranzacție</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(sale.agreedPrice)}</p></div>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">{sale.trackingCode}</p><h2 className="mt-2 truncate text-xl font-semibold tracking-tight">{sale.propertyTitle}</h2><p className="mt-1 truncate text-sm text-[var(--app-muted-foreground)]">{sale.propertyAddress}</p></div>
            {sale.unreadReplyCount ? <Badge className="shrink-0 rounded-full bg-emerald-600 text-white"><Inbox className="mr-1 h-3.5 w-3.5" />{sale.unreadReplyCount} noi</Badge> : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--app-surface-border)] bg-muted/40 p-3.5"><div className="flex items-center gap-2 text-xs text-[var(--app-muted-foreground)]"><UserRound className="h-3.5 w-3.5" /> Cumpărător</div><p className="mt-1 truncate text-sm font-medium">{buyer?.name || 'De completat'}</p></div>
            <div className="rounded-2xl border border-[var(--app-surface-border)] bg-muted/40 p-3.5"><div className="flex items-center gap-2 text-xs text-[var(--app-muted-foreground)]"><Building2 className="h-3.5 w-3.5" /> Proprietar</div><p className="mt-1 truncate text-sm font-medium">{owner?.name || 'De completat'}</p></div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="text-[var(--app-muted-foreground)]">Documente verificate</span><span className="font-semibold">{progress}%</span></div>
            <Progress value={progress} className="h-2 bg-muted" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[var(--app-muted-foreground)]"><Badge variant="outline" className="rounded-full border-[var(--app-surface-border)]"><UserRound className="mr-1 h-3 w-3" />{sale.agentName}</Badge>{sale.notary?.appointmentAt ? <Badge variant="outline" className="rounded-full border-violet-500/25 bg-violet-500/8 text-violet-600"><CalendarClock className="mr-1 h-3 w-3" />{new Date(sale.notary.appointmentAt).toLocaleDateString('ro-RO')}</Badge> : null}</div>
        </div>

        <div className="flex flex-col justify-between border-t border-[var(--app-surface-border)] bg-muted/30 p-5 md:border-l md:border-t-0">
          <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--app-muted-foreground)]">Următoarea acțiune</p><p className="mt-2 text-sm font-medium leading-6">{sale.nextAction || SALE_STAGE_META[sale.stage].description}</p>{sale.nextActionAt ? <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600"><Clock3 className="h-3.5 w-3.5" />{new Date(sale.nextActionAt).toLocaleString('ro-RO')}</p> : null}</div>
          <div className="mt-5 space-y-2">
            <Button type="button" onClick={(event) => runAction(event, onEmail)} className="w-full rounded-xl bg-emerald-600 text-white shadow-[0_14px_28px_-15px_rgba(16,185,129,.9)] hover:bg-emerald-700"><Mail className="mr-2 h-4 w-4" /> Trimite e-mail</Button>
            <Button type="button" variant="outline" onClick={(event) => runAction(event, onDossier)} className="w-full rounded-xl border-[var(--app-surface-border)]"><FolderKanban className="mr-2 h-4 w-4" /> Deschide dosarul</Button>
            {followingStage ? <Button variant="ghost" className="w-full rounded-xl text-xs" onClick={() => onStageChange(followingStage)}>Avansează la {SALE_STAGE_META[followingStage].shortLabel}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SalesManagementPage() {
  const { agencyId, user, userProfile } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'active' | SaleStage>('active');
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null);
  const [initialPanel, setInitialPanel] = useState<'context' | 'documents'>('context');
  const [setupSale, setSetupSale] = useState<SaleTransaction | null>(null);
  const [creatingPropertyId, setCreatingPropertyId] = useState<string | null>(null);

  const canSeeAll = userProfile?.role === 'admin';
  const salesQuery = useMemoFirebase(() => {
    if (!agencyId || !user) return null;
    const reference = collection(firestore, 'agencies', agencyId, 'sales');
    return canSeeAll ? reference : query(reference, where('agentId', '==', user.uid));
  }, [agencyId, canSeeAll, firestore, user]);
  const propertiesQuery = useMemoFirebase(() => agencyId ? collection(firestore, 'agencies', agencyId, 'properties') : null, [agencyId, firestore]);
  const { data: allSales, isLoading: salesLoading } = useCollection<SaleTransaction>(salesQuery);
  const { data: properties, isLoading: propertiesLoading } = useCollection<Property>(propertiesQuery);

  const visibleSales = useMemo(() => {
    const owned = (allSales || []).filter((sale) => canSeeAll || sale.agentId === user?.uid || sale.collaboratorIds?.includes(user?.uid || ''));
    const term = normalize(search);
    return owned
      .filter((sale) => stageFilter === 'all' || (stageFilter === 'active' ? !['completed', 'cancelled'].includes(sale.stage) : sale.stage === stageFilter))
      .filter((sale) => !term || normalize([sale.propertyTitle, sale.propertyAddress, sale.trackingCode, sale.agentName, ...(sale.participants || []).flatMap((participant) => [participant.name, participant.email])].join(' ')).includes(term))
      .sort((left, right) => {
        if ((right.unreadReplyCount || 0) !== (left.unreadReplyCount || 0)) return (right.unreadReplyCount || 0) - (left.unreadReplyCount || 0);
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [allSales, canSeeAll, search, stageFilter, user?.uid]);

  const eligibleProperties = useMemo(() => {
    const existingIds = new Set((allSales || []).map((sale) => sale.propertyId));
    return (properties || [])
      .filter((property) => (isSoldProperty(property) || isReservedProperty(property)) && !existingIds.has(property.id))
      .filter((property) => canSeeAll || property.agentId === user?.uid || !property.agentId)
      .slice(0, 6);
  }, [allSales, canSeeAll, properties, user?.uid]);

  const ownedSales = useMemo(() => (allSales || []).filter((sale) => canSeeAll || sale.agentId === user?.uid || sale.collaboratorIds?.includes(user?.uid || '')), [allSales, canSeeAll, user?.uid]);
  const metrics = {
    active: ownedSales.filter((sale) => !['completed', 'cancelled'].includes(sale.stage)).length,
    documents: ownedSales.filter((sale) => sale.stage === 'documents').length,
    unread: ownedSales.reduce((total, sale) => total + (sale.unreadReplyCount || 0), 0),
    completed: ownedSales.filter((sale) => sale.stage === 'completed').length,
  };

  const createDossier = async (property: Property) => {
    if (!agencyId || !user) return;
    setCreatingPropertyId(property.id);
    try {
      const sale = createSaleFromProperty(property, agencyId, { id: user.uid, name: userProfile?.name || user.displayName || 'Agent' });
      await setDoc(doc(firestore, 'agencies', agencyId, 'sales', property.id), sale);
      toast({ title: 'Dosarul de vânzare a fost creat', description: 'Completează cumpărătorul și documentele necesare.' });
      setInitialPanel('context');
      setSelectedSale({ id: property.id, ...sale });
    } catch (error) {
      toast({ title: 'Dosarul nu a putut fi creat', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setCreatingPropertyId(null);
    }
  };

  const changeStage = async (sale: SaleTransaction, stage: SaleStage) => {
    if (!agencyId) return;
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestore, 'agencies', agencyId, 'sales', sale.id), {
        stage,
        nextAction: SALE_STAGE_META[stage].description,
        updatedAt: now,
        completedAt: stage === 'completed' ? now : sale.completedAt || null,
      });
      toast({ title: `Etapa a fost schimbată în „${SALE_STAGE_META[stage].label}”` });
    } catch (error) {
      toast({ title: 'Etapa nu a putut fi schimbată', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    }
  };

  const openSale = (sale: SaleTransaction, panel: 'context' | 'documents' = 'context') => {
    try {
      const workspaceSale = normalizeSaleForWorkspace(sale);
      setInitialPanel(panel);
      setSelectedSale(workspaceSale);
      if (workspaceSale.unreadReplyCount && agencyId) void updateDoc(doc(firestore, 'agencies', agencyId, 'sales', workspaceSale.id), { unreadReplyCount: 0, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Sales dossier could not be opened', error);
      toast({ title: 'Dosarul nu a putut fi deschis', description: 'Datele dosarului au un format neașteptat.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!allSales?.length) return;
    const linkedSaleId = new URLSearchParams(window.location.search).get('sale');
    if (!linkedSaleId) return;
    const linkedSale = allSales.find((item) => item.id === linkedSaleId);
    if (!linkedSale) return;
    setInitialPanel('context');
    setSelectedSale(normalizeSaleForWorkspace(linkedSale));
  }, [allSales]);

  return (
    <div data-testid="sales-management-page" className="space-y-6 px-0 pb-10 md:px-3">
      <section className="relative overflow-hidden rounded-none border border-white/8 bg-[radial-gradient(circle_at_12%_10%,rgba(52,211,153,.2),transparent_26%),radial-gradient(circle_at_92%_20%,rgba(56,189,248,.16),transparent_26%),linear-gradient(135deg,#102946_0%,#0b2037_55%,#071827_100%)] px-5 py-7 text-white shadow-[0_32px_90px_-42px_rgba(2,6,23,.9)] md:rounded-[32px] md:px-8 md:py-8">
        <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -right-8 -top-16 h-52 w-52 rounded-full border border-white/5" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_680px] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.2em] text-emerald-100"><Sparkles className="h-3.5 w-3.5" /> Deal workspace</div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-.03em] md:text-5xl">Gestionare vânzări</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64 md:text-base md:leading-7">De la oferta acceptată până la notar: participanți, acte, emailuri și răspunsuri într-un singur dosar, fără mesaje repetitive pentru client.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ label: 'În lucru', value: metrics.active, icon: CircleDot, tone: 'text-sky-300' }, { label: 'La documente', value: metrics.documents, icon: FileCheck2, tone: 'text-amber-300' }, { label: 'Răspunsuri noi', value: metrics.unread, icon: Inbox, tone: 'text-emerald-300' }, { label: 'Finalizate', value: metrics.completed, icon: BadgeCheck, tone: 'text-violet-300' }].map((metric) => (
              <div key={metric.label} className="rounded-[22px] border border-white/10 bg-white/[.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-md"><metric.icon className={cn('h-4 w-4', metric.tone)} /><p className="mt-4 text-3xl font-semibold">{metric.value}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-[.12em] text-white/48">{metric.label}</p></div>
            ))}
          </div>
        </div>
      </section>

      {eligibleProperties.length ? (
        <section className="rounded-[28px] border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,.09),rgba(16,185,129,.045))] p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-500/12 p-3 text-amber-600"><Handshake className="h-5 w-5" /></div><div><h2 className="font-semibold">Proprietăți care așteaptă un dosar</h2><p className="mt-1 text-sm text-[var(--app-muted-foreground)]">Rezervate sau vândute recent. Pornește dosarul pentru a coordona tranzacția.</p></div></div><Badge variant="outline" className="w-fit rounded-full border-amber-500/25 bg-amber-500/10 px-3 text-amber-600">{eligibleProperties.length} de procesat</Badge></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {eligibleProperties.map((property) => <div key={property.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-3.5"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><Building2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{property.title}</p><p className="truncate text-xs text-[var(--app-muted-foreground)]">{property.address || property.location}</p></div><Button size="sm" className="rounded-xl" onClick={() => void createDossier(property)} disabled={creatingPropertyId === property.id}>{creatingPropertyId === property.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="sr-only">Creează dosar</span></Button></div>)}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1 xl:max-w-xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted-foreground)]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută proprietate, client, agent sau cod de tranzacție…" className="h-12 rounded-2xl border-[var(--app-surface-border)] bg-[var(--app-surface)] pl-11 pr-11 shadow-sm" />{search ? <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button> : null}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">{([{ id: 'active', label: 'Active' }, { id: 'all', label: 'Toate' }, ...STAGE_ORDER.map((stage) => ({ id: stage, label: SALE_STAGE_META[stage].shortLabel })), { id: 'blocked', label: 'Blocate' }] as { id: 'all' | 'active' | SaleStage; label: string }[]).map((item) => <Button key={item.id} size="sm" variant={stageFilter === item.id ? 'default' : 'outline'} className={cn('shrink-0 rounded-full border-[var(--app-surface-border)] px-4', stageFilter === item.id && 'bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active-foreground)] hover:bg-[var(--app-nav-active-bg)]')} onClick={() => setStageFilter(item.id)}>{item.label}</Button>)}</div>
        </div>

        {salesLoading || propertiesLoading ? <div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-[270px] rounded-[28px]" />)}</div> : visibleSales.length ? <div className="space-y-4">{visibleSales.map((sale) => <SaleCard key={sale.id} sale={sale} onEmail={() => openSale(sale, 'context')} onDossier={() => openSale(sale, 'documents')} onStageChange={(stage) => void changeStage(sale, stage)} />)}</div> : (
          <div className="rounded-[30px] border border-dashed border-[var(--app-surface-border)] bg-[var(--app-surface)] px-6 py-16 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-emerald-500/10 text-emerald-600"><ShieldCheck className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-semibold">{search ? 'Nu am găsit tranzacții' : 'Nicio vânzare în acest filtru'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--app-muted-foreground)]">Dosarele apar aici când o proprietate este rezervată sau marcată ca vândută. Fiecare agent vede tranzacțiile sale, iar administratorul vede întreaga agenție.</p></div>
        )}
      </section>

      <SalesEmailComposer sale={selectedSale} open={Boolean(selectedSale)} initialPanel={initialPanel} onOpenSetup={(saleToSetup) => { setSelectedSale(null); setSetupSale(saleToSetup); }} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedSale(null); }} />
      <SaleSetupWizard sale={setupSale} open={Boolean(setupSale)} onOpenChange={(nextOpen) => { if (!nextOpen) setSetupSale(null); }} onCompleted={(configuredSale) => { setSetupSale(null); setSelectedSale(configuredSale); }} />
    </div>
  );
}
