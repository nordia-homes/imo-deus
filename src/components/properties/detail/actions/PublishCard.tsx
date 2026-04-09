'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { ImobiliarePortalProfile, Property } from "@/lib/types";
import { setDocumentNonBlocking, useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useAgency } from "@/context/AgencyContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Settings2 } from 'lucide-react';
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME } from "./cardStyles";

const ImobiliareLogo = () => (
  <svg viewBox="0 0 130 20" className="h-4 w-auto" preserveAspectRatio="xMinYMid meet">
    <text x="0" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#0078d4">imobiliare</text>
    <text x="98" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="white">.ro</text>
  </svg>
);

const StoriaLogo = () => (
  <svg viewBox="0 0 100 20" className="h-4 w-auto" preserveAspectRatio="xMinYMid meet">
    <text x="0" y="15" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold" fill="#ff5a00">storia.ro</text>
  </svg>
);

const OlxLogo = () => (
  <svg viewBox="0 0 45 20" className="h-5 w-auto" preserveAspectRatio="xMinYMid meet">
    <text x="0" y="16" fontFamily="Verdana, Arial, sans-serif" fontSize="20" fontWeight="bold">
      <tspan fill="#FFF">ol</tspan><tspan fill="#23e5db">x</tspan>
    </text>
  </svg>
);

const PORTALS = [
  { id: 'imobiliare', name: 'Imobiliare.ro', logo: <ImobiliareLogo /> },
  { id: 'storia', name: 'Storia.ro', logo: <StoriaLogo /> },
  { id: 'olx', name: 'OLX.ro', logo: <OlxLogo /> },
];

type PortalSettingsDraft = {
  categoryApi: string;
  locationId: string;
  remoteAgentId: string;
  priceCurrency: string;
  streetName: string;
  streetNumber: string;
  block: string;
  entrance: string;
  apartmentNumber: string;
  titleOverride: string;
  descriptionOverride: string;
  videoLink: string;
  virtualTourLink: string;
  dataPropertiesJson: string;
};

type ImobiliareCategoryOption = {
  id: number;
  name: string;
  offerType?: string | null;
  parentName?: string | null;
  selectable?: boolean;
};

function buildDraft(profile?: ImobiliarePortalProfile): PortalSettingsDraft {
  return {
    categoryApi: profile?.categoryApi ? String(profile.categoryApi) : '',
    locationId: profile?.locationId ? String(profile.locationId) : '',
    remoteAgentId: profile?.remoteAgentId ? String(profile.remoteAgentId) : '',
    priceCurrency: profile?.priceCurrency || 'EUR',
    streetName: profile?.streetName || '',
    streetNumber: profile?.streetNumber || '',
    block: profile?.block || '',
    entrance: profile?.entrance || '',
    apartmentNumber: profile?.apartmentNumber || '',
    titleOverride: profile?.titleOverride || '',
    descriptionOverride: profile?.descriptionOverride || '',
    videoLink: profile?.mediaLinks?.find((item) => item.type === 'video')?.link || '',
    virtualTourLink: profile?.mediaLinks?.find((item) => item.type === 'virtual_tour')?.link || '',
    dataPropertiesJson: profile?.dataPropertiesOverrides ? JSON.stringify(profile.dataPropertiesOverrides, null, 2) : '',
  };
}

async function authorizedFetch(user: NonNullable<ReturnType<typeof useUser>['user']>, input: RequestInfo, init?: RequestInit) {
  const token = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export function PublishCard({ property }: { property: Property }) {
  const { toast } = useToast();
  const { agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PortalSettingsDraft>(() => buildDraft(property.portalProfiles?.imobiliare));
  const [categories, setCategories] = useState<ImobiliareCategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const propertyRef = useMemo(() => {
    if (!agencyId) return null;
    return doc(firestore, 'agencies', agencyId, 'properties', property.id);
  }, [agencyId, firestore, property.id]);

  const imobiliarePromotion = property.promotions?.imobiliare;
  const imobiliareProfile = property.portalProfiles?.imobiliare;
  const isPublished = imobiliarePromotion?.status === 'published';
  const isPending = isSubmitting || imobiliarePromotion?.status === 'pending';
  const isErrored = imobiliarePromotion?.status === 'error';

  async function loadCategories() {
    if (!user) return;
    setIsLoadingCategories(true);
    try {
      const response = await authorizedFetch(user, '/api/imobiliare/categories', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca categoriile din imobiliare.ro.');
      }

      const nextCategories = Array.isArray(payload?.data) ? payload.data as ImobiliareCategoryOption[] : [];
      const selectable = nextCategories
        .filter((item) => item?.selectable !== false)
        .sort((left, right) => {
          const leftLabel = `${left.parentName || ''} ${left.name || ''}`.trim();
          const rightLabel = `${right.parentName || ''} ${right.name || ''}`.trim();
          return leftLabel.localeCompare(rightLabel, 'ro');
        });
      setCategories(selectable);
    } catch (error) {
      toast({
        title: 'Categorii indisponibile',
        description: error instanceof Error ? error.message : 'Nu am putut incarca categoriile.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }

  async function handlePublishToggle(portalId: string, checked: boolean) {
    if (portalId !== 'imobiliare') {
      toast({ title: 'In curand', description: `${portalId} nu este integrat inca.` });
      return;
    }
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru a publica.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = checked ? '/api/imobiliare/publish' : '/api/imobiliare/unpublish';
      const response = await authorizedFetch(user, endpoint, {
        method: 'POST',
        body: JSON.stringify({ propertyId: property.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Actiunea nu a putut fi finalizata.');
      }

      toast({
        title: checked ? 'Publicare reusita' : 'Anunt retras',
        description: checked
          ? 'Proprietatea a fost sincronizata cu imobiliare.ro.'
          : 'Proprietatea a fost retrasa din imobiliare.ro.',
      });
    } catch (error) {
      toast({
        title: checked ? 'Publicare esuata' : 'Retragere esuata',
        description: error instanceof Error ? error.message : 'A aparut o eroare neasteptata.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function persistSettings() {
    if (!propertyRef) return;

    let parsedOverrides: Record<string, unknown> | undefined;
    if (settingsDraft.dataPropertiesJson.trim()) {
      try {
        parsedOverrides = JSON.parse(settingsDraft.dataPropertiesJson);
      } catch {
        toast({
          title: 'JSON invalid',
          description: 'Campul pentru data_properties overrides trebuie sa contina JSON valid.',
          variant: 'destructive',
        });
        return;
      }
    }

    const mediaLinks = [
      settingsDraft.videoLink.trim() ? { type: 'video' as const, link: settingsDraft.videoLink.trim() } : null,
      settingsDraft.virtualTourLink.trim() ? { type: 'virtual_tour' as const, link: settingsDraft.virtualTourLink.trim() } : null,
    ].filter(Boolean);

    const nextProfile: ImobiliarePortalProfile = {
      ...(imobiliareProfile || {}),
      categoryApi: settingsDraft.categoryApi.trim() ? Number(settingsDraft.categoryApi.trim()) : null,
      locationId: settingsDraft.locationId.trim() ? Number(settingsDraft.locationId.trim()) : null,
      remoteAgentId: settingsDraft.remoteAgentId.trim() ? Number(settingsDraft.remoteAgentId.trim()) : null,
      priceCurrency: (settingsDraft.priceCurrency.trim().toUpperCase() || 'EUR') as 'EUR' | 'RON' | 'USD',
      streetName: settingsDraft.streetName.trim() || undefined,
      streetNumber: settingsDraft.streetNumber.trim() || undefined,
      block: settingsDraft.block.trim() || undefined,
      entrance: settingsDraft.entrance.trim() || undefined,
      apartmentNumber: settingsDraft.apartmentNumber.trim() || undefined,
      titleOverride: settingsDraft.titleOverride.trim() || undefined,
      descriptionOverride: settingsDraft.descriptionOverride.trim() || undefined,
      dataPropertiesOverrides: parsedOverrides,
      mediaLinks: mediaLinks as ImobiliarePortalProfile['mediaLinks'],
    };

    setDocumentNonBlocking(propertyRef, {
      portalProfiles: {
        ...(property.portalProfiles || {}),
        imobiliare: nextProfile,
      },
    }, { merge: true });

    toast({
      title: 'Setari salvate',
      description: 'Override-urile pentru imobiliare.ro au fost actualizate.',
    });
    setIsDialogOpen(false);
  }

  return (
    <Card className={cn(ACTION_CARD_CLASSNAME)}>
      <CardHeader className="px-4 pb-0 pt-4">
        <CardTitle className="text-base font-semibold text-white">
          Publicare In Portale
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-2 pt-0", isMobile ? "p-4" : "p-4")}>
        <div className="grid grid-cols-[minmax(0,1fr)_140px_90px] items-center gap-4 border-b border-white/8 px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
          <span>Portal</span>
          <span className="justify-self-start pl-4">Status</span>
          <span className="text-right">Actiuni</span>
        </div>

        {PORTALS.map((portal) => {
          const isImobiliare = portal.id === 'imobiliare';
          const published = isImobiliare && isPublished;
          const pending = isImobiliare && isPending;
          const errored = isImobiliare && isErrored;

          return (
            <div
              key={portal.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_140px_90px] gap-4 rounded-xl p-3 text-sm hover:bg-white/[0.06]",
                ACTION_CARD_INNER_CLASSNAME
              )}
            >
              <Label htmlFor={`portal-${portal.id}`} className="font-medium flex-1 cursor-pointer flex items-center gap-2 min-w-0">
                {portal.logo}
              </Label>
              <div className="flex items-center justify-center">
                {published ? (
                  <span className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                    Publicat
                  </span>
                ) : null}
                {pending ? (
                  <span className="rounded-full border border-yellow-300/18 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-200">
                    In curs...
                  </span>
                ) : null}
                {errored ? (
                  <span className="rounded-full border border-red-300/18 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
                    Eroare
                  </span>
                ) : null}
                {!published && !pending && !errored ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
                    {isImobiliare ? 'Nepublicat' : 'Curand'}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                {isImobiliare ? (
                  <>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
                          onClick={() => {
                            setSettingsDraft(buildDraft(imobiliareProfile));
                            void loadCategories();
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl border-white/10 bg-[#0F1E33] text-white">
                        <DialogHeader>
                          <DialogTitle>Setari Imobiliare.ro</DialogTitle>
                          <DialogDescription className="text-white/60">
                            Completeaza doar campurile pe care vrei sa le suprascrii fata de datele standard ale proprietatii.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-white/80">categoryApi</Label>
                            <Select
                              value={settingsDraft.categoryApi || undefined}
                              onValueChange={(value) => setSettingsDraft((s) => ({ ...s, categoryApi: value }))}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue placeholder={isLoadingCategories ? 'Se incarca categoriile...' : 'Selecteaza categoria'} />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => {
                                  const label = [
                                    category.parentName,
                                    category.name,
                                    category.offerType ? `(${category.offerType})` : null,
                                  ].filter(Boolean).join(' / ');
                                  return (
                                    <SelectItem key={category.id} value={String(category.id)}>
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {settingsDraft.categoryApi ? (
                              <p className="text-xs text-white/55">
                                ID selectat: {settingsDraft.categoryApi}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">locationId</Label>
                            <Input value={settingsDraft.locationId} onChange={(e) => setSettingsDraft((s) => ({ ...s, locationId: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">remoteAgentId</Label>
                            <Input value={settingsDraft.remoteAgentId} onChange={(e) => setSettingsDraft((s) => ({ ...s, remoteAgentId: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Moneda</Label>
                            <Input value={settingsDraft.priceCurrency} onChange={(e) => setSettingsDraft((s) => ({ ...s, priceCurrency: e.target.value.toUpperCase() }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Strada</Label>
                            <Input value={settingsDraft.streetName} onChange={(e) => setSettingsDraft((s) => ({ ...s, streetName: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Numar</Label>
                            <Input value={settingsDraft.streetNumber} onChange={(e) => setSettingsDraft((s) => ({ ...s, streetNumber: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Bloc</Label>
                            <Input value={settingsDraft.block} onChange={(e) => setSettingsDraft((s) => ({ ...s, block: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Scara / intrare</Label>
                            <Input value={settingsDraft.entrance} onChange={(e) => setSettingsDraft((s) => ({ ...s, entrance: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Apartament</Label>
                            <Input value={settingsDraft.apartmentNumber} onChange={(e) => setSettingsDraft((s) => ({ ...s, apartmentNumber: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80">Link video</Label>
                            <Input value={settingsDraft.videoLink} onChange={(e) => setSettingsDraft((s) => ({ ...s, videoLink: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-white/80">Link tur virtual</Label>
                            <Input value={settingsDraft.virtualTourLink} onChange={(e) => setSettingsDraft((s) => ({ ...s, virtualTourLink: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-white/80">Titlu override</Label>
                            <Input value={settingsDraft.titleOverride} onChange={(e) => setSettingsDraft((s) => ({ ...s, titleOverride: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-white/80">Descriere override</Label>
                            <Textarea value={settingsDraft.descriptionOverride} onChange={(e) => setSettingsDraft((s) => ({ ...s, descriptionOverride: e.target.value }))} className="min-h-24 bg-white/10 border-white/20 text-white" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-white/80">data_properties overrides (JSON)</Label>
                            <Textarea value={settingsDraft.dataPropertiesJson} onChange={(e) => setSettingsDraft((s) => ({ ...s, dataPropertiesJson: e.target.value }))} className="min-h-36 bg-white/10 border-white/20 font-mono text-white" />
                          </div>
                        </div>

                        {(imobiliareProfile?.lastValidationError || imobiliarePromotion?.errorMessage) ? (
                          <div className="mt-4 rounded-xl border border-red-300/18 bg-red-400/10 p-3 text-sm text-red-100">
                            {imobiliareProfile?.lastValidationError || imobiliarePromotion?.errorMessage}
                          </div>
                        ) : null}

                        <DialogFooter>
                          <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={persistSettings}>
                            Salveaza setarile
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Checkbox
                      id={`portal-${portal.id}`}
                      checked={published || pending}
                      disabled={pending}
                      onCheckedChange={(checked) => handlePublishToggle(portal.id, !!checked)}
                    />
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-white/55 hover:bg-white/[0.04] hover:text-white/55"
                    disabled
                  >
                    Curand
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {(imobiliarePromotion?.errorMessage || imobiliareProfile?.lastValidationError) ? (
          <div className="rounded-xl border border-red-300/18 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {imobiliarePromotion?.errorMessage || imobiliareProfile?.lastValidationError}
          </div>
        ) : null}

        {isSubmitting ? (
          <div className="flex items-center gap-2 px-1 pt-1 text-xs text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sincronizam proprietatea cu imobiliare.ro...
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
