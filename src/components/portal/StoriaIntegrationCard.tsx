'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, PlugZap, RefreshCcw, Unplug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="agentfinder-integration-card shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-white">
            <img src="/storia-official-logo.svg" alt="storia.ro" className="h-5 w-auto max-w-[110px] object-contain" />
          </CardTitle>
          <span className={`flex items-center text-sm ${status?.connected ? 'text-green-400' : 'text-red-400'}`}>
            {status?.connected ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Unplug className="h-4 w-4 mr-1" />}
            {statusLabel}
          </span>
        </div>
        <CardDescription className="text-white/70">
          Ultima sincronizare: {lastSync}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-sm flex justify-between">
          <span className="text-white/70">Anunturi sincronizate:</span>
          <span className="font-medium">{listings}</span>
        </div>
        <div className="text-sm flex justify-between">
          <span className="text-white/70">Erori:</span>
          <span className="font-medium">{errors}</span>
        </div>

        {status?.connected ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-50">
            <p>Conectarea OAuth este activa pentru agentia ta.</p>
            <p>Conectat la: {status.connectedAt ? new Date(status.connectedAt).toLocaleString('ro-RO') : '-'}</p>
            <p>Ultimul refresh token: {status.lastTokenRefreshAt ? new Date(status.lastTokenRefreshAt).toLocaleString('ro-RO') : '-'}</p>
            <p>Promovari API: {status.hasVasScopes ? 'active' : 'necesita reconectare'}</p>
            <p>Lead-uri Storia: {status.hasLeadScopes ? 'active' : 'necesita reconectare'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
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
            className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white"
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
