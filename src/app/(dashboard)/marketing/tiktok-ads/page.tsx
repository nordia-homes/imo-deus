'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Film,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type {
  TikTokAccountPermissionRecord,
  TikTokAdvertiserRecord,
  TikTokCapability,
  TikTokCapabilityResolution,
  TikTokOperationResult,
} from '@/lib/tiktok-ads/types';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import {
  missingRequiredFields,
  schemaDefaults,
  setSchemaFieldByCandidates,
  TikTokSchemaForm,
  type ClientJsonSchema,
} from '@/components/marketing/tiktok-ads/TikTokSchemaForm';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type WorkspaceOperation = {
  operationId: string;
  capability: TikTokCapability;
  advertiserId: string | null;
  propertyId: string | null;
  currentStep: string;
  status: 'in_progress' | 'succeeded' | 'failed' | 'pending_recovery';
  createdResourceIds: Array<{ resourceType: string; resourceId: string }>;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  recoverable: boolean;
  lastErrorCode: string | null;
  remoteOutcomeUnknown: boolean;
};

type Workspace = {
  status: {
    configured: boolean;
    connected: boolean;
    requiresReconnect?: boolean;
    capabilityDiscoveryStatus?: string;
    lastErrorCode?: string | null;
    readsEnabled: boolean;
    writesEnabled: boolean;
    spendMutationsEnabled: boolean;
  };
  role?: 'admin' | 'agent' | 'platform_admin';
  advertisers: TikTokAdvertiserRecord[];
  advertiserId: string | null;
  permissions: TikTokAccountPermissionRecord[];
  capabilities: TikTokCapabilityResolution[];
  schemas: Partial<Record<TikTokCapability, ClientJsonSchema>>;
  assets: Array<{
    id: string;
    name: string;
    url: string;
    thumbnailUrl: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    durationSeconds: number | null;
    updatedAt: string | null;
  }>;
  properties: Array<{ id: string; title: string; location: string | null; price: number | null }>;
  operations: WorkspaceOperation[];
};

const CAMPAIGN_HIDDEN = ['advertiser_id', 'advertiserId', 'operation_status', 'status'];
const ADGROUP_HIDDEN = [...CAMPAIGN_HIDDEN, 'campaign_id', 'campaignId'];
const VIDEO_HIDDEN = ['advertiser_id', 'advertiserId', 'video_url', 'source_url', 'file_url', 'url'];
const AD_HIDDEN = [...CAMPAIGN_HIDDEN, 'adgroup_id', 'ad_group_id', 'adgroupId', 'video_id', 'videoId', 'identity_id', 'identityId', 'tiktok_account_id'];
const REQUIRED_DRAFT_CAPABILITIES: TikTokCapability[] = [
  'SPARK_NEW_VIDEO_AD_ONLY',
  'TIKTOK_PERMISSION_READ',
  'CREATIVE_UPLOAD',
  'CAMPAIGN_CREATE',
  'ADGROUP_CREATE',
  'AD_CREATE',
];

function requestKey(prefix: string) {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

async function authorizedFetch(user: User, input: RequestInfo, init?: RequestInit) {
  const token = await user.getIdToken(true);
  return fetch(input, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error?.message || 'Operația TikTok Ads nu a putut fi finalizată.');
    Object.assign(error, { code: payload?.code || payload?.error?.code || null });
    throw error;
  }
  return payload;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
}

function statusStyle(status: WorkspaceOperation['status']) {
  if (status === 'succeeded') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'pending_recovery') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function findOfficialTikTokUrl(value: unknown): string | null {
  if (typeof value === 'string' && /^https:\/\//i.test(value)) {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com') ? value : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findOfficialTikTokUrl(child);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findOfficialTikTokUrl(child);
      if (found) return found;
    }
  }
  return null;
}

function mergeDefaults(defaults: Record<string, unknown>, current: Record<string, unknown>) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(current)) {
    const base = result[key];
    result[key] = base && value && typeof base === 'object' && typeof value === 'object' && !Array.isArray(base) && !Array.isArray(value)
      ? mergeDefaults(base as Record<string, unknown>, value as Record<string, unknown>)
      : value;
  }
  return result;
}

function seedInput(schema: ClientJsonSchema | undefined, current: Record<string, unknown>, candidates: string[], value: unknown) {
  return setSchemaFieldByCandidates(mergeDefaults(schemaDefaults(schema), current), schema, candidates, value);
}

export default function TikTokAdsCampaignPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialPropertyId = searchParams?.get('propertyId') || '';
  const initialAssetId = searchParams?.get('assetId') || '';
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [advertiserId, setAdvertiserId] = useState('');
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [identityId, setIdentityId] = useState('');
  const [campaignInput, setCampaignInput] = useState<Record<string, unknown>>({});
  const [adGroupInput, setAdGroupInput] = useState<Record<string, unknown>>({});
  const [videoInput, setVideoInput] = useState<Record<string, unknown>>({});
  const [adInput, setAdInput] = useState<Record<string, unknown>>({});
  const [draftKey, setDraftKey] = useState(() => requestKey('tiktok_draft'));
  const [lastDraft, setLastDraft] = useState<WorkspaceOperation | null>(null);
  const [activationProgress, setActivationProgress] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (preferredAdvertiserId?: string, preferredPropertyId?: string) => {
    if (!user) return;
    const query = new URLSearchParams();
    if (preferredAdvertiserId) query.set('advertiserId', preferredAdvertiserId);
    if (preferredPropertyId) query.set('propertyId', preferredPropertyId);
    const response = await authorizedFetch(user, `/api/marketing/tiktok-ads/workspace?${query.toString()}`);
    const payload = await responsePayload(response) as Workspace;
    setWorkspace(payload);
    setAdvertiserId((current) => preferredAdvertiserId || current || payload.advertiserId || '');
    setPropertyId((current) => preferredPropertyId || current || initialPropertyId || payload.properties[0]?.id || '');
    setAssetId((current) => current || initialAssetId || payload.assets[0]?.id || '');
    setIdentityId((current) => payload.permissions.some((permission) => permission.tiktokAccountId === current)
      ? current
      : payload.permissions.find((permission) => permission.verificationStatus === 'verified')?.tiktokAccountId || '');
    const recentDraft = payload.operations.find((operation) => operation.capability === 'SPARK_NEW_VIDEO_AD_ONLY' && operation.status === 'succeeded');
    if (recentDraft) setLastDraft(recentDraft);
  }, [initialAssetId, initialPropertyId, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        await loadWorkspace('', initialPropertyId);
      } catch (error) {
        if (!cancelled) toast({ variant: 'destructive', title: 'TikTok Ads indisponibil', description: error instanceof Error ? error.message : 'Workspace-ul nu a putut fi încărcat.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialPropertyId, loadWorkspace, toast, user]);

  const selectedProperty = workspace?.properties.find((property) => property.id === propertyId) || null;
  const selectedAsset = workspace?.assets.find((asset) => asset.id === assetId) || null;
  const selectedAdvertiser = workspace?.advertisers.find((advertiser) => advertiser.advertiserId === advertiserId) || null;
  const selectedIdentity = workspace?.permissions.find((permission) => permission.tiktokAccountId === identityId) || null;
  const canAdmin = workspace?.role === 'admin' || workspace?.role === 'platform_admin';

  useEffect(() => {
    if (!workspace) return;
    const propertyName = selectedProperty?.title || 'Proprietate Imodeus';
    const assetName = selectedAsset?.name || 'Video Imodeus';
    // Provider schemas arrive asynchronously and intentionally seed the editable draft state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCampaignInput((current) => seedInput(workspace.schemas.CAMPAIGN_CREATE, current, ['campaign_name', 'campaignName', 'name'], `TikTok · ${propertyName}`));
    setAdGroupInput((current) => seedInput(workspace.schemas.ADGROUP_CREATE, current, ['adgroup_name', 'ad_group_name', 'adgroupName', 'name'], `Audiență · ${propertyName}`));
    setVideoInput((current) => seedInput(workspace.schemas.CREATIVE_UPLOAD, current, ['video_name', 'file_name', 'name'], assetName));
    setAdInput((current) => {
      let next = seedInput(workspace.schemas.AD_CREATE, current, ['ad_name', 'adName', 'name'], `Reclamă · ${propertyName}`);
      next = setSchemaFieldByCandidates(next, workspace.schemas.AD_CREATE, ['only_show_as_ads', 'ads_only_mode', 'is_ads_only'], true);
      return next;
    });
  }, [selectedAsset?.id, selectedAsset?.name, selectedProperty?.id, selectedProperty?.title, workspace]);

  function updateDraftInput(setter: (value: Record<string, unknown>) => void, value: Record<string, unknown>) {
    setter(value);
    setDraftKey(requestKey('tiktok_draft'));
    setLastDraft(null);
  }

  async function runAction(name: string, action: () => Promise<void>) {
    setActiveAction(name);
    try {
      await action();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Operație TikTok nereușită', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setActiveAction(null);
    }
  }

  async function connect() {
    if (!user) return;
    await runAction('connect', async () => {
      const returnTo = `/marketing/tiktok-ads${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ''}`;
      const response = await authorizedFetch(user, `/api/marketing/tiktok-ads/connect?returnTo=${encodeURIComponent(returnTo)}`);
      const payload = await responsePayload(response);
      if (!payload.authorizationUrl) throw new Error('TikTok nu a returnat URL-ul OAuth.');
      window.location.assign(payload.authorizationUrl);
    });
  }

  async function refreshDiscovery() {
    if (!user) return;
    await runAction('discovery', async () => {
      await responsePayload(await authorizedFetch(user, '/api/marketing/tiktok-ads/capabilities', { method: 'POST', body: '{}' }));
      const synchronized = await responsePayload(await authorizedFetch(user, '/api/marketing/tiktok-ads/advertisers', { method: 'POST', body: JSON.stringify({ action: 'sync' }) })) as { advertisers?: TikTokAdvertiserRecord[] };
      await loadWorkspace(advertiserId, propertyId);
      if (!synchronized.advertisers?.length) {
        throw new Error('TikTok nu a returnat niciun advertiser autorizat. Reconectează contul și acordă acces la cel puțin un cont Ads Manager.');
      }
      toast({ title: 'TikTok sincronizat', description: 'Advertiserii și schemele MCP au fost actualizate.' });
    });
  }

  async function selectAdvertiser(nextAdvertiserId: string) {
    setAdvertiserId(nextAdvertiserId);
    setIdentityId('');
    if (!user || !canAdmin) {
      await loadWorkspace(nextAdvertiserId, propertyId);
      return;
    }
    await runAction('advertiser', async () => {
      await responsePayload(await authorizedFetch(user, '/api/marketing/tiktok-ads/advertisers', {
        method: 'POST',
        body: JSON.stringify({ action: 'select', advertiserId: nextAdvertiserId }),
      }));
      await loadWorkspace(nextAdvertiserId, propertyId);
    });
  }

  async function callOperation(
    capability: TikTokCapability,
    payload: Record<string, unknown>,
    idempotencyKey?: string,
    authorizationToken?: string
  ) {
    if (!user) throw new Error('Autentifică-te din nou.');
    const response = await authorizedFetch(user, '/api/marketing/tiktok-ads/operations', {
      method: 'POST',
      body: JSON.stringify({
        capability,
        advertiserId,
        propertyId: propertyId || null,
        payload,
        idempotencyKey: idempotencyKey || null,
        authorizationToken: authorizationToken || null,
        expectedVersion: selectedAdvertiser?.version ?? null,
      }),
    });
    return responsePayload(response) as Promise<TikTokOperationResult>;
  }

  async function reconcileAccount() {
    if (!advertiserId) return;
    await runAction('readiness', async () => {
      await callOperation('ADVERTISER_STATUS', {});
      await callOperation('BILLING_READINESS', {});
      await callOperation('TIKTOK_PERMISSION_RECONCILE', {});
      await loadWorkspace(advertiserId, propertyId);
      toast({ title: 'Eligibilitate verificată', description: 'Statusul, billing-ul și permisiunile TikTok au fost reconciliate.' });
    });
  }

  async function authorizeTikTokIdentity() {
    if (!advertiserId) return;
    await runAction('identity-authorize', async () => {
      const result = await callOperation('TIKTOK_ACCOUNT_AUTHORIZE', {}, requestKey('identity_authorize'));
      const authorizationUrl = findOfficialTikTokUrl(result.remoteResult);
      if (!authorizationUrl) {
        toast({ title: 'Autorizare inițiată', description: 'TikTok a înregistrat cererea. Reîmprospătează permisiunile după confirmarea din Business Center.' });
        return;
      }
      window.location.assign(authorizationUrl);
    });
  }

  const capabilityMap = useMemo(() => new Map(workspace?.capabilities.map((capability) => [capability.capability, capability]) || []), [workspace?.capabilities]);
  const unavailableCapabilities = REQUIRED_DRAFT_CAPABILITIES.filter((capability) => !capabilityMap.get(capability)?.executionAllowed);
  const missingFields = [
    ...missingRequiredFields(workspace?.schemas.CAMPAIGN_CREATE, campaignInput, new Set(CAMPAIGN_HIDDEN.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase())), 'Campanie · '),
    ...missingRequiredFields(workspace?.schemas.ADGROUP_CREATE, adGroupInput, new Set(ADGROUP_HIDDEN.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase())), 'Ad group · '),
    ...missingRequiredFields(workspace?.schemas.CREATIVE_UPLOAD, videoInput, new Set(VIDEO_HIDDEN.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase())), 'Video · '),
    ...missingRequiredFields(workspace?.schemas.AD_CREATE, adInput, new Set(AD_HIDDEN.map((key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase())), 'Reclamă · '),
  ];
  const canCreateDraft = Boolean(
    canAdmin
    && workspace?.status.writesEnabled
    && advertiserId
    && propertyId
    && assetId
    && identityId
    && unavailableCapabilities.length === 0
    && missingFields.length === 0
  );

  async function createDraft() {
    if (!canCreateDraft) return;
    await runAction('create-draft', async () => {
      const result = await callOperation('SPARK_NEW_VIDEO_AD_ONLY', {
        adsOnly: true,
        tiktokAccountId: identityId,
        permissionToolInput: {},
        campaign: campaignInput,
        adGroup: adGroupInput,
        video: { mediaAssetId: assetId, toolInput: videoInput },
        ad: adInput,
      }, draftKey);
      const operation: WorkspaceOperation = {
        operationId: result.operationId,
        capability: result.capability,
        advertiserId,
        propertyId,
        currentStep: 'completed',
        status: result.status === 'partial' ? 'pending_recovery' : result.status,
        createdResourceIds: result.createdResourceIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        recoverable: result.status !== 'succeeded',
        lastErrorCode: null,
        remoteOutcomeUnknown: result.status === 'pending_recovery',
      };
      setLastDraft(operation);
      await loadWorkspace(advertiserId, propertyId);
      toast({ title: 'Draft TikTok creat', description: 'Campania, ad group-ul și reclama sunt în DISABLE. Nu a pornit niciun spend.' });
    });
  }

  const draftResources = lastDraft?.createdResourceIds || [];
  const campaignId = draftResources.find((resource) => resource.resourceType === 'campaign')?.resourceId || '';
  const adgroupId = draftResources.find((resource) => resource.resourceType === 'adgroup')?.resourceId || '';
  const adId = draftResources.find((resource) => resource.resourceType === 'ad')?.resourceId || '';
  function resourcePayload(capability: TikTokCapability, candidates: string[], resourceId: string) {
    const schema = workspace?.schemas[capability];
    const payload = setSchemaFieldByCandidates({}, schema, candidates, resourceId);
    return Object.keys(payload).length ? payload : { [candidates[0]]: resourceId };
  }
  const activationReady = Boolean(
    canAdmin
    && workspace?.status.spendMutationsEnabled
    && selectedAdvertiser?.billingReadiness === 'ready'
    && campaignId
    && adgroupId
    && adId
    && ['CAMPAIGN_ACTIVATE', 'ADGROUP_RESUME', 'AD_RESUME'].every((capability) => capabilityMap.get(capability as TikTokCapability)?.executionAllowed)
  );

  async function authorizeAndExecute(capability: TikTokCapability, payload: Record<string, unknown>, idempotencyKey: string) {
    if (!user) throw new Error('Autentifică-te din nou.');
    const body = { capability, advertiserId, propertyId: propertyId || null, payload, idempotencyKey, expectedVersion: selectedAdvertiser?.version ?? null };
    const authorization = await responsePayload(await authorizedFetch(user, '/api/marketing/tiktok-ads/spend-authorization', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
    return callOperation(capability, payload, idempotencyKey, authorization.token);
  }

  async function activateDraft() {
    if (!activationReady || !lastDraft) return;
    await runAction('activate', async () => {
      const steps: Array<{ label: string; capability: TikTokCapability; payload: Record<string, unknown> }> = [
        { label: 'campania', capability: 'CAMPAIGN_ACTIVATE', payload: resourcePayload('CAMPAIGN_ACTIVATE', ['campaign_id', 'campaignId'], campaignId) },
        { label: 'ad group-ul', capability: 'ADGROUP_RESUME', payload: resourcePayload('ADGROUP_RESUME', ['adgroup_id', 'ad_group_id', 'adgroupId'], adgroupId) },
        { label: 'reclama', capability: 'AD_RESUME', payload: resourcePayload('AD_RESUME', ['ad_id', 'adId'], adId) },
      ];
      for (const step of steps) {
        setActivationProgress(`Se activează ${step.label}…`);
        await authorizeAndExecute(step.capability, step.payload, `activate:${lastDraft.operationId}:${step.capability}`);
      }
      setActivationProgress(null);
      await loadWorkspace(advertiserId, propertyId);
      toast({ title: 'Reclamă activată', description: 'TikTok poate începe livrarea după aprobarea review-ului.' });
    });
    setActivationProgress(null);
  }

  async function pauseDraftResources() {
    if (!lastDraft) return;
    await runAction('pause', async () => {
      const steps: Array<{ capability: TikTokCapability; payload: Record<string, unknown> }> = [
        { capability: 'AD_PAUSE', payload: resourcePayload('AD_PAUSE', ['ad_id', 'adId'], adId) },
        { capability: 'ADGROUP_PAUSE', payload: resourcePayload('ADGROUP_PAUSE', ['adgroup_id', 'ad_group_id', 'adgroupId'], adgroupId) },
        { capability: 'CAMPAIGN_PAUSE', payload: resourcePayload('CAMPAIGN_PAUSE', ['campaign_id', 'campaignId'], campaignId) },
      ];
      for (const step of steps) {
        await callOperation(step.capability, step.payload, `pause:${lastDraft.operationId}:${step.capability}`);
      }
      await loadWorkspace(advertiserId, propertyId);
      toast({ title: 'Livrare oprită', description: 'Reclama, ad group-ul și campania au fost trecute în DISABLE.' });
    });
  }

  if (loading) {
    return <div className="space-y-5 p-4 md:p-8"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-[520px] rounded-3xl" /></div>;
  }

  if (!workspace) {
    return <div className="p-8"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>TikTok Ads indisponibil</AlertTitle><AlertDescription>Reîncarcă pagina sau autentifică-te din nou.</AlertDescription></Alert></div>;
  }

  if (!workspace.status.connected) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <Button asChild variant="ghost"><Link href={propertyId ? `/properties/${propertyId}` : '/marketing'}><ArrowLeft className="mr-2 h-4 w-4" />Înapoi</Link></Button>
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-xl">
          <div className="bg-slate-950 p-8 text-white">
            <TikTokIcon className="h-10 w-10" />
            <h1 className="mt-5 text-3xl font-black">Conectează TikTok Ads</h1>
            <p className="mt-3 max-w-2xl text-white/65">Autorizarea oficială TikTok for Business MCP este necesară înainte de discovery, selectarea advertiserului și crearea reclamelor.</p>
          </div>
          <CardContent className="p-8">
            <Button onClick={() => void connect()} disabled={!canAdmin || activeAction === 'connect' || !workspace.status.configured} className="rounded-full bg-[#FF0050] px-6 text-white hover:bg-[#dc0045]">
              {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TikTokIcon className="mr-2 h-4 w-4" />}
              Conectează prin TikTok
            </Button>
            {!canAdmin ? <p className="mt-3 text-sm text-amber-700">Conectarea poate fi realizată numai de un administrator.</p> : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 -ml-3 text-white/70 hover:bg-white/10 hover:text-white"><Link href={propertyId ? `/properties/${propertyId}` : '/marketing'}><ArrowLeft className="mr-2 h-4 w-4" />Înapoi</Link></Button>
          <div className="flex items-center gap-3"><TikTokIcon className="h-9 w-9" /><div><h1 className="text-2xl font-black md:text-3xl">TikTok Ads · Only show as ads</h1><p className="mt-1 text-sm text-white/55">Paid traffic fără publicare organică.</p></div></div>
        </div>
        <Button variant="outline" disabled={!canAdmin || activeAction === 'discovery'} onClick={() => void refreshDiscovery()} className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          {activeAction === 'discovery' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizează TikTok
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: ShieldCheck, label: 'MCP', value: 'Conectat', ok: true },
          { icon: BadgeCheck, label: 'Advertiser', value: selectedAdvertiser?.status || selectedAdvertiser?.reviewStatus || 'Necunoscut', ok: Boolean(selectedAdvertiser?.authorized) },
          { icon: CircleDollarSign, label: 'Billing', value: selectedAdvertiser?.billingReadiness || 'unknown', ok: selectedAdvertiser?.billingReadiness === 'ready' },
          { icon: Rocket, label: 'Spend switch', value: workspace.status.spendMutationsEnabled ? 'Activ' : 'Oprit sigur', ok: workspace.status.spendMutationsEnabled },
        ].map(({ icon: Icon, label, value, ok }) => (
          <Card key={label} className="rounded-2xl"><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-xl p-2 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="truncate font-bold text-slate-900">{value}</p></div></CardContent></Card>
        ))}
      </div>

      {!canAdmin ? <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Mod consultare</AlertTitle><AlertDescription>Doar administratorii pot crea, activa sau opri reclame TikTok.</AlertDescription></Alert> : null}
      {!workspace.status.spendMutationsEnabled ? <Alert className="border-emerald-200 bg-emerald-50"><ShieldCheck className="h-4 w-4 text-emerald-700" /><AlertTitle className="text-emerald-900">Spend blocat operațional</AlertTitle><AlertDescription className="text-emerald-800">Poți crea și valida draftul în DISABLE. Activarea rămâne indisponibilă până la change control.</AlertDescription></Alert> : null}
      {!workspace.advertisers.length ? <Alert className="border-amber-200 bg-amber-50"><AlertTriangle className="h-4 w-4 text-amber-700" /><AlertTitle className="text-amber-950">Niciun advertiser TikTok autorizat</AlertTitle><AlertDescription className="text-amber-900">Apasă „Sincronizează TikTok”. Dacă lista rămâne goală, reconectează TikTok și acordă acces la un cont Ads Manager; fără advertiser, verificarea de billing și identitățile nu pot porni.</AlertDescription></Alert> : null}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>1. Resurse și eligibilitate</CardTitle><CardDescription>Selectează tenant-owned resources; backendul reverifică toate ID-urile.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><p className="text-sm font-bold">Advertiser</p><Select value={advertiserId} onValueChange={(value) => void selectAdvertiser(value)}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selectează advertiser" /></SelectTrigger><SelectContent>{workspace.advertisers.map((advertiser) => <SelectItem key={advertiser.advertiserId} value={advertiser.advertiserId}>{advertiser.name || advertiser.advertiserId}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><p className="text-sm font-bold">Proprietate</p><Select value={propertyId} onValueChange={(value) => { setPropertyId(value); setDraftKey(requestKey('tiktok_draft')); setLastDraft(null); void loadWorkspace(advertiserId, value); }}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selectează proprietatea" /></SelectTrigger><SelectContent>{workspace.properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><p className="text-sm font-bold">Video Imodeus</p><Select value={assetId} onValueChange={(value) => { setAssetId(value); setDraftKey(requestKey('tiktok_draft')); setLastDraft(null); }}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selectează video ready" /></SelectTrigger><SelectContent>{workspace.assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><p className="text-sm font-bold">Identitate TikTok</p><Select value={identityId} onValueChange={(value) => { setIdentityId(value); setDraftKey(requestKey('tiktok_draft')); setLastDraft(null); }}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Reconciliază permisiunile" /></SelectTrigger><SelectContent>{workspace.permissions.map((permission) => <SelectItem key={permission.tiktokAccountId} value={permission.tiktokAccountId}>{permission.username || permission.tiktokAccountId}</SelectItem>)}</SelectContent></Select></div>
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Button variant="outline" disabled={!advertiserId || activeAction === 'readiness'} onClick={() => void reconcileAccount()} className="rounded-full">{activeAction === 'readiness' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}Verifică status, billing și permisiuni</Button>
            <Button variant="outline" disabled={!canAdmin || !advertiserId || activeAction === 'identity-authorize' || !capabilityMap.get('TIKTOK_ACCOUNT_AUTHORIZE')?.executionAllowed} onClick={() => void authorizeTikTokIdentity()} className="rounded-full">{activeAction === 'identity-authorize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}Autorizează cont TikTok</Button>
            {selectedIdentity ? <><Badge variant="outline">Deliver ads: {selectedIdentity.deliverAds ? 'Da' : 'Nu'}</Badge><Badge variant="outline">Publish new: {selectedIdentity.publishAndManageNewVideos ? 'Da' : 'Nu'}</Badge><Badge variant="outline">Only show as ads: {selectedIdentity.onlyShowAsAds ? 'Da' : 'Nu'}</Badge><span className="text-xs text-slate-500">Verificat {formatDate(selectedIdentity.lastVerifiedAt)}</span></> : <span className="text-sm text-slate-500">Rulează verificarea pentru a încărca identitățile autorizate.</span>}
          </div>
        </CardContent>
      </Card>

      {selectedAsset ? <Card className="overflow-hidden rounded-3xl"><CardContent className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">{selectedAsset.thumbnailUrl ? (
        // Studio assets use signed/remote provider URLs that are not part of the static Next image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selectedAsset.thumbnailUrl} alt="" className="h-36 w-full rounded-2xl object-cover" />
      ) : <div className="flex h-36 items-center justify-center rounded-2xl bg-slate-950"><Film className="h-10 w-10 text-white/40" /></div>}<div className="flex flex-col justify-center"><p className="text-xs font-bold uppercase tracking-wider text-[#FF0050]">Asset selectat</p><h2 className="mt-1 text-xl font-black">{selectedAsset.name}</h2><p className="mt-2 text-sm text-slate-500">{[selectedAsset.mimeType, selectedAsset.durationSeconds ? `${selectedAsset.durationSeconds}s` : null, selectedAsset.sizeBytes ? `${(selectedAsset.sizeBytes / 1_048_576).toFixed(1)} MB` : null].filter(Boolean).join(' · ')}</p></div></CardContent></Card> : null}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>2. Configurația TikTok</CardTitle><CardDescription>Câmpurile provin din schemele MCP oficiale descoperite pentru contul conectat. ID-urile și statusul DISABLE sunt impuse server-side.</CardDescription></CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={['campaign', 'adgroup', 'video', 'ad']} className="space-y-3">
            <AccordionItem value="campaign" className="rounded-2xl border px-4"><AccordionTrigger><span className="flex items-center gap-2"><Megaphone className="h-4 w-4" />Campanie</span></AccordionTrigger><AccordionContent><TikTokSchemaForm schema={workspace.schemas.CAMPAIGN_CREATE} value={campaignInput} hiddenKeys={CAMPAIGN_HIDDEN} onChange={(value) => updateDraftInput(setCampaignInput, value)} /></AccordionContent></AccordionItem>
            <AccordionItem value="adgroup" className="rounded-2xl border px-4"><AccordionTrigger><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Ad group, buget și targeting</span></AccordionTrigger><AccordionContent><TikTokSchemaForm schema={workspace.schemas.ADGROUP_CREATE} value={adGroupInput} hiddenKeys={ADGROUP_HIDDEN} onChange={(value) => updateDraftInput(setAdGroupInput, value)} /></AccordionContent></AccordionItem>
            <AccordionItem value="video" className="rounded-2xl border px-4"><AccordionTrigger><span className="flex items-center gap-2"><Film className="h-4 w-4" />Upload video advertising</span></AccordionTrigger><AccordionContent><TikTokSchemaForm schema={workspace.schemas.CREATIVE_UPLOAD} value={videoInput} hiddenKeys={VIDEO_HIDDEN} onChange={(value) => updateDraftInput(setVideoInput, value)} /></AccordionContent></AccordionItem>
            <AccordionItem value="ad" className="rounded-2xl border px-4"><AccordionTrigger><span className="flex items-center gap-2"><TikTokIcon className="h-4 w-4" />Reclamă, CTA și destinație</span></AccordionTrigger><AccordionContent><TikTokSchemaForm schema={workspace.schemas.AD_CREATE} value={adInput} hiddenKeys={AD_HIDDEN} onChange={(value) => updateDraftInput(setAdInput, value)} /></AccordionContent></AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>3. Creare și lansare</CardTitle><CardDescription>Draftul este întotdeauna creat în DISABLE. Lansarea este o operație separată, confirmată și auditată.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {unavailableCapabilities.length ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Capability MCP indisponibil</AlertTitle><AlertDescription>{unavailableCapabilities.join(', ')}. Rulează sincronizarea sau reconectează TikTok.</AlertDescription></Alert> : null}
          {missingFields.length ? <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Completează câmpurile obligatorii</AlertTitle><AlertDescription>{missingFields.slice(0, 12).join(', ')}{missingFields.length > 12 ? ` și încă ${missingFields.length - 12}` : ''}.</AlertDescription></Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button disabled={!canCreateDraft || activeAction === 'create-draft'} onClick={() => void createDraft()} className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800">{activeAction === 'create-draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}Creează draft dezactivat</Button>
            {lastDraft && campaignId && adgroupId && adId ? (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button disabled={!activationReady || activeAction === 'activate'} className="rounded-full bg-[#FF0050] px-6 text-white hover:bg-[#dc0045]">{activeAction === 'activate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}Activează reclama</Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmi pornirea traficului plătit?</AlertDialogTitle><AlertDialogDescription>Această acțiune activează campania, ad group-ul și reclama pentru advertiserul {selectedAdvertiser?.name || advertiserId}. TikTok poate începe să genereze costuri după review. Bugetul și programul sunt cele afișate în configurație.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Anulează</AlertDialogCancel><AlertDialogAction onClick={() => void activateDraft()} className="bg-[#FF0050] hover:bg-[#dc0045]">Confirm și activează</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            ) : null}
            {lastDraft && campaignId && adgroupId && adId ? <Button variant="outline" disabled={!canAdmin || activeAction === 'pause'} onClick={() => void pauseDraftResources()} className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50">{activeAction === 'pause' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}Oprește toate nivelurile</Button> : null}
          </div>
          {activationProgress ? <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Loader2 className="h-4 w-4 animate-spin" />{activationProgress}</p> : null}
          {lastDraft ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="font-bold text-emerald-900">Draft disponibil · {lastDraft.operationId}</p></div><div className="mt-3 flex flex-wrap gap-2">{lastDraft.createdResourceIds.map((resource) => <Badge key={`${resource.resourceType}:${resource.resourceId}`} variant="outline" className="border-emerald-300 bg-white text-emerald-800">{resource.resourceType}: {resource.resourceId}</Badge>)}</div>{!workspace.status.spendMutationsEnabled ? <p className="mt-3 text-sm text-emerald-800">Pentru lansare, setează TIKTOK_SPEND_MUTATIONS_ENABLED=true prin change control și redeploy.</p> : selectedAdvertiser?.billingReadiness !== 'ready' ? <p className="mt-3 text-sm text-amber-800">Billing-ul trebuie reconciliat ca ready înainte de activare.</p> : null}</div> : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Istoric operațional</CardTitle><CardDescription>Ledger persistent pentru idempotency, partial failure și recovery.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {workspace.operations.length ? workspace.operations.map((operation) => (
            <div key={operation.operationId} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{operation.capability}</p><Badge variant="outline" className={statusStyle(operation.status)}>{operation.status}</Badge>{operation.remoteOutcomeUnknown ? <Badge variant="outline" className="border-amber-300 text-amber-800">recovery necesar</Badge> : null}</div><p className="mt-1 text-xs text-slate-500">{operation.operationId} · {formatDate(operation.updatedAt)} · pas: {operation.currentStep}</p></div><div className="flex flex-wrap gap-1">{operation.createdResourceIds.map((resource) => <Badge key={`${operation.operationId}:${resource.resourceType}:${resource.resourceId}`} variant="secondary">{resource.resourceType}</Badge>)}</div></div>
          )) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Prima operație TikTok Ads va apărea aici.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
