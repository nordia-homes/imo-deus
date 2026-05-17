'use client';

import { useMemo, useState } from 'react';
import { Bot, CalendarClock, CheckCircle2, Loader2, PhoneCall, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getAiOutreachOutcomeMeta } from '@/lib/ai-outreach/status';
import type { AiOutreachCall } from '@/lib/ai-outreach/types';
import type { OwnerListing } from '@/components/owner-listings/types';
import { cn } from '@/lib/utils';

type AiOutreachCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: OwnerListing | null;
  latestCall?: AiOutreachCall | null;
  onCallCreated?: (call: AiOutreachCall) => void;
};

const toneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
};

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_16px_38px_-32px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.03] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 min-h-5 text-sm font-medium text-slate-900">{value || '-'}</p>
    </div>
  );
}

export function AiOutreachCallModal({ open, onOpenChange, listing, latestCall, onCallCreated }: AiOutreachCallModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const meta = getAiOutreachOutcomeMeta(latestCall?.outcome || listing?.aiOutreachOutcome);
  const hasCall = Boolean(latestCall);
  const result = latestCall?.result;

  const transcript = useMemo(() => latestCall?.transcript?.trim() || 'Transcriptul va aparea aici dupa finalizarea apelului.', [latestCall?.transcript]);

  const createCall = async (scheduledAt?: string | null) => {
    if (!listing || !user) return;
    if (scheduledAt) {
      setIsScheduling(true);
    } else {
      setIsStarting(true);
    }

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/ai-outreach/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerListing: {
            id: listing.id,
            title: listing.title,
            price: listing.price,
            location: listing.location,
            link: listing.link,
            ownerPhone: listing.ownerPhone,
            description: listing.description,
          },
          scheduledAt: scheduledAt || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut porni apelul AI.');
      }

      onCallCreated?.(payload.call as AiOutreachCall);
      toast({
        title: scheduledAt ? 'Apel AI programat' : payload.warning ? 'Apel salvat, integrare neconfigurata' : 'Apel AI pornit',
        description: scheduledAt
          ? `Apelul AI este programat pentru ${new Date(scheduledAt).toLocaleString('ro-RO')}.`
          : payload.warning || 'Statusul se va actualiza automat dupa webhook-ul Vapi.',
      });
      if (scheduledAt) {
        setScheduledDate('');
        setScheduledTime('');
      }
    } catch (error) {
      toast({
        title: scheduledAt ? 'Programare esuata' : 'Apel AI esuat',
        description: error instanceof Error ? error.message : scheduledAt ? 'Nu am putut programa apelul.' : 'Nu am putut porni apelul.',
        variant: 'destructive',
      });
    } finally {
      if (scheduledAt) {
        setIsScheduling(false);
      } else {
        setIsStarting(false);
      }
    }
  };

  const handleStartCall = () => createCall(null);

  const handleScheduleCall = () => {
    if (!scheduledDate || !scheduledTime) {
      toast({
        title: 'Alege data si ora',
        description: 'Completeaza ambele campuri pentru a programa apelul AI.',
        variant: 'destructive',
      });
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast({
        title: 'Programare invalida',
        description: 'Data sau ora aleasa nu este valida.',
        variant: 'destructive',
      });
      return;
    }

    createCall(scheduledAt.toISOString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden rounded-[2rem] border border-white/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f7fafc_46%,#f1f5f9_100%)] p-0 text-slate-950 shadow-[0_30px_90px_-36px_rgba(15,23,42,0.75)]">
        <DialogHeader className="relative overflow-hidden border-b border-slate-200/70 bg-white/88 px-7 py-6 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-slate-900" />
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]">
                  <Bot className="h-5 w-5" />
                </span>
                Apel AI proprietar
              </DialogTitle>
              <DialogDescription className="mt-2 truncate text-slate-500">{listing?.title || 'Anunt proprietar'}</DialogDescription>
            </div>
            <span className={cn('inline-flex shrink-0 items-center rounded-full border px-4 py-1.5 text-xs font-bold shadow-sm', toneClasses[meta.tone])}>
              {meta.label}
            </span>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92dvh-98px)] space-y-5 overflow-y-auto p-7">
          {!hasCall ? (
            <div className="rounded-[1.75rem] border border-emerald-200/90 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_34%),linear-gradient(135deg,rgba(236,253,245,0.96),rgba(240,253,250,0.92))] p-6 shadow-[0_24px_60px_-38px_rgba(6,95,70,0.65)] ring-1 ring-white/70">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/88 text-emerald-700 shadow-[0_14px_30px_-22px_rgba(6,95,70,0.85)] ring-1 ring-emerald-200/70">
                  <PhoneCall className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-emerald-950">Pregatit pentru apel AI</h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    AI-ul va confirma disponibilitatea, adresa, programul de vizionari si va negocia comisionul in limitele setate de agentie.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Telefon proprietar" value={listing?.ownerPhone || 'Lipsa'} />
                <DetailRow label="Pret anunt" value={listing?.price} />
              </div>
              <Tabs defaultValue="now" className="mt-6 space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[1.35rem] border border-white/80 bg-white/80 p-1.5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.55)] ring-1 ring-emerald-950/[0.04] backdrop-blur">
                  <TabsTrigger
                    value="now"
                    className="h-12 rounded-2xl text-sm font-bold text-slate-800 transition-all data-[state=active]:!bg-sky-50 data-[state=active]:!text-sky-950 data-[state=active]:shadow-[0_18px_34px_-20px_rgba(37,99,235,0.5),inset_0_0_0_1px_rgba(14,165,233,0.32)] [&>svg]:text-sky-700 [&[data-state=active]>svg]:!text-sky-700"
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Suna imediat
                  </TabsTrigger>
                  <TabsTrigger
                    value="schedule"
                    className="h-12 rounded-2xl text-sm font-bold text-slate-800 transition-all data-[state=active]:!bg-indigo-50 data-[state=active]:!text-indigo-950 data-[state=active]:shadow-[0_18px_34px_-20px_rgba(79,70,229,0.45),inset_0_0_0_1px_rgba(99,102,241,0.26)] [&>svg]:text-indigo-700 [&[data-state=active]>svg]:!text-indigo-700"
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Programeaza
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="now" className="rounded-[1.35rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] ring-1 ring-emerald-950/[0.04]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-slate-700">
                      Agentul AI porneste apelul catre proprietar imediat ce confirmi.
                    </p>
                    <Button
                      onClick={handleStartCall}
                      disabled={isStarting || isScheduling || !listing?.ownerPhone}
                      className="h-12 shrink-0 rounded-full border border-sky-200 bg-sky-50 px-6 text-sm font-bold text-sky-950 shadow-[0_18px_38px_-22px_rgba(37,99,235,0.85),0_0_0_4px_rgba(59,130,246,0.10),0_0_30px_-14px_rgba(14,165,233,0.8)] ring-1 ring-white/80 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-950 hover:shadow-[0_22px_44px_-22px_rgba(37,99,235,0.95),0_0_0_5px_rgba(59,130,246,0.14),0_0_38px_-12px_rgba(14,165,233,0.9)] disabled:border-sky-100 disabled:!bg-sky-50 disabled:!text-sky-800 disabled:opacity-100 disabled:shadow-none disabled:ring-0"
                    >
                      {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                      Suna acum
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="rounded-[1.35rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04]">
                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="ai-call-date">Data</Label>
                      <Input id="ai-call-date" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-call-time">Ora</Label>
                      <Input id="ai-call-time" type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 shadow-inner" />
                    </div>
                    <Button
                      onClick={handleScheduleCall}
                      disabled={isStarting || isScheduling || !listing?.ownerPhone}
                      className="h-12 rounded-full border border-indigo-200 bg-indigo-50 px-6 text-sm font-bold text-indigo-950 shadow-[0_18px_38px_-22px_rgba(79,70,229,0.78),0_0_0_4px_rgba(99,102,241,0.10),0_0_30px_-14px_rgba(99,102,241,0.82)] ring-1 ring-white/80 hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-950 hover:shadow-[0_22px_44px_-22px_rgba(79,70,229,0.9),0_0_0_5px_rgba(99,102,241,0.14),0_0_38px_-12px_rgba(99,102,241,0.9)] disabled:border-indigo-100 disabled:!bg-indigo-50 disabled:!text-indigo-800 disabled:opacity-100 disabled:shadow-none disabled:ring-0"
                    >
                      {isScheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                      Programeaza
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <Tabs defaultValue="result" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-white">
                <TabsTrigger value="result">Rezultat</TabsTrigger>
                <TabsTrigger value="details">Detalii</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="result" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Outcome" value={meta.label} />
                  <DetailRow label="Comision acceptat" value={result?.acceptedCommissionValue || 'Nediscutat'} />
                  <DetailRow label="Adresa confirmata" value={result?.exactAddress} />
                  <DetailRow label="Program vizionari" value={result?.viewingAvailability} />
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/92 p-4 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04]">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Rezumat AI
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{latestCall?.summary || 'Rezumatul va fi disponibil dupa finalizarea apelului.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleStartCall} disabled={isStarting || !listing?.ownerPhone} variant="outline" className="rounded-full">
                    {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Relanseaza apel AI
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="details" className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Telefon proprietar" value={latestCall?.ownerPhone} />
                <DetailRow label="Numar apelant" value={latestCall?.callerNumber || 'Pool platforma'} />
                <DetailRow label="Agent" value={latestCall?.agentName} />
                <DetailRow label="Incercare" value={latestCall?.attemptNumber} />
                <DetailRow label="Creat la" value={latestCall?.createdAt ? new Date(latestCall.createdAt).toLocaleString('ro-RO') : null} />
                <DetailRow label="Programat la" value={latestCall?.scheduledAt ? new Date(latestCall.scheduledAt).toLocaleString('ro-RO') : null} />
                <DetailRow label="Durata" value={latestCall?.durationSeconds ? `${latestCall.durationSeconds}s` : null} />
                <DetailRow label="Vapi call ID" value={latestCall?.vapiCallId} />
                <DetailRow label="Eroare provider" value={latestCall?.providerErrorMessage} />
              </TabsContent>

              <TabsContent value="transcript">
                <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-white/80 bg-white/92 p-4 text-sm leading-6 text-slate-700 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.04]">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-slate-500" />
                    Conversatie
                  </div>
                  <p className="whitespace-pre-wrap">{transcript}</p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
