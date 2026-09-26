'use client';

import { brandAssets } from '@/lib/brand-assets';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, Unplug, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import type {
  ImobiliareAgentMapping,
  ImobiliareAnalyticsSummary,
  ImobiliarePromotionSettings,
  ImobiliareSyncJobSummary,
} from '@/lib/types';

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
  agentMappings?: ImobiliareAgentMapping[] | null;
  analytics?: ImobiliareAnalyticsSummary | null;
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
  const [activeAction, setActiveAction] = useState<'connect' | 'disconnect' | 'settings' | 'reconcile' | 'retry' | 'agents' | null>(null);
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

  async function handleSyncAgents() {
    if (!user || !isAdmin) return;

    setIsSubmitting(true);
    setActiveAction('agents');
    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/agents/sync', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut sincroniza agentii.');
      }

      setStatus((current) => current ? {
        ...current,
        remoteAgentCount: payload?.totalRemoteAgents ?? current.remoteAgentCount,
        agentMappings: payload?.mappings ?? current.agentMappings,
      } : current);

      toast({
        title: 'Agenti sincronizati',
        description: `Am mapat ${payload?.mappedAgents ?? 0} agenti locali catre agentii remote.`,
      });
    } catch (error) {
      toast({
        title: 'Sincronizare agenti esuata',
        description: error instanceof Error ? error.message : 'Nu am putut sincroniza agentii.',
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
    <Card className="agentfinder-integration-card agentfinder-imobiliare-integration-card relative isolate flex h-full flex-col overflow-hidden rounded-[28px] border border-sky-200/70 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 text-slate-950 shadow-[0_28px_70px_-38px_rgba(14,165,233,0.55)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-sky-200/30 blur-2xl" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-16 min-w-[64px] max-w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/90 bg-white/85 px-3 py-2 shadow-sm">
              <img src={brandAssets.imobiliare} alt="imobiliare.ro" className="h-8 w-auto object-contain" />
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
        <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-500">
          <span>Agenti remote</span>
          <span>{status?.remoteAgentCount ?? 0}</span>
        </div>
        {status?.connected ? (
          <div className="rounded-2xl border border-white/80 bg-white/60 p-4 text-sm text-slate-600">
            <p>Cont: {status.username || '-'}</p>
            <p>Nume cont: {status.remoteAccountName || '-'}</p>
            <p>ACP URL: {status.acpUrl || '-'}</p>
            <p>Raport performanta: {status.performanceReportEmail || '-'}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/80 bg-white/60 p-4 text-sm text-slate-600">
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
              <p>
                Analytics: {status?.analytics
                  ? `${status.analytics.published} publicate, ${status.analytics.pending} pending, ${status.analytics.errors} cu erori, ${status.analytics.totalViews} vizualizari`
                  : 'fara date'}
              </p>
              <p>Mapari agenti: {status?.agentMappings?.length ?? 0}</p>
            </div>
            {status?.agentMappings?.length ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                {status.agentMappings.slice(0, 6).map((mapping) => (
                  <p key={`${mapping.localAgentId}-${mapping.remoteAgentId}`}>
                    {mapping.localAgentName || mapping.localAgentEmail || mapping.localAgentId}
                    {' -> '}
                    {mapping.remoteAgentName || mapping.remoteAgentEmail || mapping.remoteAgentId}
                  </p>
                ))}
              </div>
            ) : null}
            {status?.analytics?.topListings?.length ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                {status.analytics.topListings.map((listing) => (
                  <p key={listing.propertyId}>
                    {listing.title}: {listing.views} views, {listing.status}
                  </p>
                ))}
              </div>
            ) : null}
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
                onClick={handleSyncAgents}
                disabled={isSubmitting}
                className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
              >
                {activeAction === 'agents' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sync agenti
              </Button>
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
            </div>
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
        ) : null}

        {!status?.connected ? (
          <Button
            onClick={handleConnect}
            disabled={!isAdmin || isSubmitting || isLoading}
            className="w-full rounded-[18px] border-2 border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_20px_44px_-22px_rgba(16,185,129,0.9)] hover:bg-emerald-400"
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
