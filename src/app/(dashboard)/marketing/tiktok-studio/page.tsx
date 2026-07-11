'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Captions,
  CheckCircle2,
  ExternalLink,
  Film,
  Hash,
  ImageIcon,
  Layers3,
  Loader2,
  Mic2,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Scissors,
  Send,
  Sparkles,
  Unplug,
  UploadCloud,
  Video,
  Wand2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  TikTokMarketingIntegrationPublicStatus,
  TikTokPostDraft,
  TikTokStudioAsset,
  TikTokStudioCreativeBrief,
  TikTokStudioCreativePreset,
  TikTokStudioProject,
  TikTokStudioRepurposeVariant,
  TikTokStudioStoryboardScene,
  TikTokStudioSubtitlePreset,
  TikTokStudioVoiceProfile,
} from '@/lib/types';

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
  studioProjects?: TikTokStudioProject[];
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

const CREATIVE_PRESETS: Array<{ value: TikTokStudioCreativePreset; label: string; description: string }> = [
  { value: 'luxury_real_estate', label: 'Luxury Real Estate', description: 'Elegant, cald, premium' },
  { value: 'modern_urban', label: 'Modern Urban', description: 'Urban, fresh, premium' },
  { value: 'fast_tiktok_hook', label: 'Fast TikTok Hook', description: 'Rapid, viral, retentie' },
  { value: 'warm_family_home', label: 'Warm Family Home', description: 'Familial, luminos, apropiat' },
  { value: 'investor_deal', label: 'Investor Deal', description: 'Pragmatic, randament, potential' },
  { value: 'new_development', label: 'New Development', description: 'Modern, fresh, urban' },
];

const VOICE_PROFILES: Array<{ value: TikTokStudioVoiceProfile; label: string }> = [
  { value: 'warm_feminine', label: 'Femeie calda, eleganta' },
  { value: 'young_social', label: 'Femeie tanara TikTok' },
  { value: 'luxury_calm', label: 'Voce premium luxury' },
  { value: 'energetic', label: 'Voce energica social' },
  { value: 'professional', label: 'Voce calma profesionala' },
];

const SUBTITLE_PRESETS: Array<{ value: TikTokStudioSubtitlePreset; label: string }> = [
  { value: 'heygen_pink', label: 'HeyGen Pink' },
  { value: 'tiktok_bold', label: 'TikTok Bold' },
  { value: 'luxury_white', label: 'Luxury White' },
  { value: 'minimal_premium', label: 'Minimal Premium' },
  { value: 'high_contrast', label: 'High Contrast' },
];

const REPURPOSE_VARIANTS: Array<{ value: TikTokStudioRepurposeVariant; label: string }> = [
  { value: 'tiktok_9_16', label: 'TikTok 9:16' },
  { value: 'reels_9_16', label: 'Reels 9:16' },
  { value: 'story_9_16', label: 'Story 9:16' },
  { value: 'shorts_9_16', label: 'Shorts 9:16' },
  { value: 'no_subtitles', label: 'Fara subtitrari' },
  { value: 'alternate_cta', label: 'CTA alternativ' },
];

const STUDIO_STEPS = [
  { label: 'Media', detail: 'Import foto/video', icon: UploadCloud },
  { label: 'Storyboard AI', detail: 'Ordine, ritm, lipsuri', icon: Layers3 },
  { label: 'Hook', detail: 'Primele 3 secunde', icon: Wand2 },
  { label: 'Voice', detail: 'ElevenLabs', icon: Mic2 },
  { label: 'Subtitrari', detail: 'Karaoke sincronizat', icon: Captions },
  { label: 'Publicare', detail: 'Caption si TikTok', icon: Send },
];

const PREMIUM_MODULES = [
  'Storyboard AI',
  'Hook AI',
  'Template-uri premium',
  'Timeline editabil',
  'Voice ElevenLabs',
  'Subtitrari virale',
  'Caption TikTok',
  'Scor performanta',
  'Brand kit',
  'Repurpose',
  'Programare',
  'Analytics',
];

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
    draft: 'border-slate-200 bg-slate-100 text-slate-700',
    ready: 'border-sky-200 bg-sky-50 text-sky-700',
    publishing: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    processing: 'border-violet-200 bg-violet-50 text-violet-700',
    published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return classes[status] || classes.draft;
}

const STUDIO_PANEL = 'rounded-[24px] border border-slate-200/80 bg-white/90 shadow-[0_22px_70px_rgba(15,30,51,0.08)] backdrop-blur';
const STUDIO_FIELD = 'rounded-2xl border-slate-200/80 bg-slate-50/90 text-slate-950 shadow-inner shadow-white/60 placeholder:text-slate-400';
const STUDIO_MUTED_PANEL = 'rounded-2xl border border-slate-200/75 bg-slate-50/80';
const STUDIO_PRIMARY_BUTTON = 'rounded-full bg-[#FF0050] text-white shadow-[0_18px_36px_rgba(255,0,80,0.22)] hover:bg-[#ff2a68]';
const STUDIO_SECONDARY_BUTTON = 'rounded-full border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50';

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
    voiceProfile: 'warm_feminine' as TikTokStudioVoiceProfile,
    subtitleStyle: 'heygen_pink' as TikTokStudioSubtitlePreset,
    aspectRatio: '9:16',
    creativePreset: 'luxury_real_estate' as TikTokStudioCreativePreset,
    hook: '',
    caption: '',
    hashtags: '',
    scheduledAt: '',
    brandName: 'ImoDeus',
    brandAccentColor: '#FF007F',
  });
  const [creativeBrief, setCreativeBrief] = useState<TikTokStudioCreativeBrief | null>(null);
  const [timelineScenes, setTimelineScenes] = useState<TikTokStudioStoryboardScene[]>([]);
  const [repurposeVariants, setRepurposeVariants] = useState<TikTokStudioRepurposeVariant[]>(['tiktok_9_16']);
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
  const studioAssets = dashboard?.studioAssets || [];
  const studioProjects = dashboard?.studioProjects || [];
  const studioAssetById = useMemo(() => new Map(studioAssets.map((asset) => [asset.id, asset])), [studioAssets]);
  const selectedPhotoAssets = selectedPhotoIds
    .map((assetId) => studioAssetById.get(assetId))
    .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
  const importedVideos = studioAssets.filter((asset) => asset.type === 'video');
  const importedPhotos = studioAssets.filter((asset) => asset.type === 'image');
  const previewAsset = selectedPhotoAssets[0] || importedPhotos[0] || null;
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

  async function openAssetPublishModal(asset: TikTokStudioAsset) {
    if (asset.type !== 'video') {
      toast({
        variant: 'destructive',
        title: 'Fotografia trebuie randata',
        description: 'Selecteaza fotografii in AI Composer si genereaza un video inainte de publicare.',
      });
      return;
    }
    await openPublishModal({
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
    if (asset.editorState?.description) {
      setPublishForm((current) => ({
        ...current,
        description: asset.editorState?.description || current.description,
        hashtags: asset.editorState?.hashtags?.length
          ? asset.editorState.hashtags.join(' ')
          : current.hashtags || '#imobiliare #tiktokstudio #imodeus',
      }));
    }
  }

  async function handleGenerateCreativeBrief() {
    if (!user) return;
    if (selectedPhotoIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Selecteaza fotografii',
        description: 'Conceptul AI are nevoie de cel putin doua fotografii pentru storyboard.',
      });
      return;
    }

    setActiveAction('creative-brief');
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/creative-brief', {
        method: 'POST',
        body: JSON.stringify({
          title: aiComposer.title,
          preset: aiComposer.creativePreset,
          sourceAssetIds: selectedPhotoIds,
          brandKit: {
            name: aiComposer.brandName,
            accentColor: aiComposer.brandAccentColor,
            fontFamily: 'Avenue',
            defaultCallToAction: 'Pentru mai multe detalii despre aceasta proprietate si pentru a programa o vizionare, va rog sa ne contactati. Suntem disponibili la orice ora, nu percepem comision si iti vom raspunde detaliat la toate intrebarile. Pe curand.',
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut genera conceptul AI.');
      const brief = payload.brief as TikTokStudioCreativeBrief;
      setCreativeBrief(brief);
      setTimelineScenes(brief.storyboard || []);
      setAiComposer((current) => ({
        ...current,
        title: brief.title || current.title,
        script: brief.script || current.script,
        hook: brief.selectedHook || brief.hooks?.[0] || current.hook,
        caption: brief.caption || current.caption,
        hashtags: (brief.hashtags || []).join(' '),
        creativePreset: brief.preset || current.creativePreset,
        voiceProfile: brief.voiceProfile || current.voiceProfile,
        subtitleStyle: brief.brandKit?.defaultSubtitlePreset || current.subtitleStyle,
      }));
      toast({
        title: 'Concept premium generat',
        description: 'Am pregatit hook-uri, storyboard, script, descriere TikTok si scor de calitate.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Concept negenerat',
        description: error instanceof Error ? error.message : 'Nu am putut genera conceptul AI.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  function updateTimelineScene(sceneId: string, patch: Partial<TikTokStudioStoryboardScene>) {
    setTimelineScenes((current) => current.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene));
  }

  function moveTimelineScene(sceneId: string, direction: -1 | 1) {
    setTimelineScenes((current) => {
      const index = current.findIndex((scene) => scene.id === sceneId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [scene] = next.splice(index, 1);
      next.splice(target, 0, scene);
      return next;
    });
  }

  function togglePhotoInStoryboard(assetId: string) {
    setSelectedPhotoIds((current) => (
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    ));
  }

  async function handleDeleteStudioAsset(asset: TikTokStudioAsset) {
    if (!user) return;
    const confirmed = window.confirm(`Stergi definitiv "${asset.name}" din biblioteca TikTok Studio?`);
    if (!confirmed) return;

    setActiveAction(`delete-asset:${asset.id}`);
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/studio-assets', {
        method: 'DELETE',
        body: JSON.stringify({ assetId: asset.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Nu am putut sterge asset-ul.');

      setSelectedPhotoIds((current) => current.filter((id) => id !== asset.id));
      setDashboard((current) => current
        ? {
          ...current,
          studioAssets: (current.studioAssets || []).filter((item) => item.id !== asset.id),
        }
        : current);
      toast({ title: 'Asset sters', description: 'Fisierul a fost eliminat din biblioteca TikTok Studio.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Stergere esuata',
        description: error instanceof Error ? error.message : 'Nu am putut sterge asset-ul.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  function toggleRepurposeVariant(variant: TikTokStudioRepurposeVariant) {
    setRepurposeVariants((current) => {
      if (current.includes(variant)) {
        const next = current.filter((item) => item !== variant);
        return next.length ? next : ['tiktok_9_16'];
      }
      return [...current, variant];
    });
  }

  async function handleRenderAiVideo() {
    if (!user) return;
    if (selectedPhotoIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Selecteaza fotografii',
        description: 'AI Video Studio are nevoie de cel putin doua fotografii pentru un video fluid.',
      });
      return;
    }
    if (!aiComposer.script.trim()) {
      toast({
        variant: 'destructive',
        title: 'Script obligatoriu',
        description: 'Adauga scriptul care va fi citit de vocea ElevenLabs inainte de randare.',
      });
      return;
    }

    setActiveAction('render-ai-video');
    try {
      const createResponse = await authorizedFetch(user, auth, '/api/marketing/tiktok/studio-projects', {
        method: 'POST',
        body: JSON.stringify({
          title: aiComposer.title,
          sourceAssetIds: selectedPhotoIds,
          script: aiComposer.script,
          voiceId: aiComposer.voiceId || undefined,
          voiceProfile: aiComposer.voiceProfile,
          subtitleStyle: aiComposer.subtitleStyle,
          creativePreset: aiComposer.creativePreset,
          hook: aiComposer.hook || creativeBrief?.selectedHook || null,
          caption: aiComposer.caption || creativeBrief?.caption || null,
          captionVariants: creativeBrief?.captionVariants || null,
          hashtags: splitHashtags(aiComposer.hashtags || (creativeBrief?.hashtags || []).join(' ')),
          storyboard: timelineScenes.length ? timelineScenes : creativeBrief?.storyboard || null,
          timeline: timelineScenes.length ? timelineScenes : creativeBrief?.storyboard || null,
          qualityScore: creativeBrief?.qualityScore || null,
          brandKit: {
            name: aiComposer.brandName,
            accentColor: aiComposer.brandAccentColor,
            fontFamily: 'Avenue',
            watermarkText: aiComposer.brandName,
            defaultVoiceProfile: aiComposer.voiceProfile,
            defaultVoiceId: aiComposer.voiceId || null,
            defaultSubtitlePreset: aiComposer.subtitleStyle,
            defaultCallToAction: 'Pentru mai multe detalii despre aceasta proprietate si pentru a programa o vizionare, va rog sa ne contactati. Suntem disponibili la orice ora, nu percepem comision si iti vom raspunde detaliat la toate intrebarile. Pe curand.',
          },
          repurposeVariants,
          scheduledAt: aiComposer.scheduledAt || null,
          aspectRatio: aiComposer.aspectRatio,
        }),
      });
      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) throw new Error(createPayload?.message || 'Nu am putut crea proiectul AI video.');

      const project = createPayload.project as TikTokStudioProject;
      toast({
        title: 'Randarea a pornit',
        description: 'Generez voiceover ElevenLabs, subtitrari karaoke si MP4-ul final.',
      });

      const renderResponse = await authorizedFetch(user, auth, `/api/marketing/tiktok/studio-projects/${project.id}/render`, {
        method: 'POST',
      });
      const renderPayload = await renderResponse.json().catch(() => ({}));
      if (!renderResponse.ok) throw new Error(renderPayload?.message || 'Randarea AI video a esuat.');

      setSelectedPhotoIds([]);
      await loadDashboard();
      const renderedAsset = renderPayload.asset as TikTokStudioAsset | undefined;
      if (renderedAsset) {
        await openAssetPublishModal(renderedAsset);
      }
      toast({
        title: 'Video AI generat',
        description: 'MP4-ul final este in Studio si poate fi publicat pe TikTok.',
      });
    } catch (error) {
      await loadDashboard().catch(() => undefined);
      toast({
        variant: 'destructive',
        title: 'Randare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut randa video-ul AI.',
      });
    } finally {
      setActiveAction(null);
    }
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
      scheduledAt: selectedVideo.assetId ? aiComposer.scheduledAt || undefined : undefined,
      repurposeVariant: selectedVideo.assetId ? repurposeVariants[0] : undefined,
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
      <div className="min-h-full space-y-5 bg-[radial-gradient(circle_at_8%_0%,rgba(255,0,127,0.10),transparent_28%),linear-gradient(180deg,#F8FAFF_0%,#EEF3FA_100%)] p-4 text-slate-950 lg:p-6">
        <Skeleton className="h-32 rounded-[24px] bg-white/70" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-[24px] bg-white/70" />)}
        </div>
        <Skeleton className="h-[460px] rounded-[24px] bg-white/70" />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-5 bg-[radial-gradient(circle_at_8%_0%,rgba(255,0,127,0.11),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(15,30,51,0.10),transparent_28%),linear-gradient(180deg,#F8FAFF_0%,#EEF3FA_100%)] p-4 pb-28 text-slate-950 lg:p-6 lg:pb-28">
      <header className={`${STUDIO_PANEL} grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-6`}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#FF0050]">
              <Video className="mr-2 h-3.5 w-3.5" />
              TikTok AI Studio
            </div>
            <Badge className={`rounded-full border ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'} hover:bg-transparent`}>
              {connected ? 'Cont conectat' : 'Necesita conectare'}
            </Badge>
          </div>
          <div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Studio premium pentru video-uri imobiliare pe TikTok
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Pregateste publicarea, descrierea TikTok, hashtag-urile si biblioteca media intr-un flux clar, premium si usor de folosit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full border-pink-100 bg-white px-3 py-1.5 text-slate-700 hover:bg-white"><Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#FF0050]" />AI Studio</Badge>
            <Badge className="rounded-full border-pink-100 bg-white px-3 py-1.5 text-slate-700 hover:bg-white"><Hash className="mr-1.5 h-3.5 w-3.5 text-[#FF0050]" />Caption TikTok</Badge>
            <Badge className="rounded-full border-pink-100 bg-white px-3 py-1.5 text-slate-700 hover:bg-white"><Film className="mr-1.5 h-3.5 w-3.5 text-[#FF0050]" />Video 9:16</Badge>
          </div>
        </div>
        <div className="grid content-between gap-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_24px_70px_rgba(15,30,51,0.18)]">
            <div className="flex items-center gap-3">
              {dashboard?.status.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dashboard.status.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Video className="h-5 w-5 text-white/70" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-white/55">Cont TikTok</p>
                <p className="truncate text-lg font-bold">{dashboard?.status.displayName || dashboard?.status.username || 'Neconectat'}</p>
                <p className="truncate text-sm text-white/55">{dashboard?.status.username ? `@${dashboard.status.username}` : 'Conecteaza contul pentru publicare'}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className={STUDIO_SECONDARY_BUTTON}
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
              className="rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              onClick={() => void handleDisconnect()}
            >
              {activeAction === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
              Deconecteaza
            </Button>
          ) : (
            <Button
              type="button"
              disabled={activeAction === 'connect' || dashboard?.config.configured === false}
              className={`${STUDIO_PRIMARY_BUTTON} px-6`}
              onClick={() => void handleConnect()}
            >
              {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Conecteaza TikTok
            </Button>
          )}
        </div>
        </div>
      </header>

      {dashboard?.config.configured === false ? (
        <Card className="rounded-[20px] border-amber-200 bg-amber-50 text-amber-900 shadow-sm">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Lipsesc credentialele TikTok.</p>
              <p className="mt-1 text-sm text-amber-800/80">
                Completeaza `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` si `TIKTOK_TOKEN_ENCRYPTION_KEY` in `.env.local`.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dashboard?.config.privateModeOnly ? (
        <Card className="rounded-[20px] border-pink-100 bg-white/80 text-slate-800 shadow-sm">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-[#FF0050]" />
            <p className="text-sm leading-6 text-slate-600">
              Modul de testare este setat pe private-only. Pana cand aplicatia TikTok trece review-ul pentru `video.publish`, postarile vor fi trimise cu vizibilitate privata.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="ai-editor" className="space-y-5">
        <div className={`${STUDIO_PANEL} p-2`}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[20px] bg-slate-100/80 p-1 lg:grid-cols-4">
            <TabsTrigger value="ai-editor" className="rounded-2xl py-3 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-sm">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Video Editor
            </TabsTrigger>
            <TabsTrigger value="video-tours" className="rounded-2xl py-3 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-sm">
              <Film className="mr-2 h-4 w-4" />
              Video tururi
            </TabsTrigger>
            <TabsTrigger value="publishing" className="rounded-2xl py-3 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-sm">
              <Send className="mr-2 h-4 w-4" />
              Publicare
            </TabsTrigger>
            <TabsTrigger value="performance" className="rounded-2xl py-3 text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Performanta
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Cont TikTok', value: connected ? 'Conectat' : 'Neconectat', detail: dashboard?.status.username ? `@${dashboard.status.username}` : 'OAuth TikTok', icon: Video },
            { label: 'Video tururi', value: String(dashboard?.readyVideoTours.length || 0), detail: 'gata de publicare', icon: Film },
            { label: 'Media studio', value: String(studioAssets.length), detail: `${importedPhotos.length} foto / ${importedVideos.length} video`, icon: ImageIcon },
            { label: 'Proiecte AI', value: String(studioProjects.length), detail: `${dashboard?.totals.processing || 0} in procesare`, icon: Sparkles },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_55px_rgba(15,30,51,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{metric.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{metric.detail}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-[#FF0050]">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <TabsContent value="ai-editor" className="mt-0 space-y-5">
          <div className={`${STUDIO_PANEL} overflow-hidden`}>
            <div className="border-b border-slate-200/80 bg-white/80 p-4">
              <div className="grid gap-3 lg:grid-cols-6">
                {STUDIO_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index <= (selectedPhotoIds.length >= 2 ? 2 : studioAssets.length ? 1 : 0);
                  return (
                    <div key={step.label} className={`rounded-2xl border p-3 ${isActive ? 'border-pink-200 bg-pink-50 text-[#FF0050]' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <p className="text-sm font-black">{step.label}</p>
                      </div>
                      <p className="mt-1 text-xs opacity-75">{step.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid min-h-[720px] gap-0 xl:grid-cols-[460px_minmax(420px,1fr)_420px]">
              <aside className="border-b border-slate-200/80 bg-white/75 p-5 xl:border-b-0 xl:border-r">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FF0050]">Media gallery</p>
                    <h2 className="mt-1 text-2xl font-black">Galerie foto</h2>
                    <p className="mt-1 text-sm text-slate-500">Alege ordinea vizuala a turului.</p>
                  </div>
                  <Button asChild className={`${STUDIO_PRIMARY_BUTTON} h-11 px-5`}>
                    <label>
                      {isUploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                      Import
                      <input type="file" multiple accept="video/*,image/*" className="hidden" onChange={(event) => void handleStudioMediaUpload(event)} />
                    </label>
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xl font-black">{studioAssets.length}</p><p className="text-xs text-slate-500">total</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xl font-black">{importedPhotos.length}</p><p className="text-xs text-slate-500">foto</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xl font-black">{importedVideos.length}</p><p className="text-xs text-slate-500">video</p></div>
                  <div className="rounded-2xl border border-pink-200 bg-pink-50 p-3 shadow-sm"><p className="text-xl font-black text-[#FF0050]">{selectedPhotoIds.length}</p><p className="text-xs text-slate-500">scene</p></div>
                </div>

                <div className="mt-4 max-h-[520px] overflow-y-auto pr-1">
                  {studioAssets.length ? (
                    <div className="columns-2 gap-3">
                    {studioAssets.map((asset) => {
                    const isSelectedPhoto = selectedPhotoIds.includes(asset.id);
                    const isDeleting = activeAction === `delete-asset:${asset.id}`;
                    return (
                      <div key={asset.id} className={`group mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-[24px] border bg-white align-top shadow-sm transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,30,51,0.16)] ${isSelectedPhoto ? 'border-[#FF0050] ring-4 ring-pink-100' : 'border-slate-200/80'}`}>
                        <div className="relative overflow-hidden bg-white">
                          {asset.type === 'video' ? (
                            <video src={asset.url} className="aspect-video h-auto w-full object-contain" muted playsInline />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset.url} alt="" className="block h-auto w-full" />
                          )}
                          {asset.type === 'video' ? (
                            <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur">
                              <Video className="h-4 w-4" />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-black shadow-lg backdrop-blur transition ${isSelectedPhoto ? 'bg-[#FF0050] text-white' : 'bg-white/92 text-slate-950 hover:bg-white'}`}
                            onClick={() => asset.type === 'image' ? togglePhotoInStoryboard(asset.id) : void openAssetPublishModal(asset)}
                          >
                            {isSelectedPhoto ? 'Selectat' : 'Selecteaza'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            className="absolute right-3 top-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-rose-600 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-70"
                            onClick={() => void handleDeleteStudioAsset(asset)}
                          >
                            {isDeleting ? 'Sterg...' : 'Sterge'}
                          </button>
                        </div>
                      </div>
                    );
                    })}
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <UploadCloud className="mx-auto h-10 w-10 text-[#FF0050]/70" />
                      <p className="mt-3 text-sm font-semibold text-slate-600">Importa fotografii sau video-uri.</p>
                    </div>
                  )}
                </div>
              </aside>

              <section className="relative overflow-hidden bg-[#080B13] p-5 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,0,127,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FF6FAF]">Preview studio</p>
                    <h2 className="mt-1 text-2xl font-black text-white">Randare 9:16</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-black text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <PlayCircle className="h-4 w-4 text-[#FF007F]" />
                    Preview
                  </div>
                </div>

                <div className="relative mt-5 rounded-[34px] border border-white/10 bg-[#0D111D]/90 p-4 shadow-[0_34px_100px_rgba(0,0,0,0.48)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#FF007F] shadow-[0_0_18px_rgba(255,0,127,0.9)]" />
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Preview fotografie</span>
                    </div>
                    <Badge className="rounded-full border-white/10 bg-white/10 px-3 py-1.5 text-white hover:bg-white/10">
                      {selectedPhotoIds.length} scene
                    </Badge>
                  </div>

                  <div className="grid place-items-center">
                    <div className="relative aspect-[9/16] h-[min(58vh,560px)] overflow-hidden rounded-[30px] bg-black shadow-[0_26px_70px_rgba(0,0,0,0.58)] ring-1 ring-white/15">
                      {previewAsset ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewAsset.url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl" />
                          <div className="absolute inset-0 bg-black/18" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewAsset.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                        </>
                      ) : dashboard?.readyVideoTours[0]?.videoTourThumbnailUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={dashboard.readyVideoTours[0].videoTourThumbnailUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl" />
                          <div className="absolute inset-0 bg-black/18" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={dashboard.readyVideoTours[0].videoTourThumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_18%,rgba(255,0,127,0.16),transparent_34%),linear-gradient(180deg,#141927,#050713)]">
                          <div className="px-8 text-center">
                            <Film className="mx-auto h-14 w-14 text-white/22" />
                            <p className="mt-3 text-sm font-black text-white/55">Selecteaza fotografii pentru preview</p>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 right-4 h-1.5 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full w-2/5 rounded-full bg-[#FF007F] shadow-[0_0_20px_rgba(255,0,127,0.8)]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-4 rounded-[26px] border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm font-black text-white">Timeline</p>
                      <p className="text-xs text-white/45">{selectedPhotoAssets.length ? 'Fotografiile selectate intra in randare in aceasta ordine' : 'Storyboard AI asteapta selectia'}</p>
                    </div>
                    <span className="rounded-full bg-[#FF007F]/15 px-3 py-1 text-xs font-black text-[#FF8FC6]">
                      {selectedPhotoAssets.length || timelineScenes.length || 0} scene
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {selectedPhotoAssets.length ? selectedPhotoAssets.map((asset, index) => (
                      <div key={asset.id} className="min-w-[72px] overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                        <div className="relative aspect-[9/12]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.url} alt="" className="h-full w-full object-cover" />
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/62 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">#{index + 1}</span>
                        </div>
                      </div>
                    )) : timelineScenes.length ? timelineScenes.map((scene, index) => (
                      <div key={scene.id || index} className="min-w-[150px] rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p className="text-xs font-black text-[#FF8FC6]">Scena {index + 1}</p>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold">{scene.title}</p>
                      </div>
                    )) : STUDIO_STEPS.slice(0, 5).map((step, index) => (
                      <div key={step.label} className="min-w-[128px] rounded-2xl border border-white/10 bg-white/[0.08] p-3">
                        <p className="text-xs font-black text-[#FF8FC6]">Pas {index + 1}</p>
                        <p className="mt-1 text-sm font-semibold">{step.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="border-t border-slate-200/80 bg-white/80 p-4 xl:border-l xl:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FF0050]">AI Director</p>
                    <h2 className="mt-1 text-2xl font-black">Control creativ</h2>
                  </div>
                  {creativeBrief?.qualityScore ? (
                    <div className="rounded-2xl bg-pink-50 px-4 py-2 text-right">
                      <p className="text-2xl font-black text-[#FF0050]">{creativeBrief.qualityScore.score}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">score</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Select value={aiComposer.creativePreset} onValueChange={(value) => setAiComposer((current) => ({ ...current, creativePreset: value as TikTokStudioCreativePreset }))}>
                      <SelectTrigger className={`h-12 ${STUDIO_FIELD}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREATIVE_PRESETS.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" disabled={activeAction === 'creative-brief' || selectedPhotoIds.length < 2} className={`${STUDIO_PRIMARY_BUTTON} h-12`} onClick={() => void handleGenerateCreativeBrief()}>
                      {activeAction === 'creative-brief' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      Concept
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-slate-700">Voce ElevenLabs</Label>
                      <Select value={aiComposer.voiceProfile} onValueChange={(value) => setAiComposer((current) => ({ ...current, voiceProfile: value as TikTokStudioVoiceProfile }))}>
                        <SelectTrigger className={`mt-2 h-11 ${STUDIO_FIELD}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{VOICE_PROFILES.map((profile) => <SelectItem key={profile.value} value={profile.value}>{profile.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-700">Subtitrare</Label>
                      <Select value={aiComposer.subtitleStyle} onValueChange={(value) => setAiComposer((current) => ({ ...current, subtitleStyle: value as TikTokStudioSubtitlePreset }))}>
                        <SelectTrigger className={`mt-2 h-11 ${STUDIO_FIELD}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{SUBTITLE_PRESETS.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {creativeBrief?.hooks?.length ? (
                    <div>
                      <Label className="text-slate-700">Hook AI</Label>
                      <div className="mt-2 grid gap-2">
                        {creativeBrief.hooks.slice(0, 3).map((hook) => (
                          <button key={hook} type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-5 transition ${aiComposer.hook === hook ? 'border-[#FF0050] bg-pink-50 text-[#FF0050]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setAiComposer((current) => ({ ...current, hook }))}>
                            {hook}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <Label className="text-slate-700">Script voiceover</Label>
                    <Textarea value={aiComposer.script} onChange={(event) => setAiComposer((current) => ({ ...current, script: event.target.value }))} className={`mt-2 min-h-[132px] ${STUDIO_FIELD}`} placeholder="Script cursiv, cu numere scrise in litere..." />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-slate-700">Descriere TikTok</Label>
                      <Textarea value={aiComposer.caption} onChange={(event) => setAiComposer((current) => ({ ...current, caption: event.target.value }))} className={`mt-2 min-h-[96px] ${STUDIO_FIELD}`} placeholder="Caption-ul postarii..." />
                    </div>
                    <div>
                      <Label className="text-slate-700">Hashtag-uri</Label>
                      <Textarea value={aiComposer.hashtags} onChange={(event) => setAiComposer((current) => ({ ...current, hashtags: event.target.value }))} className={`mt-2 min-h-[96px] ${STUDIO_FIELD}`} placeholder="#imobiliare #turvideo" />
                    </div>
                  </div>

                  <div className={STUDIO_MUTED_PANEL + ' p-3'}>
                    <p className="text-sm font-black">Repurpose si programare</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {REPURPOSE_VARIANTS.map((variant) => (
                        <Button key={variant.value} type="button" size="sm" variant="outline" className={`rounded-full border-slate-200 ${repurposeVariants.includes(variant.value) ? 'bg-pink-50 text-[#FF0050]' : 'bg-white text-slate-700'}`} onClick={() => toggleRepurposeVariant(variant.value)}>
                          {variant.label}
                        </Button>
                      ))}
                    </div>
                    <Textarea value={aiComposer.scheduledAt} onChange={(event) => setAiComposer((current) => ({ ...current, scheduledAt: event.target.value }))} className={`mt-3 min-h-[42px] ${STUDIO_FIELD}`} placeholder="YYYY-MM-DDTHH:mm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {PREMIUM_MODULES.slice(0, 8).map((module) => (
                      <div key={module} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-[#FF0050]" />
                        {module}
                      </div>
                    ))}
                  </div>

                  <Button type="button" disabled={activeAction === 'render-ai-video' || selectedPhotoIds.length < 2 || !aiComposer.script.trim()} className={`h-12 w-full ${STUDIO_PRIMARY_BUTTON}`} onClick={() => void handleRenderAiVideo()}>
                    {activeAction === 'render-ai-video' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Randare AI video
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="video-tours" className="mt-0">
          <div className={`${STUDIO_PANEL} p-5`}>
            <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FF0050]">Video tours</p>
                <h2 className="mt-1 text-2xl font-black">Tururi pregatite pentru TikTok</h2>
              </div>
              <Badge className="rounded-full border-pink-100 bg-pink-50 px-3 py-1.5 text-[#FF0050] hover:bg-pink-50">{dashboard?.readyVideoTours.length || 0} video-uri</Badge>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {dashboard?.readyVideoTours.length ? dashboard.readyVideoTours.map((video) => {
                const draft = draftsByProperty.get(video.propertyId) || video.latestDraft || null;
                return (
                  <div key={video.propertyId} className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[120px_1fr_auto]">
                    <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-slate-950">
                      {video.videoTourThumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.videoTourThumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : <div className="flex h-full items-center justify-center"><PlayCircle className="h-8 w-8 text-white/40" /></div>}
                    </div>
                    <div className="min-w-0 py-1">
                      <p className="line-clamp-2 text-base font-black">{video.propertyTitle}</p>
                      <p className="mt-1 text-sm text-slate-500">{[video.propertyLocation, video.propertyPrice].filter(Boolean).join(' | ') || 'Proprietate ImoDeus'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">{video.format || 'portrait'}</Badge>
                        <Badge className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">{formatDate(video.generatedAt)}</Badge>
                        {draft ? <Badge className={`rounded-full border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 md:flex-col">
                      <Button type="button" disabled={!connected} className={STUDIO_PRIMARY_BUTTON} onClick={() => void openPublishModal(video)}>
                        <Send className="mr-2 h-4 w-4" />
                        Publica
                      </Button>
                      <Button asChild variant="outline" className={STUDIO_SECONDARY_BUTTON}>
                        <a href={video.videoTourUrl} target="_blank" rel="noopener noreferrer">Preview <ExternalLink className="ml-2 h-4 w-4" /></a>
                      </Button>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-full rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">Nu exista video tururi gata.</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="publishing" className="mt-0">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`${STUDIO_PANEL} p-5`}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FF0050]">Publishing hub</p>
              <h2 className="mt-1 text-2xl font-black">Drafturi TikTok</h2>
              <div className="mt-5 space-y-3">
                {dashboard?.drafts.length ? dashboard.drafts.map((draft) => (
                  <div key={draft.id} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-black">{draft.propertyTitle}</p>
                        <p className="mt-1 text-xs text-slate-400">Actualizat: {formatDate(draft.updatedAt)}</p>
                      </div>
                      <Badge className={`shrink-0 rounded-full border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{draft.description}</p>
                    {draft.publishId ? (
                      <Button type="button" size="sm" variant="outline" disabled={activeAction === `status:${draft.id}`} className={`mt-3 ${STUDIO_SECONDARY_BUTTON}`} onClick={() => void refreshDraftStatus(draft)}>
                        {activeAction === `status:${draft.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                        Verifica status
                      </Button>
                    ) : null}
                  </div>
                )) : <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Drafturile apar aici dupa prima postare.</div>}
              </div>
            </div>
            <div className={`${STUDIO_PANEL} p-5`}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FF0050]">TikTok ready</p>
              <h2 className="mt-1 text-2xl font-black">Setari postare</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                  <CalendarClock className="h-5 w-5 text-[#FF0050]" />
                  <p className="mt-3 font-black">Programare</p>
                  <p className="mt-1 text-sm text-slate-500">{aiComposer.scheduledAt || 'Publicare manuala'}</p>
                </div>
                <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                  <Scissors className="h-5 w-5 text-[#FF0050]" />
                  <p className="mt-3 font-black">Repurpose</p>
                  <p className="mt-1 text-sm text-slate-500">{repurposeVariants.length} variante selectate</p>
                </div>
                <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                  <Hash className="h-5 w-5 text-[#FF0050]" />
                  <p className="mt-3 font-black">Caption</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{aiComposer.caption || 'Caption AI separat de subtitrare'}</p>
                </div>
                <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                  <Captions className="h-5 w-5 text-[#FF0050]" />
                  <p className="mt-3 font-black">Subtitrari</p>
                  <p className="mt-1 text-sm text-slate-500">{SUBTITLE_PRESETS.find((item) => item.value === aiComposer.subtitleStyle)?.label}</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-0">
          <div className={`${STUDIO_PANEL} p-5`}>
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <div className="rounded-[28px] bg-slate-950 p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-200">Performance score</p>
                <p className="mt-4 text-6xl font-black">{creativeBrief?.qualityScore?.score || 0}</p>
                <p className="mt-2 text-white/55">{creativeBrief?.qualityScore?.label?.replace('_', ' ') || 'Genereaza concept AI pentru scor.'}</p>
                <div className="mt-5 space-y-2">
                  {(creativeBrief?.qualityScore?.improvements || ['Adauga cel putin doua fotografii', 'Genereaza storyboard AI', 'Alege hook si voce']).slice(0, 4).map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/75">{item}</div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black">Module premium vizibile</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {PREMIUM_MODULES.map((module) => (
                    <div key={module} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <CheckCircle2 className="h-5 w-5 text-[#FF0050]" />
                      <p className="mt-3 font-black">{module}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="hidden">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className={STUDIO_PANEL}>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Cont TikTok</p>
            <div className="mt-3 flex items-center gap-3">
              {dashboard?.status.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dashboard.status.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Video className="h-5 w-5 text-slate-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{dashboard?.status.displayName || dashboard?.status.username || 'Neconectat'}</p>
                <p className="truncate text-sm text-slate-500">{dashboard?.status.username ? `@${dashboard.status.username}` : 'Conecteaza TikTok pentru publicare'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={STUDIO_PANEL}>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Video tururi</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.readyVideoTours.length || 0}</p>
            <p className="mt-1 text-sm text-slate-500">Pregatite pentru TikTok Studio</p>
          </CardContent>
        </Card>
        <Card className={STUDIO_PANEL}>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Publicate</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.totals.published || 0}</p>
            <p className="mt-1 text-sm text-slate-500">Drafturi publicate prin API</p>
          </CardContent>
        </Card>
        <Card className={STUDIO_PANEL}>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">In procesare</p>
            <p className="mt-2 text-3xl font-semibold">{dashboard?.totals.processing || 0}</p>
            <p className="mt-1 text-sm text-slate-500">Upload sau procesare TikTok</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className={STUDIO_PANEL}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-[#FF0050]" />
              Video tururi pregatite
            </CardTitle>
            <CardDescription className="text-slate-600">
              Alege un video tur, genereaza descrierea TikTok si publica direct in contul conectat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.readyVideoTours.length ? dashboard.readyVideoTours.map((video) => {
              const draft = draftsByProperty.get(video.propertyId) || video.latestDraft || null;
              return (
                <div key={video.propertyId} className="grid gap-4 rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,30,51,0.10)] md:grid-cols-[96px_1fr_auto]">
                  <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-slate-950">
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
                      <p className="line-clamp-1 text-base font-bold text-slate-950">{video.propertyTitle}</p>
                      <p className="text-sm text-slate-500">{[video.propertyLocation, video.propertyPrice].filter(Boolean).join(' | ') || 'Proprietate ImoDeus'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">{video.format || 'portrait'}</Badge>
                      <Badge className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">Generat: {formatDate(video.generatedAt)}</Badge>
                      {draft ? (
                        <Badge className={`rounded-full border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge>
                      ) : null}
                    </div>
                    {draft?.lastPublishError ? <p className="text-sm text-rose-600">{draft.lastPublishError}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 md:flex-col">
                    <Button
                      type="button"
                      disabled={!connected}
                      className={STUDIO_PRIMARY_BUTTON}
                      onClick={() => void openPublishModal(video)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Publica
                    </Button>
                    <Button asChild variant="outline" className={STUDIO_SECONDARY_BUTTON}>
                      <a href={video.videoTourUrl} target="_blank" rel="noopener noreferrer">
                        Preview
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                <Film className="h-10 w-10 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold">Nu exista video tururi gata</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Genereaza intai un video tur vertical din pagina proprietatii, apoi va aparea aici pentru publicare.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={STUDIO_PANEL}>
          <CardHeader>
            <CardTitle>Istoric TikTok</CardTitle>
            <CardDescription className="text-slate-600">Drafturi, publicari si statusuri returnate de TikTok.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.drafts.length ? dashboard.drafts.map((draft) => (
              <div key={draft.id} className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-semibold">{draft.propertyTitle}</p>
                    <p className="mt-1 text-xs text-slate-400">Actualizat: {formatDate(draft.updatedAt)}</p>
                  </div>
                  <Badge className={`shrink-0 rounded-full border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{draft.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-[#FF0050]">
                  {draft.hashtags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {draft.publishId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={activeAction === `status:${draft.id}`}
                    className={`mt-3 ${STUDIO_SECONDARY_BUTTON}`}
                    onClick={() => void refreshDraftStatus(draft)}
                  >
                    {activeAction === `status:${draft.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                    Verifica status
                  </Button>
                ) : null}
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
                Drafturile TikTok vor aparea aici dupa ce pregatesti prima postare.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className={STUDIO_PANEL}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#FF0050]" />
                  Biblioteca media
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  Importa videoclipuri sau fotografii, pregateste editarea si publica video-urile direct pe TikTok.
                </CardDescription>
              </div>
              <Button asChild className={STUDIO_PRIMARY_BUTTON}>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className={STUDIO_MUTED_PANEL + ' p-3'}>
                <p className="text-xl font-black">{studioAssets.length}</p>
                <p className="text-xs text-slate-500">total</p>
              </div>
              <div className={STUDIO_MUTED_PANEL + ' p-3'}>
                <p className="text-xl font-black">{importedPhotos.length}</p>
                <p className="text-xs text-slate-500">foto</p>
              </div>
              <div className={STUDIO_MUTED_PANEL + ' p-3'}>
                <p className="text-xl font-black">{importedVideos.length}</p>
                <p className="text-xs text-slate-500">video</p>
              </div>
            </div>
            <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {studioAssets.length ? studioAssets.map((asset) => {
              const draft = draftsByAsset.get(asset.id);
              const isSelectedPhoto = selectedPhotoIds.includes(asset.id);
              return (
                <div key={asset.id} className={`overflow-hidden rounded-[20px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,30,51,0.10)] ${isSelectedPhoto ? 'border-[#FF0050] ring-4 ring-pink-100' : 'border-slate-200/80'}`}>
                  <div className="aspect-[9/13] bg-slate-950">
                    {asset.type === 'video' ? (
                      <video src={asset.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">{asset.name}</p>
                      <p className="text-xs text-slate-500">{asset.type === 'video' ? 'Video importat' : 'Fotografie pentru AI video'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">{asset.editorState?.aspectRatio || '9:16'}</Badge>
                      {draft ? <Badge className={`rounded-full border ${getStatusClass(draft.status)} hover:bg-transparent`}>{STATUS_LABELS[draft.status]}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {asset.type === 'video' ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!connected}
                          className={STUDIO_PRIMARY_BUTTON}
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
                          className={isSelectedPhoto ? 'rounded-full border-[#FF0050] bg-pink-50 text-[#FF0050] hover:bg-pink-100' : STUDIO_SECONDARY_BUTTON}
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
              <div className="col-span-full rounded-[20px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                <Sparkles className="mx-auto mb-3 h-9 w-9 text-[#FF0050]/70" />
                Importa primul video sau primele fotografii pentru a porni studioul.
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        <Card className={STUDIO_PANEL}>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#FF0050]" />
                  Composer foto in video AI
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  Storyboard, voiceover ElevenLabs, subtitrari karaoke si descriere TikTok intr-un singur flux.
                </CardDescription>
              </div>
              <div className="rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm">
                <p className="font-black text-[#FF0050]">{selectedPhotoIds.length} fotografii selectate</p>
                <p className="max-w-[240px] truncate text-xs text-slate-500">{selectedPhotoAssets.slice(0, 2).map((asset) => asset.name).join(', ') || 'Alege cel putin doua fotografii'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label className="text-slate-700">Preset creativ premium</Label>
                <Select
                  value={aiComposer.creativePreset}
                  onValueChange={(value) => setAiComposer((current) => ({ ...current, creativePreset: value as TikTokStudioCreativePreset }))}
                >
                  <SelectTrigger className={`h-11 ${STUDIO_FIELD}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATIVE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>{preset.label} - {preset.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={activeAction === 'creative-brief' || selectedPhotoIds.length < 2}
                className={`self-end ${STUDIO_PRIMARY_BUTTON}`}
                onClick={() => void handleGenerateCreativeBrief()}
              >
                {activeAction === 'creative-brief' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Genereaza concept AI
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Brand afisat</Label>
                <Textarea
                  value={aiComposer.brandName}
                  onChange={(event) => setAiComposer((current) => ({ ...current, brandName: event.target.value }))}
                  className={`min-h-[46px] ${STUDIO_FIELD}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Culoare accent</Label>
                <Textarea
                  value={aiComposer.brandAccentColor}
                  onChange={(event) => setAiComposer((current) => ({ ...current, brandAccentColor: event.target.value }))}
                  className={`min-h-[46px] ${STUDIO_FIELD}`}
                />
              </div>
            </div>
            {creativeBrief?.qualityScore ? (
              <div className="rounded-[20px] border border-pink-100 bg-[linear-gradient(135deg,rgba(255,0,127,0.10),rgba(255,255,255,0.90))] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Scor creativ</p>
                    <p className="mt-1 text-sm text-slate-500">{creativeBrief.qualityScore.label.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-[#FF0050]">{creativeBrief.qualityScore.score}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">din 100</p>
                  </div>
                </div>
                {creativeBrief.qualityScore.improvements.length ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    {creativeBrief.qualityScore.improvements.slice(0, 3).map((item) => <p key={item}>- {item}</p>)}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-emerald-700">Conceptul este pregatit pentru randare premium.</p>
                )}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Titlu proiect</Label>
                <Textarea
                  value={aiComposer.title}
                  onChange={(event) => setAiComposer((current) => ({ ...current, title: event.target.value }))}
                  className={`min-h-[52px] ${STUDIO_FIELD}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Aspect</Label>
                <Select
                  value={aiComposer.aspectRatio}
                  onValueChange={(value) => setAiComposer((current) => ({ ...current, aspectRatio: value }))}
                >
                  <SelectTrigger className={`h-11 ${STUDIO_FIELD}`}>
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Profil voce ElevenLabs</Label>
                <Select
                  value={aiComposer.voiceProfile}
                  onValueChange={(value) => setAiComposer((current) => ({ ...current, voiceProfile: value as TikTokStudioVoiceProfile }))}
                >
                  <SelectTrigger className={`h-11 ${STUDIO_FIELD}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_PROFILES.map((profile) => <SelectItem key={profile.value} value={profile.value}>{profile.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Preset subtitrare</Label>
                <Select
                  value={aiComposer.subtitleStyle}
                  onValueChange={(value) => setAiComposer((current) => ({ ...current, subtitleStyle: value as TikTokStudioSubtitlePreset }))}
                >
                  <SelectTrigger className={`h-11 ${STUDIO_FIELD}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTITLE_PRESETS.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {creativeBrief?.hooks?.length ? (
              <div className="space-y-2">
                <Label className="text-slate-700">Hook-uri AI</Label>
                <div className="grid gap-2">
                  {creativeBrief.hooks.map((hook) => (
                    <button
                      key={hook}
                      type="button"
                      className={`rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition ${aiComposer.hook === hook ? 'border-[#FF0050] bg-pink-50 text-[#FF0050]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      onClick={() => setAiComposer((current) => ({ ...current, hook }))}
                    >
                      {hook}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-slate-700">Script voiceover ElevenLabs</Label>
              <Textarea
                value={aiComposer.script}
                onChange={(event) => setAiComposer((current) => ({ ...current, script: event.target.value }))}
                className={`min-h-[160px] ${STUDIO_FIELD}`}
                placeholder="Scrie sau genereaza scriptul pentru voce..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Descriere TikTok</Label>
              <Textarea
                value={aiComposer.caption}
                onChange={(event) => setAiComposer((current) => ({ ...current, caption: event.target.value }))}
                className={`min-h-[110px] ${STUDIO_FIELD}`}
                placeholder="Descrierea postarii TikTok, separata de subtitrarea video..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Hashtag-uri</Label>
              <Textarea
                value={aiComposer.hashtags}
                onChange={(event) => setAiComposer((current) => ({ ...current, hashtags: event.target.value }))}
                className={`min-h-[54px] ${STUDIO_FIELD}`}
                placeholder="#imobiliare #turvideo #imodeus"
              />
            </div>
            {creativeBrief?.captionVariants?.length ? (
              <div className="space-y-2">
                <Label className="text-slate-700">Variante descriere TikTok</Label>
                <div className="grid gap-2">
                  {creativeBrief.captionVariants.map((caption, index) => (
                    <button
                      key={`${caption}-${index}`}
                      type="button"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm leading-6 text-slate-600 transition hover:bg-slate-50"
                      onClick={() => setAiComposer((current) => ({ ...current, caption }))}
                    >
                      {caption}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {creativeBrief?.missingShots?.length || creativeBrief?.weakPhotos?.length ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Recomandari AI pentru media</p>
                <div className="mt-2 space-y-1 text-sm text-amber-800/80">
                  {(creativeBrief.missingShots || []).slice(0, 3).map((item) => <p key={item}>- {item}</p>)}
                  {(creativeBrief.weakPhotos || []).slice(0, 2).map((item) => <p key={`${item.assetId}-${item.reason}`}>- {item.reason}</p>)}
                </div>
              </div>
            ) : null}
            {timelineScenes.length ? (
              <div className={`${STUDIO_MUTED_PANEL} space-y-2 p-4`}>
                <p className="text-sm font-bold">Timeline editabil</p>
                <div className="space-y-2">
                  {timelineScenes.map((scene, index) => (
                    <div key={scene.id || index} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{index + 1}. {scene.title}</p>
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => moveTimelineScene(scene.id, -1)}>Sus</Button>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => moveTimelineScene(scene.id, 1)}>Jos</Button>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{scene.visualIntent}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-[90px_1fr_150px]">
                        <Textarea
                          value={String(scene.durationSeconds)}
                          onChange={(event) => updateTimelineScene(scene.id, { durationSeconds: Number(event.target.value) || scene.durationSeconds })}
                          className={`min-h-[42px] ${STUDIO_FIELD}`}
                        />
                        <Textarea
                          value={scene.overlayText || ''}
                          onChange={(event) => updateTimelineScene(scene.id, { overlayText: event.target.value })}
                          className={`min-h-[42px] ${STUDIO_FIELD}`}
                          placeholder="Overlay text"
                        />
                        <Select value={scene.motion} onValueChange={(value) => updateTimelineScene(scene.id, { motion: value as TikTokStudioStoryboardScene['motion'] })}>
                          <SelectTrigger className={`h-11 ${STUDIO_FIELD}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slow_push">Slow push</SelectItem>
                            <SelectItem value="pull_back">Pull back</SelectItem>
                            <SelectItem value="pan_left">Pan left</SelectItem>
                            <SelectItem value="pan_right">Pan right</SelectItem>
                            <SelectItem value="detail_zoom">Detail zoom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {scene.mediaType || 'other'} {scene.qualityNote ? `- ${scene.qualityNote}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={`${STUDIO_MUTED_PANEL} space-y-3 p-4`}>
              <p className="text-sm font-bold">Repurpose si programare</p>
              <div className="flex flex-wrap gap-2">
                {REPURPOSE_VARIANTS.map((variant) => (
                  <Button
                    key={variant.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-full border-slate-200 hover:bg-slate-50 ${repurposeVariants.includes(variant.value) ? 'bg-pink-50 text-[#FF0050]' : 'bg-white text-slate-700'}`}
                    onClick={() => toggleRepurposeVariant(variant.value)}
                  >
                    {variant.label}
                  </Button>
                ))}
              </div>
              <div>
                <Label className="text-slate-700">Programare publicare</Label>
                <Textarea
                  value={aiComposer.scheduledAt}
                  onChange={(event) => setAiComposer((current) => ({ ...current, scheduledAt: event.target.value }))}
                  className={`mt-2 min-h-[44px] ${STUDIO_FIELD}`}
                  placeholder="YYYY-MM-DDTHH:mm sau lasa gol pentru publicare manuala"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                <p className="text-sm font-semibold">Subtitrari</p>
                <p className="mt-1 text-sm text-slate-500">Stil HeyGen roz, doua randuri, sincronizare pe cuvinte ElevenLabs.</p>
              </div>
              <div className={STUDIO_MUTED_PANEL + ' p-4'}>
                <p className="text-sm font-semibold">Editor avansat</p>
                <p className="mt-1 text-sm text-slate-500">Trim, crop 9:16, cover, headline, descriere TikTok si export MP4.</p>
              </div>
            </div>
            <Button
              type="button"
              disabled={activeAction === 'render-ai-video' || selectedPhotoIds.length < 2 || !aiComposer.script.trim()}
              className={`w-full ${STUDIO_PRIMARY_BUTTON}`}
              onClick={() => void handleRenderAiVideo()}
            >
              {activeAction === 'render-ai-video' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Randare AI video din fotografii
            </Button>
            {studioProjects.length ? (
              <div className={`${STUDIO_MUTED_PANEL} space-y-2 p-4`}>
                <p className="text-sm font-bold">Proiecte recente</p>
                {studioProjects.slice(0, 4).map((project) => (
                  <div key={project.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.title}</p>
                      {project.errorMessage ? <p className="truncate text-xs text-rose-600">{project.errorMessage}</p> : null}
                    </div>
                    <Badge className={`shrink-0 rounded-full border ${project.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : project.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-violet-200 bg-violet-50 text-violet-700'} hover:bg-transparent`}>
                      {project.status === 'ready' ? 'Gata' : project.status === 'rendering' ? 'Randare' : project.status === 'error' ? 'Eroare' : 'Draft'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

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
