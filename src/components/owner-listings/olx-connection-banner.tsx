'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Link2,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ConnectionStatus =
  | 'not_configured'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'error';

type ConnectionPayload = {
  configured?: boolean;
  status?: ConnectionStatus;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  liveViewUrl?: string;
  expiresAt?: string | null;
  connected?: boolean;
  resumedJobs?: number;
  message?: string;
};

export function OlxConnectionBanner({ adminClassic = false }: { adminClassic?: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [configured, setConfigured] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<'start' | 'confirm' | 'disconnect' | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Autentificarea ImoDeus este necesara.');
    return user.getIdToken(true);
  }, [user]);

  const loadStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/owner-listings/olx-connection', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as ConnectionPayload;
      if (!response.ok) throw new Error(payload.message || 'Nu am putut verifica legatura OLX.');
      setConfigured(payload.configured !== false);
      setStatus(payload.status || 'disconnected');
      setLastError(payload.lastError || null);
    } catch (error) {
      setStatus('error');
      setLastError(error instanceof Error ? error.message : 'Nu am putut verifica legatura OLX.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'browserbase-disconnected') {
        void loadStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadStatus]);

  const runAction = async (nextAction: 'start' | 'confirm' | 'disconnect') => {
    setAction(nextAction);
    try {
      const token = await getToken();
      const response = await fetch('/api/owner-listings/olx-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: nextAction }),
      });
      const payload = await response.json().catch(() => ({})) as ConnectionPayload;
      if (!response.ok) throw new Error(payload.message || 'Conectarea OLX a esuat.');

      if (nextAction === 'start') {
        if (!payload.liveViewUrl) throw new Error('Fereastra securizata OLX nu este disponibila.');
        setLiveViewUrl(payload.liveViewUrl);
        setDialogOpen(true);
        setStatus('connecting');
        return;
      }

      if (nextAction === 'confirm') {
        setDialogOpen(false);
        setLiveViewUrl('');
        setStatus('connected');
        setLastError(null);
        toast({
          title: 'Cont OLX conectat',
          description: payload.resumedJobs
            ? `${payload.resumedJobs} anunturi din Prospectare au fost retrimise automat.`
            : 'Numerele OLX pot fi preluate pentru anunturile din Prospectare.',
        });
      } else {
        setStatus('disconnected');
        setLastError(null);
        toast({
          title: 'Cont OLX deconectat',
          description: 'Profilul cloud OLX al agentului a fost eliminat.',
        });
      }
      await loadStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Conectarea OLX a esuat.';
      setLastError(message);
      if (nextAction === 'confirm') {
        setStatus(liveViewUrl ? 'connecting' : 'error');
      }
      toast({
        title: nextAction === 'confirm' ? 'Conectarea nu este finalizata' : 'Conectare OLX esuata',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAction(null);
    }
  };

  const isConnected = status === 'connected';
  const needsReconnect = status === 'expired' || status === 'error';
  const Icon = isConnected
    ? CheckCircle2
    : needsReconnect
      ? AlertTriangle
      : configured
        ? Link2
        : Cloud;
  const title = isConnected
    ? 'Cont OLX conectat'
    : !configured
      ? 'Browserul cloud OLX necesita configurare'
      : needsReconnect
        ? 'Reconecteaza contul OLX'
        : 'Conecteaza contul OLX';
  const description = isConnected
    ? 'Numerele OLX se preiau automat doar pentru anunturile adaugate in Prospectare.'
    : !configured
      ? 'Administratorul platformei trebuie sa configureze profilurile cloud securizate.'
      : needsReconnect
        ? lastError || 'Sesiunea OLX a expirat si trebuie reinnoita.'
        : 'Pentru preluarea automata a numerelor din anunturile adaugate in Prospectare, autentifica-te direct pe OLX. ImoDeus nu iti salveaza parola.';

  return (
    <>
      <section
        aria-live="polite"
        className={cn(
          'flex flex-col gap-4 rounded-[1.4rem] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
          isConnected
            ? adminClassic
              ? 'border-emerald-400/25 bg-emerald-400/10 text-white'
              : 'border-emerald-200 bg-emerald-50 text-slate-900'
            : needsReconnect
              ? adminClassic
                ? 'border-amber-300/30 bg-amber-300/10 text-white'
                : 'border-amber-200 bg-amber-50 text-slate-900'
              : adminClassic
                ? 'border-white/12 bg-white/8 text-white'
                : 'border-slate-200 bg-white/85 text-slate-900',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isConnected
                ? 'bg-emerald-500 text-white'
                : needsReconnect
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-slate-900 text-white',
            )}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">{isLoading ? 'Verificam conexiunea OLX...' : title}</h2>
            <p className={cn('mt-1 text-sm leading-5', adminClassic ? 'text-white/68' : 'text-slate-600')}>
              {isLoading ? 'Profilul securizat al agentului este verificat.' : description}
            </p>
          </div>
        </div>

        {!isLoading && configured ? (
          <div className="flex shrink-0 items-center gap-2">
            {isConnected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runAction('start')}
                  disabled={Boolean(action)}
                  className={cn(
                    'rounded-full',
                    adminClassic && 'border-white/15 bg-white/10 text-white hover:bg-white/15',
                  )}
                >
                  {action === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Reconecteaza
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Deconecteaza OLX"
                  onClick={() => void runAction('disconnect')}
                  disabled={Boolean(action)}
                  className={cn('rounded-full', adminClassic && 'text-white/70 hover:bg-white/10 hover:text-white')}
                >
                  {action === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => void runAction('start')}
                disabled={Boolean(action)}
                className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {action === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {needsReconnect ? 'Reconecteaza OLX' : 'Conecteaza contul OLX'}
              </Button>
            )}
          </div>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setLiveViewUrl('');
        }}
      >
        <DialogContent className="h-[min(860px,92dvh)] max-w-[min(1180px,96vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
          <DialogHeader className="pr-10">
            <DialogTitle>Conecteaza contul OLX</DialogTitle>
            <DialogDescription>
              Autentifica-te direct in fereastra OLX. Parola nu este transmisa catre ImoDeus.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden rounded-2xl border bg-white">
            {liveViewUrl ? (
              <iframe
                title="Autentificare securizata OLX"
                src={liveViewUrl}
                className="h-full min-h-[520px] w-full"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            )}
          </div>
          <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
            <p className="text-xs text-muted-foreground">
              Dupa ce vezi contul tau OLX, confirma conectarea.
            </p>
            <Button
              type="button"
              onClick={() => void runAction('confirm')}
              disabled={action === 'confirm' || !liveViewUrl}
              className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {action === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Am terminat conectarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
