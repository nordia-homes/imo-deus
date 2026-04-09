'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { ImobiliarePromotionSettings, Property } from "@/lib/types";
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from 'lucide-react';
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME } from "./cardStyles";
import { useAgency } from "@/context/AgencyContext";

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

type ImobiliareUiStatus = 'unpublished' | 'pending' | 'published' | 'error';
type ImobiliareSyncTarget = 'published' | 'unpublished' | null;
type PromotionFormState = {
  status: 'draft' | 'online';
  imoradarStatus: 'draft' | 'online';
  special: boolean;
  top_listing: boolean;
  top_listing_s: boolean;
  promo: boolean;
  pole_position: boolean;
  promote_imoradar: boolean;
  bonus: boolean;
  properties_of_the_month: boolean;
  similar_properties: boolean;
  promo_zones: string;
  energy: string;
};

const PROMOTION_BOOLEAN_FIELDS: Array<{ key: keyof Pick<
  PromotionFormState,
  | 'special'
  | 'top_listing'
  | 'top_listing_s'
  | 'promo'
  | 'pole_position'
  | 'promote_imoradar'
  | 'bonus'
  | 'properties_of_the_month'
  | 'similar_properties'
>; label: string }> = [
  { key: 'special', label: 'Special' },
  { key: 'top_listing', label: 'Top listing' },
  { key: 'top_listing_s', label: 'Top listing S' },
  { key: 'promo', label: 'Promo' },
  { key: 'pole_position', label: 'Pole position' },
  { key: 'promote_imoradar', label: 'Promote imoradar' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'properties_of_the_month', label: 'Properties of the month' },
  { key: 'similar_properties', label: 'Similar properties' },
];

function getImobiliareSyncStorageKey(propertyId: string) {
  return `imobiliare-sync-target:${propertyId}`;
}

function readPersistedSyncTarget(propertyId: string): ImobiliareSyncTarget {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getImobiliareSyncStorageKey(propertyId));
  return rawValue === 'published' || rawValue === 'unpublished' ? rawValue : null;
}

function writePersistedSyncTarget(propertyId: string, target: ImobiliareSyncTarget) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getImobiliareSyncStorageKey(propertyId);
  if (!target) {
    window.sessionStorage.removeItem(storageKey);
    return;
  }

  window.sessionStorage.setItem(storageKey, target);
}

function buildPromotionFormState(settings?: ImobiliarePromotionSettings | null): PromotionFormState {
  return {
    status: settings?.status || 'online',
    imoradarStatus: settings?.imoradarStatus || 'draft',
    special: Boolean(settings?.promotions?.special),
    top_listing: Boolean(settings?.promotions?.top_listing),
    top_listing_s: Boolean(settings?.promotions?.top_listing_s),
    promo: Boolean(settings?.promotions?.promo),
    pole_position: Boolean(settings?.promotions?.pole_position),
    promote_imoradar: Boolean(settings?.promotions?.promote_imoradar),
    bonus: Boolean(settings?.promotions?.bonus),
    properties_of_the_month: Boolean(settings?.promotions?.properties_of_the_month),
    similar_properties: Boolean(settings?.promotions?.similar_properties),
    promo_zones: Array.isArray(settings?.promotions?.promo_zones) ? settings!.promotions!.promo_zones!.join(', ') : '',
    energy:
      typeof settings?.promotions?.energy === 'number' && Number.isFinite(settings.promotions.energy)
        ? String(settings.promotions.energy)
        : '',
  };
}

function buildPromotionSettingsPayload(form: PromotionFormState): ImobiliarePromotionSettings {
  const promoZones = form.promo_zones
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const parsedEnergy = Number(form.energy);

  const promotions = {
    ...(form.special ? { special: true } : {}),
    ...(form.top_listing ? { top_listing: true } : {}),
    ...(form.top_listing_s ? { top_listing_s: true } : {}),
    ...(form.promo ? { promo: true } : {}),
    ...(promoZones.length ? { promo_zones: promoZones } : {}),
    ...(form.pole_position ? { pole_position: true } : {}),
    ...(form.promote_imoradar ? { promote_imoradar: true } : {}),
    ...(form.bonus ? { bonus: true } : {}),
    ...(Number.isFinite(parsedEnergy) ? { energy: parsedEnergy } : {}),
    ...(form.properties_of_the_month ? { properties_of_the_month: true } : {}),
    ...(form.similar_properties ? { similar_properties: true } : {}),
  };

  return {
    status: form.status,
    imoradarStatus: form.imoradarStatus,
    ...(Object.keys(promotions).length ? { promotions } : {}),
  };
}

function formatApiErrorDetails(details: unknown): string {
  if (!details) {
    return '';
  }

  if (typeof details === 'string') {
    return details;
  }

  if (typeof details !== 'object') {
    return '';
  }

  const record = details as {
    message?: unknown;
    error?: unknown;
    error_description?: unknown;
    errors?: Record<string, unknown>;
  };

  if (record.errors && typeof record.errors === 'object') {
    const flattened = Object.entries(record.errors)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) {
          return value
            .filter((item): item is string => typeof item === 'string' && Boolean(item))
            .map((item) => `${field}: ${item}`);
        }

        if (typeof value === 'string' && value) {
          return [`${field}: ${value}`];
        }

        return [];
      })
      .filter(Boolean);

    if (flattened.length) {
      return flattened.join(' | ');
    }
  }

  return [
    typeof record.error_description === 'string' ? record.error_description : '',
    typeof record.error === 'string' ? record.error : '',
    typeof record.message === 'string' ? record.message : '',
  ].filter(Boolean).join(' | ');
}

function getPersistedImobiliareError(propertyLike: {
  promotions?: { imobiliare?: { status?: string | null; errorMessage?: string | null } | null } | null;
  portalProfiles?: { imobiliare?: Record<string, unknown> | null } | null;
}) {
  const promotionStatus = propertyLike.promotions?.imobiliare?.status;
  const genericError = propertyLike.promotions?.imobiliare?.errorMessage;
  const profile = propertyLike.portalProfiles?.imobiliare as
    | {
        lastValidationError?: string | null;
        lastPublishAudit?: { stage?: string | null; responsePayload?: unknown } | null;
      }
    | null
    | undefined;

  const auditError = formatApiErrorDetails(profile?.lastPublishAudit?.responsePayload);
  if (
    profile?.lastPublishAudit?.stage === 'success' ||
    (promotionStatus === 'published' && !genericError && !profile?.lastValidationError)
  ) {
    return '';
  }
  return auditError || profile?.lastValidationError || genericError || '';
}

function deriveImobiliareUiStatus(property: Property): ImobiliareUiStatus {
  const promotion = property.promotions?.imobiliare;
  const profile = property.portalProfiles?.imobiliare as
    | {
        lastPublishAudit?: { stage?: string | null } | null;
      }
    | null
    | undefined;
  const rawStatus = promotion?.status;
  const remoteState = typeof promotion?.remoteState === 'string' ? promotion.remoteState.toLowerCase() : '';
  const hasRemoteListing = Boolean(
    promotion?.remoteId ||
    promotion?.link ||
    remoteState === 'online' ||
    remoteState === 'published' ||
    profile?.lastPublishAudit?.stage === 'success'
  );

  if (rawStatus === 'error') {
    return 'error';
  }

  if (rawStatus === 'unpublished') {
    return 'unpublished';
  }

  if (rawStatus === 'published') {
    return 'published';
  }

  if (rawStatus === 'pending') {
    return hasRemoteListing ? 'published' : 'pending';
  }

  if (hasRemoteListing) {
    return 'published';
  }

  return 'unpublished';
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

export function PublishCard({ property }: { property: Property }) {
  const { toast } = useToast();
  const { agencyId } = useAgency();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingPromotionSettings, setIsSavingPromotionSettings] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<ImobiliareUiStatus | null>(null);
  const [syncTarget, setSyncTarget] = useState<ImobiliareSyncTarget>(() => readPersistedSyncTarget(property.id));
  const [promotionForm, setPromotionForm] = useState<PromotionFormState>(
    buildPromotionFormState(property.portalProfiles?.imobiliare?.promotionSettings)
  );
  const propertyRef = useMemo(() => {
    if (!agencyId) {
      return null;
    }

    return doc(firestore, 'agencies', agencyId, 'properties', property.id);
  }, [agencyId, firestore, property.id]);

  const serverStatus = deriveImobiliareUiStatus(property);
  const isSyncing = syncTarget !== null;
  const effectiveStatus: ImobiliareUiStatus = isSyncing ? 'pending' : optimisticStatus || serverStatus;
  const isPublished = effectiveStatus === 'published';
  const isPending = effectiveStatus === 'pending';
  const isErrored = effectiveStatus === 'error';
  const persistedError = getPersistedImobiliareError(property);

  useEffect(() => {
    writePersistedSyncTarget(property.id, syncTarget);
  }, [property.id, syncTarget]);

  useEffect(() => {
    setSyncTarget(readPersistedSyncTarget(property.id));
    setOptimisticStatus(null);
    setIsSubmitting(false);
    setPromotionForm(buildPromotionFormState(property.portalProfiles?.imobiliare?.promotionSettings));
  }, [property.id, property.portalProfiles?.imobiliare?.promotionSettings]);

  useEffect(() => {
    if (syncTarget) {
      if (serverStatus === syncTarget) {
        setSyncTarget(null);
        setOptimisticStatus(null);
        setIsSubmitting(false);
        return;
      }

      if (!isSubmitting && serverStatus === 'error') {
        setSyncTarget(null);
        setOptimisticStatus('error');
      }
      return;
    }

    if (!optimisticStatus) {
      return;
    }

    if (optimisticStatus === 'pending') {
      if (!isSubmitting && serverStatus !== 'pending') {
        setOptimisticStatus(null);
      }
      return;
    }

    if (!isSubmitting && optimisticStatus === serverStatus) {
      setOptimisticStatus(null);
    }
  }, [isSubmitting, optimisticStatus, serverStatus, syncTarget]);

  async function loadLatestImobiliareError() {
    if (!propertyRef) {
      return '';
    }

    const snapshot = await getDoc(propertyRef);
    if (!snapshot.exists()) {
      return '';
    }

    return getPersistedImobiliareError(snapshot.data() as Property & Record<string, unknown>);
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
    setOptimisticStatus(null);
    setSyncTarget(checked ? 'published' : 'unpublished');
    try {
      const endpoint = checked ? '/api/imobiliare/publish' : '/api/imobiliare/unpublish';
      const response = await authorizedFetch(user, auth, endpoint, {
        method: 'POST',
        body: JSON.stringify({ propertyId: property.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detailText = formatApiErrorDetails(payload?.details);
        throw new Error([payload?.message, detailText].filter(Boolean).join(' | ') || 'Actiunea nu a putut fi finalizata.');
      }

      toast({
        title: checked ? 'Publicare reusita' : 'Anunt retras',
        description: checked
          ? 'Proprietatea a fost sincronizata cu imobiliare.ro.'
          : 'Proprietatea a fost retrasa din imobiliare.ro.',
      });
      setIsSubmitting(false);
    } catch (error) {
      let description = error instanceof Error ? error.message : 'A aparut o eroare neasteptata.';
      if (/^Server Error\.(\s*\|\s*Server Error\.)?$/i.test(description.trim())) {
        const latestError = await loadLatestImobiliareError().catch(() => '');
        if (latestError) {
          description = latestError;
        }
      }

      toast({
        title: checked ? 'Publicare esuata' : 'Retragere esuata',
        description,
        variant: 'destructive',
      });
      setSyncTarget(null);
      setOptimisticStatus('error');
      setIsSubmitting(false);
    }
  }

  async function handleSavePromotionSettings() {
    if (!user) {
      toast({ title: 'Autentificare necesara', description: 'Trebuie sa fii autentificat pentru a salva promovarile.', variant: 'destructive' });
      return;
    }

    const promotionSettings = buildPromotionSettingsPayload(promotionForm);

    setIsSavingPromotionSettings(true);
    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/property-promotion-settings', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: property.id,
          promotionSettings,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut salva promovarile pentru proprietate.');
      }

      toast({
        title: 'Promovari salvate',
        description: payload?.appliedRemotely
          ? 'Setarile au fost salvate si aplicate imediat pe imobiliare.ro.'
          : 'Setarile au fost salvate pentru urmatoarea publicare.',
      });
    } catch (error) {
      toast({
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva promovarile.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPromotionSettings(false);
    }
  }

  async function handleOpenPublishedListing() {
    if (!user) {
      toast({
        title: 'Autentificare necesara',
        description: 'Trebuie sa fii autentificat pentru a deschide anuntul.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await authorizedFetch(user, auth, '/api/imobiliare/property-link', {
        method: 'POST',
        body: JSON.stringify({ propertyId: property.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.url !== 'string' || !payload.url) {
        throw new Error(payload?.message || 'Nu am putut rezolva linkul public al anuntului.');
      }

      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        title: 'Link indisponibil',
        description: error instanceof Error ? error.message : 'Nu am putut deschide anuntul.',
        variant: 'destructive',
      });
    }
  }

  function updatePromotionForm<K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) {
    setPromotionForm((current) => ({
      ...current,
      [key]: value,
    }));
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
                  isSyncing ? (
                    <div className="flex h-5 w-5 items-center justify-center text-emerald-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <Checkbox
                      id={`portal-${portal.id}`}
                      checked={published || pending}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) => handlePublishToggle(portal.id, !!checked)}
                    />
                  )
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

        {persistedError ? (
          <div className="rounded-xl border border-red-300/18 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {persistedError}
          </div>
        ) : null}

        {isPublished ? (
          <div className="rounded-xl border border-emerald-300/18 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
            <button
              type="button"
              onClick={handleOpenPublishedListing}
              className="underline underline-offset-4"
            >
              Vezi anuntul pe imobiliare.ro
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2">
            <p className="text-sm font-medium text-white">Promovare imobiliare.ro</p>
            <p className="text-xs text-white/55">
              Seteaza promovarile direct pe aceasta proprietate. Daca anuntul este deja publicat, modificarile se aplica imediat.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white/75">Status listing</Label>
              <Select
                value={promotionForm.status}
                onValueChange={(value: 'draft' | 'online') => updatePromotionForm('status', value)}
              >
                <SelectTrigger className="border-white/15 bg-[#0F1E33] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">online</SelectItem>
                  <SelectItem value="draft">draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/75">Status imoradar</Label>
              <Select
                value={promotionForm.imoradarStatus}
                onValueChange={(value: 'draft' | 'online') => updatePromotionForm('imoradarStatus', value)}
              >
                <SelectTrigger className="border-white/15 bg-[#0F1E33] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="online">online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PROMOTION_BOOLEAN_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0F1E33] px-3 py-2 text-sm text-white/85"
              >
                <Checkbox
                  checked={promotionForm[key]}
                  onCheckedChange={(checked) => updatePromotionForm(key, Boolean(checked))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white/75">Promo zones</Label>
              <Input
                value={promotionForm.promo_zones}
                onChange={(event) => updatePromotionForm('promo_zones', event.target.value)}
                className="border-white/15 bg-[#0F1E33] text-white"
                placeholder="zona1, zona2"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/75">Energy</Label>
              <Input
                value={promotionForm.energy}
                onChange={(event) => updatePromotionForm('energy', event.target.value)}
                className="border-white/15 bg-[#0F1E33] text-white"
                inputMode="numeric"
                placeholder="ex. 3"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={handleSavePromotionSettings}
              disabled={isSavingPromotionSettings || isSyncing}
              className="bg-white/10 border border-white/20 hover:bg-white/20 text-white"
            >
              {isSavingPromotionSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salveaza promovarea
            </Button>
          </div>
        </div>

        {isSyncing ? (
          <div className="flex items-center gap-2 px-1 pt-1 text-xs text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sincronizam proprietatea cu imobiliare.ro...
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
