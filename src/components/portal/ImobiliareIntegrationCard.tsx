'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, Unplug, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';

type IntegrationStatus = {
  connected: boolean;
  username?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
  lastError?: string | null;
  remoteAgentCount?: number;
  remoteAccountName?: string | null;
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
      throw new Error('Sesiunea Firebase nu mai este valida. Autentifica-te din nou si reconecteaza contul.');
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

export default function ImobiliareIntegrationCard({ listings, errors, lastSync, onStatusChange }: Props) {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isAdmin = status?.role === 'admin';

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
          const response = await authorizedFetch(user, auth, '/api/imobiliare/status', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut incarca statusul integrarii imobiliare.ro.');
        }
        if (isMounted) {
          setStatus(payload);
        }
      } catch (error) {
        if (isMounted) {
          setStatus({
            connected: false,
            lastError: error instanceof Error ? error.message : 'Nu am putut incarca statusul integrarii.',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Se verifica...';
    return status?.connected ? 'Conectat' : 'Deconectat';
  }, [isLoading, status?.connected]);

  async function handleConnect() {
    if (!user) return;
    if (!username.trim() || !password) {
      toast({ title: 'Date incomplete', description: 'Introdu username-ul si parola contului imobiliare.ro.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/connect', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Conectarea la imobiliare.ro a esuat.');
      }

      setPassword('');
      setStatus((current) => ({
        ...(current || { role: 'admin' }),
        ...payload,
        role: current?.role || 'admin',
      }));
      toast({ title: 'Cont conectat', description: 'Integrarea cu imobiliare.ro este activa pentru agentia ta.' });
      onStatusChange?.();
    } catch (error) {
      toast({
        title: 'Conectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut conecta acest cont.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/disconnect', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut deconecta integrarea.');
      }

      setStatus((current) => ({
        ...(current || {}),
        connected: false,
        username: null,
        connectedAt: null,
        remoteAgentCount: 0,
        remoteAccountName: null,
        lastError: null,
      }));
      toast({ title: 'Integrare deconectata', description: 'Contul imobiliare.ro a fost deconectat.' });
      onStatusChange?.();
    } catch (error) {
      toast({
        title: 'Deconectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut deconecta integrarea.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-white">Imobiliare.ro</CardTitle>
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
          <span className="text-white/70">Agenti remote:</span>
          <span className="font-medium">{status?.remoteAgentCount ?? 0}</span>
        </div>
        {errors > 0 ? (
          <div className="text-sm flex justify-between text-red-300">
            <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Erori la sincronizare:</span>
            <span className="font-medium">{errors}</span>
          </div>
        ) : null}
        {status?.connected ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-50">
            <p>Cont: {status.username || '-'}</p>
            <p>Nume cont: {status.remoteAccountName || '-'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
            Integrarea foloseste contul agentiei din imobiliare.ro si publica automat proprietatile din Imodeus.
          </div>
        )}

        {!status?.connected && isAdmin ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0F1E33] p-4">
            <div className="space-y-2">
              <Label htmlFor="imobiliare-username" className="text-white/80">Username / email</Label>
              <Input
                id="imobiliare-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
                placeholder="contul agentiei din imobiliare.ro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imobiliare-password" className="text-white/80">Parola</Label>
              <Input
                id="imobiliare-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
                placeholder="parola contului"
              />
            </div>
          </div>
        ) : null}

        {!isAdmin && !status?.connected ? (
          <p className="text-xs text-white/55">
            Doar administratorul agentiei poate conecta sau deconecta integrarea.
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="gap-2">
        {!status?.connected ? (
          <Button
            onClick={handleConnect}
            disabled={!isAdmin || isSubmitting || isLoading}
            className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Conecteaza
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={!isAdmin || isSubmitting}
            className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
            Deconecteaza
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
