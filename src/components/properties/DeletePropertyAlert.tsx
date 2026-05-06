'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, TrendingUp, UserX, XCircle } from 'lucide-react';
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

export type DeletePropertyPayload = {
  reason: PropertyDeletionReason;
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
  accentClassName: string;
};

const REASON_OPTIONS: ReasonOption[] = [
  {
    value: 'not_interesting',
    title: 'Nu prezinta interes',
    description: 'Cererea este slaba sau proprietatea nu mai merita urmarita activ.',
    icon: XCircle,
    accentClassName: 'from-rose-500/18 via-orange-400/10 to-transparent border-rose-300/18',
  },
  {
    value: 'collaboration_ended',
    title: 'Colaborare incetata',
    description: 'Relatia cu proprietarul s-a incheiat si listingul iese din portofoliu.',
    icon: UserX,
    accentClassName: 'from-amber-400/18 via-yellow-300/10 to-transparent border-amber-300/18',
  },
  {
    value: 'sold',
    title: 'Proprietate vanduta',
    description: 'Salvam pretul final si folosim tranzactia pentru a rafina analiza de piata.',
    icon: TrendingUp,
    accentClassName: 'from-emerald-400/20 via-cyan-400/12 to-transparent border-emerald-300/20',
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO').format(value);
}

function buildAgentMessage(propertyTitle: string, reason: PropertyDeletionReason, soldPrice?: number) {
  switch (reason) {
    case 'not_interesting':
      return `Scot "${propertyTitle}" din portofoliul activ pentru ca nu mai prezinta interes comercial suficient in forma actuala.`;
    case 'collaboration_ended':
      return `Inchid listarea pentru "${propertyTitle}" deoarece colaborarea cu proprietarul a incetat si proprietatea nu mai este gestionata de agentie.`;
    case 'sold':
      return `Marchez "${propertyTitle}" ca vanduta la pretul final de ${formatCurrency(soldPrice || 0)} EUR, iar tranzactia intra in memoria de piata pentru analize viitoare mai bune.`;
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
  const [soldPriceInput, setSoldPriceInput] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReason('not_interesting');
      setSoldPriceInput('');
    }
  }, [isOpen]);

  const soldPrice = useMemo(() => {
    const normalized = soldPriceInput.replace(/[^\d]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [soldPriceInput]);

  const agentMessage = property
    ? buildAgentMessage(property.title, reason, soldPrice)
    : '';

  const isSubmitDisabled = !property || isDeleting || (reason === 'sold' && !soldPrice);

  if (!property) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-[700px] flex-col overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(145deg,_rgba(10,18,33,0.98),_rgba(13,24,41,0.98))] p-0 text-white shadow-[0_40px_120px_-44px_rgba(0,0,0,0.9)] sm:max-h-[88vh] sm:w-full sm:max-w-[700px]">
        <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6 sm:py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Flux inteligent de stergere
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold text-white">
                De ce scoatem aceasta proprietate din portofoliu?
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Agentul explica motivul, iar daca proprietatea este vanduta salvam tranzactia pentru a imbunatati continuu analiza de piata.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-5 sm:space-y-6">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Proprietate selectata</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-white sm:text-xl">{property.title}</p>
                <p className="mt-1 text-sm text-white/60">{property.address}</p>
              </div>
              <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left sm:w-auto sm:text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Pret listare</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">{formatCurrency(property.price)} EUR</p>
              </div>
            </div>
          </div>

          <RadioGroup value={reason} onValueChange={(value) => setReason(value as PropertyDeletionReason)} className="grid gap-3">
            {REASON_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.value === reason;

              return (
                <label
                  key={option.value}
                  className={cn(
                    'group flex cursor-pointer items-start gap-4 rounded-[24px] border bg-white/[0.04] p-4 transition-all duration-200 hover:bg-white/[0.06]',
                    option.accentClassName,
                    selected
                      ? 'border-white/20 shadow-[0_18px_44px_-28px_rgba(16,185,129,0.55)]'
                      : 'border-white/10'
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-1 border-white/40 text-emerald-300" />
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-white/80">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white">{option.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/60">{option.description}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {reason === 'sold' ? (
            <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-400/8 p-5">
              <Label htmlFor="sold-price" className="text-sm font-medium text-white">
                Pret final de vanzare
              </Label>
              <div className="mt-3 flex items-center gap-3">
                <Input
                  id="sold-price"
                  inputMode="numeric"
                  placeholder="Ex: 125000"
                  value={soldPriceInput}
                  onChange={(event) => setSoldPriceInput(event.target.value)}
                  className="h-12 border-white/10 bg-black/20 text-base text-white placeholder:text-white/30"
                />
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-emerald-200">
                  EUR
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-emerald-50/75">
                Acest pret, impreuna cu camerele, suprafata, zona si restul caracteristicilor proprietatii, va fi reutilizat ca reper in analizele viitoare.
              </p>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-sky-300/15 bg-[linear-gradient(135deg,rgba(17,24,39,0.86),rgba(10,20,36,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-300/15 bg-sky-400/10 p-3 text-sky-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/55">Mesajul agentului</p>
                <p className="mt-1 text-sm text-white/55">Acesta este textul care insoteste decizia de stergere.</p>
              </div>
            </div>
            <p className="mt-4 text-base leading-7 text-white/88">{agentMessage}</p>
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 bg-black/10 px-5 py-4 sm:justify-between sm:px-6 sm:py-5">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Anuleaza
          </Button>
          <Button
            type="button"
            onClick={() => onDelete({ reason, soldPrice, agentMessage })}
            disabled={isSubmitDisabled}
            className="rounded-full bg-[linear-gradient(135deg,rgba(16,185,129,0.98),rgba(14,165,233,0.96))] px-6 text-slate-950 shadow-[0_18px_36px_-20px_rgba(16,185,129,0.75)] hover:opacity-95"
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sterge proprietatea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
