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
  getSaleSetupState,
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

function SaleCard({ sale, imageUrl, onEmail, onDossier, onSetup, onStageChange }: { sale: SaleTransaction; imageUrl?: string | null; onEmail: () => void; onDossier: () => void; onSetup: () => void; onStageChange: (stage: SaleStage) => void }) {
  const progress = documentProgress(sale);
  const buyer = sale.participants?.find((item) => item.role === 'buyer');
  const owner = sale.participants?.find((item) => item.role === 'owner');
  const followingStage = nextStage(sale.stage);
  const requiredDocuments = (sale.checklist || []).filter((item) => item.required).length;
  const verifiedDocuments = (sale.checklist || []).filter((item) => item.required && item.status === 'verified').length;
  const effectiveImageUrl = imageUrl || sale.propertyImageUrl;
  const setupReadiness = getSaleSetupState(sale);
  const setupComplete = setupReadiness.complete;
  const setupProgress = setupComplete ? 100 : Math.min(setupReadiness.progress, 92);
  const runAction = (event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <article
      data-testid={`sale-card-${sale.id}`}
      className="group relative isolate overflow-hidden rounded-[32px] border border-white bg-white/95 shadow-[0_28px_75px_-42px_rgba(15,118,110,.34),0_12px_28px_-22px_rgba(15,23,42,.16)] ring-1 ring-slate-900/[.045] transition duration-500 hover:-translate-y-1 hover:shadow-[0_38px_90px_-42px_rgba(13,148,136,.38),0_18px_34px_-24px_rgba(15,23,42,.18)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-[linear-gradient(90deg,#10b981_0%,#2dd4bf_38%,#38bdf8_72%,#a78bfa_100%)]" />

      <header className="relative flex flex-col gap-3 border-b border-slate-200/70 bg-[linear-gradient(110deg,rgba(236,253,245,.78),rgba(255,255,255,.94)_42%,rgba(239,246,255,.72))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Badge className={cn('rounded-full border px-3 py-1.5 shadow-sm', STAGE_COLORS[sale.stage])}>{SALE_STAGE_META[sale.stage].label}</Badge>
          <span className="truncate text-[10px] font-bold uppercase tracking-[.22em] text-teal-700/80">Dosar · {sale.trackingCode}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sale.unreadReplyCount ? <Badge className="rounded-full border-0 bg-[linear-gradient(135deg,#10b981,#0d9488)] text-white shadow-[0_10px_22px_-12px_rgba(13,148,136,.75)]"><Inbox className="mr-1 h-3 w-3" />{sale.unreadReplyCount} răspunsuri noi</Badge> : null}
          <Badge variant="outline" className="rounded-full border-emerald-200/80 bg-white/80 px-3 py-1.5 text-emerald-800 shadow-sm"><UserRound className="mr-1 h-3 w-3" />{sale.agentName}</Badge>
        </div>
      </header>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
        <div className="sales-management-property-media relative min-h-[300px] overflow-hidden bg-[linear-gradient(145deg,#ecfdf5,#f0fdfa)] lg:min-h-full">
          {effectiveImageUrl ? (
            <img
              src={effectiveImageUrl}
              alt={sale.propertyTitle}
              loading="lazy"
              decoding="async"
              className="sales-management-property-image absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
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
            <div className="absolute inset-0 grid place-items-center text-emerald-700/35"><Building2 className="h-12 w-12" /></div>
          )}
          <div className="sales-management-property-image-overlay pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.02)_44%,rgba(15,118,110,.18)_100%)]" />
          <div className="absolute bottom-5 left-5 rounded-[20px] border border-white/90 bg-white/[.9] px-5 py-3.5 text-slate-950 shadow-[0_20px_42px_-22px_rgba(15,23,42,.42)] backdrop-blur-xl">
            <p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal-700/65">Valoare tranzacție</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-.035em]">{formatCurrency(sale.agreedPrice)}</p>
          </div>
        </div>

        <div className="relative flex min-w-0 flex-col bg-[radial-gradient(circle_at_100%_0%,rgba(224,242,254,.34),transparent_30%),radial-gradient(circle_at_20%_100%,rgba(209,250,229,.24),transparent_30%)] p-5 md:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Proprietatea tranzacționată</p>
              <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-[-.04em] text-slate-950 md:text-[28px]">{sale.propertyTitle}</h2>
              <p className="mt-1 truncate text-sm text-slate-500">{sale.propertyAddress}</p>
            </div>
            {sale.notary?.appointmentAt ? <Badge variant="outline" className="w-fit shrink-0 rounded-full border-amber-300/60 bg-amber-50 px-3 py-1.5 text-amber-800"><CalendarClock className="mr-1 h-3 w-3" />Notar · {new Date(sale.notary.appointmentAt).toLocaleDateString('ro-RO')}</Badge> : null}
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,.65fr)]">
            {sale.stage === 'preparing' ? (
              <button
                type="button"
                data-testid={'sale-setup-cta-' + sale.id}
                aria-label={'Completează participanții și documentele. ' + (setupComplete ? 'Informațiile sunt complete.' : 'Informațiile nu sunt complete.')}
                onClick={(event) => runAction(event, onSetup)}
                className={cn(
                  'sales-management-setup-cta group/setup relative min-h-[150px] w-full overflow-hidden rounded-[24px] border-2 p-4 text-left transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
                  setupComplete ? 'sales-management-setup-cta--complete' : 'sales-management-setup-cta--incomplete'
                )}
              >
                <span className="sales-management-setup-cta__accent pointer-events-none absolute inset-y-0 left-0 w-1.5" />
                <span className="sales-management-setup-cta__glow pointer-events-none absolute -right-8 -top-14 h-36 w-36 rounded-full blur-2xl transition duration-500 group-hover/setup:scale-110" />
                <div className="relative flex h-full items-start gap-4 sm:items-center">
                  <div className="sales-management-setup-cta__icon grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border shadow-sm transition duration-300 group-hover/setup:rotate-3 group-hover/setup:scale-105">
                    {setupComplete ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="sales-management-setup-cta__eyebrow text-[10px] font-extrabold uppercase tracking-[.18em]">Completare ghidată</p>
                      <span className="sales-management-setup-cta__badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em]">
                        {setupComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {setupComplete ? 'Finalizat' : 'Necesită atenție'}
                      </span>
                    </div>

                    <p className="sales-management-setup-cta__title mt-2 text-[17px] font-bold leading-5 tracking-[-.015em]">Completează participanții și documentele</p>

                    <div className="sales-management-setup-cta__status mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2">
                      {setupComplete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{setupComplete ? 'Informațiile sunt complete' : 'Informațiile nu sunt complete'}</p>
                        <p className="mt-0.5 text-[10px] font-medium opacity-75">
                          {setupComplete
                            ? 'Configurarea ghidată a fost finalizată.'
                            : setupReadiness.issues.length
                              ? setupReadiness.issues.length + (setupReadiness.issues.length === 1 ? ' element rămas de completat.' : ' elemente rămase de completat.')
                              : 'Datele există, dar wizardul trebuie finalizat.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="sales-management-setup-cta__progress h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                        <div className="sales-management-setup-cta__progress-fill h-full rounded-full transition-all duration-500" style={{ width: setupProgress + '%' }} />
                      </div>
                      <span className="sales-management-setup-cta__progress-label text-[10px] font-bold">{setupProgress}% completat</span>
                    </div>
                  </div>

                  <span className="sales-management-setup-cta__action hidden shrink-0 items-center gap-2 rounded-full border px-3.5 py-2.5 text-[11px] font-bold transition duration-300 group-hover/setup:translate-x-0.5 sm:inline-flex">
                    Deschide wizardul
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-[22px] border border-amber-200/75 bg-[linear-gradient(135deg,rgba(255,251,235,.96),rgba(255,247,237,.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-white/45" />
                <div className="relative flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border border-amber-200/70 bg-white text-amber-600 shadow-[0_12px_26px_-17px_rgba(217,119,6,.58)]"><Clock3 className="h-[18px] w-[18px]" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-amber-800/60">Următorul pas recomandat</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{sale.nextAction || SALE_STAGE_META[sale.stage].description}</p>
                    {sale.nextActionAt ? <p className="mt-1.5 text-[11px] text-amber-700">{new Date(sale.nextActionAt).toLocaleString('ro-RO')}</p> : null}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[22px] border border-teal-200/70 bg-[linear-gradient(145deg,rgba(240,253,250,.96),rgba(236,254,255,.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
              <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[.15em] text-teal-950/50">Documente verificate</span><span className="text-xl font-semibold tracking-[-.03em] text-teal-700">{progress}%</span></div>
              <Progress value={progress} className="mt-3 h-2 bg-teal-950/10" />
              <p className="mt-2 text-[11px] text-slate-500">{verifiedDocuments} din {requiredDocuments || 0} documente</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-[19px] border border-slate-200/70 bg-white/85 px-3.5 py-3 shadow-[0_12px_26px_-22px_rgba(15,23,42,.36)]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#d1fae5,#ccfbf1)] text-xs font-bold text-emerald-800 ring-2 ring-white">{buyer?.name?.trim()?.charAt(0).toUpperCase() || '?'}</div>
              <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[.08em] text-slate-400">Cumpărător</p><p className="truncate text-sm font-semibold text-slate-800">{buyer?.name || 'De completat'}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-[19px] border border-slate-200/70 bg-white/85 px-3.5 py-3 shadow-[0_12px_26px_-22px_rgba(15,23,42,.36)]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fef3c7,#ffedd5)] text-xs font-bold text-amber-800 ring-2 ring-white">{owner?.name?.trim()?.charAt(0).toUpperCase() || '?'}</div>
              <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[.08em] text-slate-400">Proprietar</p><p className="truncate text-sm font-semibold text-slate-800">{owner?.name || 'De completat'}</p></div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-[23px] border border-teal-200/70 bg-[radial-gradient(circle_at_0%_0%,rgba(167,243,208,.5),transparent_38%),linear-gradient(120deg,rgba(240,253,250,.95),rgba(255,255,255,.92),rgba(240,249,255,.9))] p-4 shadow-[0_18px_38px_-28px_rgba(13,148,136,.45)] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white text-teal-600 shadow-sm ring-1 ring-emerald-100"><Sparkles className="h-[18px] w-[18px]" /></div>
              <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">Continuă tranzacția</p><p className="truncate text-xs text-slate-500">Mesaje, documente și următorii pași într-un singur loc.</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:shrink-0 xl:justify-end">
              <Button type="button" onClick={(event) => runAction(event, onEmail)} className="h-11 rounded-[14px] border-0 bg-[linear-gradient(135deg,#10b981,#0d9488)] px-5 text-white shadow-[0_14px_28px_-15px_rgba(13,148,136,.68)] hover:brightness-105"><Mail className="mr-2 h-4 w-4" />Trimite e-mail</Button>
              <Button type="button" variant="outline" onClick={(event) => runAction(event, onDossier)} className="h-11 rounded-[14px] border-white bg-white/90 px-5 text-slate-800 shadow-[0_10px_24px_-18px_rgba(15,23,42,.4)] hover:border-emerald-200 hover:bg-white hover:text-emerald-800"><FolderKanban className="mr-2 h-4 w-4 text-teal-600" />Deschide dosarul</Button>
              {followingStage ? <Button type="button" variant="ghost" className="h-11 rounded-[14px] px-4 text-xs font-semibold text-teal-700 hover:bg-white/80 hover:text-teal-900" onClick={(event) => runAction(event, () => onStageChange(followingStage))}>Treci la {SALE_STAGE_META[followingStage].shortLabel}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}
            </div>
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
  const [stageFilter, setStageFilter] = useState<'all' | 'active' | SaleStage>('preparing');
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null);
  const [initialPanel, setInitialPanel] = useState<'context' | 'documents'>('context');
  const [setupSale, setSetupSale] = useState<SaleTransaction | null>(null);
  const [returnToComposerAfterSetup, setReturnToComposerAfterSetup] = useState(false);
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
      setSelectedSale(null);
      setReturnToComposerAfterSetup(false);
      setSetupSale({ id: property.id, ...sale });
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

  const openSetup = (sale: SaleTransaction, returnToComposer = false) => {
    try {
      setReturnToComposerAfterSetup(returnToComposer);
      setSetupSale(normalizeSaleForWorkspace(sale));
    } catch (error) {
      console.error('Sales setup wizard could not be opened', error);
      toast({ title: 'Wizardul nu a putut fi deschis', description: 'Datele dosarului au un format neașteptat.', variant: 'destructive' });
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
    <div data-testid="sales-management-page" className="relative isolate space-y-6 rounded-[36px] bg-[radial-gradient(circle_at_0%_12%,rgba(209,250,229,.34),transparent_24%),radial-gradient(circle_at_100%_68%,rgba(224,242,254,.38),transparent_28%)] px-0 pb-12 text-slate-950 md:px-3">
      <section className="relative isolate overflow-hidden rounded-none border border-white/90 bg-[radial-gradient(circle_at_8%_0%,rgba(167,243,208,.7),transparent_30%),radial-gradient(circle_at_92%_8%,rgba(186,230,253,.74),transparent_28%),radial-gradient(circle_at_70%_110%,rgba(221,214,254,.48),transparent_32%),linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,252,.92))] px-5 py-7 shadow-[0_30px_80px_-40px_rgba(14,116,144,.34),0_12px_28px_-22px_rgba(15,23,42,.16)] ring-1 ring-slate-900/[.035] md:rounded-[34px] md:px-8 md:py-8">
        <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full border-[42px] border-white/45 shadow-[0_0_80px_rgba(255,255,255,.8)]" />
        <div className="pointer-events-none absolute -right-8 -top-16 h-52 w-52 rounded-full border border-sky-200/45" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_680px] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.2em] text-emerald-800 shadow-[0_10px_24px_-16px_rgba(5,150,105,.45)] backdrop-blur-xl"><Sparkles className="h-3.5 w-3.5" /> Deal workspace</div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-.045em] md:text-5xl"><span className="text-slate-950">Gestionare</span>{' '}<span className="text-teal-600">vânzări</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base md:leading-7">De la oferta acceptată până la notar: participanți, acte, emailuri și răspunsuri într-un singur dosar, fără mesaje repetitive pentru client.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'În lucru', value: metrics.active, icon: CircleDot, tone: 'bg-sky-50 text-sky-600 ring-sky-100', surface: 'bg-[linear-gradient(145deg,rgba(255,255,255,.96),rgba(224,242,254,.82))]' },
              { label: 'La documente', value: metrics.documents, icon: FileCheck2, tone: 'bg-amber-50 text-amber-600 ring-amber-100', surface: 'bg-[linear-gradient(145deg,rgba(255,255,255,.96),rgba(254,243,199,.72))]' },
              { label: 'Răspunsuri noi', value: metrics.unread, icon: Inbox, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100', surface: 'bg-[linear-gradient(145deg,rgba(255,255,255,.96),rgba(209,250,229,.78))]' },
              { label: 'Finalizate', value: metrics.completed, icon: BadgeCheck, tone: 'bg-violet-50 text-violet-600 ring-violet-100', surface: 'bg-[linear-gradient(145deg,rgba(255,255,255,.96),rgba(237,233,254,.8))]' },
            ].map((metric) => (
              <div key={metric.label} className={cn('relative overflow-hidden rounded-[22px] border border-white/90 p-4 shadow-[0_18px_38px_-24px_rgba(15,23,42,.22),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/95', metric.surface)}><metric.icon className={cn('h-9 w-9 rounded-[13px] p-2 shadow-sm ring-1', metric.tone)} /><p className="mt-3 text-3xl font-semibold tracking-[-.04em] text-slate-950">{metric.value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{metric.label}</p></div>
            ))}
          </div>
        </div>
      </section>

      {eligibleProperties.length ? (
        <section className="relative overflow-hidden rounded-[30px] border border-amber-200/70 bg-[radial-gradient(circle_at_8%_0%,rgba(254,243,199,.82),transparent_26%),radial-gradient(circle_at_96%_100%,rgba(204,251,241,.7),transparent_30%),rgba(255,255,255,.86)] p-5 shadow-[0_24px_60px_-38px_rgba(180,83,9,.3)] ring-1 ring-white md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="rounded-[18px] border border-amber-200/70 bg-white/85 p-3 text-amber-600 shadow-[0_12px_26px_-18px_rgba(217,119,6,.5)]"><Handshake className="h-5 w-5" /></div><div><h2 className="font-semibold">Proprietăți care așteaptă un dosar</h2><p className="mt-1 text-sm text-slate-500">Rezervate sau vândute recent. Pornește dosarul pentru a coordona tranzacția.</p></div></div><Badge variant="outline" className="w-fit rounded-full border-amber-200 bg-white/80 px-3 py-1 text-amber-700 shadow-sm">{eligibleProperties.length} de procesat</Badge></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {eligibleProperties.map((property) => <div key={property.id} className="group/property flex min-w-0 items-center gap-3 rounded-[20px] border border-white bg-white/90 p-3.5 shadow-[0_14px_32px_-24px_rgba(15,23,42,.3)] ring-1 ring-slate-900/[.04] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_38px_-24px_rgba(13,148,136,.28)]"><PropertyThumbnail property={property} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{property.title}</p><p className="truncate text-xs text-slate-500">{property.address || property.location}</p></div><Button size="icon" className="h-10 w-10 shrink-0 rounded-[14px] border-0 bg-[linear-gradient(135deg,#10b981,#0d9488)] text-white shadow-[0_12px_24px_-14px_rgba(13,148,136,.72)] transition group-hover/property:rotate-3 group-hover/property:scale-105 hover:brightness-105" onClick={() => void createDossier(property)} disabled={creatingPropertyId === property.id}>{creatingPropertyId === property.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="sr-only">Creează dosar</span></Button></div>)}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[26px] border border-white/90 bg-white/[.86] p-2.5 shadow-[0_18px_42px_-30px_rgba(15,23,42,.28)] ring-1 ring-slate-900/[.035] backdrop-blur-xl xl:flex-row xl:items-center">
          <div className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[18px] border border-slate-200/70 bg-slate-50/80 p-1">
            {([{ id: 'active', label: 'Active' }, { id: 'all', label: 'Toate' }] as const).map((item) => <Button key={item.id} size="sm" variant="ghost" className={cn('rounded-xl px-4', stageFilter === item.id && 'sales-management-stage-tab--active bg-[linear-gradient(135deg,#10b981,#0d9488)] text-white shadow-[0_10px_22px_-14px_rgba(13,148,136,.72)] hover:brightness-105')} onClick={() => setStageFilter(item.id)}>{item.label}</Button>)}
          </div>
          <div className="relative min-w-0 flex-1 xl:max-w-xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută proprietate, client, agent sau cod de tranzacție…" className="h-12 rounded-[18px] border-slate-200/80 bg-white/90 pl-11 pr-11 shadow-[inset_0_1px_2px_rgba(15,23,42,.03)] transition focus-visible:border-teal-300 focus-visible:ring-teal-200/50" />{search ? <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button> : null}</div>
          <div className="sales-management-stage-tabs flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 xl:justify-end xl:pb-0">{([...STAGE_ORDER.map((stage) => ({ id: stage, label: SALE_STAGE_META[stage].shortLabel })), { id: 'blocked' as const, label: 'Blocate' }] as { id: SaleStage; label: string }[]).map((item) => <Button key={item.id} size="sm" variant={stageFilter === item.id ? 'default' : 'outline'} className={cn('sales-management-stage-tab shrink-0 rounded-full border-slate-200/80 bg-white/75 px-4 text-slate-600 shadow-sm hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800', stageFilter === item.id && 'sales-management-stage-tab--active bg-[linear-gradient(135deg,#10b981,#0d9488)] text-white shadow-[0_10px_22px_-14px_rgba(13,148,136,.72)] hover:brightness-105')} onClick={() => setStageFilter(item.id)}>{item.label}</Button>)}</div>
        </div>
        {salesLoading || propertiesLoading ? <div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-[270px] rounded-[32px] bg-[linear-gradient(110deg,#f8fafc,#ecfdf5,#f8fafc)]" />)}</div> : visibleSales.length ? <div className="space-y-4">{visibleSales.map((sale) => <SaleCard key={sale.id} sale={sale} imageUrl={propertyImageForSale(sale)} onEmail={() => openSale(sale, 'context')} onDossier={() => openSale(sale, 'documents')} onSetup={() => openSetup(sale)} onStageChange={(stage) => void changeStage(sale, stage)} />)}</div> : (
          <div className="rounded-[32px] border border-dashed border-teal-200 bg-[radial-gradient(circle_at_top,rgba(204,251,241,.68),transparent_45%),rgba(255,255,255,.9)] px-6 py-16 text-center shadow-[0_24px_60px_-42px_rgba(13,148,136,.32)]"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-emerald-500/10 text-emerald-600"><ShieldCheck className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-semibold">{search ? 'Nu am găsit tranzacții' : 'Nicio vânzare în acest filtru'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Dosarele apar aici când o proprietate este rezervată sau marcată ca vândută. Fiecare agent vede tranzacțiile sale, iar administratorul vede întreaga agenție.</p></div>
        )}
      </section>

      <SalesEmailComposer sale={selectedSale} open={Boolean(selectedSale)} initialPanel={initialPanel} onOpenSetup={(saleToSetup) => { setSelectedSale(null); openSetup(saleToSetup, true); }} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedSale(null); }} />
      <SaleSetupWizard
        sale={setupSale}
        open={Boolean(setupSale)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSetupSale(null);
            setReturnToComposerAfterSetup(false);
          }
        }}
        onSaved={(configuredSale) => {
          setSetupSale(null);
          if (returnToComposerAfterSetup) setSelectedSale(configuredSale);
          setReturnToComposerAfterSetup(false);
        }}
      />
    </div>
  );
}
