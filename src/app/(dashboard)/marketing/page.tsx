'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Facebook,
  LineChart,
  Loader2,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  Pencil,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  Unplug,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MetaCampaignEditorDialog } from '@/components/marketing/MetaCampaignEditorDialog';
import type { MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus } from '@/lib/types';

type DashboardPayload = {
  status: MetaMarketingIntegrationPublicStatus;
  role?: 'admin' | 'agent';
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    activeCampaigns: number;
    draftCampaigns: number;
    errors: number;
    costPerLead: number | null;
  };
  campaigns: MetaMarketingCampaignDraft[];
};

type MetaAssetsPayload = {
  businesses: Array<{ id: string; name: string }>;
  adAccounts: Array<{ id: string; accountId?: string | null; name: string; currency?: string | null; timezoneName?: string | null }>;
  pages: Array<{
    id: string;
    name: string;
    instagramBusinessAccount?: { id: string; username?: string | null; name?: string | null } | null;
  }>;
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

function formatMoney(value: number, currency = 'RON') {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ro-RO').format(value || 0);
}

function formatStatusLabel(status: MetaMarketingCampaignDraft['status']) {
  const labels: Record<MetaMarketingCampaignDraft['status'], string> = {
    draft: 'Draft',
    ready: 'Pregatita',
    publishing: 'Se publica',
    published: 'Activa',
    paused: 'Pauzata',
    completed: 'Finalizata',
    deleted: 'Stearsa',
    error: 'Eroare',
  };
  return labels[status] || status;
}

function getStatusClass(status: MetaMarketingCampaignDraft['status']) {
  const classes: Record<MetaMarketingCampaignDraft['status'], string> = {
    draft: 'border-slate-400/25 bg-slate-400/12 text-slate-100',
    ready: 'border-sky-300/25 bg-sky-400/15 text-sky-100',
    publishing: 'border-cyan-300/25 bg-cyan-400/15 text-cyan-100',
    published: 'border-emerald-300/25 bg-emerald-400/15 text-emerald-100',
    paused: 'border-amber-300/25 bg-amber-400/15 text-amber-100',
    completed: 'border-violet-300/25 bg-violet-400/15 text-violet-100',
    deleted: 'border-slate-500/25 bg-slate-500/15 text-slate-200',
    error: 'border-rose-300/25 bg-rose-400/15 text-rose-100',
  };
  return classes[status] || classes.draft;
}

function formatObjectiveLabel(objective: MetaMarketingCampaignDraft['objective']) {
  const labels: Record<MetaMarketingCampaignDraft['objective'], string> = {
    leads: 'Lead-uri',
    messages: 'Mesaje',
    traffic: 'Trafic',
    calls: 'Apeluri',
  };
  return labels[objective] || objective;
}

function canPauseCampaign(status: MetaMarketingCampaignDraft['status']) {
  return status === 'ready' || status === 'published' || status === 'error';
}

function StatusBadge({ connected }: { connected?: boolean }) {
  return connected ? (
    <Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">
      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
      Conectat
    </Badge>
  ) : (
    <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/15">
      <Unplug className="mr-1 h-3.5 w-3.5" />
      Neconectat
    </Badge>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-xl">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-white/55">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingPage() {
  const { user } = useUser();
  const auth = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [assets, setAssets] = useState<MetaAssetsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [hasAutoLoadedAssets, setHasAutoLoadedAssets] = useState(false);
  const [activeAction, setActiveAction] = useState<'connect' | 'disconnect' | 'assets' | 'save' | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedAdAccountId, setSelectedAdAccountId] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [editingCampaign, setEditingCampaign] = useState<MetaMarketingCampaignDraft | null>(null);
  const [campaignAction, setCampaignAction] = useState<{ id: string; type: 'pause' | 'delete' } | null>(null);

  const isAdmin = dashboard?.role === 'admin';
  const status = dashboard?.status;
  const selectedCurrency = status?.selectedAdAccount?.currency || 'RON';

  async function loadDashboard() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/dashboard', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca modulul Marketing.');
      }
      setDashboard(payload);
      setSelectedBusinessId(payload.status?.selectedBusiness?.id || '');
      setSelectedAdAccountId(payload.status?.selectedAdAccount?.id || '');
      setSelectedPageId(payload.status?.selectedPage?.id || '');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Marketing indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut incarca statusul Meta.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssets() {
    if (!user) return;
    setHasAutoLoadedAssets(true);
    setIsAssetsLoading(true);
    setActiveAction('assets');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/assets', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca asset-urile Meta.');
      }
      setAssets(payload);
      if (!selectedBusinessId && payload.businesses?.[0]?.id) setSelectedBusinessId(payload.businesses[0].id);
      if (!selectedAdAccountId && payload.adAccounts?.[0]?.id) setSelectedAdAccountId(payload.adAccounts[0].id);
      if (!selectedPageId && payload.pages?.[0]?.id) setSelectedPageId(payload.pages[0].id);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Asset-uri indisponibile',
        description: error instanceof Error ? error.message : 'Nu am putut incarca Business/Ad Account/Page.',
      });
    } finally {
      setIsAssetsLoading(false);
      setActiveAction(null);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [user]);

  useEffect(() => {
    if (!user || !status?.connected || assets || hasAutoLoadedAssets) return;
    void loadAssets();
  }, [user, status?.connected, assets, hasAutoLoadedAssets]);

  useEffect(() => {
    const meta = searchParams?.get('meta');
    const message = searchParams?.get('message');
    if (meta === 'connected') {
      toast({ title: 'Meta conectat', description: 'Alege acum Business, Ad Account si Page pentru campanii.' });
      void loadDashboard();
    }
    if (meta === 'error') {
      toast({
        variant: 'destructive',
        title: 'Conectare Meta esuata',
        description: message || 'Meta nu a finalizat autorizarea.',
      });
    }
  }, [searchParams]);

  const connectedButUnconfigured = Boolean(status?.connected && (!status.selectedBusiness || !status.selectedAdAccount || !status.selectedPage));

  const latestCampaigns = useMemo(() => dashboard?.campaigns || [], [dashboard?.campaigns]);

  async function handleConnect() {
    if (!user || !isAdmin) return;
    setActiveAction('connect');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/connect', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.authorizationUrl !== 'string') {
        throw new Error(payload?.message || 'Nu am putut porni conectarea Meta.');
      }
      window.location.href = payload.authorizationUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Conectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut porni OAuth Meta.',
      });
      setActiveAction(null);
    }
  }

  async function handleDisconnect() {
    if (!user || !isAdmin) return;
    setActiveAction('disconnect');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/disconnect', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut deconecta Meta.');
      }
      setAssets(null);
      await loadDashboard();
      toast({ title: 'Meta deconectat', description: 'Conexiunea Meta a fost oprita pentru aceasta agentie.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Deconectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut deconecta Meta.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSaveAssets() {
    if (!user || !isAdmin) return;
    setActiveAction('save');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/assets', {
        method: 'POST',
        body: JSON.stringify({
          businessId: selectedBusinessId,
          adAccountId: selectedAdAccountId,
          pageId: selectedPageId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut salva selectia Meta.');
      }
      await loadDashboard();
      toast({ title: 'Selectie Meta salvata', description: 'Campaniile vor folosi asset-urile selectate.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva asset-urile Meta.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  function upsertCampaign(campaign: MetaMarketingCampaignDraft) {
    setDashboard((current) => {
      if (!current) return current;
      const exists = current.campaigns.some((item) => item.id === campaign.id);
      return {
        ...current,
        campaigns: exists
          ? current.campaigns.map((item) => item.id === campaign.id ? campaign : item)
          : [campaign, ...current.campaigns],
      };
    });
    setEditingCampaign(campaign);
  }

  async function handlePauseCampaign(campaign: MetaMarketingCampaignDraft) {
    if (!user || campaignAction) return;
    setCampaignAction({ id: campaign.id, type: 'pause' });
    try {
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${campaign.id}/pause`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut pune campania in pauza.');
      }
      const updatedCampaign = payload.campaign as MetaMarketingCampaignDraft;
      setDashboard((current) => current
        ? {
          ...current,
          campaigns: current.campaigns.map((item) => item.id === updatedCampaign.id ? updatedCampaign : item),
        }
        : current);
      toast({ title: 'Campanie pusa in pauza', description: 'Campania nu mai este marcata ca activa.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Pauza esuata',
        description: error instanceof Error ? error.message : 'Nu am putut pune campania in pauza.',
      });
    } finally {
      setCampaignAction(null);
    }
  }

  async function handleDeleteCampaign(campaign: MetaMarketingCampaignDraft) {
    if (!user || campaignAction) return;
    const isPublished = campaign.status === 'published';
    const confirmed = window.confirm(
      isPublished
        ? 'Stergi aceasta campanie si o opresti din Meta daca a fost publicata? Actiunea nu poate fi anulata.'
        : 'Stergi acest draft de campanie? Actiunea nu poate fi anulata.'
    );
    if (!confirmed) return;

    setCampaignAction({ id: campaign.id, type: 'delete' });
    try {
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${campaign.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut sterge campania.');
      }
      setDashboard((current) => current
        ? {
          ...current,
          campaigns: current.campaigns.filter((item) => item.id !== campaign.id),
        }
        : current);
      if (editingCampaign?.id === campaign.id) setEditingCampaign(null);
      toast({ title: 'Campanie stearsa', description: 'Campania a fost eliminata din lista.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Stergere esuata',
        description: error instanceof Error ? error.message : 'Nu am putut sterge campania.',
      });
    } finally {
      setCampaignAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
        <Skeleton className="h-12 w-72 bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl bg-white/10" />)}
        </div>
        <Skeleton className="h-[420px] rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="agentfinder-marketing-page min-h-full space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
            <Megaphone className="mr-2 h-4 w-4" />
            Marketing
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Promovare Meta pentru proprietati</h1>
          <p className="max-w-3xl text-white/70">
            Conecteaza Business Manager-ul agentiei, alege contul de reclame si pregateste campanii Housing pentru fiecare proprietate.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reimprospateaza
          </Button>
          {status?.connected ? (
            <Button
              type="button"
              variant="outline"
              disabled={!isAdmin || activeAction === 'disconnect'}
              className="rounded-full border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
              onClick={() => void handleDisconnect()}
            >
              {activeAction === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
              Deconecteaza
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!isAdmin || activeAction === 'connect'}
              className="rounded-full bg-emerald-400 px-6 text-black hover:bg-emerald-300"
              onClick={() => void handleConnect()}
            >
              {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Conecteaza Meta
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={CircleDollarSign} label="Spend" value={formatMoney(dashboard?.totals.spend || 0, selectedCurrency)} helper="Din campaniile urmarite" />
        <KpiCard icon={Target} label="Lead-uri" value={formatNumber(dashboard?.totals.leads || 0)} helper="Atribuite campaniilor Meta" />
        <KpiCard icon={MousePointerClick} label="Click-uri" value={formatNumber(dashboard?.totals.clicks || 0)} helper="Trafic catre proprietati" />
        <KpiCard icon={LineChart} label="Cost / lead" value={dashboard?.totals.costPerLead ? formatMoney(dashboard.totals.costPerLead, selectedCurrency) : '-'} helper="Media pe campanii" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Facebook className="h-5 w-5 text-[#9cc7ff]" />
                  Conexiune Meta
                </CardTitle>
                <CardDescription className="mt-2 text-white/65">
                  OAuth Business Login, Marketing API si asset-uri selectate pentru agentie.
                </CardDescription>
              </div>
              <StatusBadge connected={status?.connected} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Utilizator Meta</p>
                <p className="mt-2 font-semibold text-white">{status?.metaUserName || 'Neconectat'}</p>
                <p className="mt-1 text-sm text-white/55">{status?.metaUserId || 'Conectarea se face de catre adminul agentiei.'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Business</p>
                  <p className="mt-2 text-sm font-semibold text-white">{status?.selectedBusiness?.name || 'Neselectat'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Ad Account</p>
                  <p className="mt-2 text-sm font-semibold text-white">{status?.selectedAdAccount?.name || 'Neselectat'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Page</p>
                  <p className="mt-2 text-sm font-semibold text-white">{status?.selectedPage?.name || 'Neselectata'}</p>
                </div>
              </div>
            </div>

            {status?.lastError ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <AlertTriangle className="mb-2 h-4 w-4" />
                {status.lastError}
              </div>
            ) : null}

            {connectedButUnconfigured ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Conexiunea exista, dar trebuie aleasa combinatia Business + Ad Account + Page inainte de campanii.
              </div>
            ) : null}

            <Separator className="bg-white/10" />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">Alege conturile folosite la reclame</p>
                  <p className="text-sm text-white/60">Selecteaza Business Manager-ul, contul de reclame si pagina care apare in anunturi.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!status?.connected || isAssetsLoading}
                  className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void loadAssets()}
                >
                  {activeAction === 'assets' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Actualizeaza lista Meta
                </Button>
              </div>

              {assets ? (
                <div className="grid gap-3">
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">1. Business Manager</p>
                      <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                        <SelectTrigger className="h-11 rounded-xl border-white/15 bg-white/10 text-white">
                          <SelectValue placeholder="Alege Business Portfolio" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.businesses.map((business) => (
                            <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">2. Cont de reclame</p>
                      <Select value={selectedAdAccountId} onValueChange={setSelectedAdAccountId}>
                        <SelectTrigger className="h-11 rounded-xl border-white/15 bg-white/10 text-white">
                          <SelectValue placeholder="Alege Ad Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.adAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} {account.currency ? `(${account.currency})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">3. Pagina Facebook</p>
                      <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                        <SelectTrigger className="h-11 rounded-xl border-white/15 bg-white/10 text-white">
                          <SelectValue placeholder="Alege Facebook Page" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.pages.map((page) => (
                            <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={!isAdmin || !selectedBusinessId || !selectedAdAccountId || !selectedPageId || activeAction === 'save'}
                    className="rounded-full bg-emerald-400 text-black hover:bg-emerald-300"
                    onClick={() => void handleSaveAssets()}
                  >
                    {activeAction === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Salveaza selectia
                  </Button>
                </div>
              ) : status?.connected ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/60">
                  {isAssetsLoading ? 'Se cauta Business Manager, Ad Account si Page in contul Meta conectat...' : 'Apasa Actualizeaza lista Meta daca optiunile nu apar automat.'}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Campanii Meta</CardTitle>
            <CardDescription className="text-white/65">
              Campaniile sunt pregatite pentru categoria speciala Housing si legate de proprietati.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestCampaigns.length ? (
              <div className="space-y-3">
                {latestCampaigns.map((campaign) => {
                  const actionType = campaignAction?.id === campaign.id ? campaignAction.type : null;
                  const canPause = canPauseCampaign(campaign.status);

                  return (
                    <div
                      key={campaign.id}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0F1E33]/80 shadow-lg shadow-black/10 transition hover:border-emerald-300/25 hover:bg-[#142844]"
                    >
                      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`rounded-full border px-3 py-1 text-xs font-semibold hover:bg-transparent ${getStatusClass(campaign.status)}`}>
                              {formatStatusLabel(campaign.status)}
                            </Badge>
                            <Badge className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15">
                              HOUSING
                            </Badge>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                              {formatObjectiveLabel(campaign.objective)}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <p className="line-clamp-1 text-base font-semibold text-white">
                              {campaign.headline || campaign.campaignName || 'Campanie fara titlu'}
                            </p>
                            <p className="line-clamp-2 text-sm leading-6 text-white/60">
                              {campaign.primaryText || 'Textul reclamei nu este completat.'}
                            </p>
                          </div>

                          <div className="grid gap-2 text-sm sm:grid-cols-4">
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Buget</p>
                              <p className="mt-1 font-semibold text-white">{formatMoney(campaign.budgetAmount, campaign.currency)}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Durata</p>
                              <p className="mt-1 font-semibold text-white">{campaign.durationDays} zile</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Click-uri</p>
                              <p className="mt-1 font-semibold text-white">{formatNumber(campaign.insights?.clicks || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Lead-uri</p>
                              <p className="mt-1 font-semibold text-white">{formatNumber(campaign.insights?.leads || 0)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => setEditingCampaign(campaign)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editeaza
                          </Button>
                          {campaign.status === 'paused' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled
                              className="rounded-full border-amber-300/20 bg-amber-400/10 text-amber-100 opacity-70"
                            >
                              <PauseCircle className="mr-2 h-3.5 w-3.5" />
                              Pauzata
                            </Button>
                          ) : canPause ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={Boolean(campaignAction)}
                              className="rounded-full border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15 disabled:opacity-45"
                              onClick={() => void handlePauseCampaign(campaign)}
                            >
                              {actionType === 'pause' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="mr-2 h-3.5 w-3.5" />}
                              Pauza
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={Boolean(campaignAction)}
                            className="rounded-full border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15"
                            onClick={() => void handleDeleteCampaign(campaign)}
                          >
                            {actionType === 'delete' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                            Sterge
                          </Button>
                        </div>
                      </div>

                      <div className="grid border-t border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/60 sm:grid-cols-3">
                        <span>Spend: <b className="text-white">{formatMoney(campaign.insights?.spend || 0, campaign.currency)}</b></span>
                        <span>Impresii: <b className="text-white">{formatNumber(campaign.insights?.impressions || 0)}</b></span>
                        <span>Cost / lead: <b className="text-white">{campaign.insights?.costPerLead ? formatMoney(campaign.insights.costPerLead, campaign.currency) : '-'}</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
                <Building2 className="h-10 w-10 text-white/45" />
                <h3 className="mt-4 text-lg font-semibold text-white">Nu exista campanii inca</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
                  Deschide o proprietate si foloseste cardul Meta Ads pentru a pregati prima campanie.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/10 bg-[#10261f] text-white shadow-xl">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-semibold">Pregatit pentru produs real, App Review dupa testare</p>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
              Fluxul este multi-agentie: fiecare client isi conecteaza propriul Business Manager, Ad Account si Page. Publicarea live a reclamelor se activeaza dupa ce App Review aproba permisiunile `ads_management`, `ads_read`, `business_management`, `pages_show_list` si `pages_read_engagement`.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
              Meta Developers
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <MetaCampaignEditorDialog
        open={Boolean(editingCampaign)}
        campaign={editingCampaign}
        pageName={status?.selectedPage?.name || 'ImoDeus'}
        fallbackTitle={editingCampaign?.headline || 'Proprietate ImoDeus'}
        onOpenChange={(open) => {
          if (!open) setEditingCampaign(null);
        }}
        onSaved={upsertCampaign}
        onReady={(campaignId) => {
          setDashboard((current) => current
            ? {
              ...current,
              campaigns: current.campaigns.map((campaign) => campaign.id === campaignId ? { ...campaign, status: 'ready' } : campaign),
            }
            : current);
          setEditingCampaign(null);
        }}
        onPublished={upsertCampaign}
      />
    </div>
  );
}
