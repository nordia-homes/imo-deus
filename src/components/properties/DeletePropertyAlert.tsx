'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Sparkles, TrendingUp, UserX, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { Property, PropertyDeletionReason } from '@/lib/types';

export type SoldDisposition = 'agency' | 'other_agency' | 'owner';

export type DeletePropertyPayload = {
  reason: PropertyDeletionReason;
  soldDisposition?: SoldDisposition;
  soldPrice?: number;
  agentMessage: string;
};

type DeletePropertyAlertProps = {
  property: Property | null;
  isOpen: boolean;
  isDeleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (payload: DeletePropertyPayload) => Promise<void> | void;
};

type ReasonOption = {
  value: PropertyDeletionReason;
  title: string;
  description: string;
  icon: typeof Sparkles;
  selectedClassName: string;
};

const REASON_OPTIONS: ReasonOption[] = [
  {
    value: 'not_interesting',
    title: 'Nu prezinta interes',
    description: 'Cererea este slaba sau proprietatea nu mai merita urmarita activ.',
    icon: XCircle,
    selectedClassName: 'border-rose-300/45 bg-rose-500/10 text-rose-50',
  },
  {
    value: 'collaboration_ended',
    title: 'Colaborare incetata',
    description: 'Relatia cu proprietarul s-a incheiat si listingul iese din portofoliu.',
    icon: UserX,
    selectedClassName: 'border-amber-300/45 bg-amber-500/10 text-amber-50',
  },
  {
    value: 'sold',
    title: 'Proprietate vanduta',
    description: 'Salvam pretul final si folosim tranzactia pentru a rafina analiza de piata.',
    icon: TrendingUp,
    selectedClassName: 'border-emerald-300/45 bg-emerald-500/10 text-emerald-50',
  },
];

const SOLD_DISPOSITION_OPTIONS: Array<{ value: SoldDisposition; label: string; helper: string }> = [
  {
    value: 'agency',
    label: 'Vandut de agentia mea',
    helper: 'Muta proprietatea in Proprietati Vandute.',
  },
  {
    value: 'other_agency',
    label: 'Vandut de alta agentie',
    helper: 'O arhiveaza fara sa intre in vanzarile agentiei.',
  },
  {
    value: 'owner',
    label: 'Vandut de proprietar',
    helper: 'O scoate din portofoliu ca vanzare externa.',
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO').format(value);
}

function buildAgentMessage(
  propertyTitle: string,
  reason: PropertyDeletionReason,
  soldPrice?: number,
  soldDisposition?: SoldDisposition
) {
  switch (reason) {
    case 'not_interesting':
      return `Scot "${propertyTitle}" din portofoliul activ pentru ca nu mai prezinta interes comercial suficient in forma actuala.`;
    case 'collaboration_ended':
      return `Inchid listarea pentru "${propertyTitle}" deoarece colaborarea cu proprietarul a incetat si proprietatea nu mai este gestionata de agentie.`;
    case 'sold':
      if (soldDisposition === 'agency') {
        return `Marchez "${propertyTitle}" ca vanduta de agentia mea la pretul final de ${formatCurrency(soldPrice || 0)} EUR, iar tranzactia intra in pagina Proprietati Vandute.`;
      }
      if (soldDisposition === 'other_agency') {
        return `Arhivez "${propertyTitle}" ca vanduta de alta agentie la pretul final de ${formatCurrency(soldPrice || 0)} EUR, fara sa o mut in Proprietati Vandute.`;
      }
      return `Arhivez "${propertyTitle}" ca vanduta de proprietar la pretul final de ${formatCurrency(soldPrice || 0)} EUR, fara sa o mut in Proprietati Vandute.`;
    default:
      return `Scot "${propertyTitle}" din portofoliu.`;
  }
}

export function DeletePropertyAlert({
  property,
  isOpen,
  isDeleting = false,
  onOpenChange,
  onDelete,
}: DeletePropertyAlertProps) {
  const [reason, setReason] = useState<PropertyDeletionReason>('not_interesting');
  const [soldDisposition, setSoldDisposition] = useState<SoldDisposition>('agency');
  const [soldPriceInput, setSoldPriceInput] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReason('not_interesting');
      setSoldDisposition('agency');
      setSoldPriceInput('');
    }
  }, [isOpen]);

  const soldPrice = useMemo(() => {
    const normalized = soldPriceInput.replace(/[^\d]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [soldPriceInput]);

  const agentMessage = property
    ? buildAgentMessage(property.title, reason, soldPrice, soldDisposition)
    : '';

  const isSubmitDisabled = !property || isDeleting || (reason === 'sold' && !soldPrice);

  if (!property) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.25rem)] max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1e33] p-0 text-white shadow-[0_32px_90px_-40px_rgba(0,0,0,0.9)] sm:w-full">
        <div className="shrink-0 border-b border-white/10 bg-[#152A47] px-5 py-5 sm:px-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              <Building2 className="h-3.5 w-3.5" />
              Gestionare proprietate
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                Scoate proprietatea din portofoliu
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                Alege motivul corect. Doar vanzarile realizate de agentia ta sunt mutate in pagina Proprietati Vandute.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white" title={property.title}>{property.title}</p>
                  <p className="mt-1 truncate text-sm text-white/55" title={property.address}>{property.address}</p>
                </div>
                <div className="shrink-0 rounded-2xl border border-white/10 bg-black/15 px-4 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">Pret listare</p>
                  <p className="mt-0.5 text-base font-semibold text-emerald-200">{formatCurrency(property.price)} EUR</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white/82">Motiv</p>
              <RadioGroup value={reason} onValueChange={(value) => setReason(value as PropertyDeletionReason)} className="grid gap-3 sm:grid-cols-3">
                {REASON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = option.value === reason;

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative flex min-h-[148px] cursor-pointer flex-col rounded-[20px] border border-white/10 bg-white/[0.045] p-4 text-white transition-colors hover:bg-white/[0.075]',
                        selected && option.selectedClassName
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={cn('rounded-2xl border border-white/10 bg-black/15 p-2.5 text-white/72', selected && 'border-white/15 bg-black/20 text-white')}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <RadioGroupItem value={option.value} className="mt-1 border-white/40 text-emerald-300" />
                      </div>
                      <div className="mt-4 min-w-0">
                        <p className="text-sm font-semibold text-white">{option.title}</p>
                        <p className="mt-2 text-xs leading-5 text-white/55">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {reason === 'sold' ? (
              <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-400/[0.07] p-4">
                <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                  <div>
                    <Label className="text-sm font-semibold text-white/82">
                      Cine a vandut proprietatea?
                    </Label>
                    <RadioGroup
                      value={soldDisposition}
                      onValueChange={(value) => setSoldDisposition(value as SoldDisposition)}
                      className="mt-3 grid gap-2"
                    >
                      {SOLD_DISPOSITION_OPTIONS.map((option) => {
                        const selected = soldDisposition === option.value;

                        return (
                          <label
                            key={option.value}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 transition-colors hover:bg-black/20',
                              selected && 'border-emerald-200/35 bg-emerald-300/10'
                            )}
                          >
                            <RadioGroupItem value={option.value} className="mt-0.5 border-white/40 text-emerald-300" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">{option.label}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-white/52">{option.helper}</span>
                            </span>
                            {selected ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-200" /> : null}
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="sold-price" className="text-sm font-semibold text-white/82">
                      Pret final
                    </Label>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                      <Input
                        id="sold-price"
                        inputMode="numeric"
                        placeholder="125000"
                        value={soldPriceInput}
                        onChange={(event) => setSoldPriceInput(event.target.value)}
                        className="h-11 border-white/10 bg-black/20 text-base text-white placeholder:text-white/30"
                      />
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/80">EUR</p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-emerald-50/68">
                      Pentru vanzarile agentiei, pretul intra in arhiva Proprietati Vandute.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-2.5 text-sky-100">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Mesaj salvat</p>
                  <p className="mt-2 text-sm leading-6 text-white/76">{agentMessage}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 bg-[#152A47] px-5 py-4 sm:justify-between sm:px-6">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full border border-white/10 bg-white/[0.04] px-5 text-white hover:bg-white/[0.08] hover:text-white"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Anuleaza
          </Button>
          <Button
            type="button"
            onClick={() => onDelete({ reason, soldDisposition: reason === 'sold' ? soldDisposition : undefined, soldPrice, agentMessage })}
            disabled={isSubmitDisabled}
            className="rounded-full bg-emerald-300 px-6 text-slate-950 shadow-[0_18px_36px_-22px_rgba(16,185,129,0.85)] hover:bg-emerald-200"
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {reason === 'sold' && soldDisposition === 'agency' ? 'Marcheaza ca vanduta' : reason === 'sold' ? 'Arhiveaza ca vanduta' : 'Sterge proprietatea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
