'use client';

import { useMemo, useState } from 'react';
import { Bot, CalendarClock, CheckCircle2, Loader2, PhoneCall, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 min-h-5 text-sm font-medium text-slate-900">{value || '-'}</p>
    </div>
  );
}

export function AiOutreachCallModal({ open, onOpenChange, listing, latestCall, onCallCreated }: AiOutreachCallModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const meta = getAiOutreachOutcomeMeta(latestCall?.outcome || listing?.aiOutreachOutcome);
  const hasCall = Boolean(latestCall);
  const result = latestCall?.result;

  const transcript = useMemo(() => latestCall?.transcript?.trim() || 'Transcriptul va aparea aici dupa finalizarea apelului.', [latestCall?.transcript]);

  const handleStartCall = async () => {
    if (!listing || !user) return;
    setIsStarting(true);

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
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut porni apelul AI.');
      }

      onCallCreated?.(payload.call as AiOutreachCall);
      toast({
        title: payload.warning ? 'Apel salvat, integrare neconfigurata' : 'Apel AI pornit',
        description: payload.warning || 'Statusul se va actualiza automat dupa webhook-ul Vapi.',
      });
    } catch (error) {
      toast({
        title: 'Apel AI esuat',
        description: error instanceof Error ? error.message : 'Nu am putut porni apelul.',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto rounded-3xl border-slate-200 bg-slate-50 p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Bot className="h-5 w-5 text-emerald-600" />
                Apel AI proprietar
              </DialogTitle>
              <DialogDescription className="mt-2 truncate text-slate-500">{listing?.title || 'Anunt proprietar'}</DialogDescription>
            </div>
            <span className={cn('inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold', toneClasses[meta.tone])}>
              {meta.label}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {!hasCall ? (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <PhoneCall className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="font-semibold text-emerald-950">Anunt nesunat cu AI</h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    AI-ul va confirma disponibilitatea, adresa, programul de vizionari si va negocia comisionul in limitele setate de agentie.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Telefon proprietar" value={listing?.ownerPhone || 'Lipsa'} />
                <DetailRow label="Pret anunt" value={listing?.price} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={handleStartCall} disabled={isStarting || !listing?.ownerPhone} className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                  Suna acum cu AI
                </Button>
              </div>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
                <DetailRow label="Durata" value={latestCall?.durationSeconds ? `${latestCall.durationSeconds}s` : null} />
                <DetailRow label="Vapi call ID" value={latestCall?.vapiCallId} />
                <DetailRow label="Eroare provider" value={latestCall?.providerErrorMessage} />
              </TabsContent>

              <TabsContent value="transcript">
                <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
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
