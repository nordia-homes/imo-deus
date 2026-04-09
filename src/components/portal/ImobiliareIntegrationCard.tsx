'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, Unplug, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import type { ImobiliarePromotionSettings, ImobiliareSyncJobSummary } from '@/lib/types';

type IntegrationStatus = {
  connected: boolean;
  username?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
  lastError?: string | null;
  remoteAgentCount?: number;
  remoteAccountName?: string | null;
  role?: 'admin' | 'agent';
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
  lastReconcileAt?: string | null;
  lastReconcileSummary?: ImobiliareSyncJobSummary | null;
  lastRetryAt?: string | null;
  lastRetrySummary?: ImobiliareSyncJobSummary | null;
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
  const [activeAction, setActiveAction] = useState<'connect' | 'disconnect' | 'settings' | 'reconcile' | 'retry' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acpUrl, setAcpUrl] = useState('');
  const [performanceReportEmail, setPerformanceReportEmail] = useState('');
  const [promotionSettingsJson, setPromotionSettingsJson] = useState('{}');

  const isAdmin = status?.role === 'admin';

  useEffect(() => {
    setAcpUrl(status?.acpUrl || '');
    setPerformanceReportEmail(status?.performanceReportEmail || '');
    setPromotionSettingsJson(
      JSON.stringify(status?.defaultPromotionSettings || {}, null, 2)
    );
  }, [status?.acpUrl, status?.performanceReportEmail, status?.defaultPromotionSettings]);

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
    setActiveAction('connect');
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
      setActiveAction(null);
    }
  }

  async function handleDisconnect() {
    if (!user) return;
    setIsSubmitting(true);
    setActiveAction('disconnect');
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
      setActiveAction(null);
    }
  }

  async function handleSaveSettings() {
    if (!user || !isAdmin) return;

    let defaultPromotionSettings: ImobiliarePromotionSettings | null = null;
    try {
      const parsed = promotionSettingsJson.trim() ? JSON.parse(promotionSettingsJson) : {};
      defaultPromotionSettings = parsed && typeof parsed === 'object' ? parsed as ImobiliarePromotionSettings : null;
    } catch {
      toast({
        title: 'JSON invalid',
        description: 'Setarile implicite de promovare trebuie sa fie un JSON valid.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setActiveAction('settings');
    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/settings', {
        method: 'POST',
        body: JSON.stringify({
          acpUrl,
          performanceReportEmail,
          defaultPromotionSettings,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut salva setarile imobiliare.ro.');
      }

      setStatus((current) => current ? {
        ...current,
        ...payload,
      } : {
        connected: true,
        role: 'admin',
        ...payload,
      });
      toast({ title: 'Setari salvate', description: 'ACP URL, performance report si default promotions au fost actualizate.' });
    } catch (error) {
      toast({
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva setarile.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }

  async function handleRunJob(endpoint: '/api/imobiliare/reconcile' | '/api/imobiliare/retry', action: 'reconcile' | 'retry') {
    if (!user || !isAdmin) return;

    setIsSubmitting(true);
    setActiveAction(action);
    try {
      const response = await authorizedFetch(user, auth, endpoint, {
        method: 'POST',
        body: JSON.stringify({ limit: 10 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Jobul nu a putut fi pornit.');
      }

      setStatus((current) => current ? {
        ...current,
        ...(action === 'reconcile'
          ? { lastReconcileAt: payload.finishedAt, lastReconcileSummary: payload }
          : { lastRetryAt: payload.finishedAt, lastRetrySummary: payload }),
      } : current);

      toast({
        title: action === 'reconcile' ? 'Reconciliere terminata' : 'Retry terminat',
        description:
          action === 'reconcile'
            ? `Am scanat ${payload?.scanned ?? 0} proprietati si am actualizat ${payload?.updated ?? 0}.`
            : `Am reincercat ${payload?.retried ?? 0} proprietati si am actualizat ${payload?.updated ?? 0}.`,
      });
      onStatusChange?.();
    } catch (error) {
      toast({
        title: action === 'reconcile' ? 'Reconciliere esuata' : 'Retry esuat',
        description: error instanceof Error ? error.message : 'Nu am putut rula jobul.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }

  function renderSummary(summary?: ImobiliareSyncJobSummary | null) {
    if (!summary) {
      return 'Nerulat inca';
    }

    return `scanate ${summary.scanned}, actualizate ${summary.updated}, publicate ${summary.published}, nepublicate ${summary.unpublished}, erori ${summary.errors}, esecuri ${summary.failed}`;
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
            <p>ACP URL: {status.acpUrl || '-'}</p>
            <p>Raport performanta: {status.performanceReportEmail || '-'}</p>
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

        {status?.connected ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0F1E33] p-4">
            <div className="space-y-2">
              <Label htmlFor="imobiliare-acp-url" className="text-white/80">ACP URL</Label>
              <Input
                id="imobiliare-acp-url"
                value={acpUrl}
                onChange={(event) => setAcpUrl(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
                placeholder="https://..."
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imobiliare-performance-email" className="text-white/80">Email performance report</Label>
              <Input
                id="imobiliare-performance-email"
                value={performanceReportEmail}
                onChange={(event) => setPerformanceReportEmail(event.target.value)}
                className="bg-white/10 border-white/20 text-white"
                placeholder="rapoarte@agentie.ro"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imobiliare-default-promotions" className="text-white/80">Default promotion settings (JSON)</Label>
              <Textarea
                id="imobiliare-default-promotions"
                value={promotionSettingsJson}
                onChange={(event) => setPromotionSettingsJson(event.target.value)}
                className="min-h-32 bg-white/10 border-white/20 text-white"
                disabled={!isAdmin}
              />
            </div>
            {status?.acpUrl ? (
              <a
                href={status.acpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-emerald-300 underline underline-offset-4"
              >
                Deschide ACP
              </a>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <p>Ultima reconciliere: {renderSummary(status?.lastReconcileSummary)}</p>
              <p>Ultimul retry: {renderSummary(status?.lastRetrySummary)}</p>
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col gap-2">
        {status?.connected && isAdmin ? (
          <div className="grid w-full grid-cols-1 gap-2">
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSubmitting}
              className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white"
            >
              {activeAction === 'settings' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salveaza setari
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRunJob('/api/imobiliare/reconcile', 'reconcile')}
                disabled={isSubmitting}
                className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
              >
                {activeAction === 'reconcile' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reconciliaza
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRunJob('/api/imobiliare/retry', 'retry')}
                disabled={isSubmitting}
                className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
              >
                {activeAction === 'retry' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Retry erori
              </Button>
            </div>
          </div>
        ) : null}

        {!status?.connected ? (
          <Button
            onClick={handleConnect}
            disabled={!isAdmin || isSubmitting || isLoading}
            className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white"
          >
            {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Conecteaza
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={!isAdmin || isSubmitting}
            className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
          >
            {activeAction === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
            Deconecteaza
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
