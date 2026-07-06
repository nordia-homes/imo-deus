'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Eye, ImageIcon, Images, Loader2, MessageCircle, Play, Save, Share2, ShieldCheck, ThumbsUp, Upload } from 'lucide-react';
import type { MetaMarketingCampaignDraft } from '@/lib/types';
import { useAuth, useStorage, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type CampaignForm = {
  campaignName: string;
  adSetName: string;
  adName: string;
  objective: MetaMarketingCampaignDraft['objective'];
  budgetType: MetaMarketingCampaignDraft['budgetType'];
  budgetAmount: string;
  durationDays: string;
  startsAt: string;
  endsAt: string;
  startMode: NonNullable<MetaMarketingCampaignDraft['startMode']>;
  locationLabel: string;
  radiusKm: string;
  headline: string;
  primaryText: string;
  creativeFormat: NonNullable<MetaMarketingCampaignDraft['creativeFormat']>;
  creativeAspectRatio: NonNullable<MetaMarketingCampaignDraft['creativeAspectRatio']>;
  previewDevice: NonNullable<MetaMarketingCampaignDraft['previewDevice']>;
  placements: NonNullable<MetaMarketingCampaignDraft['placements']>;
  optimizationGoal: NonNullable<MetaMarketingCampaignDraft['optimizationGoal']>;
  billingEvent: NonNullable<MetaMarketingCampaignDraft['billingEvent']>;
  abTestEnabled: boolean;
  creativeVariants: NonNullable<MetaMarketingCampaignDraft['creativeVariants']>;
  callToAction: MetaMarketingCampaignDraft['callToAction'];
  imageUrl: string;
  imageAlt: string;
  mediaItems: NonNullable<MetaMarketingCampaignDraft['mediaItems']>;
  videoUrl: string;
  videoThumbnailUrl: string;
  destinationUrl: string;
  destinationType: NonNullable<MetaMarketingCampaignDraft['destinationType']>;
  utmEnabled: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
};

type PropertyImage = {
  url: string;
  alt?: string | null;
};

type Props = {
  open: boolean;
  campaign: MetaMarketingCampaignDraft | null;
  propertyImages?: PropertyImage[];
  fallbackTitle?: string;
  pageName?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (campaign: MetaMarketingCampaignDraft) => void;
  onReady?: (campaignId: string) => void;
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

function buildFormFromCampaign(campaign: MetaMarketingCampaignDraft): CampaignForm {
  return {
    campaignName: campaign.campaignName || `Promovare ${campaign.headline || 'proprietate'}`,
    adSetName: campaign.adSetName || `${campaign.locationLabel || 'Housing'} - ${campaign.durationDays || 7} zile`,
    adName: campaign.adName || `${campaign.headline || 'Creativ principal'}`,
    objective: campaign.objective,
    budgetType: campaign.budgetType,
    budgetAmount: String(campaign.budgetAmount || 50),
    durationDays: String(campaign.durationDays || 7),
    startsAt: campaign.startsAt || '',
    endsAt: campaign.endsAt || '',
    startMode: campaign.startMode || 'now',
    locationLabel: campaign.locationLabel || '',
    radiusKm: String(campaign.radiusKm || 25),
    headline: campaign.headline || '',
    primaryText: campaign.primaryText || '',
    creativeFormat: campaign.creativeFormat || 'single_image',
    creativeAspectRatio: campaign.creativeAspectRatio || '1:1',
    previewDevice: campaign.previewDevice || 'mobile',
    placements: campaign.placements || ['facebook_feed', 'instagram_feed'],
    optimizationGoal: campaign.optimizationGoal || (campaign.objective === 'messages' ? 'messages' : campaign.objective === 'traffic' ? 'landing_page_views' : 'leads'),
    billingEvent: campaign.billingEvent || 'impressions',
    abTestEnabled: Boolean(campaign.abTestEnabled),
    creativeVariants: campaign.creativeVariants || [],
    callToAction: campaign.callToAction || 'LEARN_MORE',
    imageUrl: campaign.imageUrl || '',
    imageAlt: campaign.imageAlt || '',
    mediaItems: campaign.mediaItems || (campaign.imageUrl ? [{
      url: campaign.imageUrl,
      type: 'image',
      alt: campaign.imageAlt || campaign.headline,
      name: null,
      source: 'property',
    }] : []),
    videoUrl: campaign.videoUrl || '',
    videoThumbnailUrl: campaign.videoThumbnailUrl || '',
    destinationUrl: campaign.destinationUrl || '',
    destinationType: campaign.destinationType || 'property_page',
    utmEnabled: campaign.utmEnabled !== false,
    utmSource: campaign.utmSource || 'meta',
    utmMedium: campaign.utmMedium || 'paid_social',
    utmCampaign: campaign.utmCampaign || `property_${campaign.propertyId}`,
    utmContent: campaign.utmContent || 'main_creative',
  };
}

function serializeForm(form: CampaignForm) {
  return {
    campaignName: form.campaignName,
    adSetName: form.adSetName,
    adName: form.adName,
    objective: form.objective,
    budgetType: form.budgetType,
    budgetAmount: Number(form.budgetAmount) || 50,
    durationDays: Number(form.durationDays) || 7,
    startsAt: form.startMode === 'scheduled' ? form.startsAt || null : null,
    endsAt: form.endsAt || null,
    startMode: form.startMode,
    locationLabel: form.locationLabel,
    radiusKm: Number(form.radiusKm) || 25,
    headline: form.headline,
    primaryText: form.primaryText,
    creativeFormat: form.creativeFormat,
    creativeAspectRatio: form.creativeAspectRatio,
    previewDevice: form.previewDevice,
    placements: form.placements,
    optimizationGoal: form.optimizationGoal,
    billingEvent: form.billingEvent,
    abTestEnabled: form.abTestEnabled,
    creativeVariants: form.abTestEnabled ? form.creativeVariants : [],
    callToAction: form.callToAction,
    imageUrl: form.imageUrl || null,
    imageAlt: form.imageAlt || null,
    mediaItems: form.mediaItems,
    videoUrl: form.videoUrl || null,
    videoThumbnailUrl: form.videoThumbnailUrl || null,
    destinationUrl: form.destinationUrl,
    destinationType: form.destinationType,
    utmEnabled: form.utmEnabled,
    utmSource: form.utmSource || null,
    utmMedium: form.utmMedium || null,
    utmCampaign: form.utmCampaign || null,
    utmContent: form.utmContent || null,
  };
}

function getDomain(url?: string) {
  if (!url) return 'imodeus.ro';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'imodeus.ro';
  }
}

function ctaLabel(value: MetaMarketingCampaignDraft['callToAction']) {
  if (value === 'CONTACT_US') return 'Contacteaza-ne';
  if (value === 'SEND_MESSAGE') return 'Trimite mesaj';
  return 'Afla mai multe';
}

function collapseFacebookText(value: string, maxLength = 165) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return { text: normalized, isTruncated: false };
  }
  const cut = normalized.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return {
    text: (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trimEnd(),
    isTruncated: true,
  };
}

function withUtmParameters(form: CampaignForm) {
  if (!form.utmEnabled || !form.destinationUrl) return form.destinationUrl;
  try {
    const url = new URL(form.destinationUrl);
    if (form.utmSource) url.searchParams.set('utm_source', form.utmSource);
    if (form.utmMedium) url.searchParams.set('utm_medium', form.utmMedium);
    if (form.utmCampaign) url.searchParams.set('utm_campaign', form.utmCampaign);
    if (form.utmContent) url.searchParams.set('utm_content', form.utmContent);
    return url.toString();
  } catch {
    return form.destinationUrl;
  }
}

function getMediaAspectClass(aspectRatio: CampaignForm['creativeAspectRatio']) {
  if (aspectRatio === '4:5') return 'aspect-[4/5]';
  if (aspectRatio === 'original') return 'max-h-[420px]';
  return 'aspect-square';
}

function getPlacementLabel(placement: NonNullable<MetaMarketingCampaignDraft['placements']>[number]) {
  if (placement === 'facebook_feed') return 'Facebook Feed';
  if (placement === 'instagram_feed') return 'Instagram Feed';
  if (placement === 'facebook_story') return 'Facebook Stories';
  return 'Instagram Stories';
}

export function MetaCampaignEditorDialog({
  open,
  campaign,
  propertyImages = [],
  fallbackTitle = 'Proprietate ImoDeus',
  pageName = 'ImoDeus',
  onOpenChange,
  onSaved,
  onReady,
}: Props) {
  const { user } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const { toast } = useToast();
  const [form, setForm] = useState<CampaignForm | null>(campaign ? buildFormFromCampaign(campaign) : null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  useEffect(() => {
    setForm(campaign ? buildFormFromCampaign(campaign) : null);
    setIsTextExpanded(false);
  }, [campaign?.id, campaign?.updatedAt]);

  function updateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function togglePlacement(placement: CampaignForm['placements'][number]) {
    setForm((current) => {
      if (!current) return current;
      const exists = current.placements.includes(placement);
      const nextPlacements = exists
        ? current.placements.filter((item) => item !== placement)
        : [...current.placements, placement];
      return { ...current, placements: nextPlacements.length ? nextPlacements : current.placements };
    });
  }

  function selectImage(url: string, alt?: string | null) {
    setForm((current) => current ? {
      ...current,
      imageUrl: url,
      imageAlt: alt || current.headline || fallbackTitle,
      videoThumbnailUrl: current.videoThumbnailUrl || url,
    } : current);
  }

  function removeMedia(url: string) {
    setForm((current) => {
      if (!current) return current;
      const nextMedia = current.mediaItems.filter((item) => item.url !== url);
      const nextImage = current.imageUrl === url ? nextMedia.find((item) => item.type === 'image') : null;
      const nextVideo = current.videoUrl === url ? nextMedia.find((item) => item.type === 'video') : null;
      return {
        ...current,
        mediaItems: nextMedia,
        imageUrl: current.imageUrl === url ? nextImage?.url || '' : current.imageUrl,
        imageAlt: current.imageUrl === url ? nextImage?.alt || '' : current.imageAlt,
        videoUrl: current.videoUrl === url ? nextVideo?.url || '' : current.videoUrl,
        videoThumbnailUrl: current.videoThumbnailUrl === url ? '' : current.videoThumbnailUrl,
      };
    });
  }

  function moveMedia(url: string, direction: -1 | 1) {
    setForm((current) => {
      if (!current) return current;
      const index = current.mediaItems.findIndex((item) => item.url === url);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.mediaItems.length) return current;
      const nextMedia = [...current.mediaItems];
      const [item] = nextMedia.splice(index, 1);
      nextMedia.splice(nextIndex, 0, item);
      return { ...current, mediaItems: nextMedia };
    });
  }

  function updateCreativeVariant(index: number, key: 'headline' | 'primaryText', value: string) {
    setForm((current) => {
      if (!current) return current;
      const variants = [...current.creativeVariants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...current, creativeVariants: variants };
    });
  }

  function addCreativeVariant() {
    setForm((current) => {
      if (!current || current.creativeVariants.length >= 3) return current;
      return {
        ...current,
        creativeVariants: [
          ...current.creativeVariants,
          { headline: current.headline, primaryText: current.primaryText },
        ],
      };
    });
  }

  function removeCreativeVariant(index: number) {
    setForm((current) => {
      if (!current) return current;
      return { ...current, creativeVariants: current.creativeVariants.filter((_, variantIndex) => variantIndex !== index) };
    });
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !campaign) return;

    setIsUploadingMedia(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const mediaRef = ref(storage, `agencies/${campaign.agencyId}/meta-campaigns/${campaign.id}/${Date.now()}-${safeName}`);
        await uploadBytes(mediaRef, file, { contentType: file.type });
        const url = await getDownloadURL(mediaRef);
        return {
          url,
          type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
          alt: file.name,
          name: file.name,
          source: 'upload' as const,
        };
      }));

      setForm((current) => {
        if (!current) return current;
        const nextMedia = [...current.mediaItems, ...uploaded].slice(0, 10);
        const firstImage = uploaded.find((item) => item.type === 'image');
        const firstVideo = uploaded.find((item) => item.type === 'video');
        return {
          ...current,
          mediaItems: nextMedia,
          imageUrl: current.imageUrl || firstImage?.url || '',
          imageAlt: current.imageAlt || firstImage?.alt || '',
          videoUrl: current.videoUrl || firstVideo?.url || '',
          creativeFormat: firstVideo && !current.videoUrl ? 'video' : current.creativeFormat,
        };
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload esuat',
        description: error instanceof Error ? error.message : 'Nu am putut incarca media pentru reclama.',
      });
    } finally {
      setIsUploadingMedia(false);
      event.target.value = '';
    }
  }

  async function saveDraft() {
    if (!user || !campaign || !form) return null;
    setIsSaving(true);
    try {
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${campaign.id}`, {
        method: 'PATCH',
        body: JSON.stringify(serializeForm(form)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut salva campania Meta.');
      }
      const updated = payload.campaign as MetaMarketingCampaignDraft;
      setForm(buildFormFromCampaign(updated));
      onSaved?.(updated);
      return updated;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    try {
      await saveDraft();
      toast({
        title: 'Draft salvat',
        description: 'Campania ramane editabila pana cand este trimisa la publicare.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva draftul Meta.',
      });
    }
  }

  async function handleMarkReady() {
    if (!user || !campaign) return;
    setIsMarkingReady(true);
    try {
      const saved = await saveDraft();
      const campaignId = saved?.id || campaign.id;
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${campaignId}/ready`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut marca draftul ca pregatit.');
      }
      onReady?.(campaignId);
      onOpenChange(false);
      toast({
        title: 'Campanie pregatita',
        description: 'Draftul este gata pentru pasul de publicare Meta dupa App Review.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Campanie neconfirmata',
        description: error instanceof Error ? error.message : 'Nu am putut pregati campania pentru publicare.',
      });
    } finally {
      setIsMarkingReady(false);
    }
  }

  const imageMediaItems = form?.mediaItems.filter((item) => item.type === 'image') || [];
  const videoMediaItems = form?.mediaItems.filter((item) => item.type === 'video') || [];
  const selectedImageUrl = form?.imageUrl || '';
  const availableImageItems = [
    ...imageMediaItems,
    ...propertyImages
      .filter((image) => image?.url && !imageMediaItems.some((item) => item.url === image.url))
      .map((image) => ({
        url: image.url,
        type: 'image' as const,
        alt: image.alt || fallbackTitle,
        name: null,
        source: 'property' as const,
      })),
  ];
  const previewImages = form?.creativeFormat === 'carousel'
    ? imageMediaItems.slice(0, 6)
    : imageMediaItems.filter((item) => item.url === selectedImageUrl).slice(0, 1);
  const activeVideoUrl = form?.videoUrl || videoMediaItems[0]?.url || '';
  const collapsedText = collapseFacebookText(form?.primaryText || '');
  const destinationPreviewUrl = form ? withUtmParameters(form) : '';
  const totalBudget = form ? (Number(form.budgetAmount) || 0) * (form.budgetType === 'daily' ? Number(form.durationDays) || 1 : 1) : 0;
  const hasValidUrl = Boolean(form?.destinationUrl && /^https?:\/\//.test(form.destinationUrl));
  const validationItems = form ? [
    { label: 'Nume campanie, ad set si ad completate', ok: Boolean(form.campaignName && form.adSetName && form.adName) },
    { label: 'Buget minim 10 RON si durata valida', ok: Number(form.budgetAmount) >= 10 && Number(form.durationDays) >= 1 },
    { label: 'Text, titlu si CTA completate', ok: Boolean(form.primaryText.trim() && form.headline.trim() && form.callToAction) },
    { label: 'Creative media selectat pentru formatul ales', ok: form.creativeFormat === 'video' ? Boolean(activeVideoUrl) : imageMediaItems.length > 0 },
    { label: 'Link destinatie public si valid', ok: hasValidUrl },
    { label: 'Audienta Housing pe oras / zona metropolitana', ok: Boolean(form.locationLabel.trim()) && Number(form.radiusKm) >= 15 },
    { label: 'Cel putin un placement selectat', ok: form.placements.length > 0 },
    { label: 'UTM configurat pentru masurare', ok: !form.utmEnabled || Boolean(form.utmSource && form.utmMedium && form.utmCampaign) },
  ] : [];
  const canMarkReady = validationItems.every((item) => item.ok);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden border-white/10 bg-[#0F1E33] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
          <DialogTitle>Configureaza campania Meta</DialogTitle>
          <DialogDescription className="text-white/60">
            Pregateste reclama Housing pentru aceasta proprietate. Publicarea live ramane blocata pana la App Review.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
            <div className="min-h-0 overflow-y-auto px-6 py-5 pr-4 lg:max-h-[calc(92vh-10.5rem)]">
              <div className="space-y-5">
                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Setari campanie</p>
                    <p className="mt-1 text-xs text-white/45">Alege obiectivul, bugetul, durata si CTA-ul reclamei.</p>
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label className="text-white/70">Nume campanie</Label>
                      <Input value={form.campaignName} onChange={(event) => updateForm('campaignName', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-white/70">Nume ad set</Label>
                        <Input value={form.adSetName} onChange={(event) => updateForm('adSetName', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70">Nume ad</Label>
                        <Input value={form.adName} onChange={(event) => updateForm('adName', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-white/70">Obiectiv</Label>
                  <Select value={form.objective} onValueChange={(value) => updateForm('objective', value as CampaignForm['objective'])}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Lead-uri</SelectItem>
                      <SelectItem value="messages">Mesaje</SelectItem>
                      <SelectItem value="traffic">Trafic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Buget</Label>
                  <div className="grid grid-cols-[1fr_auto] items-center overflow-hidden rounded-md border border-white/15 bg-white/10">
                    <Input value={form.budgetAmount} onChange={(event) => updateForm('budgetAmount', event.target.value)} inputMode="numeric" className="border-0 bg-transparent text-white focus-visible:ring-0" />
                    <span className="px-3 text-sm font-semibold text-white/70">RON</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Durata zile</Label>
                  <Input value={form.durationDays} onChange={(event) => updateForm('durationDays', event.target.value)} inputMode="numeric" className="border-white/15 bg-white/10 text-white" />
                </div>
              </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white/70">Tip buget</Label>
                      <Select value={form.budgetType} onValueChange={(value) => updateForm('budgetType', value as CampaignForm['budgetType'])}>
                        <SelectTrigger className="border-white/15 bg-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Zilnic</SelectItem>
                          <SelectItem value="lifetime">Total campanie</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70">Call to action</Label>
                      <Select value={form.callToAction} onValueChange={(value) => updateForm('callToAction', value as CampaignForm['callToAction'])}>
                        <SelectTrigger className="border-white/15 bg-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LEARN_MORE">Afla mai multe</SelectItem>
                          <SelectItem value="CONTACT_US">Contacteaza-ne</SelectItem>
                          <SelectItem value="SEND_MESSAGE">Trimite mesaj</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-white/70">Pornire</Label>
                        <Select value={form.startMode} onValueChange={(value) => updateForm('startMode', value as CampaignForm['startMode'])}>
                          <SelectTrigger className="border-white/15 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="now">Imediat dupa publicare</SelectItem>
                            <SelectItem value="scheduled">Programata</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70">Start</Label>
                        <Input
                          type="datetime-local"
                          value={form.startsAt}
                          onChange={(event) => updateForm('startsAt', event.target.value)}
                          disabled={form.startMode === 'now'}
                          className="border-white/15 bg-white/10 text-white disabled:opacity-45"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/70">Final</Label>
                        <Input type="datetime-local" value={form.endsAt} onChange={(event) => updateForm('endsAt', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/45">
                      Total estimat: <span className="font-semibold text-white">{totalBudget.toLocaleString('ro-RO')} RON</span>
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white/70">Optimizare</Label>
                      <Select value={form.optimizationGoal} onValueChange={(value) => updateForm('optimizationGoal', value as CampaignForm['optimizationGoal'])}>
                        <SelectTrigger className="border-white/15 bg-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="leads">Lead-uri</SelectItem>
                          <SelectItem value="landing_page_views">Vizite pagina</SelectItem>
                          <SelectItem value="messages">Conversatii</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70">Billing event</Label>
                      <Select value={form.billingEvent} onValueChange={(value) => updateForm('billingEvent', value as CampaignForm['billingEvent'])}>
                        <SelectTrigger className="border-white/15 bg-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="impressions">Impressions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Creativ reclama</p>
                    <p className="mt-1 text-xs text-white/45">Controleaza formatul, titlul si textul care apar in feed.</p>
                  </div>

              <div className="space-y-2">
                <Label className="text-white/70">Format creativ</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: 'single_image', label: 'O imagine', helper: 'Postare simpla', icon: ImageIcon },
                    { value: 'carousel', label: 'Carusel', helper: 'Mai multe poze', icon: Images },
                    { value: 'video', label: 'Video', helper: 'Creativ video', icon: Play },
                  ].map((option) => {
                    const Icon = option.icon;
                    const isActive = form.creativeFormat === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'flex min-h-20 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition',
                          isActive
                            ? 'border-emerald-300 bg-emerald-300 text-[#06351f] shadow-emerald-900/20 ring-2 ring-emerald-200/40'
                            : 'border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15'
                        )}
                        onClick={() => updateForm('creativeFormat', option.value as CampaignForm['creativeFormat'])}
                      >
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', isActive ? 'bg-white/70' : 'bg-white/10')}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{option.label}</span>
                          <span className={cn('block text-xs', isActive ? 'text-[#0a5735]' : 'text-white/55')}>{option.helper}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Crop / aspect preview</Label>
                  <Select value={form.creativeAspectRatio} onValueChange={(value) => updateForm('creativeAspectRatio', value as CampaignForm['creativeAspectRatio'])}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">Patrat 1:1</SelectItem>
                      <SelectItem value="4:5">Vertical 4:5</SelectItem>
                      <SelectItem value="original">Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Preview</Label>
                  <Select value={form.previewDevice} onValueChange={(value) => updateForm('previewDevice', value as CampaignForm['previewDevice'])}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">Mobil</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Titlu</Label>
                <Input value={form.headline} onChange={(event) => updateForm('headline', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                <p className="text-xs text-white/45">Titlul este preluat din titlul proprietatii si poate fi ajustat manual.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Text reclama</Label>
                <Textarea value={form.primaryText} onChange={(event) => updateForm('primaryText', event.target.value)} className="min-h-44 border-white/15 bg-white/10 text-white" />
                <p className="text-xs text-white/45">{form.primaryText.length} caractere. Meta poate trunchia vizual textul lung in feed, dar draftul pastreaza paragrafele.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Variante creative A/B</p>
                    <p className="mt-1 text-xs text-white/45">Pregateste pana la 3 variante de titlu si text pentru testare.</p>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold',
                      form.abTestEnabled ? 'border-emerald-300 bg-emerald-300 text-[#06351f]' : 'border-white/15 bg-white/10 text-white/70'
                    )}
                    onClick={() => updateForm('abTestEnabled', !form.abTestEnabled)}
                  >
                    {form.abTestEnabled ? 'Activ' : 'Inactiv'}
                  </button>
                </div>
                {form.abTestEnabled ? (
                  <div className="mt-3 space-y-3">
                    {form.creativeVariants.map((variant, index) => (
                      <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Varianta {index + 1}</p>
                          <button type="button" className="text-xs font-semibold text-red-200 hover:text-red-100" onClick={() => removeCreativeVariant(index)}>
                            Sterge
                          </button>
                        </div>
                        <Input value={variant.headline} onChange={(event) => updateCreativeVariant(index, 'headline', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                        <Textarea value={variant.primaryText} onChange={(event) => updateCreativeVariant(index, 'primaryText', event.target.value)} className="min-h-24 border-white/15 bg-white/10 text-white" />
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={addCreativeVariant} disabled={form.creativeVariants.length >= 3}>
                      Adauga varianta
                    </Button>
                  </div>
                ) : null}
              </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Audienta si destinatie</p>
                    <p className="mt-1 text-xs text-white/45">Pentru Housing, promovarea trebuie sa ramana conforma cu limitarile Meta.</p>
                  </div>

              <div className="space-y-2">
                <Label className="text-white/70">Oras promovat</Label>
                <Input value={form.locationLabel} onChange={(event) => updateForm('locationLabel', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                <p className="text-xs leading-5 text-white/45">Pentru Housing, foloseste orasul sau zona metropolitana, nu targetare ingusta pe cartier.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Raza audienta Housing</Label>
                <div className="grid grid-cols-[1fr_auto] items-center overflow-hidden rounded-md border border-white/15 bg-white/10">
                  <Input value={form.radiusKm} onChange={(event) => updateForm('radiusKm', event.target.value)} inputMode="numeric" className="border-0 bg-transparent text-white focus-visible:ring-0" />
                  <span className="px-3 text-sm font-semibold text-white/70">km</span>
                </div>
                <p className="text-xs leading-5 text-white/45">Pastreaza o raza larga, potrivita pentru regulile Special Ad Category: Housing.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Placements</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['facebook_feed', 'instagram_feed', 'facebook_story', 'instagram_story'] as CampaignForm['placements']).map((placement) => {
                    const selected = form.placements.includes(placement);
                    return (
                      <button
                        key={placement}
                        type="button"
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left text-sm font-semibold',
                          selected ? 'border-emerald-300 bg-emerald-300 text-[#06351f]' : 'border-white/15 bg-white/10 text-white/70 hover:bg-white/15'
                        )}
                        onClick={() => togglePlacement(placement)}
                      >
                        {getPlacementLabel(placement)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Link destinatie</Label>
                <Input value={form.destinationUrl} onChange={(event) => updateForm('destinationUrl', event.target.value)} className="border-white/15 bg-white/10 text-white" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Destinatie</Label>
                  <Select value={form.destinationType} onValueChange={(value) => updateForm('destinationType', value as CampaignForm['destinationType'])}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="property_page">Pagina proprietatii</SelectItem>
                      <SelectItem value="lead_form">Formular lead</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="messenger">Messenger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Tracking UTM</Label>
                  <button
                    type="button"
                    className={cn(
                      'h-10 w-full rounded-md border px-3 text-left text-sm font-semibold',
                      form.utmEnabled ? 'border-emerald-300 bg-emerald-300 text-[#06351f]' : 'border-white/15 bg-white/10 text-white/70'
                    )}
                    onClick={() => updateForm('utmEnabled', !form.utmEnabled)}
                  >
                    {form.utmEnabled ? 'UTM activ' : 'UTM inactiv'}
                  </button>
                </div>
              </div>
              {form.utmEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={form.utmSource} onChange={(event) => updateForm('utmSource', event.target.value)} placeholder="utm_source" className="border-white/15 bg-white/10 text-white" />
                  <Input value={form.utmMedium} onChange={(event) => updateForm('utmMedium', event.target.value)} placeholder="utm_medium" className="border-white/15 bg-white/10 text-white" />
                  <Input value={form.utmCampaign} onChange={(event) => updateForm('utmCampaign', event.target.value)} placeholder="utm_campaign" className="border-white/15 bg-white/10 text-white" />
                  <Input value={form.utmContent} onChange={(event) => updateForm('utmContent', event.target.value)} placeholder="utm_content" className="border-white/15 bg-white/10 text-white" />
                  <p className="sm:col-span-2 break-all rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-white/45">
                    URL final: {destinationPreviewUrl || 'Adauga link destinatie pentru preview UTM.'}
                  </p>
                </div>
              ) : null}
                </section>

                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Media reclama</p>
                    <p className="mt-1 text-xs text-white/45">Selecteaza pozele proprietatii sau incarca imagini si video dedicate reclamei.</p>
                  </div>

              <div className="space-y-2">
                <Label className="text-white/70">Incarca media pentru reclama</Label>
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm font-semibold text-white/75 hover:bg-white/10">
                  {isUploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Incarca imagini sau video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="sr-only"
                    onChange={(event) => void handleMediaUpload(event)}
                    disabled={isUploadingMedia}
                  />
                </label>
                <p className="text-xs text-white/45">Media incarcata se salveaza in Firebase Storage si poate fi folosita in draft.</p>
              </div>

              {availableImageItems.length ? (
                <div className="space-y-2">
                  <Label className="text-white/70">Imagini pentru reclama</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {availableImageItems.map((item) => {
                      const selectedIndex = form.mediaItems.findIndex((mediaItem) => mediaItem.url === item.url);
                      const isSelected = selectedIndex >= 0;
                      return (
                        <div
                          key={item.url}
                          className={cn(
                            'overflow-hidden rounded-xl border bg-white/5',
                            form.imageUrl === item.url ? 'border-emerald-300 ring-2 ring-emerald-300/30' : isSelected ? 'border-white/35' : 'border-white/10'
                          )}
                        >
                          <button
                            type="button"
                            className="block aspect-square w-full overflow-hidden"
                            onClick={() => {
                              selectImage(item.url, item.alt || fallbackTitle);
                              setForm((current) => {
                                if (!current) return current;
                                const exists = current.mediaItems.some((mediaItem) => mediaItem.url === item.url);
                                if (exists) return current;
                                return { ...current, mediaItems: [...current.mediaItems, item].slice(0, 10) };
                              });
                            }}
                          >
                            <img src={item.url} alt={item.alt || fallbackTitle} className="h-full w-full object-cover" />
                          </button>
                          <div className="grid grid-cols-3 border-t border-white/10 text-[10px] font-semibold text-white/70">
                            <button type="button" className="py-1 hover:bg-white/10" onClick={() => moveMedia(item.url, -1)} disabled={!isSelected || selectedIndex <= 0}>
                              Sus
                            </button>
                            <button type="button" className="py-1 hover:bg-white/10" onClick={() => moveMedia(item.url, 1)} disabled={!isSelected || selectedIndex >= form.mediaItems.length - 1}>
                              Jos
                            </button>
                            <button type="button" className="py-1 text-red-200 hover:bg-white/10" onClick={() => removeMedia(item.url)} disabled={!isSelected}>
                              X
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/45">Pentru carusel se foloseste ordinea imaginilor selectate. X scoate imaginea doar din draftul reclamei.</p>
                </div>
              ) : null}

              {videoMediaItems.length ? (
                <div className="space-y-2">
                  <Label className="text-white/70">Video reclame</Label>
                  <div className="grid gap-2">
                    {videoMediaItems.map((item) => (
                      <div
                        key={item.url}
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm',
                          form.videoUrl === item.url ? 'border-emerald-300 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70'
                        )}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between text-left"
                          onClick={() => {
                            updateForm('videoUrl', item.url);
                            updateForm('creativeFormat', 'video');
                          }}
                        >
                          <span className="truncate">{item.name || item.alt || 'Video incarcat'}</span>
                          <Play className="ml-3 h-4 w-4 shrink-0" />
                        </button>
                        <button type="button" className="ml-3 shrink-0 text-xs font-semibold text-red-200 hover:text-red-100" onClick={() => removeMedia(item.url)}>
                          Sterge
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Thumbnail video</Label>
                    <Input value={form.videoThumbnailUrl} onChange={(event) => updateForm('videoThumbnailUrl', event.target.value)} placeholder="URL imagine thumbnail" className="border-white/15 bg-white/10 text-white" />
                  </div>
                </div>
              ) : null}
                </section>
              </div>
            </div>

            <aside className="min-h-0 border-t border-white/10 bg-white/[0.03] px-6 py-5 lg:border-l lg:border-t-0 lg:pl-5">
              <div className="sticky top-0 max-h-[calc(92vh-10.5rem)] space-y-4 overflow-y-auto pr-1">
            <div className={cn('space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4', form.previewDevice === 'mobile' ? 'mx-auto max-w-[430px]' : 'w-full')}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">Preview Facebook feed</p>
                <Badge className="bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">HOUSING</Badge>
              </div>
              <div className="overflow-hidden rounded-2xl bg-white text-[#1c1e21] shadow-2xl">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877f2] text-sm font-bold text-white">
                    {pageName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{pageName}</p>
                    <p className="text-xs text-[#65676b]">Sponsored <span aria-hidden="true">&middot;</span> Facebook</p>
                  </div>
                </div>
                <div className="px-4 pb-3 text-sm leading-5 text-[#050505]">
                  <div>
                    {isTextExpanded ? (
                      <p className="whitespace-pre-line">
                        {form.primaryText || 'Textul reclamei va aparea aici.'}
                      </p>
                    ) : (
                      <p>
                        {collapsedText.text || 'Textul reclamei va aparea aici.'}
                        {collapsedText.isTruncated ? ' ' : ''}
                        {collapsedText.isTruncated ? (
                          <button
                            type="button"
                            className="inline font-semibold text-[#65676b]"
                            onClick={() => setIsTextExpanded(true)}
                          >
                            ....mai mult
                          </button>
                        ) : null}
                      </p>
                    )}
                    {isTextExpanded && collapsedText.isTruncated ? (
                      <button
                        type="button"
                        className="mt-1 font-semibold text-[#65676b]"
                        onClick={() => setIsTextExpanded(false)}
                      >
                        Arata mai putin
                      </button>
                    ) : null}
                  </div>
                </div>
                {form.creativeFormat === 'video' ? (
                  activeVideoUrl ? (
                    <video src={activeVideoUrl} controls className={cn('w-full bg-black object-cover', getMediaAspectClass(form.creativeAspectRatio))} poster={form.videoThumbnailUrl || form.imageUrl || undefined} />
                  ) : (
                    <div className={cn('flex items-center justify-center bg-slate-100 text-slate-400', getMediaAspectClass(form.creativeAspectRatio))}>
                      <Play className="h-9 w-9" />
                    </div>
                  )
                ) : form.creativeFormat === 'carousel' && previewImages.length ? (
                  <div className="flex snap-x gap-2 overflow-x-auto bg-black p-2">
                    {previewImages.map((item) => (
                      <img key={item.url} src={item.url} alt={item.alt || form.headline} className={cn('w-[82%] shrink-0 snap-center rounded-sm object-cover sm:w-[72%]', getMediaAspectClass(form.creativeAspectRatio))} />
                    ))}
                  </div>
                ) : form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.imageAlt || form.headline} className={cn('w-full object-cover', getMediaAspectClass(form.creativeAspectRatio))} />
                ) : (
                  <div className={cn('flex items-center justify-center bg-slate-100 text-slate-400', getMediaAspectClass(form.creativeAspectRatio))}>
                    <Eye className="h-8 w-8" />
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-[#f0f2f5] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase text-[#65676b]">{getDomain(destinationPreviewUrl)}</p>
                    <p className="truncate text-sm font-semibold text-[#050505]">{form.headline || fallbackTitle}</p>
                    <p className="truncate text-xs text-[#65676b]">{form.locationLabel || 'Oras promovat'}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" className="h-9 rounded-md bg-[#e4e6eb] px-3 text-[#050505] hover:bg-[#d8dadf]">
                    {ctaLabel(form.callToAction)}
                  </Button>
                </div>
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between border-y border-[#dadde1] py-1 text-sm font-semibold text-[#65676b]">
                    <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-[#f0f2f5]">
                      <ThumbsUp className="h-4 w-4" />
                      Like
                    </button>
                    <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-[#f0f2f5]">
                      <MessageCircle className="h-4 w-4" />
                      Comment
                    </button>
                    <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-[#f0f2f5]">
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-white/50">
                Preview {form.previewDevice === 'mobile' ? 'mobil' : 'desktop'} cu aspect {form.creativeAspectRatio}. URL-ul final include UTM daca tracking-ul este activ.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">Verificare publicare</p>
                  <p className="mt-1 text-xs text-white/45">Checklist pentru draft pregatit de Meta Ads.</p>
                </div>
                <Badge className={cn(canMarkReady ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100', 'hover:bg-transparent')}>
                  {canMarkReady ? 'Gata' : 'Incomplet'}
                </Badge>
              </div>
              <div className="space-y-2">
                {validationItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 p-2 text-sm">
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold', item.ok ? 'bg-emerald-300 text-[#06351f]' : 'bg-amber-200 text-amber-900')}>
                      {item.ok ? 'OK' : '!'}
                    </span>
                    <span className={item.ok ? 'text-white/75' : 'text-amber-100'}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50/80">
                Special Ad Category este blocata pe <span className="font-semibold text-emerald-50">HOUSING</span>. Setarile nepermise pentru locuinte, precum varsta, gender sau interese inguste, nu sunt expuse in editor.
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Status tehnic</p>
              <div className="grid gap-2 text-xs text-white/60">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-2">
                  <span>Status draft</span>
                  <span className="font-semibold text-white">{campaign?.status || 'draft'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-2">
                  <span>Campaign ID</span>
                  <span className="truncate font-semibold text-white">{campaign?.metaCampaignId || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-2">
                  <span>Ad Set ID</span>
                  <span className="truncate font-semibold text-white">{campaign?.metaAdSetId || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-2">
                  <span>Creative ID</span>
                  <span className="truncate font-semibold text-white">{campaign?.metaCreativeId || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-2">
                  <span>Ad ID</span>
                  <span className="truncate font-semibold text-white">{campaign?.metaAdId || '-'}</span>
                </div>
              </div>
            </div>
              </div>
            </aside>
          </div>
        ) : null}

        <DialogFooter className="shrink-0 gap-2 border-t border-white/10 bg-[#0F1E33] px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void handleSaveDraft()} disabled={isSaving || isMarkingReady || !form}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salveaza draft
          </Button>
          <Button type="button" className="bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-45" onClick={() => void handleMarkReady()} disabled={isSaving || isMarkingReady || !form || !canMarkReady}>
            {isMarkingReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Pregateste pentru publicare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
