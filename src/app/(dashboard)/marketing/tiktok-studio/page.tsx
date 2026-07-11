'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  Captions,
  CheckCircle2,
  ChevronRight,
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

type PortfolioProperty = {
  id: string;
  title: string;
  address?: string | null;
  location?: string | null;
  price?: string | null;
  description?: string | null;
  keyFeatures?: string | null;
  rooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
  propertyType?: string | null;
  images: Array<{ url: string; alt?: string | null }>;
};

type DashboardPayload = {
  status: TikTokMarketingIntegrationPublicStatus;
  role?: 'admin' | 'agent';
  readyVideoTours: ReadyVideoTour[];
  portfolioProperties?: PortfolioProperty[];
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

type RoomType = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony' | 'hallway' | 'parking' | 'exterior';

type RoomDraft = {
  room: RoomType;
  description: string;
};

type RoomGroup = RoomDraft & {
  assetIds: string[];
};

type ScriptInput = {
  property: PortfolioProperty | null | undefined;
  hookBrief?: string;
  drafts: RoomDraft[];
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

const ROOM_OPTIONS: Array<{ value: RoomType; label: string; mediaType: NonNullable<TikTokStudioStoryboardScene['mediaType']> }> = [
  { value: 'living', label: 'Living room', mediaType: 'living' },
  { value: 'bedroom', label: 'Dormitor', mediaType: 'bedroom' },
  { value: 'kitchen', label: 'Bucatarie', mediaType: 'kitchen' },
  { value: 'bathroom', label: 'Baie', mediaType: 'bathroom' },
  { value: 'balcony', label: 'Balcon/Terasa', mediaType: 'balcony' },
  { value: 'hallway', label: 'Hol', mediaType: 'detail' },
  { value: 'parking', label: 'Parcare', mediaType: 'detail' },
  { value: 'exterior', label: 'Exterior', mediaType: 'exterior' },
];

const ROOM_SCRIPT_HINTS: Record<RoomType, string> = {
  living: 'Livingul este zona principala a proprietatii, luminos si potrivit pentru relaxare sau socializare.',
  bedroom: 'Dormitorul ofera un spatiu linistit si confortabil, gandit pentru odihna.',
  kitchen: 'Bucataria este practica si bine organizata, pregatita pentru utilizare zilnica.',
  bathroom: 'Baia completeaza proprietatea cu finisaje curate si o configuratie functionala.',
  balcony: 'Balconul sau terasa adauga un plus de aer liber si o perspectiva placuta asupra zonei.',
  hallway: 'Holul leaga fluent incaperile si ofera o intrare ordonata in proprietate.',
  parking: 'Zona de parcare aduce confort suplimentar pentru utilizarea de zi cu zi.',
  exterior: 'Exteriorul prezinta contextul proprietatii si accesul catre locuinta.',
};

function inferRoomType(text: string): RoomType {
  const value = text.toLowerCase();
  if (/(living|sufragerie|camera de zi|open space)/i.test(value)) return 'living';
  if (/(dormitor|bedroom|matrimonial)/i.test(value)) return 'bedroom';
  if (/(bucatar|kitchen|chicineta)/i.test(value)) return 'kitchen';
  if (/(baie|bathroom|dus|cada|toaleta)/i.test(value)) return 'bathroom';
  if (/(balcon|terasa|logie|curte|gradina)/i.test(value)) return 'balcony';
  if (/(hol|intrare|vestibul)/i.test(value)) return 'hallway';
  if (/(parcare|garaj|parking)/i.test(value)) return 'parking';
  if (/(exterior|fatada|bloc|cladire|casa|strada|acces)/i.test(value)) return 'exterior';
  return 'living';
}

function getRoomLabel(room: RoomType) {
  return ROOM_OPTIONS.find((option) => option.value === room)?.label || 'Camera';
}

function getRoomMediaType(room: RoomType): NonNullable<TikTokStudioStoryboardScene['mediaType']> {
  return ROOM_OPTIONS.find((option) => option.value === room)?.mediaType || 'other';
}

function getDefaultRoomDescription(room: RoomType, _property: PortfolioProperty, _imageAlt?: string | null) {
  return ROOM_SCRIPT_HINTS[room];
}

function estimateSceneDuration(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Number(Math.max(4.2, Math.min(12, words / 2.35)).toFixed(1));
}

function sentenceLimit(value: string, maxWords: number) {
  const words = value.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}.`;
}

function cleanNarrativeText(value: string | null | undefined) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(proprietate selectata|date|descriere portofoliu|caracteristici)\s*:\s*/i, '')
    .trim();
}

function stripPriceReferences(value: string) {
  return value
    .replace(/\bpret(?:ul)?[^.?!]*(?:[.?!]|$)/gi, '')
    .replace(/\b\d+[\d\s.,]*(?:eur|euro|\u20ac)[^.?!]*(?:[.?!]|$)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPropertyTitleParts(property: PortfolioProperty | null | undefined) {
  const parts = cleanNarrativeText(property?.title)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    name: parts[0] || property?.propertyType || 'aceasta proprietate',
    highlights: parts.slice(1),
  };
}

function joinHumanList(items: string[]) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} si ${items[items.length - 1]}`;
}

function buildPropertyFacts(property: PortfolioProperty | null | undefined, includePrice: boolean) {
  if (!property) return '';
  return [
    property.location ? `zona ${property.location}` : '',
    property.propertyType || '',
    property.squareFootage ? `${property.squareFootage} mp utili` : '',
    property.rooms ? `${property.rooms} camere` : '',
    property.bathrooms ? `${property.bathrooms} bai` : '',
    includePrice && property.price ? `pret ${property.price}` : '',
  ].filter(Boolean).join(', ');
}

function buildDefaultHookBrief(property: PortfolioProperty | null | undefined) {
  if (!property) return '';
  const titleParts = getPropertyTitleParts(property);
  const location = property.location ? ` in zona ${property.location}` : '';
  const rooms = property.rooms ? ` cu ${property.rooms} camere` : '';
  const highlightText = joinHumanList(titleParts.highlights);
  const walkableHint = highlightText
    ? `, cu ${highlightText.toLowerCase()}`
    : '';
  return `Daca ai putea descoperi o proprietate${rooms}${location}${walkableHint}, pregatita sa fie inteleasa din primele secunde, ai veni sa o vezi?`;
}

function buildPriceEnding(property: PortfolioProperty | null | undefined) {
  const price = property?.price ? `Pretul proprietatii este ${property.price}. ` : '';
  return `${price}Daca iti doresti o locuinta bine pozitionata si usor de transformat in acasa, aceasta proprietate merita programata la vizionare.`;
}

function buildPropertyIntro(property: PortfolioProperty | null | undefined) {
  if (!property) return 'Astazi iti prezint o proprietate aleasa pentru un tur scurt, clar si usor de urmarit.';
  const titleParts = getPropertyTitleParts(property);
  const location = property.location ? ` in zona ${property.location}` : '';
  const address = property.address ? `, la adresa ${property.address}` : '';
  const type = property.propertyType || 'proprietate';
  const rooms = property.rooms ? ` cu ${property.rooms} camere` : '';
  const baths = property.bathrooms ? ` si ${property.bathrooms} bai` : '';
  const size = property.squareFootage ? `, avand ${property.squareFootage} mp utili` : '';
  const highlights = titleParts.highlights.length ? ` Printre avantajele importante se numara ${joinHumanList(titleParts.highlights).toLowerCase()}.` : '';
  const description = sentenceLimit(stripPriceReferences(cleanNarrativeText(property.description)), 34);
  const base = `Astazi iti prezint ${titleParts.name}${location}${address}. Este ${type.toLowerCase()}${rooms}${baths}${size}, gandita pentru cei care cauta o locuinta practica, luminoasa si usor de inteles dintr-un tur video.${highlights}`;
  return description ? `${base} ${description}` : base;
}

function buildRoomNarrative(room: RoomType, description: string) {
  const roomLabel = getRoomLabel(room).toLowerCase();
  const cleanDescription = sentenceLimit(cleanNarrativeText(description) || ROOM_SCRIPT_HINTS[room], 42);
  const startsWithRoom = new RegExp(`^${roomLabel}\\b`, 'i').test(cleanDescription);
  if (startsWithRoom) return cleanDescription;

  const openings: Record<RoomType, string> = {
    living: 'Livingul este zona in care se simte cel mai bine atmosfera locuintei.',
    bedroom: 'Dormitorul pastreaza partea linistita si intima a proprietatii.',
    kitchen: 'Bucataria completeaza turul cu o zona practica pentru rutina de zi cu zi.',
    bathroom: 'Baia este prezentata ca un spatiu functional, curat si coerent cu restul locuintei.',
    balcony: 'Balconul sau terasa aduce acel moment de respiro care conteaza intr-o locuinta urbana.',
    hallway: 'Holul face legatura intre incaperi si seteaza prima impresie a locuintei.',
    parking: 'Zona de parcare adauga un avantaj concret pentru confortul zilnic.',
    exterior: 'Exteriorul arata contextul proprietatii si felul in care se prezinta accesul catre locuinta.',
  };
  return `${openings[room]} ${cleanDescription}`;
}

function chooseSceneAsset(assets: TikTokStudioAsset[], draftsByAssetId: Record<string, RoomDraft>, preferredRooms: RoomType[]) {
  return assets.find((asset) => preferredRooms.includes(draftsByAssetId[asset.id]?.room)) || assets[0] || null;
}

function buildScriptFromInputs({ property, hookBrief, drafts }: ScriptInput) {
  if (!property || !drafts.length) return '';
  const intro = stripPriceReferences(hookBrief || buildDefaultHookBrief(property) || buildPropertyIntro(property));
  const body = drafts
    .map((draft) => buildRoomNarrative(draft.room, draft.description))
    .filter(Boolean)
    .join(' ');
  return [intro, buildPropertyIntro(property), body, 'Iar daca toate aceste detalii sunt exact ceea ce cauti, urmatorul lucru important este pretul.', buildPriceEnding(property)].filter(Boolean).join(' ');
}

function buildScriptFromRoomDrafts(property: PortfolioProperty | null | undefined, drafts: RoomDraft[]) {
  return buildScriptFromInputs({ property, drafts });
}

function splitTextAcrossScenes(text: string, count: number) {
  const clean = text.trim();
  if (count <= 1 || !clean) return [clean];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= count) {
    const chunks = Array.from({ length: count }, () => [] as string[]);
    sentences.forEach((sentence, index) => chunks[Math.min(index, count - 1)].push(sentence));
    return chunks.map((chunk) => chunk.join(' ').trim()).filter(Boolean);
  }
  const words = clean.split(/\s+/).filter(Boolean);
  const size = Math.ceil(words.length / count);
  return Array.from({ length: count }, (_, index) => words.slice(index * size, (index + 1) * size).join(' ').trim()).filter(Boolean);
}

function groupRoomDrafts(assetIds: string[], draftsByAssetId: Record<string, RoomDraft>): RoomGroup[] {
  const groups: RoomGroup[] = [];
  const groupByRoom = new Map<RoomType, RoomGroup>();
  assetIds.forEach((assetId) => {
    const draft = draftsByAssetId[assetId] || { room: 'living' as RoomType, description: ROOM_SCRIPT_HINTS.living };
    const existing = groupByRoom.get(draft.room);
    if (existing) {
      existing.assetIds.push(assetId);
      if (!existing.description.trim() && draft.description.trim()) existing.description = draft.description;
      return;
    }
    const group = {
      room: draft.room,
      description: draft.description || ROOM_SCRIPT_HINTS[draft.room],
      assetIds: [assetId],
    };
    groupByRoom.set(draft.room, group);
    groups.push(group);
  });
  return groups;
}

function orderAssetsByRoomGroups(assets: TikTokStudioAsset[], draftsByAssetId: Record<string, RoomDraft>) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return groupRoomDrafts(assets.map((asset) => asset.id), draftsByAssetId)
    .flatMap((group) => group.assetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is TikTokStudioAsset => Boolean(asset)));
}

function buildRoomTimelineScenes(
  assets: TikTokStudioAsset[],
  draftsByAssetId: Record<string, RoomDraft>
): TikTokStudioStoryboardScene[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const motions: Array<NonNullable<TikTokStudioStoryboardScene['motion']>> = ['slow_push', 'pan_left', 'detail_zoom', 'pull_back', 'pan_right'];
  return groupRoomDrafts(assets.map((asset) => asset.id), draftsByAssetId).flatMap((group) => {
    const roomAssets = group.assetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is TikTokStudioAsset => Boolean(asset));
    const roomLabel = getRoomLabel(group.room);
    const cleanDescription = sentenceLimit(buildRoomNarrative(group.room, group.description), 58);
    const descriptionWords = cleanDescription.split(/\s+/).filter(Boolean).length;
    const desiredSceneCount = roomAssets.length === 1 && descriptionWords > 24 ? 2 : roomAssets.length;
    const visualAssets = Array.from({ length: desiredSceneCount }, (_, index) => roomAssets[index % roomAssets.length]).filter(Boolean);
    const lines = splitTextAcrossScenes(cleanDescription, visualAssets.length);
    return visualAssets.map((asset, index) => {
      const voiceoverLine = lines[index] || group.description;
      return {
        id: `room-${group.room}-${asset.id}-${index}`,
        assetId: asset.id,
        title: visualAssets.length > 1 ? `${roomLabel} ${index + 1}` : roomLabel,
        visualIntent: `Arata clar incaperea: ${roomLabel}.`,
        voiceoverLine,
        overlayText: roomLabel,
        durationSeconds: estimateSceneDuration(voiceoverLine),
        motion: motions[index % motions.length],
        safeZone: 'center',
        mediaType: getRoomMediaType(group.room),
        qualityNote: null,
        missingShotRecommendation: null,
        crop: { x: 50, y: 50, scale: 1 },
      } satisfies TikTokStudioStoryboardScene;
    });
  });
}

function buildPropertyTimelineScenes(
  assets: TikTokStudioAsset[],
  draftsByAssetId: Record<string, RoomDraft>,
  hookAssetIds: string[],
  hookBrief: string,
  property: PortfolioProperty | null | undefined
): TikTokStudioStoryboardScene[] {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const hookAssets = hookAssetIds.map((assetId) => assetMap.get(assetId)).filter((asset): asset is TikTokStudioAsset => Boolean(asset));
  const fallbackHookAssets = hookAssets.length ? hookAssets : assets.slice(0, Math.min(2, assets.length));
  const hookText = stripPriceReferences(hookBrief || buildDefaultHookBrief(property) || 'Descopera aceasta proprietate intr-un tur video gandit pentru social media.').trim();
  const hookLines = splitTextAcrossScenes(hookText, fallbackHookAssets.length);
  const hookScenes = fallbackHookAssets.map((asset, index) => ({
    id: `hook-${asset.id}-${index}`,
    assetId: asset.id,
    title: `Hook ${index + 1}`,
    visualIntent: 'Cadru de impact pentru primele secunde ale turului.',
    voiceoverLine: hookLines[index] || hookText,
    overlayText: 'Hook',
    durationSeconds: estimateSceneDuration(hookLines[index] || hookText),
    motion: index % 2 === 0 ? 'slow_push' : 'detail_zoom',
    safeZone: 'center',
    mediaType: getRoomMediaType(draftsByAssetId[asset.id]?.room || 'living'),
    qualityNote: null,
    missingShotRecommendation: null,
    crop: { x: 50, y: 50, scale: 1 },
  } satisfies TikTokStudioStoryboardScene));
  const introText = sentenceLimit(buildPropertyIntro(property), 62);
  const introAsset = chooseSceneAsset(assets, draftsByAssetId, ['exterior', 'living', 'hallway']);
  const introScene = introAsset ? [{
    id: `intro-${introAsset.id}`,
    assetId: introAsset.id,
    title: 'Introducere',
    visualIntent: 'Stabileste contextul proprietatii si pregateste turul pe incaperi.',
    voiceoverLine: introText,
    overlayText: property?.title || 'Tur proprietate',
    durationSeconds: estimateSceneDuration(introText),
    motion: 'pan_left',
    safeZone: 'center',
    mediaType: getRoomMediaType(draftsByAssetId[introAsset.id]?.room || 'exterior'),
    qualityNote: null,
    missingShotRecommendation: null,
    crop: { x: 50, y: 50, scale: 1 },
  } satisfies TikTokStudioStoryboardScene] : [];
  const roomScenes = buildRoomTimelineScenes(orderAssetsByRoomGroups(assets, draftsByAssetId), draftsByAssetId);
  const transitionText = 'Iar daca atmosfera, compartimentarea si pozitionarea se potrivesc cu ceea ce cauti, probabil urmatoarea intrebare este pretul.';
  const endingText = buildPriceEnding(property);
  const endingAsset = chooseSceneAsset(assets, draftsByAssetId, ['exterior', 'living', 'parking']) || assets[assets.length - 1];
  const endingScenes = endingAsset ? [{
    id: `price-transition-${endingAsset.id}`,
    assetId: endingAsset.id,
    title: 'Tranzitie pret',
    visualIntent: 'Pregateste momentul in care este prezentat pretul proprietatii.',
    voiceoverLine: transitionText,
    overlayText: 'Detalii finale',
    durationSeconds: estimateSceneDuration(transitionText),
    motion: 'pull_back',
    safeZone: 'center',
    mediaType: getRoomMediaType(draftsByAssetId[endingAsset.id]?.room || 'exterior'),
    qualityNote: null,
    missingShotRecommendation: null,
    crop: { x: 50, y: 50, scale: 1 },
  } satisfies TikTokStudioStoryboardScene, {
    id: `price-${endingAsset.id}`,
    assetId: endingAsset.id,
    title: 'Pret si CTA',
    visualIntent: 'Inchidere clara cu pretul si invitatia la vizionare.',
    voiceoverLine: endingText,
    overlayText: property?.price ? property.price : 'Detalii si vizionare',
    durationSeconds: estimateSceneDuration(endingText),
    motion: 'slow_push',
    safeZone: 'center',
    mediaType: getRoomMediaType(draftsByAssetId[endingAsset.id]?.room || 'living'),
    qualityNote: null,
    missingShotRecommendation: null,
    crop: { x: 50, y: 50, scale: 1 },
  } satisfies TikTokStudioStoryboardScene] : [];
  return [...hookScenes, ...introScene, ...roomScenes, ...endingScenes];
}

function buildScriptFromTimelineScenes(scenes: TikTokStudioStoryboardScene[]) {
  return scenes
    .map((scene) => scene.voiceoverLine)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPropertyCreativeContext(input: ScriptInput & { hookAssetIds: string[]; assets: TikTokStudioAsset[] }) {
  const { property, hookBrief, drafts, hookAssetIds, assets } = input;
  const facts = buildPropertyFacts(property, true);
  const hookNames = hookAssetIds
    .map((assetId) => assets.find((asset) => asset.id === assetId)?.name || assetId)
    .join(', ');
  const rooms = drafts.map((draft, index) => `${index + 1}. ${getRoomLabel(draft.room)}: ${draft.description}`).join('\n');
  return [
    property ? `Subiectul turului este ${property.title}${facts ? `, cu aceste repere de context: ${facts}.` : '.'}` : '',
    property?.description ? `Descrierea din portofoliu trebuie rescrisa natural, ca poveste, fara etichete tehnice: ${property.description}` : '',
    property?.keyFeatures ? `Integreaza firesc, doar unde suna natural, aceste avantaje: ${property.keyFeatures}` : '',
    `Hook-ul trebuie sa porneasca de la ideea: ${hookBrief || buildDefaultHookBrief(property) || 'o fraza de impact si un sumar descriptiv al proprietatii'}.`,
    hookNames ? `Scene alese pentru hook: ${hookNames}. Durata lor trebuie sincronizata cu vocea hook-ului.` : '',
    'Regula stricta: hook-ul si sumarul initial nu mentioneaza pretul. Pretul apare doar la finalul scriptului, inainte de call to action.',
    'Scrie scriptul ca o compunere cursiva, nu ca lista si nu include prefixe precum "Date", "Descriere portofoliu" sau "Proprietate selectata". Descrie incaperile pe rand, in ordinea de mai jos, astfel incat scena vizuala sa corespunda exact segmentului vorbit.',
    rooms ? `Incaperi si descrieri utilizator:\n${rooms}` : '',
  ].filter(Boolean).join('\n');
}

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
  const [propertyPhotoIds, setPropertyPhotoIds] = useState<string[]>([]);
  const [selectedPortfolioPropertyId, setSelectedPortfolioPropertyId] = useState('');
  const [roomDraftsByAssetId, setRoomDraftsByAssetId] = useState<Record<string, RoomDraft>>({});
  const [hookSceneAssetIds, setHookSceneAssetIds] = useState<string[]>([]);
  const [aiComposer, setAiComposer] = useState({
    title: 'Video AI pentru TikTok',
    script: '',
    hookBrief: '',
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
  const portfolioProperties = dashboard?.portfolioProperties || [];
  const selectedPortfolioProperty = portfolioProperties.find((property) => property.id === selectedPortfolioPropertyId) || null;
  const studioAssetById = useMemo(() => new Map(studioAssets.map((asset) => [asset.id, asset])), [studioAssets]);
  const selectedPhotoAssets = selectedPhotoIds
    .map((assetId) => studioAssetById.get(assetId))
    .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
  const propertyPhotoAssets = propertyPhotoIds
    .map((assetId) => studioAssetById.get(assetId))
    .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
  const displayedPropertyPhotoAssets = propertyPhotoAssets.length ? propertyPhotoAssets : selectedPhotoAssets;
  const selectedRoomGroups = groupRoomDrafts(selectedPhotoIds, roomDraftsByAssetId);
  const selectedRoomDrafts = selectedRoomGroups.map(({ room, description }) => ({ room, description }));
  const importedVideos = studioAssets.filter((asset) => asset.type === 'video');
  const importedPhotos = studioAssets.filter((asset) => asset.type === 'image');
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

  async function handleSelectPortfolioProperty(propertyId: string) {
    setSelectedPortfolioPropertyId(propertyId);
    const property = portfolioProperties.find((item) => item.id === propertyId);
    if (!property || !user) return;

    const images = property.images.filter((image) => image.url).slice(0, 18);
    if (!images.length) {
      toast({
        variant: 'destructive',
        title: 'Proprietate fara fotografii',
        description: 'Alege o proprietate care are fotografii in portofoliu.',
      });
      return;
    }

    setActiveAction('property-import');
    try {
      const existingByUrl = new Map(studioAssets.filter((asset) => asset.type === 'image').map((asset) => [asset.url, asset]));
      const importedAssets: TikTokStudioAsset[] = [];

      for (const [index, image] of images.entries()) {
        const existing = existingByUrl.get(image.url);
        if (existing) {
          importedAssets.push(existing);
          continue;
        }

        const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/studio-assets', {
          method: 'POST',
          body: JSON.stringify({
            type: 'image',
            name: `${property.title || 'Proprietate'} - ${image.alt || `foto ${index + 1}`}`,
            url: image.url,
            thumbnailUrl: image.url,
            mimeType: 'image/jpeg',
            source: 'upload',
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Nu am putut importa fotografiile proprietatii.');
        importedAssets.push(payload.asset as TikTokStudioAsset);
      }

      const nextDrafts = importedAssets.reduce<Record<string, RoomDraft>>((acc, asset, index) => {
        const image = images[index];
        const room = inferRoomType(`${image?.alt || ''} ${asset.name || ''}`);
        acc[asset.id] = {
          room,
          description: getDefaultRoomDescription(room, property, image?.alt),
        };
        return acc;
      }, {});
      const assetIds = importedAssets.map((asset) => asset.id);
      const hookAssetIds = assetIds.slice(0, Math.min(2, assetIds.length));
      const hookBrief = buildDefaultHookBrief(property);
      const timeline = buildPropertyTimelineScenes(importedAssets, nextDrafts, hookAssetIds, hookBrief, property);
      const script = buildScriptFromTimelineScenes(timeline);

      setRoomDraftsByAssetId(nextDrafts);
      setHookSceneAssetIds(hookAssetIds);
      setPropertyPhotoIds(assetIds);
      setSelectedPhotoIds(assetIds);
      setTimelineScenes(timeline);
      setCreativeBrief(null);
      setAiComposer((current) => ({
        ...current,
        title: property.title || current.title,
        hookBrief,
        script,
        caption: property.description || current.caption,
        hashtags: '#imobiliare #turvideo #tiktokimobiliar',
      }));
      await loadDashboard();
      toast({
        title: 'Proprietate incarcata',
        description: 'Fotografiile au fost preluate si impartite pe incaperi pentru storyboard.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import proprietate esuat',
        description: error instanceof Error ? error.message : 'Nu am putut prelua fotografiile proprietatii.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  function updateRoomDraft(assetId: string, patch: Partial<RoomDraft>) {
    setRoomDraftsByAssetId((current) => {
      const previous = current[assetId] || { room: 'living' as RoomType, description: ROOM_SCRIPT_HINTS.living };
      const room = patch.room || previous.room;
      const existingRoomDescription = Object.entries(current).find(([id, draft]) => id !== assetId && draft.room === room)?.[1]?.description;
      const nextDraft = {
        room,
        description: patch.description ?? (patch.room ? existingRoomDescription || ROOM_SCRIPT_HINTS[room] : previous.description),
      };
      const next = { ...current, [assetId]: nextDraft };
      const selectedAssets = selectedPhotoIds
        .map((id) => studioAssetById.get(id))
        .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
      const timeline = buildPropertyTimelineScenes(selectedAssets, next, hookSceneAssetIds, aiComposer.hookBrief, selectedPortfolioProperty);
      const script = buildScriptFromTimelineScenes(timeline);
      setTimelineScenes(timeline);
      setAiComposer((composer) => ({ ...composer, script }));
      return next;
    });
  }

  function updateRoomGroup(group: RoomGroup, patch: Partial<RoomDraft>) {
    setRoomDraftsByAssetId((current) => {
      const room = patch.room || group.room;
      const existingRoomDescription = Object.entries(current).find(([id, draft]) => !group.assetIds.includes(id) && draft.room === room)?.[1]?.description;
      const description = patch.description ?? (patch.room ? existingRoomDescription || group.description || ROOM_SCRIPT_HINTS[room] : group.description);
      const next = { ...current };
      group.assetIds.forEach((assetId) => {
        next[assetId] = {
          room,
          description,
        };
      });
      const selectedAssets = selectedPhotoIds
        .map((id) => studioAssetById.get(id))
        .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
      const timeline = buildPropertyTimelineScenes(selectedAssets, next, hookSceneAssetIds, aiComposer.hookBrief, selectedPortfolioProperty);
      setTimelineScenes(timeline);
      setAiComposer((composer) => ({
        ...composer,
        script: buildScriptFromTimelineScenes(timeline),
      }));
      return next;
    });
  }

  function updateHookBrief(value: string) {
    const timeline = buildPropertyTimelineScenes(selectedPhotoAssets, roomDraftsByAssetId, hookSceneAssetIds, value, selectedPortfolioProperty);
    const script = buildScriptFromTimelineScenes(timeline);
    setAiComposer((current) => ({ ...current, hookBrief: value, script }));
    setTimelineScenes(timeline);
  }

  function toggleHookScene(assetId: string) {
    setHookSceneAssetIds((current) => {
      const next = current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId];
      const timeline = buildPropertyTimelineScenes(selectedPhotoAssets, roomDraftsByAssetId, next, aiComposer.hookBrief, selectedPortfolioProperty);
      setTimelineScenes(timeline);
      setAiComposer((current) => ({ ...current, script: buildScriptFromTimelineScenes(timeline) }));
      return next;
    });
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
      const propertyContext = buildPropertyCreativeContext({
        property: selectedPortfolioProperty,
        hookBrief: aiComposer.hookBrief,
        drafts: selectedRoomDrafts,
        hookAssetIds: hookSceneAssetIds,
        assets: selectedPhotoAssets,
      });
      const localTimeline = buildPropertyTimelineScenes(selectedPhotoAssets, roomDraftsByAssetId, hookSceneAssetIds, aiComposer.hookBrief, selectedPortfolioProperty);
      const response = await authorizedFetch(user, auth, '/api/marketing/tiktok/creative-brief', {
        method: 'POST',
        body: JSON.stringify({
          title: aiComposer.title,
          preset: aiComposer.creativePreset,
          sourceAssetIds: selectedPhotoIds,
          propertyContext,
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
      setTimelineScenes(localTimeline.length ? localTimeline : brief.storyboard || []);
      const syncedScript = buildScriptFromTimelineScenes(localTimeline.length ? localTimeline : brief.storyboard || []);
      setAiComposer((current) => ({
        ...current,
        title: brief.title || current.title,
        script: syncedScript || current.script,
        hookBrief: current.hookBrief || brief.selectedHook || brief.hooks?.[0] || '',
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

  function rebuildStoryboardFromSelection(nextSelectedIds: string[], nextHookIds = hookSceneAssetIds.filter((id) => nextSelectedIds.includes(id))) {
    const selectedAssets = nextSelectedIds
      .map((id) => studioAssetById.get(id))
      .filter((asset): asset is TikTokStudioAsset => Boolean(asset));
    setHookSceneAssetIds(nextHookIds);
    const timeline = buildPropertyTimelineScenes(selectedAssets, roomDraftsByAssetId, nextHookIds, aiComposer.hookBrief, selectedPortfolioProperty);
    setTimelineScenes(timeline);
    setAiComposer((currentComposer) => ({
      ...currentComposer,
      script: buildScriptFromTimelineScenes(timeline),
    }));
  }

  function movePropertyPhoto(assetId: string, direction: -1 | 1) {
    setPropertyPhotoIds((current) => {
      const baseOrder = current.length ? current : selectedPhotoIds;
      const index = baseOrder.indexOf(assetId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= baseOrder.length) return current;
      const nextOrder = [...baseOrder];
      const [item] = nextOrder.splice(index, 1);
      nextOrder.splice(target, 0, item);
      setSelectedPhotoIds((selected) => {
        const selectedSet = new Set(selected);
        const nextSelected = [
          ...nextOrder.filter((id) => selectedSet.has(id)),
          ...selected.filter((id) => !nextOrder.includes(id)),
        ];
        rebuildStoryboardFromSelection(nextSelected);
        return nextSelected;
      });
      return nextOrder;
    });
  }

  function togglePhotoInStoryboard(assetId: string) {
    setSelectedPhotoIds((current) => {
      const next = current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId];
      const nextHookIds = hookSceneAssetIds.filter((id) => next.includes(id));
      rebuildStoryboardFromSelection(next, nextHookIds);
      return next;
    });
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

      setSelectedPhotoIds((current) => {
        const next = current.filter((id) => id !== asset.id);
        const nextHookIds = hookSceneAssetIds.filter((id) => id !== asset.id && next.includes(id));
        const selectedAssets = next
          .map((id) => studioAssetById.get(id))
          .filter((item): item is TikTokStudioAsset => Boolean(item));
        setHookSceneAssetIds(nextHookIds);
        setTimelineScenes(buildPropertyTimelineScenes(selectedAssets, roomDraftsByAssetId, nextHookIds, aiComposer.hookBrief, selectedPortfolioProperty));
        setAiComposer((currentComposer) => ({
          ...currentComposer,
          script: buildScriptFromInputs({
            property: selectedPortfolioProperty,
            hookBrief: currentComposer.hookBrief,
            drafts: groupRoomDrafts(next, roomDraftsByAssetId).map(({ room, description }) => ({ room, description })),
          }),
        }));
        return next;
      });
      setPropertyPhotoIds((current) => current.filter((id) => id !== asset.id));
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
      const renderTimeline = timelineScenes.length
        ? timelineScenes
        : buildPropertyTimelineScenes(selectedPhotoAssets, roomDraftsByAssetId, hookSceneAssetIds, aiComposer.hookBrief, selectedPortfolioProperty);
      const renderScript = buildScriptFromTimelineScenes(renderTimeline) || aiComposer.script;
      const createResponse = await authorizedFetch(user, auth, '/api/marketing/tiktok/studio-projects', {
        method: 'POST',
        body: JSON.stringify({
          title: aiComposer.title,
          sourceAssetIds: selectedPhotoIds,
          script: renderScript,
          voiceId: aiComposer.voiceId || undefined,
          voiceProfile: aiComposer.voiceProfile,
          subtitleStyle: aiComposer.subtitleStyle,
          creativePreset: aiComposer.creativePreset,
          hook: aiComposer.hook || creativeBrief?.selectedHook || null,
          caption: aiComposer.caption || creativeBrief?.caption || null,
          captionVariants: creativeBrief?.captionVariants || null,
          hashtags: splitHashtags(aiComposer.hashtags || (creativeBrief?.hashtags || []).join(' ')),
          storyboard: renderTimeline.length ? renderTimeline : creativeBrief?.storyboard || null,
          timeline: renderTimeline.length ? renderTimeline : creativeBrief?.storyboard || null,
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
    <div className="min-h-full space-y-5 bg-[radial-gradient(circle_at_8%_0%,rgba(255,0,127,0.11),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(15,30,51,0.10),transparent_28%),linear-gradient(180deg,#F8FAFF_0%,#EEF3FA_100%)] p-4 text-slate-950 lg:p-6">
      <Tabs defaultValue="ai-editor" className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Cont TikTok', value: connected ? 'Conectat' : 'Neconectat', detail: dashboard?.status.username ? `@${dashboard.status.username}` : 'OAuth TikTok', icon: Video },
            { label: 'Video tururi', value: String(dashboard?.readyVideoTours.length || 0), detail: 'gata de publicare', icon: Film },
            { label: 'Media studio', value: String(studioAssets.length), detail: `${importedPhotos.length} foto / ${importedVideos.length} video`, icon: ImageIcon },
            { label: 'Proiecte AI', value: String(studioProjects.length), detail: `${dashboard?.totals.processing || 0} in procesare`, icon: Sparkles },
          ].map((metric) => {
            const Icon = metric.icon;
            const isTikTokAccountMetric = metric.label === 'Cont TikTok';
            return (
              <div key={metric.label} className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_55px_rgba(15,30,51,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
                    {isTikTokAccountMetric && !connected ? null : (
                      <p className="mt-2 text-3xl font-black text-slate-950">{metric.value}</p>
                    )}
                    <p className={`${isTikTokAccountMetric && !connected ? 'mt-2' : 'mt-1'} text-sm text-slate-500`}>{metric.detail}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-[#FF0050]">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {isTikTokAccountMetric ? (
                  <div className="mt-4 flex items-center gap-2">
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
                        className={`${STUDIO_PRIMARY_BUTTON} px-5`}
                        onClick={() => void handleConnect()}
                      >
                        {activeAction === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                        Conecteaza TikTok
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Reimprospateaza"
                      title="Reimprospateaza"
                      className="h-11 w-11 shrink-0 rounded-full border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                      onClick={() => void loadDashboard()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={`${STUDIO_PANEL} p-2`}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[20px] bg-slate-100/80 p-1 lg:grid-cols-4">
            <TabsTrigger value="ai-editor" className="rounded-2xl border border-slate-200/80 bg-white/65 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-pink-200 hover:bg-white hover:text-[#FF0050] data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-md">
              <Wand2 className="mr-2 h-4 w-4" />
              AI Video Editor
            </TabsTrigger>
            <TabsTrigger value="video-tours" className="rounded-2xl border border-slate-200/80 bg-white/65 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-pink-200 hover:bg-white hover:text-[#FF0050] data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-md">
              <Film className="mr-2 h-4 w-4" />
              Video tururi
            </TabsTrigger>
            <TabsTrigger value="publishing" className="rounded-2xl border border-slate-200/80 bg-white/65 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-pink-200 hover:bg-white hover:text-[#FF0050] data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-md">
              <Send className="mr-2 h-4 w-4" />
              Publicare
            </TabsTrigger>
            <TabsTrigger value="performance" className="rounded-2xl border border-slate-200/80 bg-white/65 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-pink-200 hover:bg-white hover:text-[#FF0050] data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-[#FF0050] data-[state=active]:shadow-md">
              <BarChart3 className="mr-2 h-4 w-4" />
              Performanta
            </TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="ai-editor" className="mt-0 space-y-5">
          <div className={`${STUDIO_PANEL} overflow-hidden`}>
            <div className="border-b border-slate-200/80 bg-white/80 p-4">
              <div className="grid gap-5 lg:grid-cols-6">
                {STUDIO_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index <= (selectedPhotoIds.length >= 2 ? 2 : studioAssets.length ? 1 : 0);
                  return (
                    <div key={step.label} className="relative">
                      <div className={`relative z-10 rounded-2xl border px-3 py-2.5 lg:pr-7 ${isActive ? 'border-pink-200 bg-pink-50 text-[#FF0050]' : 'border-slate-200 bg-white text-slate-500'}`}>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <p className="min-w-0 truncate text-[13px] font-black leading-5">{step.label}</p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] leading-4 opacity-75">{step.detail}</p>
                      </div>
                      {index < STUDIO_STEPS.length - 1 ? (
                        <div className="pointer-events-none absolute -right-5 top-1/2 z-20 hidden -translate-y-1/2 lg:flex">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-pink-100 bg-white text-[#FF0050] shadow-[0_10px_24px_rgba(255,0,80,0.14)]">
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid h-[calc(100vh-96px)] min-h-[720px] gap-0 overflow-hidden xl:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)]">
              <section className="relative h-full min-h-0 overflow-y-auto border-b border-slate-200/80 bg-slate-50 p-5 text-slate-950 xl:border-b-0 xl:border-r">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,0,127,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.88),transparent_28%)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FF4F9D]">Portofoliu</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">Proprietate si incaperi</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
                    <Layers3 className="h-4 w-4 text-[#FF007F]" />
                    Storyboard sincronizat
                  </div>
                </div>

                <div className="relative mt-5 rounded-[34px] border border-slate-200 bg-white/90 p-4 shadow-[0_28px_70px_rgba(15,30,51,0.13)]">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <Label className="text-slate-700">Alege proprietatea din portofoliu</Label>
                      <Select value={selectedPortfolioPropertyId} onValueChange={(value) => void handleSelectPortfolioProperty(value)}>
                        <SelectTrigger className={`mt-2 h-12 ${STUDIO_FIELD}`}>
                          <SelectValue placeholder="Selecteaza o proprietate cu fotografii..." />
                        </SelectTrigger>
                        <SelectContent>
                          {portfolioProperties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge className="h-10 rounded-full border-slate-200 bg-slate-100 px-4 text-slate-800 hover:bg-slate-100">
                      {selectedPhotoIds.length}/{displayedPropertyPhotoAssets.length || selectedPhotoIds.length} selectate
                    </Badge>
                  </div>

                  {activeAction === 'property-import' ? (
                    <div className="mt-4 rounded-[22px] border border-pink-100 bg-pink-50 p-4 text-sm font-semibold text-[#FF0050]">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Preiau fotografiile proprietatii si pregatesc storyboard-ul...
                    </div>
                  ) : null}

                  {selectedPortfolioProperty ? (
                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-950">{selectedPortfolioProperty.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[selectedPortfolioProperty.location, selectedPortfolioProperty.price, selectedPortfolioProperty.squareFootage ? `${selectedPortfolioProperty.squareFootage} mp` : null].filter(Boolean).join(' | ') || 'Fotografiile vor fi sincronizate cu scriptul.'}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {displayedPropertyPhotoAssets.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {displayedPropertyPhotoAssets.map((asset, index) => {
                          const draft = roomDraftsByAssetId[asset.id] || { room: 'living' as RoomType, description: ROOM_SCRIPT_HINTS.living };
                          const isDeleting = activeAction === `delete-asset:${asset.id}`;
                          const isSelectedPhoto = selectedPhotoIds.includes(asset.id);
                          const canMoveUp = index > 0;
                          const canMoveDown = index < displayedPropertyPhotoAssets.length - 1;
                          return (
                            <div key={asset.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                              <div className="relative aspect-[4/3] bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={asset.url} alt="" className="h-full w-full object-cover" />
                                <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-xs font-black text-slate-800 shadow-sm">#{index + 1}</span>
                                <button
                                  type="button"
                                  className={`absolute left-3 bottom-3 rounded-full px-3 py-1.5 text-xs font-black shadow-lg backdrop-blur transition ${isSelectedPhoto ? 'bg-[#FF0050] text-white' : 'bg-white/92 text-slate-950 hover:bg-white'}`}
                                  onClick={() => togglePhotoInStoryboard(asset.id)}
                                >
                                  {isSelectedPhoto ? 'Selectat' : 'Selecteaza'}
                                </button>
                                <div className="absolute bottom-3 right-3 flex gap-1.5">
                                  <button
                                    type="button"
                                    disabled={!canMoveUp}
                                    aria-label="Muta fotografia mai sus"
                                    title="Muta mai sus"
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => movePropertyPhoto(asset.id, -1)}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveDown}
                                    aria-label="Muta fotografia mai jos"
                                    title="Muta mai jos"
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => movePropertyPhoto(asset.id, 1)}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  className="absolute right-3 top-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-rose-600 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-70"
                                  onClick={() => void handleDeleteStudioAsset(asset)}
                                >
                                  {isDeleting ? 'Sterg...' : 'Sterge'}
                                </button>
                              </div>
                              <div className="p-3">
                                <Label className="text-xs font-bold text-slate-600">Tip incapere</Label>
                                <Select value={draft.room} onValueChange={(value) => updateRoomDraft(asset.id, { room: value as RoomType })}>
                                  <SelectTrigger className={`mt-1 h-10 ${STUDIO_FIELD}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROOM_OPTIONS.map((room) => (
                                      <SelectItem key={room.value} value={room.value}>{room.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <Layers3 className="mx-auto h-10 w-10 text-[#FF0050]/70" />
                        <p className="mt-3 text-sm font-semibold text-slate-600">Selecteaza o proprietate pentru a prelua automat fotografiile.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-4 rounded-[26px] border border-slate-200 bg-white/85 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm font-black text-slate-950">Timeline</p>
                      <p className="text-xs text-slate-500">{timelineScenes.length ? 'Hook, incaperi si pret final in ordinea randarii' : 'Storyboard AI asteapta selectia'}</p>
                    </div>
                    <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-[#FF007F]">
                      {timelineScenes.length || selectedPhotoAssets.length || 0} scene
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {timelineScenes.length ? timelineScenes.map((scene, index) => {
                      const asset = scene.assetId ? studioAssetById.get(scene.assetId) : null;
                      return (
                        <div key={scene.id || index} className="min-w-[116px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <div className="relative aspect-[9/12] bg-white">
                            {asset ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={asset.url} alt="" className="h-full w-full object-cover" />
                              </>
                            ) : (
                              <div className="grid h-full place-items-center">
                                <Film className="h-6 w-6 text-slate-300" />
                              </div>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/62 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">#{index + 1}</span>
                          </div>
                          <div className="p-2">
                            <p className="line-clamp-1 text-xs font-black text-[#FF007F]">{scene.title}</p>
                            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{scene.durationSeconds?.toFixed?.(1) || scene.durationSeconds || 0}s</p>
                          </div>
                        </div>
                      );
                    }) : STUDIO_STEPS.slice(0, 5).map((step, index) => (
                      <div key={step.label} className="min-w-[128px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-black text-[#FF007F]">Pas {index + 1}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{step.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="flex h-full min-h-0 flex-col bg-white/85">
                <div className="flex items-center justify-between gap-3 p-5 pb-0">
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

                <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 py-4">
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

                  <div className="rounded-[22px] border border-pink-100 bg-pink-50/55 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-slate-800">Hook si sumar initial</Label>
                      <Badge className="rounded-full border-pink-100 bg-white px-2.5 py-1 text-[#FF0050] hover:bg-white">
                        fara pret
                      </Badge>
                    </div>
                    <Textarea
                      value={aiComposer.hookBrief}
                      onChange={(event) => updateHookBrief(event.target.value)}
                      className={`mt-2 min-h-[92px] bg-white ${STUDIO_FIELD}`}
                      placeholder="Fraza de impact si sumar descriptiv al proprietatii. Pretul va fi pus automat doar la final."
                    />
                    <div className="mt-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Scene pentru hook</p>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {selectedPhotoAssets.length ? selectedPhotoAssets.map((asset, index) => {
                          const selected = hookSceneAssetIds.includes(asset.id);
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => toggleHookScene(asset.id)}
                              className={`relative h-16 min-w-[64px] overflow-hidden rounded-2xl border-2 bg-white transition ${selected ? 'border-[#FF0050] shadow-[0_10px_24px_rgba(255,0,80,0.18)]' : 'border-white hover:border-pink-200'}`}
                              aria-pressed={selected}
                              title={`Scena hook ${index + 1}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={asset.url} alt="" className="h-full w-full object-cover" />
                              <span className={`absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-black ${selected ? 'bg-[#FF0050] text-white' : 'bg-white/90 text-slate-700'}`}>#{index + 1}</span>
                            </button>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-pink-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                            Alege o proprietate pentru scene.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-slate-800">Descrieri pe incaperi</Label>
                      <span className="text-xs font-bold text-slate-500">{selectedRoomGroups.length} incaperi</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedRoomGroups.length ? selectedRoomGroups.map((group) => {
                        const roomAssets = group.assetIds.map((assetId) => studioAssetById.get(assetId)).filter((asset): asset is TikTokStudioAsset => Boolean(asset));
                        return (
                          <div key={group.room} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex gap-3">
                              <div className="flex w-20 shrink-0 -space-x-8 overflow-hidden rounded-2xl bg-slate-100 p-1">
                                {roomAssets.slice(0, 3).map((asset) => (
                                  <div key={asset.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-slate-100 shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                                  </div>
                                ))}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{group.assetIds.length} foto</span>
                                  <Select value={group.room} onValueChange={(value) => updateRoomGroup(group, { room: value as RoomType })}>
                                    <SelectTrigger className={`h-9 flex-1 ${STUDIO_FIELD}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ROOM_OPTIONS.map((room) => (
                                        <SelectItem key={room.value} value={room.value}>{room.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Textarea
                                  value={group.description}
                                  onChange={(event) => updateRoomGroup(group, { description: event.target.value })}
                                  className={`mt-2 min-h-[76px] ${STUDIO_FIELD}`}
                                  placeholder="Scrie descrierea sau cateva idei cheie pentru aceasta incapere..."
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">
                          Selecteaza o proprietate din portofoliu ca sa apara incaperile aici.
                        </div>
                      )}
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
                </div>
                <div className="border-t border-pink-100 bg-white/95 p-5 shadow-[0_-18px_40px_rgba(255,0,80,0.12)]">
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
