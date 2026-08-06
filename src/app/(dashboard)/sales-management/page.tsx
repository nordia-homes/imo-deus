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
  preparing: 'border-emerald-500/30 bg-emerald-50 text-emerald-800',
  documents: 'border-amber-500/25 bg-amber-500/10 text-amber-600',
  notary_scheduling: 'border-orange-500/25 bg-orange-500/10 text-orange-700',
  ready_to_sign: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
  completed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600',
  blocked: 'border-red-500/25 bg-red-500/10 text-red-600',
  cancelled: 'border-slate-500/25 bg-slate-500/10 text-slate-500',
};

function PropertyThumbnail({ property }: { property: Property }) {
  const imageUrl = property.images?.find((image) => image.url?.trim())?.url;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <div className="relative grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-black/[.04]">
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={property.images?.[0]?.alt || property.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Building2 className="h-5 w-5" />
      )}
    </div>
  );
}
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

function SaleCard({ sale, imageUrl, onEmail, onDossier, onStageChange }: { sale: SaleTransaction; imageUrl?: string | null; onEmail: () => void; onDossier: () => void; onStageChange: (stage: SaleStage) => void }) {
  const progress = documentProgress(sale);
  const buyer = sale.participants?.find((item) => item.role === 'buyer');
  const owner = sale.participants?.find((item) => item.role === 'owner');
  const followingStage = nextStage(sale.stage);
  const requiredDocuments = (sale.checklist || []).filter((item) => item.required).length;
  const verifiedDocuments = (sale.checklist || []).filter((item) => item.required && item.status === 'verified').length;
  const effectiveImageUrl = imageUrl || sale.propertyImageUrl;
  const runAction = (event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <article data-testid={`sale-card-${sale.id}`} className="group overflow-hidden rounded-[30px] border border-emerald-950/10 bg-[var(--app-surface)] shadow-[0_26px_70px_-48px_rgba(20,83,45,.35)] transition duration-300 hover:-translate-y-0.5 hover:border-emerald-600/25 hover:shadow-[0_34px_82px_-46px_rgba(20,83,45,.4)]">
      <div className="h-1 bg-emerald-500" />
      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)_250px]">
        <div className="relative min-h-[245px] overflow-hidden bg-emerald-50 xl:min-h-full">
          {effectiveImageUrl ? (
            <img
              src={effectiveImageUrl}
              alt={sale.propertyTitle}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-100 transition-transform duration-500 group-hover:scale-[1.025]"
              style={{ filter: 'none', opacity: 1 }}
              onError={(event) => {
                if (!event.currentTarget.dataset.fallbackApplied && sale.propertyImageUrl && sale.propertyImageUrl !== effectiveImageUrl) {
                  event.currentTarget.dataset.fallbackApplied = 'true';
                  event.currentTarget.src = sale.propertyImageUrl;
                  return;
                }
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-emerald-700/40"><Building2 className="h-12 w-12" /></div>
          )}
          <Badge className={cn('absolute left-4 top-4 rounded-full border px-3 py-1.5 shadow-sm', STAGE_COLORS[sale.stage])}>{SALE_STAGE_META[sale.stage].label}</Badge>
          <div className="absolute bottom-4 left-4 rounded-2xl px-4 py-3 shadow-lg" style={{ background: 'rgba(17, 48, 38, 0.92)', color: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{ color: 'rgba(255,255,255,.65)' }}>Valoare tranzacție</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{formatCurrency(sale.agreedPrice)}</p>
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[.22em] text-emerald-700">Dosar de vânzare · {sale.trackingCode}</span>
                {sale.unreadReplyCount ? <Badge className="rounded-full bg-emerald-600 text-[#fff]"><Inbox className="mr-1 h-3 w-3" />{sale.unreadReplyCount} noi</Badge> : null}
              </div>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-.025em]">{sale.propertyTitle}</h2>
              <p className="mt-1 truncate text-sm text-[var(--app-muted-foreground)]">{sale.propertyAddress}</p>
            </div>
            <Badge variant="outline" className="rounded-full border-emerald-900/10 bg-emerald-50 text-emerald-800"><UserRound className="mr-1 h-3 w-3" />{sale.agentName}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
              <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Clock3 className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-amber-800/65">Următoarea acțiune</p><p className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{sale.nextAction || SALE_STAGE_META[sale.stage].description}</p>{sale.nextActionAt ? <p className="mt-1 text-[11px] text-amber-700">{new Date(sale.nextActionAt).toLocaleString('ro-RO')}</p> : null}</div></div>
            </div>
            <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50/55 p-4">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-950/50">Documente</span><span className="text-base font-semibold text-emerald-700">{progress}%</span></div>
              <Progress value={progress} className="mt-3 h-2 bg-emerald-950/10" />
              <p className="mt-2 text-[11px] text-[var(--app-muted-foreground)]">{verifiedDocuments} din {requiredDocuments || 0} verificate</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] px-3 py-2.5 shadow-sm"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{buyer?.name?.trim()?.charAt(0).toUpperCase() || '?'}</div><div className="min-w-0"><p className="text-[10px] text-[var(--app-muted-foreground)]">Cumpărător</p><p className="truncate text-sm font-medium">{buyer?.name || 'De completat'}</p></div></div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] px-3 py-2.5 shadow-sm"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{owner?.name?.trim()?.charAt(0).toUpperCase() || '?'}</div><div className="min-w-0"><p className="text-[10px] text-[var(--app-muted-foreground)]">Proprietar</p><p className="truncate text-sm font-medium">{owner?.name || 'De completat'}</p></div></div>
          </div>
          {sale.notary?.appointmentAt ? <div className="mt-3"><Badge variant="outline" className="rounded-full border-amber-300/60 bg-amber-50 text-amber-800"><CalendarClock className="mr-1 h-3 w-3" />Notar · {new Date(sale.notary.appointmentAt).toLocaleDateString('ro-RO')}</Badge></div> : null}
        </div>

        <aside className="m-4 mt-0 flex flex-col rounded-[24px] border border-emerald-950/10 p-5 xl:ml-0 xl:mt-4" style={{ background: '#173a30', color: '#ffffff' }}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Centru de acțiuni</div>
          <p className="mt-3 text-lg font-semibold">Continuă tranzacția</p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'rgba(255,255,255,.64)' }}>Mesajele, actele și pașii următori rămân organizați în același dosar.</p>
          <div className="my-5 h-px" style={{ background: 'rgba(255,255,255,.12)' }} />
          <div className="mt-auto space-y-2">
            <Button type="button" onClick={(event) => runAction(event, onEmail)} className="h-11 w-full rounded-xl border-0 bg-emerald-400 text-emerald-950 shadow-[0_14px_28px_-16px_rgba(52,211,153,.8)] hover:bg-emerald-300"><Mail className="mr-2 h-4 w-4" /> Trimite e-mail</Button>
            <Button type="button" variant="outline" onClick={(event) => runAction(event, onDossier)} className="h-11 w-full rounded-xl border-emerald-100/20 bg-transparent text-[#fff] hover:bg-emerald-50/10 hover:text-[#fff]"><FolderKanban className="mr-2 h-4 w-4" /> Deschide dosarul</Button>
            {followingStage ? <Button variant="ghost" className="h-10 w-full rounded-xl text-xs text-emerald-100/75 hover:bg-emerald-50/10 hover:text-emerald-50" onClick={() => onStageChange(followingStage)}>Avansează la {SALE_STAGE_META[followingStage].shortLabel}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button> : null}
          </div>
        </aside>
      </div>
    </article>
  );
}
export default function SalesManagementPage() {
  const { agencyId, user, userProfile } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'active' | SaleStage>('preparing');
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

  const propertyImageRecords = useMemo(() => {
    const records: Array<{ id: string; title: string; address: string; imageUrl: string }> = [];
    for (const property of properties || []) {
      const imageUrl = property.images?.find((image) => image.url?.trim())?.url;
      if (!imageUrl) continue;
      records.push({
        id: property.id,
        title: normalize(property.title),
        address: normalize(property.address || property.location || ''),
        imageUrl,
      });
    }
    return records;
  }, [properties]);

  const propertyImageForSale = (sale: SaleTransaction) => {
    const saleTitle = normalize(sale.propertyTitle);
    const saleAddress = normalize(sale.propertyAddress);
    const exact = propertyImageRecords.find((property) =>
      property.id === sale.propertyId || property.title === saleTitle || (saleAddress && property.address === saleAddress)
    );
    return exact?.imageUrl || null;
  };
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
            {eligibleProperties.map((property) => <div key={property.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-3.5"><PropertyThumbnail property={property} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{property.title}</p><p className="truncate text-xs text-[var(--app-muted-foreground)]">{property.address || property.location}</p></div><Button size="sm" className="rounded-xl" onClick={() => void createDossier(property)} disabled={creatingPropertyId === property.id}>{creatingPropertyId === property.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="sr-only">Creează dosar</span></Button></div>)}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex w-fit shrink-0 items-center gap-1 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-1 shadow-sm">
            {([{ id: 'active', label: 'Active' }, { id: 'all', label: 'Toate' }] as const).map((item) => <Button key={item.id} size="sm" variant="ghost" className={cn('rounded-xl px-4', stageFilter === item.id && 'bg-emerald-700 text-[#fff] hover:bg-emerald-800')} onClick={() => setStageFilter(item.id)}>{item.label}</Button>)}
          </div>
          <div className="relative min-w-0 flex-1 xl:max-w-xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted-foreground)]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută proprietate, client, agent sau cod de tranzacție…" className="h-12 rounded-2xl border-[var(--app-surface-border)] bg-[var(--app-surface)] pl-11 pr-11 shadow-sm" />{search ? <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button> : null}</div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 xl:justify-end xl:pb-0">{([...STAGE_ORDER.map((stage) => ({ id: stage, label: SALE_STAGE_META[stage].shortLabel })), { id: 'blocked' as const, label: 'Blocate' }] as { id: SaleStage; label: string }[]).map((item) => <Button key={item.id} size="sm" variant={stageFilter === item.id ? 'default' : 'outline'} className={cn('shrink-0 rounded-full border-[var(--app-surface-border)] px-4', stageFilter === item.id && 'bg-emerald-700 text-[#fff] hover:bg-emerald-800')} onClick={() => setStageFilter(item.id)}>{item.label}</Button>)}</div>
        </div>
        {salesLoading || propertiesLoading ? <div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-[270px] rounded-[28px]" />)}</div> : visibleSales.length ? <div className="space-y-4">{visibleSales.map((sale) => <SaleCard key={sale.id} sale={sale} imageUrl={propertyImageForSale(sale)} onEmail={() => openSale(sale, 'context')} onDossier={() => openSale(sale, 'documents')} onStageChange={(stage) => void changeStage(sale, stage)} />)}</div> : (
          <div className="rounded-[30px] border border-dashed border-[var(--app-surface-border)] bg-[var(--app-surface)] px-6 py-16 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-emerald-500/10 text-emerald-600"><ShieldCheck className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-semibold">{search ? 'Nu am găsit tranzacții' : 'Nicio vânzare în acest filtru'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--app-muted-foreground)]">Dosarele apar aici când o proprietate este rezervată sau marcată ca vândută. Fiecare agent vede tranzacțiile sale, iar administratorul vede întreaga agenție.</p></div>
        )}
      </section>

      <SalesEmailComposer sale={selectedSale} open={Boolean(selectedSale)} initialPanel={initialPanel} onOpenSetup={(saleToSetup) => { setSelectedSale(null); setSetupSale(saleToSetup); }} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedSale(null); }} />
      <SaleSetupWizard sale={setupSale} open={Boolean(setupSale)} onOpenChange={(nextOpen) => { if (!nextOpen) setSetupSale(null); }} onCompleted={(configuredSale) => { setSetupSale(null); setSelectedSale(configuredSale); }} />
    </div>
  );
}
