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
  objective: MetaMarketingCampaignDraft['objective'];
  budgetType: MetaMarketingCampaignDraft['budgetType'];
  budgetAmount: string;
  durationDays: string;
  locationLabel: string;
  headline: string;
  primaryText: string;
  creativeFormat: NonNullable<MetaMarketingCampaignDraft['creativeFormat']>;
  callToAction: MetaMarketingCampaignDraft['callToAction'];
  imageUrl: string;
  imageAlt: string;
  mediaItems: NonNullable<MetaMarketingCampaignDraft['mediaItems']>;
  videoUrl: string;
  videoThumbnailUrl: string;
  destinationUrl: string;
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
    objective: campaign.objective,
    budgetType: campaign.budgetType,
    budgetAmount: String(campaign.budgetAmount || 50),
    durationDays: String(campaign.durationDays || 7),
    locationLabel: campaign.locationLabel || '',
    headline: campaign.headline || '',
    primaryText: campaign.primaryText || '',
    creativeFormat: campaign.creativeFormat || 'single_image',
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
  };
}

function serializeForm(form: CampaignForm) {
  return {
    objective: form.objective,
    budgetType: form.budgetType,
    budgetAmount: Number(form.budgetAmount) || 50,
    durationDays: Number(form.durationDays) || 7,
    locationLabel: form.locationLabel,
    headline: form.headline,
    primaryText: form.primaryText,
    creativeFormat: form.creativeFormat,
    callToAction: form.callToAction,
    imageUrl: form.imageUrl || null,
    imageAlt: form.imageAlt || null,
    mediaItems: form.mediaItems,
    videoUrl: form.videoUrl || null,
    videoThumbnailUrl: form.videoThumbnailUrl || null,
    destinationUrl: form.destinationUrl,
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

  function selectImage(url: string, alt?: string | null) {
    setForm((current) => current ? {
      ...current,
      imageUrl: url,
      imageAlt: alt || current.headline || fallbackTitle,
      videoThumbnailUrl: current.videoThumbnailUrl || url,
    } : current);
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
    ? availableImageItems.slice(0, 6)
    : availableImageItems.filter((item) => item.url === selectedImageUrl).slice(0, 1);
  const activeVideoUrl = form?.videoUrl || videoMediaItems[0]?.url || '';
  const collapsedText = collapseFacebookText(form?.primaryText || '');

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
                <Label className="text-white/70">Link destinatie</Label>
                <Input value={form.destinationUrl} onChange={(event) => updateForm('destinationUrl', event.target.value)} className="border-white/15 bg-white/10 text-white" />
              </div>
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
                    {availableImageItems.map((item) => (
                      <button
                        key={item.url}
                        type="button"
                        className={cn(
                          'aspect-square overflow-hidden rounded-xl border bg-white/5',
                          form.imageUrl === item.url ? 'border-emerald-300 ring-2 ring-emerald-300/30' : 'border-white/10'
                        )}
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
                    ))}
                  </div>
                </div>
              ) : null}

              {videoMediaItems.length ? (
                <div className="space-y-2">
                  <Label className="text-white/70">Video reclame</Label>
                  <div className="grid gap-2">
                    {videoMediaItems.map((item) => (
                      <button
                        key={item.url}
                        type="button"
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm',
                          form.videoUrl === item.url ? 'border-emerald-300 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70'
                        )}
                        onClick={() => {
                          updateForm('videoUrl', item.url);
                          updateForm('creativeFormat', 'video');
                        }}
                      >
                        <span className="truncate">{item.name || item.alt || 'Video incarcat'}</span>
                        <Play className="ml-3 h-4 w-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
                </section>
              </div>
            </div>

            <aside className="min-h-0 border-t border-white/10 bg-white/[0.03] px-6 py-5 lg:border-l lg:border-t-0 lg:pl-5">
              <div className="sticky top-0 max-h-[calc(92vh-10.5rem)] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
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
                    <video src={activeVideoUrl} controls className="aspect-square w-full bg-black object-cover" poster={form.videoThumbnailUrl || form.imageUrl || undefined} />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-slate-100 text-slate-400">
                      <Play className="h-9 w-9" />
                    </div>
                  )
                ) : form.creativeFormat === 'carousel' && previewImages.length ? (
                  <div className="flex snap-x gap-2 overflow-x-auto bg-black p-2">
                    {previewImages.map((item) => (
                      <img key={item.url} src={item.url} alt={item.alt || form.headline} className="aspect-square w-[82%] shrink-0 snap-center rounded-sm object-cover sm:w-[72%]" />
                    ))}
                  </div>
                ) : form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.imageAlt || form.headline} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-100 text-slate-400">
                    <Eye className="h-8 w-8" />
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-[#f0f2f5] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase text-[#65676b]">{getDomain(form.destinationUrl)}</p>
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
                Preview-ul foloseste format patrat 1:1, potrivit pentru feed si usor de verificat vizual.
              </p>
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
          <Button type="button" className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => void handleMarkReady()} disabled={isSaving || isMarkingReady || !form}>
            {isMarkingReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Pregateste pentru publicare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
