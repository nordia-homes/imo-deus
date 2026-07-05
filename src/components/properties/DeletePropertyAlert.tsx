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
  themeVariant?: 'light' | 'dark';
  onOpenChange: (open: boolean) => void;
  onDelete: (payload: DeletePropertyPayload) => Promise<void> | void;
};

type ReasonOption = {
  value: PropertyDeletionReason;
  title: string;
  description: string;
  icon: typeof Sparkles;
  selectedDarkClassName: string;
  selectedLightClassName: string;
};

const REASON_OPTIONS: ReasonOption[] = [
  {
    value: 'not_interesting',
    title: 'Nu prezinta interes',
    description: 'Cererea este slaba sau proprietatea nu mai merita urmarita activ.',
    icon: XCircle,
    selectedDarkClassName: 'border-rose-300/40 bg-rose-500/10 text-rose-50',
    selectedLightClassName: 'border-rose-200 bg-rose-50 text-rose-950 shadow-[0_18px_38px_-28px_rgba(244,63,94,0.45)]',
  },
  {
    value: 'collaboration_ended',
    title: 'Colaborare incetata',
    description: 'Relatia cu proprietarul s-a incheiat si listingul iese din portofoliu.',
    icon: UserX,
    selectedDarkClassName: 'border-amber-300/40 bg-amber-500/10 text-amber-50',
    selectedLightClassName: 'border-amber-200 bg-amber-50 text-amber-950 shadow-[0_18px_38px_-28px_rgba(245,158,11,0.38)]',
  },
  {
    value: 'sold',
    title: 'Proprietate vanduta',
    description: 'Salvam pretul final si folosim tranzactia pentru a rafina analiza de piata.',
    icon: TrendingUp,
    selectedDarkClassName: 'border-emerald-300/40 bg-emerald-500/10 text-emerald-50',
    selectedLightClassName: 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-[0_18px_38px_-28px_rgba(16,185,129,0.42)]',
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
  themeVariant = 'dark',
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

  const isLightTheme = themeVariant === 'light';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] w-[calc(100vw-1.25rem)] max-w-[760px] flex-col overflow-hidden rounded-[28px] p-0 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.7)] sm:w-full',
          isLightTheme
            ? 'border border-slate-200 bg-white text-slate-950'
            : 'border border-white/10 bg-[#0f1e33] text-white shadow-[0_32px_90px_-40px_rgba(0,0,0,0.9)]'
        )}
      >
        <div className={cn('shrink-0 border-b px-5 py-5 sm:px-6', isLightTheme ? 'border-slate-200 bg-slate-50/95' : 'border-white/10 bg-[#152A47]')}>
          <DialogHeader className="space-y-3 text-left">
            <div
              className={cn(
                'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                isLightTheme ? 'border-slate-200 bg-white text-slate-500 shadow-sm' : 'border-white/10 bg-white/[0.08] text-white/60'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Gestionare proprietate
            </div>
            <div>
              <DialogTitle className={cn('text-2xl font-semibold tracking-tight', isLightTheme ? 'text-slate-950' : 'text-white')}>
                Scoate proprietatea din portofoliu
              </DialogTitle>
              <DialogDescription className={cn('mt-2 max-w-2xl text-sm leading-6', isLightTheme ? 'text-slate-600' : 'text-white/60')}>
                Alege motivul corect. Doar vanzarile realizate de agentia ta sunt mutate in pagina Proprietati Vandute.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <div className={cn('rounded-[22px] border p-4', isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.05]')}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={cn('truncate text-base font-semibold', isLightTheme ? 'text-slate-950' : 'text-white')} title={property.title}>{property.title}</p>
                  <p className={cn('mt-1 truncate text-sm', isLightTheme ? 'text-slate-500' : 'text-white/50')} title={property.address}>{property.address}</p>
                </div>
                <div className={cn('shrink-0 rounded-2xl border px-4 py-2', isLightTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/15')}>
                  <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', isLightTheme ? 'text-slate-500' : 'text-white/40')}>Pret listare</p>
                  <p className={cn('mt-0.5 text-base font-semibold', isLightTheme ? 'text-emerald-700' : 'text-emerald-200')}>{formatCurrency(property.price)} EUR</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className={cn('text-sm font-semibold', isLightTheme ? 'text-slate-600' : 'text-white/80')}>Motiv</p>
              <RadioGroup value={reason} onValueChange={(value) => setReason(value as PropertyDeletionReason)} className="grid gap-3 sm:grid-cols-3">
                {REASON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = option.value === reason;

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative flex min-h-[148px] cursor-pointer flex-col rounded-[20px] border p-4 transition-colors',
                        isLightTheme
                          ? 'border-slate-200 bg-white text-slate-950 hover:bg-slate-50'
                          : 'border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]',
                        selected && (isLightTheme ? option.selectedLightClassName : option.selectedDarkClassName)
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={cn(
                            'rounded-2xl border p-2.5',
                            isLightTheme ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/10 bg-black/15 text-white/70',
                            selected && (isLightTheme ? 'border-white bg-white text-slate-900' : 'border-white/20 bg-black/20 text-white')
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <RadioGroupItem value={option.value} className={cn('mt-1', isLightTheme ? 'border-slate-300 text-emerald-600' : 'border-white/40 text-emerald-300')} />
                      </div>
                      <div className="mt-4 min-w-0">
                        <p className={cn('text-sm font-semibold', isLightTheme ? 'text-slate-950' : 'text-white')}>{option.title}</p>
                        <p className={cn('mt-2 text-xs leading-5', isLightTheme ? 'text-slate-500' : 'text-white/50')}>{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {reason === 'sold' ? (
              <div className={cn('rounded-[22px] border p-4', isLightTheme ? 'border-emerald-200 bg-emerald-50/70' : 'border-emerald-300/20 bg-emerald-400/[0.07]')}>
                <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                  <div>
                    <Label className={cn('text-sm font-semibold', isLightTheme ? 'text-slate-700' : 'text-white/80')}>
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
                              'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
                              isLightTheme ? 'border-slate-200 bg-white hover:bg-emerald-50' : 'border-white/10 bg-black/10 hover:bg-black/20',
                              selected && (isLightTheme ? 'border-emerald-300 bg-emerald-100/80' : 'border-emerald-200/40 bg-emerald-300/10')
                            )}
                          >
                            <RadioGroupItem value={option.value} className={cn('mt-0.5', isLightTheme ? 'border-slate-300 text-emerald-600' : 'border-white/40 text-emerald-300')} />
                            <span className="min-w-0">
                              <span className={cn('block text-sm font-semibold', isLightTheme ? 'text-slate-950' : 'text-white')}>{option.label}</span>
                              <span className={cn('mt-0.5 block text-xs leading-5', isLightTheme ? 'text-slate-500' : 'text-white/50')}>{option.helper}</span>
                            </span>
                            {selected ? <CheckCircle2 className={cn('ml-auto h-4 w-4 shrink-0', isLightTheme ? 'text-emerald-600' : 'text-emerald-200')} /> : null}
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="sold-price" className={cn('text-sm font-semibold', isLightTheme ? 'text-slate-700' : 'text-white/80')}>
                      Pret final
                    </Label>
                    <div className={cn('mt-3 rounded-2xl border p-3', isLightTheme ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/15')}>
                      <Input
                        id="sold-price"
                        inputMode="numeric"
                        placeholder="125000"
                        value={soldPriceInput}
                        onChange={(event) => setSoldPriceInput(event.target.value)}
                        className={cn('h-11 text-base', isLightTheme ? 'border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400' : 'border-white/10 bg-black/20 text-white placeholder:text-white/30')}
                      />
                      <p className={cn('mt-2 text-xs font-semibold uppercase tracking-[0.16em]', isLightTheme ? 'text-emerald-700' : 'text-emerald-200/80')}>EUR</p>
                    </div>
                    <p className={cn('mt-3 text-xs leading-5', isLightTheme ? 'text-emerald-700' : 'text-emerald-50/70')}>
                      Pentru vanzarile agentiei, pretul intra in arhiva Proprietati Vandute.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn('rounded-[20px] border p-4', isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]')}>
              <div className="flex items-start gap-3">
                <div className={cn('rounded-2xl border p-2.5', isLightTheme ? 'border-slate-200 bg-white text-[#445b84]' : 'border-white/10 bg-black/15 text-sky-100')}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', isLightTheme ? 'text-slate-500' : 'text-white/40')}>Mesaj salvat</p>
                  <p className={cn('mt-2 text-sm leading-6', isLightTheme ? 'text-slate-700' : 'text-white/75')}>{agentMessage}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className={cn('shrink-0 border-t px-5 py-4 sm:justify-between sm:px-6', isLightTheme ? 'border-slate-200 bg-slate-50/95' : 'border-white/10 bg-[#152A47]')}>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'rounded-full border px-5',
              isLightTheme
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white'
            )}
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Anuleaza
          </Button>
          <Button
            type="button"
            onClick={() => onDelete({ reason, soldDisposition: reason === 'sold' ? soldDisposition : undefined, soldPrice, agentMessage })}
            disabled={isSubmitDisabled}
            className={cn(
              'rounded-full px-6',
              isLightTheme
                ? 'bg-[#66dfac] text-slate-950 shadow-[0_18px_36px_-22px_rgba(16,185,129,0.7)] hover:bg-[#57d6a1]'
                : 'bg-emerald-300 text-slate-950 shadow-[0_18px_36px_-22px_rgba(16,185,129,0.85)] hover:bg-emerald-200'
            )}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {reason === 'sold' && soldDisposition === 'agency' ? 'Marcheaza ca vanduta' : reason === 'sold' ? 'Arhiveaza ca vanduta' : 'Sterge proprietatea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
