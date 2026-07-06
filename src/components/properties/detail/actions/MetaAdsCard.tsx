'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { BarChart3, CheckCircle2, Eye, Loader2, Megaphone, Pencil, Save, ShieldCheck, Target } from 'lucide-react';
import type { MetaMarketingCampaignDraft, Property } from '@/lib/types';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ACTION_CARD_INTERACTIVE_CLASSNAME,
  ACTION_ICON_CLASSNAME,
  ACTION_ICON_WRAPPER_CLASSNAME,
  ACTION_PILL_CLASSNAME,
} from './cardStyles';

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

export function MetaAdsCard({ property }: { property: Property }) {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<MetaMarketingCampaignDraft[]>([]);
  const [editingCampaign, setEditingCampaign] = useState<MetaMarketingCampaignDraft | null>(null);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);

  const latestCampaign = campaigns[0] || null;
  const latestInsights = latestCampaign?.insights || null;
  const propertyImages = property.images?.filter((image) => image?.url).slice(0, 6) || [];
  const statusLabel = latestCampaign
    ? latestCampaign.status === 'draft'
      ? 'Draft in lucru'
      : latestCampaign.status === 'ready'
        ? 'Gata de publicare'
        : latestCampaign.status
    : 'Nepromovata';

  async function loadCampaigns() {
    if (!user || !property.id) return;
    setIsLoading(true);
    try {
      const response = await authorizedFetch(
        user,
        auth,
        `/api/marketing/meta/property-campaigns?propertyId=${encodeURIComponent(property.id)}`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca promovarea Meta.');
      }
      setCampaigns(payload.campaigns || []);
    } catch {
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, [user, property.id]);

  function openCampaignEditor(campaign: MetaMarketingCampaignDraft) {
    setEditingCampaign(campaign);
    setForm(buildFormFromCampaign(campaign));
  }

  function updateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function handleCreateDraft() {
    if (!user || !property.id) return;
    setIsCreating(true);
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/property-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: property.id,
          objective: 'leads',
          budgetType: 'daily',
          budgetAmount: 50,
          durationDays: 7,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut pregati campania Meta.');
      }
      const campaign = payload.campaign as MetaMarketingCampaignDraft;
      setCampaigns((current) => [campaign, ...current]);
      openCampaignEditor(campaign);
      toast({
        title: 'Draft Meta creat',
        description: 'Verifica textul, imaginea si bugetul inainte de publicare.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Campanie nepregatita',
        description: error instanceof Error ? error.message : 'Nu am putut crea draftul Meta.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function saveDraft() {
    if (!user || !editingCampaign || !form) return null;
    setIsSaving(true);
    try {
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        body: JSON.stringify(serializeForm(form)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut salva campania Meta.');
      }
      const campaign = payload.campaign as MetaMarketingCampaignDraft;
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? campaign : item));
      setEditingCampaign(campaign);
      setForm(buildFormFromCampaign(campaign));
      return campaign;
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
    if (!user || !editingCampaign) return;
    setIsMarkingReady(true);
    try {
      const saved = await saveDraft();
      const campaignId = saved?.id || editingCampaign.id;
      const response = await authorizedFetch(user, auth, `/api/marketing/meta/property-campaigns/${campaignId}/ready`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut marca draftul ca pregatit.');
      }
      setCampaigns((current) => current.map((item) => item.id === campaignId ? { ...item, status: 'ready' } : item));
      setEditingCampaign(null);
      setForm(null);
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

  const metrics = useMemo(() => {
    if (!latestCampaign) {
      return [
        { label: 'Spend', value: '-' },
        { label: 'Lead-uri', value: '-' },
        { label: 'CPL', value: '-' },
      ];
    }
    return [
      { label: 'Spend', value: formatMoney(latestInsights?.spend || 0, latestCampaign.currency) },
      { label: 'Lead-uri', value: formatNumber(latestInsights?.leads || 0) },
      { label: 'CPL', value: latestInsights?.costPerLead ? formatMoney(latestInsights.costPerLead, latestCampaign.currency) : '-' },
    ];
  }, [latestCampaign, latestInsights]);

  return (
    <>
      <Card className={cn(`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0`)}>
        <CardContent className="space-y-4 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
                <Megaphone className={ACTION_ICON_CLASSNAME} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Meta Ads</p>
                <p className="text-xs text-white/60">Campanie platita Facebook si Instagram.</p>
              </div>
            </div>
            <Badge className="shrink-0 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Housing
            </Badge>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Status</p>
                <p className="mt-1 text-sm font-semibold text-white">{isLoading ? 'Se verifica...' : statusLabel}</p>
              </div>
              {latestCampaign ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-200" />
              ) : (
                <Target className="h-5 w-5 text-white/45" />
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-black/10 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{metric.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          {latestCampaign ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                {latestCampaign.imageUrl ? (
                  <img src={latestCampaign.imageUrl} alt={latestCampaign.imageAlt || latestCampaign.headline} className="h-16 w-20 shrink-0 rounded-xl object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium text-white">{latestCampaign.headline}</p>
                  <p className="line-clamp-2 text-xs leading-5 text-white/55">{latestCampaign.primaryText}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" className={`flex-1 rounded-full ${ACTION_PILL_CLASSNAME}`} onClick={() => openCampaignEditor(latestCampaign)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editeaza campania
                </Button>
                <Button asChild variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`}>
                  <Link href="/marketing" aria-label="Vezi Marketing">
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              className="w-full rounded-full bg-emerald-400 text-black hover:bg-emerald-300"
              onClick={() => void handleCreateDraft()}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
              Configureaza campanie
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingCampaign && form)} onOpenChange={(open) => {
        if (!open) {
          setEditingCampaign(null);
          setForm(null);
        }
      }}>
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
                  <Label className="text-white/70">Zona promovata</Label>
                  <Input value={form.locationLabel} onChange={(event) => updateForm('locationLabel', event.target.value)} className="border-white/15 bg-white/10 text-white" />
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
                            updateForm('imageAlt', image.alt || property.title);
                          }}
                        >
                          <img src={image.url} alt={image.alt || property.title} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">Preview reclama</p>
                  <Badge className="bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/15">HOUSING</Badge>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#152A47]">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt={form.imageAlt || form.headline} className="aspect-[1.91/1] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[1.91/1] items-center justify-center bg-white/5 text-white/45">
                      <Eye className="h-8 w-8" />
                    </div>
                  )}
                  <div className="space-y-3 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">{form.locationLabel || 'Zona proprietate'}</p>
                    <h3 className="text-lg font-semibold text-white">{form.headline || property.title}</h3>
                    <p className="text-sm leading-6 text-white/65">{form.primaryText || 'Textul reclamei va aparea aici.'}</p>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                      <div>
                        <p className="text-xs text-white/45">Buget</p>
                        <p className="font-semibold text-white">{form.budgetAmount || 0} RON / {form.budgetType === 'daily' ? 'zi' : 'campanie'}</p>
                      </div>
                      <Badge className="bg-white/10 text-white hover:bg-white/10">{form.durationDays || 0} zile</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-5 text-white/50">
                  Recomandare: foloseste imagine luminoasa, titlu sub 80 caractere si un buget zilnic suficient pentru zona aleasa.
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
    </>
  );
}
