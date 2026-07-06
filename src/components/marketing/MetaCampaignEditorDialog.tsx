'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Eye, Loader2, Save, ShieldCheck } from 'lucide-react';
import type { MetaMarketingCampaignDraft } from '@/lib/types';
import { useAuth, useUser } from '@/firebase';
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
  callToAction: MetaMarketingCampaignDraft['callToAction'];
  imageUrl: string;
  imageAlt: string;
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
    callToAction: campaign.callToAction || 'LEARN_MORE',
    imageUrl: campaign.imageUrl || '',
    imageAlt: campaign.imageAlt || '',
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
    callToAction: form.callToAction,
    imageUrl: form.imageUrl || null,
    imageAlt: form.imageAlt || null,
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
  const { toast } = useToast();
  const [form, setForm] = useState<CampaignForm | null>(campaign ? buildFormFromCampaign(campaign) : null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);

  useEffect(() => {
    setForm(campaign ? buildFormFromCampaign(campaign) : null);
  }, [campaign?.id, campaign?.updatedAt]);

  function updateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/10 bg-[#0F1E33] text-white">
        <DialogHeader>
          <DialogTitle>Configureaza campania Meta</DialogTitle>
          <DialogDescription className="text-white/60">
            Pregateste reclama Housing pentru aceasta proprietate. Publicarea live ramane blocata pana la App Review.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
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
                  <Input value={form.budgetAmount} onChange={(event) => updateForm('budgetAmount', event.target.value)} inputMode="numeric" className="border-white/15 bg-white/10 text-white" />
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

              <div className="space-y-2">
                <Label className="text-white/70">Titlu</Label>
                <Input value={form.headline} maxLength={80} onChange={(event) => updateForm('headline', event.target.value)} className="border-white/15 bg-white/10 text-white" />
                <p className="text-xs text-white/45">{form.headline.length}/80</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Text reclama</Label>
                <Textarea value={form.primaryText} maxLength={500} onChange={(event) => updateForm('primaryText', event.target.value)} className="min-h-32 border-white/15 bg-white/10 text-white" />
                <p className="text-xs text-white/45">{form.primaryText.length}/500</p>
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

              {propertyImages.length ? (
                <div className="space-y-2">
                  <Label className="text-white/70">Imagine reclama</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {propertyImages.map((image) => (
                      <button
                        key={image.url}
                        type="button"
                        className={cn(
                          'aspect-[4/3] overflow-hidden rounded-xl border bg-white/5',
                          form.imageUrl === image.url ? 'border-emerald-300 ring-2 ring-emerald-300/30' : 'border-white/10'
                        )}
                        onClick={() => {
                          updateForm('imageUrl', image.url);
                          updateForm('imageAlt', image.alt || fallbackTitle);
                        }}
                      >
                        <img src={image.url} alt={image.alt || fallbackTitle} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

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
                    <p className="text-xs text-[#65676b]">Sponsored · Facebook</p>
                  </div>
                </div>
                <p className="whitespace-pre-line px-4 pb-3 text-sm leading-5 text-[#050505]">{form.primaryText || 'Textul reclamei va aparea aici.'}</p>
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.imageAlt || form.headline} className="aspect-[1.91/1] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[1.91/1] items-center justify-center bg-slate-100 text-slate-400">
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
              </div>
              <p className="text-xs leading-5 text-white/50">
                Preview-ul reproduce structura principala din feed: nume pagina, Sponsored, text, imagine, card link si CTA.
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
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
