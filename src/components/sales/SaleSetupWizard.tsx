'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileCheck2, Landmark, Loader2, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SALE_DOCUMENTS, getSaleReadiness } from '@/lib/sales';
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
  onCompleted: (sale: SaleTransaction) => void;
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

export function SaleSetupWizard({ sale, open, onOpenChange, onCompleted }: Props) {
  const { user } = useAgency();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [participants, setParticipants] = useState<SaleParticipant[]>([]);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [financingType, setFinancingType] = useState<SaleTransaction['financingType']>('unknown');
  const [checklist, setChecklist] = useState<SaleChecklistItem[]>([]);
  const [notary, setNotary] = useState<NonNullable<SaleTransaction['notary']>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sale || !open) return;
    const buyer = sale.participants?.find((item) => item.role === 'buyer');
    const owner = sale.participants?.find((item) => item.role === 'owner');
    const others = (sale.participants || []).filter((item) => !['buyer', 'owner'].includes(item.role));
    setParticipants([participant('buyer', buyer), participant('owner', owner), ...others]);
    setAgreedPrice(String(sale.agreedPrice || ''));
    setFinancingType(sale.financingType || 'unknown');
    setChecklist(sale.checklist?.length ? sale.checklist : DEFAULT_SALE_DOCUMENTS.map((item) => ({ id: crypto.randomUUID(), label: item.label, participantRole: item.role, status: 'required', required: true, reviewStatus: 'unreviewed', scanStatus: 'pending', ocrStatus: 'not_requested', version: 1 })));
    setNotary(sale.notary || {});
    setStep(0);
  }, [open, sale?.id]);

  const candidate = useMemo(() => sale ? { ...sale, participants, agreedPrice: Number(agreedPrice) || null, financingType, checklist, notary } : null, [agreedPrice, checklist, financingType, notary, participants, sale]);
  const readiness = candidate ? getSaleReadiness(candidate) : { ready: false, issues: [], progress: 0 };
  const buyer = participants.find((item) => item.role === 'buyer');
  const owner = participants.find((item) => item.role === 'owner');

  const updateParticipant = (id: string, field: keyof SaleParticipant, value: string) => {
    setParticipants((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const next = () => {
    if (step === 0 && (!buyer?.name.trim() || !buyer.email.trim() || !owner?.name.trim() || !owner.email.trim())) {
      toast({ title: 'Completează ambele părți', description: 'Numele și emailul cumpărătorului și proprietarului sunt obligatorii.', variant: 'destructive' });
      return;
    }
    if (step === 1 && (!(Number(agreedPrice) > 0) || financingType === 'unknown')) {
      toast({ title: 'Completează tranzacția', description: 'Prețul agreat și forma de finanțare sunt obligatorii.', variant: 'destructive' });
      return;
    }
    if (step === 2 && !checklist.some((item) => item.required)) {
      toast({ title: 'Alege documentele necesare', variant: 'destructive' });
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const complete = async () => {
    if (!sale || !user || !readiness.ready) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/${sale.id}/setup`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants, agreedPrice: Number(agreedPrice), financingType, checklist, notary: Object.values(notary).some(Boolean) ? notary : null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Dosarul nu a putut fi configurat.');
      toast({ title: 'Dosarul este pregătit', description: 'Poți compune mesajele fără riscul unor date lipsă.' });
      onCompleted(payload.sale as SaleTransaction);
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
          <div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-2xl">Pregătește dosarul de vânzare</DialogTitle><DialogDescription className="mt-1 text-[var(--app-muted-foreground)]">{sale.propertyTitle} · datele sunt verificate înainte de primul email</DialogDescription></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)}><X className="h-5 w-5" /></Button></div>
          <div className="mt-5 grid grid-cols-4 gap-2">{steps.map((item, index) => <button type="button" key={item.id} onClick={() => index <= step && setStep(index)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition', index === step ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-600' : index < step ? 'border-[var(--app-surface-border)] bg-[var(--app-surface)]' : 'border-transparent text-[var(--app-muted-foreground)]')}><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', index <= step ? 'bg-emerald-500/12' : 'bg-muted')} >{index < step ? <Check className="h-3.5 w-3.5" /> : <item.icon className="h-3.5 w-3.5" />}</span><span className="hidden sm:inline">{item.label}</span></button>)}</div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-3xl space-y-5 p-6 md:p-8">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><CurrentIcon className="h-5 w-5" /></div><div><h3 className="font-semibold">{steps[step].label}</h3><p className="text-sm text-[var(--app-muted-foreground)]">Pasul {step + 1} din {steps.length}</p></div></div>

            {step === 0 ? <div className="grid gap-4 md:grid-cols-2">{[buyer, owner].map((item) => item ? <div key={item.id} className="space-y-3 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-5"><div className="text-sm font-semibold">{item.role === 'buyer' ? 'Cumpărător' : 'Proprietar'}</div><div><Label>Nume complet</Label><Input className="mt-1.5 rounded-xl" value={item.name} onChange={(event) => updateParticipant(item.id, 'name', event.target.value)} /></div><div><Label>Email</Label><Input className="mt-1.5 rounded-xl" type="email" value={item.email} onChange={(event) => updateParticipant(item.id, 'email', event.target.value)} placeholder="nume@gmail.com" /></div><div><Label>Telefon</Label><Input className="mt-1.5 rounded-xl" value={item.phone || ''} onChange={(event) => updateParticipant(item.id, 'phone', event.target.value)} /></div></div> : null)}</div> : null}

            {step === 1 ? <div className="grid gap-5 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-5 md:grid-cols-2"><div><Label>Preț agreat (€)</Label><Input className="mt-1.5 h-12 rounded-xl" type="number" min="1" value={agreedPrice} onChange={(event) => setAgreedPrice(event.target.value)} /></div><div><Label>Finanțare</Label><Select value={financingType} onValueChange={(value: NonNullable<SaleTransaction['financingType']>) => setFinancingType(value)}><SelectTrigger className="mt-1.5 h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit">Credit</SelectItem><SelectItem value="unknown">De stabilit</SelectItem></SelectContent></Select></div><div className="md:col-span-2"><Label>Notar (poate fi completat și ulterior)</Label><div className="mt-1.5 grid gap-3 md:grid-cols-2"><Input className="rounded-xl" value={notary.name || ''} onChange={(event) => setNotary((current) => ({ ...current, name: event.target.value }))} placeholder="Nume notar/birou" /><Input className="rounded-xl" type="email" value={notary.email || ''} onChange={(event) => setNotary((current) => ({ ...current, email: event.target.value }))} placeholder="Email notar" /><Input className="rounded-xl md:col-span-2" value={notary.address || ''} onChange={(event) => setNotary((current) => ({ ...current, address: event.target.value }))} placeholder="Adresă birou" /></div></div></div> : null}

            {step === 2 ? <div className="space-y-2">{checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4"><Checkbox checked={item.required} onCheckedChange={(checked) => setChecklist((current) => current.map((entry) => entry.id === item.id ? { ...entry, required: Boolean(checked), status: checked ? 'required' : entry.status } : entry))} /><div className="min-w-0 flex-1"><p className="font-medium">{item.label}</p><p className="text-xs text-[var(--app-muted-foreground)]">{item.participantRole === 'buyer' ? 'Cumpărător' : 'Proprietar'}</p></div></label>)}</div> : null}

            {step === 3 ? <div className="space-y-5"><div className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/8 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-600" /><div><p className="font-semibold">{readiness.ready ? 'Dosarul poate fi activat' : 'Mai sunt informații lipsă'}</p><p className="text-sm text-[var(--app-muted-foreground)]">Completitudine estimată: {readiness.progress}%</p></div></div></div>{readiness.issues.length ? <div className="space-y-2">{readiness.issues.map((issue) => <div key={issue.id} className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm">Lipsește: {issue.label}</div>)}</div> : <div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4"><p className="text-xs text-[var(--app-muted-foreground)]">Părți</p><p className="mt-1 font-semibold">{buyer?.name} · {owner?.name}</p></div><div className="rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4"><p className="text-xs text-[var(--app-muted-foreground)]">Preț</p><p className="mt-1 font-semibold">{Number(agreedPrice).toLocaleString('ro-RO')} €</p></div><div className="rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4"><p className="text-xs text-[var(--app-muted-foreground)]">Acte necesare</p><p className="mt-1 font-semibold">{checklist.filter((item) => item.required).length}</p></div></div>}</div> : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4 md:px-6"><Button variant="ghost" className="rounded-xl" onClick={() => step ? setStep((current) => current - 1) : onOpenChange(false)}><ChevronLeft className="mr-1 h-4 w-4" />{step ? 'Înapoi' : 'Mai târziu'}</Button>{step < steps.length - 1 ? <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={next}>Continuă <ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={complete} disabled={!readiness.ready || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Activează dosarul</Button>}</div>
      </DialogContent>
    </Dialog>
  );
}
