'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, PlugZap, RefreshCcw, Unplug, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';

type IntegrationStatus = {
  connected: boolean;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
  lastError?: string | null;
  hasVasScopes?: boolean;
  hasLeadScopes?: boolean;
  scope?: string | null;
  role?: 'admin' | 'agent';
};

type Props = {
  listings: number;
  errors: number;
  lastSync: string;
  onStatusChange?: () => void;
};

async function authorizedFetch(
  user: NonNullable<ReturnType<typeof useUser>['user']>,
  auth: ReturnType<typeof useAuth>,
  input: RequestInfo,
  init?: RequestInit
) {
  let token: string;
  try {
    token = await user.getIdToken(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('auth/invalid-credential') || message.includes('invalid-credential')) {
      await signOut(auth).catch(() => undefined);
      throw new Error('Sesiunea Firebase nu mai este valida. Autentifica-te din nou si reincearca.');
    }
    throw error;
  }
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export default function StoriaIntegrationCard({ listings, errors, lastSync, onStatusChange }: Props) {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<'connect' | 'disconnect' | 'refresh' | null>(null);

  const isAdmin = status?.role === 'admin';

  async function loadStatus() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authorizedFetch(user, auth, '/api/storia/status', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca statusul integrarii Storia.');
      }
      setStatus(payload);
    } catch (error) {
      setStatus({
        connected: false,
        lastError: error instanceof Error ? error.message : 'Nu am putut incarca statusul integrarii.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setIsLoading(false);
      return;
    }
    (async () => {
      if (!isMounted) return;
      await loadStatus();
    })();

    const handleFocus = () => {
      void loadStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Se verifica...';
    return status?.connected ? 'Conectat' : 'Deconectat';
  }, [isLoading, status?.connected]);

  async function handleConnect() {
    if (!user || !isAdmin) return;

    setIsSubmitting(true);
    setActiveAction('connect');
    try {
      const response = await authorizedFetch(user, auth, '/api/storia/connect', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.authorizationUrl !== 'string') {
        throw new Error(payload?.message || 'Nu am putut porni autorizarea Storia.');
      }

      window.open(payload.authorizationUrl, '_blank', 'noopener,noreferrer,width=760,height=860');
      toast({
        title: 'Autorizare pornita',
        description: 'Finalizeaza autorizarea in fereastra Storia, apoi intoarce-te aici. Statusul se va reimprospata automat.',
      });
    } catch (error) {
      toast({
        title: 'Conectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut porni fluxul OAuth pentru Storia.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }

  async function handleDisconnect() {
    if (!user || !isAdmin) return;

    setIsSubmitting(true);
    setActiveAction('disconnect');
    try {
      const response = await authorizedFetch(user, auth, '/api/storia/disconnect', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut deconecta integrarea Storia.');
      }

      setStatus((current) => ({
        ...(current || {}),
        connected: false,
        connectedAt: null,
        lastTokenRefreshAt: null,
        lastError: null,
      }));
      toast({ title: 'Integrare deconectata', description: 'Contul Storia a fost deconectat.' });
      onStatusChange?.();
    } catch (error) {
      toast({
        title: 'Deconectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut deconecta integrarea.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }

  async function handleRefresh() {
    setActiveAction('refresh');
    setIsLoading(true);
    await loadStatus();
    setActiveAction(null);
  }

  return (
    <Card className="agentfinder-integration-card relative isolate flex h-full flex-col overflow-hidden rounded-[28px] border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/80 to-fuchsia-50 text-slate-950 shadow-[0_28px_70px_-38px_rgba(139,92,246,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-violet-200/30 blur-2xl" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-16 min-w-[64px] max-w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/90 bg-white/85 px-3 py-2 shadow-sm">
              <img src="/storia-official-logo.svg" alt="storia.ro" className="h-8 w-auto object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Portal</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${status?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {status?.connected ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Unplug className="mr-1 h-4 w-4" />}
            {statusLabel}
          </span>
        </div>
        <CardDescription className="text-slate-500">
          Ultima sincronizare: {lastSync}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1.2fr_.8fr] gap-2">
          <div className="rounded-3xl border border-white/90 bg-white/85 p-4 shadow-[0_16px_38px_-26px_rgba(16,185,129,0.55)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Anunțuri live</p>
            <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950">{listings}</p>
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/70 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Lead-uri</p>
            <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-slate-950">0</p>
          </div>
        </div>
        {errors > 0 ? (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Necesită atenție</span>
            <span>{errors} erori</span>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Flux sănătos</span>
            <span>0 erori</span>
          </div>
        )}
        {status?.connected ? (
          <div className="rounded-2xl border border-white/80 bg-white/60 p-4 text-sm text-slate-600">
            <p>Conectarea OAuth este activa pentru agentia ta.</p>
            <p>Conectat la: {status.connectedAt ? new Date(status.connectedAt).toLocaleString('ro-RO') : '-'}</p>
            <p>Ultimul refresh token: {status.lastTokenRefreshAt ? new Date(status.lastTokenRefreshAt).toLocaleString('ro-RO') : '-'}</p>
            <p>Promovari API: {status.hasVasScopes ? 'active' : 'necesita reconectare'}</p>
            <p>Lead-uri Storia: {status.hasLeadScopes ? 'active' : 'necesita reconectare'}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/80 bg-white/60 p-4 text-sm text-slate-600">
            Integrarea Storia foloseste OAuth2 prin OLX Group. Conectarea se face o singura data per agentie, apoi proprietatile pot fi publicate direct din ImoDeus.
          </div>
        )}

        {status?.lastError ? (
          <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">
            {status.lastError}
          </div>
        ) : null}

        {status?.connected && status.hasVasScopes === false ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-50">
            Promovarile prin API au fost activate in aplicatia Storia, dar acest cont trebuie reconectat ca sa autorizeze noile scope-uri `read:vas` si `write:vas`.
          </div>
        ) : null}

        {status?.connected && status.hasLeadScopes === false ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-50">
            Lead scope este activat in aplicatia Storia, dar acest cont trebuie reconectat ca sa autorizeze noile permisiuni. Fara reconectare, mesajele nu vor intra in Inbox Storia.
          </div>
        ) : null}

        {!isAdmin ? (
          <p className="text-xs text-white/55">
            Doar administratorul agentiei poate conecta sau deconecta integrarea Storia.
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={isSubmitting || isLoading}
          className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
        >
          {activeAction === 'refresh' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Reincarca status
        </Button>

        {!status?.connected ? (
          <Button
            onClick={handleConnect}
            disabled={!isAdmin || isSubmitting || isLoading}
            className="w-full rounded-[18px] border-2 border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_20px_44px_-22px_rgba(16,185,129,0.9)] hover:bg-emerald-400"
          >
            {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Conecteaza Storia
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('https://www.storia.ro/ro/', '_blank', 'noopener,noreferrer')}
              className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Deschide Storia
            </Button>
            {status.hasVasScopes === false || status.hasLeadScopes === false ? (
              <Button
                onClick={handleConnect}
                disabled={!isAdmin || isSubmitting || isLoading}
                className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white"
              >
                {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                Reconecteaza pentru scope-uri
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={!isAdmin || isSubmitting}
              className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
            >
              {activeAction === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
              Deconecteaza
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
