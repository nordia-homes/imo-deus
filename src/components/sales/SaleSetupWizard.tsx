'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CreditCard, Euro, FileCheck2, Landmark, Loader2, Mail, MapPin, Phone, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import {
  calculateContractBalance,
  createDefaultSaleChecklistItems,
  DEFAULT_CONTRACT_OWNER_DOCUMENTS,
  DEFAULT_SALE_DOCUMENTS,
  getSaleReadiness,
  withDefaultSaleDocumentsForStage,
} from '@/lib/sales';
import { getSaleDocumentStages, hasActiveSaleDocumentFile, SALE_DOCUMENT_STATUS_LABELS } from '@/lib/sales-documents';
import type { SaleChecklistItem, SaleParticipant, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  sale: SaleTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (sale: SaleTransaction) => void;
};

const steps = [
  { id: 'participants', label: 'Participanți', icon: UserRound },
  { id: 'transaction', label: 'Tranzacție', icon: Landmark },
  { id: 'documents', label: 'Documente', icon: FileCheck2 },
  { id: 'review', label: 'Verificare', icon: ShieldCheck },
] as const;

function participant(role: 'buyer' | 'owner', existing?: SaleParticipant): SaleParticipant {
  return existing || { id: `${role}-${crypto.randomUUID()}`, role, name: '', email: '', phone: '', preferredChannel: 'email' };
}

function optionalAmount(value: string) {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

const LEGACY_DEFAULT_DOCUMENT_LABELS = new Set([
  'Act de identitate cumpărător',
  'Dovada finanțării / preaprobare',
  'Act de identitate proprietar',
  'Act de proprietate',
  'Extras de carte funciară',
  'Certificat fiscal',
  'Certificat energetic',
  'Cadastru / releveu',
]);

function isPristineLegacyChecklist(checklist: SaleChecklistItem[]) {
  return checklist.length === LEGACY_DEFAULT_DOCUMENT_LABELS.size
    && checklist.every((item) => LEGACY_DEFAULT_DOCUMENT_LABELS.has(item.label)
      && item.status === 'required'
      && !item.fileName
      && !item.downloadUrl
      && !item.requestedAt
      && !item.receivedAt
      && !item.verifiedAt);
}


function checklistStageLabel(item: SaleChecklistItem) {
  return getSaleDocumentStages(item).map((stage) => {
    if (stage === 'reservation') return 'Rezervare';
    if (stage === 'precontract') return 'Antecontract';
    return 'Contract';
  }).join(', ');
}

export function SaleSetupWizard({ sale, open, onOpenChange, onSaved }: Props) {
  const { user } = useAgency();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [participants, setParticipants] = useState<SaleParticipant[]>([]);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [reservationAmount, setReservationAmount] = useState('');
  const [precontractAmount, setPrecontractAmount] = useState('');
  const [financingType, setFinancingType] = useState<SaleTransaction['financingType']>('unknown');
  const [checklist, setChecklist] = useState<SaleChecklistItem[]>([]);
  const [notary, setNotary] = useState<NonNullable<SaleTransaction['notary']>>({});
  const normalizedReservationAmount = optionalAmount(reservationAmount);
  const normalizedPrecontractAmount = optionalAmount(precontractAmount);
  const contractBalanceAmount = calculateContractBalance(optionalAmount(agreedPrice), normalizedReservationAmount, normalizedPrecontractAmount);
  const paymentAmountsExceedPrice = contractBalanceAmount != null && contractBalanceAmount < 0;
  const [saving, setSaving] = useState(false);

  const toggleChecklistRequirement = (documentId: string, enabled: boolean) => {
    setChecklist((current) => current.map((entry) => {
      if (entry.id !== documentId) return entry;
      if (!enabled) return { ...entry, required: false, status: 'not_required', notRequiredReason: 'Marcat opțional în completarea ghidată' };
      const status = entry.status === 'not_required'
        ? (hasActiveSaleDocumentFile(entry) ? 'received_needs_review' : 'required')
        : entry.status;
      return { ...entry, required: true, status };
    }));
  };
  useEffect(() => {
    if (!sale || !open) return;
    const buyer = sale.participants?.find((item) => item.role === 'buyer');
    const owner = sale.participants?.find((item) => item.role === 'owner');
    const others = (sale.participants || []).filter((item) => !['buyer', 'owner'].includes(item.role));
    setParticipants([participant('buyer', buyer), participant('owner', owner), ...others]);
    setAgreedPrice(sale.agreedPrice == null ? '' : String(sale.agreedPrice));
    setReservationAmount(sale.reservationAmount == null ? '' : String(sale.reservationAmount));
    setPrecontractAmount(sale.precontractAmount == null ? '' : String(sale.precontractAmount));
    setFinancingType(sale.financingType || 'unknown');
    const existingChecklist = sale.checklist || [];
    let initialChecklist = !existingChecklist.length || isPristineLegacyChecklist(existingChecklist)
      ? createDefaultSaleChecklistItems(DEFAULT_SALE_DOCUMENTS, () => crypto.randomUUID())
      : existingChecklist;
    if (sale.stage === 'contract') {
      initialChecklist = withDefaultSaleDocumentsForStage(initialChecklist, DEFAULT_CONTRACT_OWNER_DOCUMENTS, () => crypto.randomUUID());
    }
    setChecklist(initialChecklist);
    setNotary(sale.notary || {});
    setStep(0);
  }, [open, sale?.id, sale?.stage]);

  const candidate = useMemo(() => sale ? {
    ...sale,
    participants,
    agreedPrice: Number(agreedPrice) || null,
    reservationAmount: normalizedReservationAmount,
    precontractAmount: normalizedPrecontractAmount,
    contractBalanceAmount,
    financingType,
    checklist,
    notary,
  } : null, [agreedPrice, checklist, contractBalanceAmount, financingType, normalizedPrecontractAmount, normalizedReservationAmount, notary, participants, sale]);
  const readiness = candidate ? getSaleReadiness(candidate) : { ready: false, issues: [], progress: 0 };
  const buyer = participants.find((item) => item.role === 'buyer');
  const owner = participants.find((item) => item.role === 'owner');

  const updateParticipant = (id: string, field: keyof SaleParticipant, value: string) => {
    setParticipants((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const next = () => setStep((current) => Math.min(steps.length - 1, current + 1));

  const save = async () => {
    if (!sale || !user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const normalizedPrice = Number(agreedPrice);
      const response = await fetch(`/api/sales/${sale.id}/setup`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants,
          agreedPrice: normalizedPrice > 0 ? normalizedPrice : null,
          reservationAmount: normalizedReservationAmount,
          precontractAmount: normalizedPrecontractAmount,
          financingType,
          checklist,
          notary: Object.values(notary).some(Boolean) ? notary : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Dosarul nu a putut fi configurat.');
      toast(readiness.ready
        ? { title: 'Configurarea a fost finalizată', description: 'Participanții și documentele sunt complete.' }
        : { title: 'Progresul a fost salvat', description: 'Poți reveni oricând. Butonul din dosar va semnala informațiile rămase.' });
      onSaved(payload.sale as SaleTransaction);
    } catch (error) {
      toast({ title: 'Configurarea nu a fost salvată', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!sale) return null;
  const CurrentIcon = steps[step].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,820px)] w-[min(96vw,980px)] max-w-none flex-col gap-0 overflow-hidden rounded-[30px] border border-[var(--app-surface-border)] bg-[var(--app-page-background)] p-0 text-[var(--app-page-foreground)] [&>button]:hidden">
        <DialogHeader className="border-b border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.16),transparent_34%),var(--app-surface)] px-6 py-5">
          <div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-2xl">Pregătește dosarul de vânzare</DialogTitle><DialogDescription className="mt-1 text-[var(--app-muted-foreground)]">{sale.propertyTitle} · completează acum ce ai la îndemână și revino oricând</DialogDescription></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)}><X className="h-5 w-5" /></Button></div>
          <div className="mt-5 grid grid-cols-4 gap-2">{steps.map((item, index) => <button type="button" key={item.id} onClick={() => setStep(index)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition', index === step ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-600' : 'border-[var(--app-surface-border)] bg-[var(--app-surface)] text-[var(--app-muted-foreground)] hover:border-emerald-500/25 hover:text-emerald-600')}><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', index === step ? 'bg-emerald-500/12' : 'bg-muted')}><item.icon className="h-3.5 w-3.5" /></span><span className="hidden sm:inline">{item.label}</span></button>)}</div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-3xl space-y-5 p-6 md:p-8">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><CurrentIcon className="h-5 w-5" /></div><div><h3 className="font-semibold">{steps[step].label}</h3><p className="text-sm text-[var(--app-muted-foreground)]">Pasul {step + 1} din {steps.length}</p></div></div>

            {step === 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                {[buyer, owner].map((item) => item ? (
                  <div key={item.id} className={cn('group/participant relative overflow-hidden rounded-[27px] p-px shadow-[0_22px_48px_-34px_rgba(15,118,110,.42)]', item.role === 'buyer' ? 'bg-[linear-gradient(145deg,#bae6fd,#ffffff_46%,#99f6e4)]' : 'bg-[linear-gradient(145deg,#fde68a,#ffffff_46%,#a7f3d0)]')}>
                    <div className="relative h-full overflow-hidden rounded-[26px] bg-white/95 p-5">
                      <span className={cn('pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] opacity-70', item.role === 'buyer' ? 'border-sky-50' : 'border-amber-50')} />
                      <div className="relative flex items-center gap-3">
                        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-sm', item.role === 'buyer' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-amber-200 bg-amber-50 text-amber-700')}><UserRound className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900">{item.role === 'buyer' ? 'Cumpărător' : 'Proprietar'}</p>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Parte în tranzacție</p>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em]', item.name.trim() && item.email.trim() ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>{item.name.trim() && item.email.trim() ? 'Complet' : 'De completat'}</span>
                      </div>

                      <div className="relative mt-5 space-y-3.5">
                        <div>
                          <Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Nume complet</Label>
                          <div className="relative mt-1.5">
                            <UserRound className={cn('pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2', item.role === 'buyer' ? 'text-sky-500' : 'text-amber-500')} />
                            <Input className={cn('h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_-20px_rgba(15,23,42,.5)] transition hover:bg-white focus-visible:bg-white focus-visible:ring-2', item.role === 'buyer' ? 'focus-visible:border-sky-300 focus-visible:ring-sky-200' : 'focus-visible:border-amber-300 focus-visible:ring-amber-200')} value={item.name} onChange={(event) => updateParticipant(item.id, 'name', event.target.value)} placeholder={item.role === 'buyer' ? 'Numele cumpărătorului' : 'Numele proprietarului'} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Email</Label>
                          <div className="relative mt-1.5">
                            <Mail className={cn('pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2', item.role === 'buyer' ? 'text-sky-500' : 'text-amber-500')} />
                            <Input className={cn('h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_-20px_rgba(15,23,42,.5)] transition hover:bg-white focus-visible:bg-white focus-visible:ring-2', item.role === 'buyer' ? 'focus-visible:border-sky-300 focus-visible:ring-sky-200' : 'focus-visible:border-amber-300 focus-visible:ring-amber-200')} type="email" value={item.email} onChange={(event) => updateParticipant(item.id, 'email', event.target.value)} placeholder="nume@email.ro" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Telefon</Label>
                          <div className="relative mt-1.5">
                            <Phone className={cn('pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2', item.role === 'buyer' ? 'text-sky-500' : 'text-amber-500')} />
                            <Input className={cn('h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_-20px_rgba(15,23,42,.5)] transition hover:bg-white focus-visible:bg-white focus-visible:ring-2', item.role === 'buyer' ? 'focus-visible:border-sky-300 focus-visible:ring-sky-200' : 'focus-visible:border-amber-300 focus-visible:ring-amber-200')} type="tel" inputMode="tel" value={item.phone || ''} onChange={(event) => updateParticipant(item.id, 'phone', event.target.value)} placeholder="07xx xxx xxx" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null)}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div className="group/transaction relative overflow-hidden rounded-[27px] bg-[linear-gradient(145deg,#a7f3d0,#ffffff_46%,#bae6fd)] p-px shadow-[0_22px_48px_-34px_rgba(15,118,110,.42)]">
                  <div className="relative overflow-hidden rounded-[26px] bg-white/95 p-5">
                    <span className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] border-emerald-50 opacity-70" />
                    <div className="relative flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"><Landmark className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1"><p className="font-bold text-slate-900">Tranzacție</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Condiții financiare</p></div>
                      <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em]', agreedPrice && financingType !== 'unknown' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>{agreedPrice && financingType !== 'unknown' ? 'Complet' : 'De completat'}</span>
                    </div>
                    <div className="relative mt-5 grid gap-4 md:grid-cols-2">
                      <div><Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Preț de vânzare (€)</Label><div className="relative mt-1.5"><Euro className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" /><Input data-testid="sale-agreed-price" className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_-20px_rgba(15,23,42,.5)] transition hover:bg-white focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-200" type="number" min="1" step="0.01" value={agreedPrice} onChange={(event) => setAgreedPrice(event.target.value)} /></div></div>
                      <div><Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Finanțare</Label><div className="relative mt-1.5"><CreditCard className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-sky-500" /><Select value={financingType} onValueChange={(value: NonNullable<SaleTransaction['financingType']>) => setFinancingType(value)}><SelectTrigger className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_8px_24px_-20px_rgba(15,23,42,.5)] hover:bg-white focus:ring-2 focus:ring-sky-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit">Credit</SelectItem><SelectItem value="unknown">De stabilit</SelectItem></SelectContent></Select></div></div>
                    </div>
                  </div>
                </div>

                <div className="group/payments relative overflow-hidden rounded-[27px] bg-[linear-gradient(145deg,#fde68a,#ffffff_46%,#99f6e4)] p-px shadow-[0_22px_48px_-34px_rgba(217,119,6,.38)]">
                  <div className="relative overflow-hidden rounded-[26px] bg-white/95 p-5">
                    <span className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] border-amber-50 opacity-70" />
                    <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm"><CreditCard className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">Structura plăților</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Etapele de plată</p></div><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-700">Opțional</span></div>
                    <div className="relative mt-5 grid gap-4 md:grid-cols-3">
                      <div><Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Valoare rezervare (€)</Label><div className="relative mt-1.5"><Euro className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" /><Input data-testid="sale-reservation-amount" className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 font-semibold shadow-sm transition hover:bg-white focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200" type="number" min="0" step="0.01" value={reservationAmount} onChange={(event) => setReservationAmount(event.target.value)} placeholder="0" /></div></div>
                      <div><Label className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-600">Valoare antecontract (€)</Label><div className="relative mt-1.5"><Euro className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" /><Input data-testid="sale-precontract-amount" className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 font-semibold shadow-sm transition hover:bg-white focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200" type="number" min="0" step="0.01" value={precontractAmount} onChange={(event) => setPrecontractAmount(event.target.value)} placeholder="0" /></div></div>
                      <div><Label className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[.035em] text-slate-600">Valoare restantă contract (€)</Label><div className="relative mt-1.5"><Euro className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" /><Input data-testid="sale-contract-balance-amount" aria-label="Valoare restantă contract calculată automat" className={cn('h-12 cursor-not-allowed rounded-2xl border-emerald-100 bg-emerald-50/65 pl-10 font-bold text-emerald-800 shadow-sm', paymentAmountsExceedPrice && 'border-red-300 bg-red-50 text-red-700')} type="number" step="0.01" value={contractBalanceAmount ?? ''} readOnly /></div><p className={cn('mt-1.5 text-[10px] text-emerald-700/75', paymentAmountsExceedPrice && 'font-medium text-red-600')}>{paymentAmountsExceedPrice ? 'Rezervarea și antecontractul depășesc prețul de vânzare.' : 'Preț vânzare − rezervare − antecontract'}</p></div>
                    </div>
                  </div>
                </div>

                <div className="group/notary relative overflow-hidden rounded-[27px] bg-[linear-gradient(145deg,#bae6fd,#ffffff_46%,#a7f3d0)] p-px shadow-[0_22px_48px_-34px_rgba(14,165,233,.38)]">
                  <div className="relative overflow-hidden rounded-[26px] bg-white/95 p-5">
                    <span className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] border-sky-50 opacity-70" />
                    <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 shadow-sm"><Landmark className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">Notar</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Date birou notarial</p></div><span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-sky-700">Opțional</span></div>
                    <div className="relative mt-5 grid gap-4 md:grid-cols-2">
                      <div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" /><Input className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-200" value={notary.name || ''} onChange={(event) => setNotary((current) => ({ ...current, name: event.target.value }))} placeholder="Nume notar/birou" /></div>
                      <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" /><Input className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-200" type="email" value={notary.email || ''} onChange={(event) => setNotary((current) => ({ ...current, email: event.target.value }))} placeholder="Email notar" /></div>
                      <div className="relative md:col-span-2"><MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" /><Input className="h-12 rounded-2xl border-white/90 bg-slate-50/85 pl-10 shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-200" value={notary.address || ''} onChange={(event) => setNotary((current) => ({ ...current, address: event.target.value }))} placeholder="Adresă birou" /></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[27px] bg-[linear-gradient(145deg,#bae6fd,#ffffff_46%,#a7f3d0)] p-px shadow-[0_22px_48px_-34px_rgba(14,165,233,.42)]">
                  <div className="relative overflow-hidden rounded-[26px] bg-white/95 p-5"><span className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] border-sky-50 opacity-70" /><div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 shadow-sm"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">Checklist documente</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Actele dosarului</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-emerald-700">{checklist.filter((item) => item.required).length} incluse</span></div></div>
                </div>
                <div className="space-y-2.5">
                  {checklist.map((item) => (
                    <label key={item.id} className={cn('group/document block cursor-pointer overflow-hidden rounded-[23px] p-px shadow-[0_16px_38px_-32px_rgba(15,118,110,.38)] transition hover:-translate-y-0.5', item.participantRole === 'buyer' ? 'bg-[linear-gradient(145deg,#bae6fd,#ffffff_48%,#99f6e4)]' : 'bg-[linear-gradient(145deg,#fde68a,#ffffff_48%,#a7f3d0)]')}>
                      <div className="flex items-center gap-3 rounded-[22px] bg-white/95 p-3.5">
                        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl border', item.required ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-50 text-slate-400')}>{item.required ? <Check className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}</span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.label}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400">{checklistStageLabel(item) ? `${checklistStageLabel(item)} · ` : ''}{item.participantRole === 'buyer' ? 'Cumpărător' : 'Proprietar'}</p></div>
                        <span className={cn('rounded-full border px-2 py-1 text-[8px] font-extrabold uppercase tracking-[.08em]', item.required ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500')}>{SALE_DOCUMENT_STATUS_LABELS[item.status]}</span>
                        <Checkbox checked={item.required} onCheckedChange={(checked) => toggleChecklistRequirement(item.id, checked === true)} className="h-5 w-5 shrink-0 rounded-md border-slate-300 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className={cn('relative overflow-hidden rounded-[27px] p-px shadow-[0_22px_48px_-34px_rgba(15,118,110,.42)]', readiness.ready ? 'bg-[linear-gradient(145deg,#a7f3d0,#ffffff_46%,#bae6fd)]' : 'bg-[linear-gradient(145deg,#fde68a,#ffffff_46%,#99f6e4)]')}>
                  <div className="relative overflow-hidden rounded-[26px] bg-white/95 p-5"><span className={cn('pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full border-[22px] opacity-70', readiness.ready ? 'border-emerald-50' : 'border-amber-50')} /><div className="relative flex items-center gap-3"><span className={cn('grid h-11 w-11 place-items-center rounded-2xl border shadow-sm', readiness.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>{readiness.ready ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{readiness.ready ? 'Configurarea poate fi finalizată' : 'Dosarul poate fi salvat ca progres'}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">{readiness.ready ? 'Dosar pregătit' : `${readiness.issues.length} elemente necesită atenție`}</p></div><span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.1em]', readiness.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>{readiness.progress}% complet</span></div><div className="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn('h-full rounded-full', readiness.ready ? 'bg-[linear-gradient(90deg,#34d399,#14b8a6,#38bdf8)]' : 'bg-[linear-gradient(90deg,#fbbf24,#fb923c,#2dd4bf)]')} style={{ width: `${readiness.progress}%` }} /></div></div>
                </div>
                {readiness.issues.length ? <div className="space-y-2.5">{readiness.issues.map((issue) => <button type="button" key={issue.id} onClick={() => setStep(issue.section === 'participants' ? 0 : issue.section === 'documents' ? 2 : 1)} className="group/issue block w-full overflow-hidden rounded-[22px] bg-[linear-gradient(145deg,#fde68a,#ffffff_52%,#a7f3d0)] p-px text-left shadow-[0_16px_36px_-32px_rgba(217,119,6,.5)] transition hover:-translate-y-0.5"><span className="flex items-center gap-3 rounded-[21px] bg-white/95 p-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600"><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-[9px] font-extrabold uppercase tracking-[.1em] text-amber-600">De completat</span><span className="block truncate text-sm font-bold text-slate-800">{issue.label}</span></span><ChevronRight className="h-4 w-4 text-amber-500 transition group-hover/issue:translate-x-0.5" /></span></button>)}</div> : <div className="grid gap-3 md:grid-cols-3">{[[<UserRound className="h-5 w-5" />, 'Participanți', `${buyer?.name} · ${owner?.name}`, 'sky'], [<Landmark className="h-5 w-5" />, 'Preț', `${Number(agreedPrice).toLocaleString('ro-RO')} €`, 'amber'], [<FileCheck2 className="h-5 w-5" />, 'Acte necesare', `${checklist.filter((item) => item.required).length} documente`, 'emerald']].map(([icon, label, value, tone], index) => <div key={String(label)} className={cn('overflow-hidden rounded-[22px] p-px shadow-sm', tone === 'sky' ? 'bg-[linear-gradient(145deg,#bae6fd,#ffffff,#99f6e4)]' : tone === 'amber' ? 'bg-[linear-gradient(145deg,#fde68a,#ffffff,#a7f3d0)]' : 'bg-[linear-gradient(145deg,#a7f3d0,#ffffff,#bae6fd)]')}><div className="h-full rounded-[21px] bg-white/95 p-4"><span className={cn('grid h-9 w-9 place-items-center rounded-xl border', index === 0 ? 'border-sky-200 bg-sky-50 text-sky-600' : index === 1 ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600')}>{icon}</span><p className="mt-3 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p></div></div>)}</div>}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4 md:px-6"><Button variant="ghost" className="rounded-xl" onClick={() => step ? setStep((current) => current - 1) : onOpenChange(false)}><ChevronLeft className="mr-1 h-4 w-4" />{step ? 'Înapoi' : 'Mai târziu'}</Button>{step < steps.length - 1 ? <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={next}>Continuă <ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button className={cn('rounded-xl text-white', readiness.ready ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900')} onClick={save} disabled={saving || paymentAmountsExceedPrice}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : readiness.ready ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{readiness.ready ? 'Finalizează configurarea' : 'Salvează progresul'}</Button>}</div>
      </DialogContent>
    </Dialog>
  );
}
