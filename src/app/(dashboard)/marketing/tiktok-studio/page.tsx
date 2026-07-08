'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Film,
  Hash,
  Loader2,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Send,
  Sparkles,
  Unplug,
  Video,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth, useStorage, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { TikTokMarketingIntegrationPublicStatus, TikTokPostDraft, TikTokStudioAsset } from '@/lib/types';

type ReadyVideoTour = {
  source?: 'property_video_tour' | 'studio_asset';
  propertyId: string;
  assetId?: string | null;
  propertyTitle: string;
  propertyPrice?: string | null;
  propertyLocation?: string | null;
  videoTourUrl: string;
  videoTourThumbnailUrl?: string | null;
  generatedAt?: string | null;
  format?: string | null;
  style?: string | null;
  latestDraft?: TikTokPostDraft | null;
};

type CreatorInfo = {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

type DashboardPayload = {
  status: TikTokMarketingIntegrationPublicStatus;
  role?: 'admin' | 'agent';
  readyVideoTours: ReadyVideoTour[];
  drafts: TikTokPostDraft[];
  totals: {
    total: number;
    published: number;
    processing: number;
    errors: number;
  };
  config: {
    configured: boolean;
    redirectUri: string;
    privateModeOnly: boolean;
    defaultPrivacyLevel: string;
  };
  studioAssets?: TikTokStudioAsset[];
};

type PublishForm = {
  draftId: string | null;
  description: string;
  hashtags: string;
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  aiGeneratedContent: boolean;
};

const STATUS_LABELS: Record<TikTokPostDraft['status'], string> = {
  draft: 'Draft',
  ready: 'Pregatit',
  publishing: 'Se publica',
  processing: 'Procesare',
  published: 'Publicat',
  error: 'Eroare',
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

function getStatusClass(status: TikTokPostDraft['status']) {
  const classes: Record<TikTokPostDraft['status'], string> = {
    draft: 'border-white/15 bg-white/10 text-white',
    ready: 'border-sky-300/25 bg-sky-400/15 text-sky-100',
    publishing: 'border-cyan-300/25 bg-cyan-400/15 text-cyan-100',
    processing: 'border-violet-300/25 bg-violet-400/15 text-violet-100',
    published: 'border-emerald-300/25 bg-emerald-400/15 text-emerald-100',
    error: 'border-rose-300/25 bg-rose-400/15 text-rose-100',
  };
  return classes[status] || classes.draft;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ro-RO');
}

function splitHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.startsWith('#') ? item : `#${item}`);
}

export default function TikTokStudioPage() {
  const { user } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ReadyVideoTour | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [aiComposer, setAiComposer] = useState({
    title: 'Video AI pentru TikTok',
    script: '',
    voiceId: '',
    subtitleStyle: 'heygen_pink',
    aspectRatio: '9:16',
  });
  const [publishForm, setPublishForm] = useState<PublishForm>({
    draftId: null,
    description: '',
    hashtags: '',
    privacyLevel: 'SELF_ONLY',
    disableComment: false,
    disableDuet: false,
    disableStitch: false,
    aiGeneratedContent: true,
  });

  const connected = Boolean(dashboard?.status.connected);
  const privacyOptions = creatorInfo?.privacy_level_options?.length
    ? creatorInfo.privacy_level_options
    : [dashboard?.config.defaultPrivacyLevel || 'SELF_ONLY'];

  async function loadDashboard() {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/dashboard', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut incarca TikTok Studio.');
      setDashboard(payload);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'TikTok Studio indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut incarca modulul TikTok.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCreatorInfo() {
    if (!user || !connected) return null;
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/creator-info', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut incarca informatiile creatorului TikTok.');
      setCreatorInfo(payload.creatorInfo || null);
      return payload.creatorInfo as CreatorInfo;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Creator info indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut verifica optiunile TikTok.',
      });
      return null;
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [user]);

  useEffect(() => {
    const tiktok = searchParams?.get('tiktok');
    const message = searchParams?.get('message');
    if (tiktok === 'connected') {
      toast({ title: 'TikTok conectat', description: 'Acum poti pregati postari din video tururile generate.' });
      void loadDashboard();
    }
    if (tiktok === 'error') {
      toast({
        variant: 'destructive',
        title: 'Conectare TikTok esuata',
        description: message || 'TikTok nu a finalizat autorizarea.',
      });
    }
  }, [searchParams]);

  const draftsByProperty = useMemo(() => {
    const map = new Map<string, TikTokPostDraft>();
    (dashboard?.drafts || []).forEach((draft) => {
      if (draft.propertyId && !map.has(draft.propertyId)) map.set(draft.propertyId, draft);
    });
    return map;
  }, [dashboard?.drafts]);

  const draftsByAsset = useMemo(() => {
    const map = new Map<string, TikTokPostDraft>();
    (dashboard?.drafts || []).forEach((draft) => {
      if (draft.studioAssetId && !map.has(draft.studioAssetId)) map.set(draft.studioAssetId, draft);
    });
    return map;
  }, [dashboard?.drafts]);

  async function handleConnect() {
    if (!user) return;
    setActiveAction('connect');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/connect', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.authorizationUrl !== 'string') {
        throw new Error(payload?.message || 'Nu am putut porni conectarea TikTok.');
      }
      window.location.href = payload.authorizationUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Conectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut porni OAuth TikTok.',
      });
      setActiveAction(null);
    }
  }

  async function handleDisconnect() {
    if (!user) return;
    setActiveAction('disconnect');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/disconnect', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut deconecta TikTok.');
      setCreatorInfo(null);
      await loadDashboard();
      toast({ title: 'TikTok deconectat', description: 'Conexiunea TikTok a fost oprita.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Deconectare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut deconecta TikTok.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function openPublishModal(video: ReadyVideoTour) {
    setSelectedVideo(video);
    const latestDraft = video.assetId
      ? draftsByAsset.get(video.assetId) || null
      : draftsByProperty.get(video.propertyId) || video.latestDraft || null;
    setPublishForm({
      draftId: latestDraft?.id || null,
      description: latestDraft?.description || '',
      hashtags: (latestDraft?.hashtags || []).join(' '),
      privacyLevel: latestDraft?.privacyLevel || dashboard?.config.defaultPrivacyLevel || 'SELF_ONLY',
      disableComment: Boolean(latestDraft?.disableComment),
      disableDuet: Boolean(latestDraft?.disableDuet),
      disableStitch: Boolean(latestDraft?.disableStitch),
      aiGeneratedContent: latestDraft?.aiGeneratedContent !== false,
    });
    if (connected && !creatorInfo) {
      void loadCreatorInfo();
    }
    if (!latestDraft?.description && !video.assetId) {
      await generateDescription(video.propertyId);
    } else if (!latestDraft?.description && video.assetId) {
      setPublishForm((current) => ({
        ...current,
        description: `${video.propertyTitle} pregatit in ImoDeus TikTok Studio.`,
        hashtags: '#imobiliare #tiktokstudio #imodeus',
      }));
    }
  }

  async function handleStudioMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !user) return;

    setIsUploadingMedia(true);
    try {
      await Promise.all(files.map(async (file) => {
        const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
        if (!type) return;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const mediaRef = ref(storage, `tiktok-studio/${user.uid}/${Date.now()}-${safeName}`);
        await uploadBytes(mediaRef, file, { contentType: file.type });
        const url = await getDownloadURL(mediaRef);
        const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/studio-assets', {
          method: 'POST',
          body: JSON.stringify({
            type,
            name: file.name,
            url,
            mimeType: file.type,
            sizeBytes: file.size,
            source: 'upload',
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Nu am putut salva asset-ul importat.');
      }));
      await loadDashboard();
      toast({ title: 'Media importata', description: 'Fisierele au fost adaugate in TikTok Studio.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import esuat',
        description: error instanceof Error ? error.message : 'Nu am putut importa fisierele media.',
      });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  function openAssetPublishModal(asset: TikTokStudioAsset) {
    if (asset.type !== 'video') {
      toast({
        variant: 'destructive',
        title: 'Fotografia trebuie randata',
        description: 'Selecteaza fotografii in AI Composer si genereaza un video inainte de publicare.',
      });
      return;
    }
    void openPublishModal({
      source: 'studio_asset',
      propertyId: '',
      assetId: asset.id,
      propertyTitle: asset.name,
      videoTourUrl: asset.url,
      videoTourThumbnailUrl: asset.thumbnailUrl || null,
      generatedAt: asset.createdAt,
      format: asset.editorState?.aspectRatio || '9:16',
      style: 'studio',
    });
  }

  async function generateDescription(propertyId?: string) {
    if (!user) return;
    const targetPropertyId = propertyId || selectedVideo?.propertyId;
    if (!targetPropertyId) return;
    setActiveAction('description');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/descriptions', {
        method: 'POST',
        body: JSON.stringify({ propertyId: targetPropertyId, tone: 'social' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut genera descrierea TikTok.');
      setPublishForm((current) => ({
        ...current,
        description: payload.description || current.description,
        hashtags: (payload.hashtags || splitHashtags(current.hashtags)).join(' '),
      }));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Descriere negenerata',
        description: error instanceof Error ? error.message : 'Nu am putut genera descrierea TikTok.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function saveDraft() {
    if (!user || !selectedVideo) return null;
    const body = {
      propertyId: selectedVideo.assetId ? undefined : selectedVideo.propertyId,
      assetId: selectedVideo.assetId || undefined,
      description: publishForm.description,
      hashtags: splitHashtags(publishForm.hashtags),
      privacyLevel: publishForm.privacyLevel,
      disableComment: publishForm.disableComment,
      disableDuet: publishForm.disableDuet,
      disableStitch: publishForm.disableStitch,
      aiGeneratedContent: publishForm.aiGeneratedContent,
    };
    const endpoint = publishForm.draftId
      ? `/api/marketing/tiktok/post-drafts/${publishForm.draftId}`
      : '/api/marketing/tiktok/post-drafts';
    const response = await authorizedFetch(user, auth, endpoint, {
      method: publishForm.draftId ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Nu am putut salva draftul TikTok.');
    const draft = payload.draft as TikTokPostDraft;
    setPublishForm((current) => ({ ...current, draftId: draft.id }));
    await loadDashboard();
    return draft;
  }

  async function handleSaveDraft() {
    setActiveAction('save');
    try {
      await saveDraft();
      toast({ title: 'Draft salvat', description: 'Descrierea TikTok si setarile au fost salvate.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva draftul.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handlePublish() {
    setActiveAction('publish');
    try {
      const draft = await saveDraft();
      if (!draft) throw new Error('Draftul TikTok nu este disponibil.');
      const response = await authorizedFetch(user!, auth, `/api/marketing/tiktok/post-drafts/${draft.id}/publish`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Publicarea TikTok a esuat.');
      await loadDashboard();
      setSelectedVideo(null);
      toast({ title: 'Publicare pornita', description: 'Video-ul a fost trimis catre TikTok si este in procesare.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Publicare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut publica pe TikTok.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function refreshDraftStatus(draft: TikTokPostDraft) {
    if (!user) return;
    setActiveAction(`status:${draft.id}`);
    try {
      const response = await authorizedFetch(user, auth, `/api/marketing/tiktok/post-drafts/${draft.id}/status`, {
        method: 'GET',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut verifica statusul TikTok.');
      await loadDashboard();
      toast({ title: 'Status actualizat', description: `TikTok: ${STATUS_LABELS[payload.draft?.status as TikTokPostDraft['status']] || 'actualizat'}.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Status indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut verifica statusul.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
        <Skeleton className="h-12 w-72 bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl bg-white/10" />)}
        </div>
        <Skeleton className="h-[460px] rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full border border-pink-400/25 bg-pink-500/10 px-4 py-1.5 text-sm font-medium text-pink-100">
            <Video className="mr-2 h-4 w-4" />
            TikTok Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Publicare video tururi pe TikTok</h1>
          <p className="max-w-3xl text-white/70">
            Pregateste descrierea TikTok, hashtag-urile si setarile de postare pentru video tururile imobiliare generate in ImoDeus.
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
          {connected ? (
            <Button
              type="button"
              variant="outline"
              disabled={activeAction === 'disconnect'}
              className="rounded-full border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
              onClick={() => void handleDisconnect()}
            >
              {activeAction === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
              Deconecteaza
            </Button>
          ) : (
            <Button
              type="button"
              disabled={activeAction === 'connect' || dashboard?.config.configured === false}
              className="rounded-full bg-[#FF0050] px-6 text-white hover:bg-[#ff2a68]"
              onClick={() => void handleConnect()}
            >
              {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Conecteaza TikTok
            </Button>
          )}
        </div>
      </header>

      {dashboard?.config.configured === false ? (
        <Card className="rounded-2xl border-amber-300/25 bg-amber-500/10 text-amber-50">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Lipsesc credentialele TikTok.</p>
              <p className="mt-1 text-sm text-amber-50/75">
                Completeaza `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` si `TIKTOK_TOKEN_ENCRYPTION_KEY` in `.env.local`.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dashboard?.config.privateModeOnly ? (
        <Card className="rounded-2xl border-white/10 bg-white/[0.04] text-white">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-pink-200" />
            <p className="text-sm leading-6 text-white/70">
              Modul de testare este setat pe private-only. Pana cand aplicatia TikTok trece review-ul pentru `video.publish`, postarile vor fi trimise cu vizibilitate privata.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Cont TikTok</p>
            <div className="mt-3 flex items-center gap-3">
              {dashboard?.status.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dashboard.status.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Video className="h-5 w-5 text-white/60" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{dashboard?.status.displayName || dashboard?.status.username || 'Neconectat'}</p>
                <p className="truncate text-sm text-white/55">{dashboard?.status.username ? `@${dashboard.status.username}` : 'Conecteaza TikTok pentru publicare'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Video tururi</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.readyVideoTours.length || 0}</p>
            <p className="mt-1 text-sm text-white/55">Pregatite pentru TikTok Studio</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Publicate</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.totals.published || 0}</p>
            <p className="mt-1 text-sm text-white/55">Drafturi publicate prin API</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">In procesare</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.totals.processing || 0}</p>
            <p className="mt-1 text-sm text-white/55">Upload sau procesare TikTok</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-pink-200" />
              Video tururi pregatite
            </CardTitle>
            <CardDescription className="text-white/65">
              Alege un video tur, genereaza descrierea TikTok si publica direct in contul conectat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.readyVideoTours.length ? dashboard.readyVideoTours.map((video) => {
              const draft = draftsByProperty.get(video.propertyId) || video.latestDraft || null;
              return (
                <div key={video.propertyId} className="grid gap-4 rounded-2xl border border-white/10 bg-[#0F1E33]/80 p-4 md:grid-cols-[120px_1fr_auto]">
                  <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black/40">
                    {video.videoTourThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.videoTourThumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <PlayCircle className="h-8 w-8 text-white/45" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="space-y-1">
                      <p className="line-clamp-1 font-semibold text-white">{video.propertyTitle}</p>
                      <p className="text-sm text-white/55">{[video.propertyLocation, video.propertyPrice].filter(Boolean).join(' | ') || 'Proprietate ImoDeus'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/10">{video.format || 'portrait'}</Badge>
                      <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/10">Generat: {formatDate(video.generatedAt)}</Badge>
                      {draft ? (
                        <Badge className={`border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge>
                      ) : null}
                    </div>
                    {draft?.lastPublishError ? <p className="text-sm text-rose-200">{draft.lastPublishError}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 md:flex-col">
                    <Button
                      type="button"
                      disabled={!connected}
                      className="rounded-full bg-[#FF0050] text-white hover:bg-[#ff2a68]"
                      onClick={() => void openPublishModal(video)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Publica
                    </Button>
                    <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                      <a href={video.videoTourUrl} target="_blank" rel="noopener noreferrer">
                        Preview
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
                <Film className="h-10 w-10 text-white/45" />
                <h3 className="mt-4 text-lg font-semibold">Nu exista video tururi gata</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
                  Genereaza intai un video tur vertical din pagina proprietatii, apoi va aparea aici pentru publicare.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Istoric TikTok</CardTitle>
            <CardDescription className="text-white/65">Drafturi, publicari si statusuri returnate de TikTok.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.drafts.length ? dashboard.drafts.map((draft) => (
              <div key={draft.id} className="rounded-2xl border border-white/10 bg-[#0F1E33]/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-semibold">{draft.propertyTitle}</p>
                    <p className="mt-1 text-xs text-white/45">Actualizat: {formatDate(draft.updatedAt)}</p>
                  </div>
                  <Badge className={`shrink-0 border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/65">{draft.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-pink-100">
                  {draft.hashtags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {draft.publishId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeAction === `status:${draft.id}`}
                    className="mt-3 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => void refreshDraftStatus(draft)}
                  >
                    {activeAction === `status:${draft.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                    Verifica status
                  </Button>
                ) : null}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-white/60">
                Drafturile TikTok vor aparea aici dupa ce pregatesti prima postare.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-200" />
                  AI Video Studio
                </CardTitle>
                <CardDescription className="mt-2 text-white/65">
                  Importa videoclipuri sau fotografii, pregateste editarea si publica video-urile direct pe TikTok.
                </CardDescription>
              </div>
              <Button asChild className="rounded-full bg-[#FF0050] text-white hover:bg-[#ff2a68]">
                <label>
                  {isUploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                  Import video/foto
                  <input
                    type="file"
                    multiple
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(event) => void handleStudioMediaUpload(event)}
                  />
                </label>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(dashboard?.studioAssets || []).length ? dashboard!.studioAssets!.map((asset) => {
              const draft = draftsByAsset.get(asset.id);
              const isSelectedPhoto = selectedPhotoIds.includes(asset.id);
              return (
                <div key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F1E33]/85">
                  <div className="aspect-[9/13] bg-black/40">
                    {asset.type === 'video' ? (
                      <video src={asset.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{asset.name}</p>
                      <p className="text-xs text-white/45">{asset.type === 'video' ? 'Video importat' : 'Fotografie pentru AI video'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/10">{asset.editorState?.aspectRatio || '9:16'}</Badge>
                      {draft ? <Badge className={`border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.type === 'video' ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!connected}
                          className="rounded-full bg-[#FF0050] text-white hover:bg-[#ff2a68]"
                          onClick={() => openAssetPublishModal(asset)}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Publica
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => setSelectedPhotoIds((current) => (
                            current.includes(asset.id)
                              ? current.filter((id) => id !== asset.id)
                              : [...current, asset.id]
                          ))}
                        >
                          {isSelectedPhoto ? 'Selectata' : 'Adauga in AI'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-white/60">
                Importa primul video sau primele fotografii pentru a porni studioul.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-200" />
              Composer fotografii {'->'} video AI
            </CardTitle>
            <CardDescription className="text-white/65">
              Pregateste un video vertical din fotografii, voce ElevenLabs si subtitrari in stilul video tur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold">{selectedPhotoIds.length} fotografii selectate</p>
              <p className="mt-1 text-sm text-white/55">Ordinea selectiei va fi folosita pentru storyboard-ul video.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white">Titlu proiect</Label>
                <Textarea
                  value={aiComposer.title}
                  onChange={(event) => setAiComposer((current) => ({ ...current, title: event.target.value }))}
                  className="min-h-[52px] rounded-2xl border-white/10 bg-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Aspect</Label>
                <Select
                  value={aiComposer.aspectRatio}
                  onValueChange={(value) => setAiComposer((current) => ({ ...current, aspectRatio: value }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-white/15 bg-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 TikTok</SelectItem>
                    <SelectItem value="4:5">4:5 Feed</SelectItem>
                    <SelectItem value="1:1">1:1 Square</SelectItem>
                    <SelectItem value="16:9">16:9 Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Script voiceover ElevenLabs</Label>
              <Textarea
                value={aiComposer.script}
                onChange={(event) => setAiComposer((current) => ({ ...current, script: event.target.value }))}
                className="min-h-[160px] rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-white/35"
                placeholder="Scrie sau genereaza scriptul pentru voce..."
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold">Subtitrari</p>
                <p className="mt-1 text-sm text-white/55">Stil HeyGen roz, doua randuri, sincronizare pe cuvinte ElevenLabs.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold">Editor avansat</p>
                <p className="mt-1 text-sm text-white/55">Trim, crop 9:16, cover, headline, descriere TikTok si export MP4.</p>
              </div>
            </div>
            <Button
              type="button"
              disabled
              className="w-full rounded-full bg-white/15 text-white/55"
            >
              Randare AI video din fotografii - pipeline pregatit
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedVideo)} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,1100px)] max-w-none overflow-y-auto border-white/10 bg-[#0D121C] p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,0,80,0.22),transparent_38%),linear-gradient(135deg,#15182A,#0D121C)] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Send className="h-5 w-5 text-pink-200" />
              Publicare TikTok
            </DialogTitle>
            <DialogDescription className="text-white/65">
              Descrierea TikTok este textul postarii, nu subtitrarea video. Subtitrarile raman deja in MP4.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 p-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              <div className="mx-auto aspect-[9/16] max-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-black">
                {selectedVideo?.videoTourUrl ? (
                  <video src={selectedVideo.videoTourUrl} className="h-full w-full object-contain" controls playsInline />
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-semibold">{selectedVideo?.propertyTitle}</p>
                <p className="mt-1 text-sm text-white/55">
                  {[selectedVideo?.propertyLocation, selectedVideo?.propertyPrice].filter(Boolean).join(' | ') || 'Video tur ImoDeus'}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Cont publicare</p>
                    <p className="mt-1 text-sm text-white/55">
                      {dashboard?.status.username ? `@${dashboard.status.username}` : dashboard?.status.displayName || 'TikTok conectat'}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Conectat
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold text-white">Descriere TikTok</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeAction === 'description'}
                    className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => void generateDescription()}
                  >
                    {activeAction === 'description' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                    Genereaza AI
                  </Button>
                </div>
                <Textarea
                  value={publishForm.description}
                  onChange={(event) => setPublishForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-[190px] rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-white/35"
                  placeholder="Descrierea postarii TikTok..."
                />
                <p className="text-xs text-white/45">{publishForm.description.length}/2200 caractere</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Hash className="h-4 w-4" />
                  Hashtag-uri
                </Label>
                <Textarea
                  value={publishForm.hashtags}
                  onChange={(event) => setPublishForm((current) => ({ ...current, hashtags: event.target.value }))}
                  className="min-h-[78px] rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-white/35"
                  placeholder="#imobiliare #apartamentdevanzare #bucuresti"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-white">Vizibilitate</Label>
                  <Select
                    value={publishForm.privacyLevel}
                    onValueChange={(value) => setPublishForm((current) => ({ ...current, privacyLevel: value }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-white/15 bg-white/10 text-white">
                      <SelectValue placeholder="Alege vizibilitatea" />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
                  {creatorInfo?.max_video_post_duration_sec
                    ? `Limita contului: ${creatorInfo.max_video_post_duration_sec} secunde.`
                    : 'Optiunile reale se incarca din TikTok Creator Info.'}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['disableComment', 'Dezactiveaza comentariile'],
                  ['disableDuet', 'Dezactiveaza duet'],
                  ['disableStitch', 'Dezactiveaza stitch'],
                  ['aiGeneratedContent', 'Marcheaza continut AI'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <Label htmlFor={key} className="text-sm text-white/75">{label}</Label>
                    <Switch
                      id={key}
                      checked={Boolean(publishForm[key as keyof PublishForm])}
                      onCheckedChange={(checked) => setPublishForm((current) => ({ ...current, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={activeAction === 'save' || activeAction === 'publish'}
                  className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void handleSaveDraft()}
                >
                  {activeAction === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salveaza draft
                </Button>
                <Button
                  type="button"
                  disabled={!publishForm.description.trim() || activeAction === 'publish'}
                  className="rounded-full bg-[#FF0050] px-7 text-white hover:bg-[#ff2a68]"
                  onClick={() => void handlePublish()}
                >
                  {activeAction === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Publica pe TikTok
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
