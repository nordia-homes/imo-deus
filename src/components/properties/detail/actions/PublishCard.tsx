'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CheckCircle2, Loader2, Rocket, Sparkles, Zap } from 'lucide-react';
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
type PublishModalStep = 'confirm' | 'syncing' | 'published';
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

function getImobiliarePublishModalStorageKey(propertyId: string) {
  return `imobiliare-publish-modal:${propertyId}`;
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

function readPersistedPublishModalStep(propertyId: string): PublishModalStep | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(getImobiliarePublishModalStorageKey(propertyId));
  return rawValue === 'confirm' || rawValue === 'syncing' || rawValue === 'published' ? rawValue : null;
}

function writePersistedPublishModalStep(propertyId: string, step: PublishModalStep | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getImobiliarePublishModalStorageKey(propertyId);
  if (!step) {
    window.sessionStorage.removeItem(storageKey);
    return;
  }

  window.sessionStorage.setItem(storageKey, step);
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

function formatPrice(price: number) {
  return new Intl.NumberFormat('ro-RO').format(price);
}

function getPrimaryImage(property: Property) {
  return property.images?.[0]?.url || '';
}

function getLocationLine(property: Property) {
  return [property.zone, property.city, property.address].filter(Boolean).join(' • ') || property.location;
}

function ImobiliarePublishLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div
        className="pl"
        style={
          {
            ['--trans-dur' as string]: '0.3s',
            ['--bg' as string]: '#10223d',
            ['--primary1' as string]: '#22c55e',
            ['--primary2' as string]: '#60a5fa',
            ['--fg-t' as string]: 'rgba(255,255,255,0.75)',
          } as CSSProperties
        }
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="pl__dot" />
        ))}
        <div className="pl__text">Sync</div>
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-white">Sincronizam proprietatea cu imobiliare.ro</p>
        <p className="text-sm text-white/60">Te tinem in acest pas pana cand publicarea este confirmata.</p>
      </div>
      <style jsx>{`
        .pl {
          box-shadow: 2em 0 2em rgba(0, 0, 0, 0.2) inset, -2em 0 2em rgba(255, 255, 255, 0.1) inset;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transform: rotateX(30deg) rotateZ(45deg);
          width: 14em;
          height: 14em;
          color: white;
        }

        .pl,
        .pl__dot {
          border-radius: 50%;
        }

        .pl__dot {
          animation-name: shadow724;
          box-shadow: 0.1em 0.1em 0 0.1em black, 0.3em 0 0.3em rgba(0, 0, 0, 0.5);
          top: calc(50% - 0.75em);
          left: calc(50% - 0.75em);
          width: 1.5em;
          height: 1.5em;
        }

        .pl__dot,
        .pl__dot:before,
        .pl__dot:after {
          animation-duration: 2s;
          animation-iteration-count: infinite;
          position: absolute;
        }

        .pl__dot:before,
        .pl__dot:after {
          content: "";
          display: block;
          left: 0;
          width: inherit;
          transition: background-color var(--trans-dur);
        }

        .pl__dot:before {
          animation-name: pushInOut1724;
          background-color: var(--bg);
          border-radius: inherit;
          box-shadow: 0.05em 0 0.1em rgba(255, 255, 255, 0.2) inset;
          height: inherit;
          z-index: 1;
        }

        .pl__dot:after {
          animation-name: pushInOut2724;
          background-color: var(--primary1);
          border-radius: 0.75em;
          box-shadow: 0.1em 0.3em 0.2em rgba(255, 255, 255, 0.4) inset, 0 -0.4em 0.2em #2e3138 inset, 0 -1em 0.25em rgba(0, 0, 0, 0.3) inset;
          bottom: 0;
          clip-path: polygon(0 75%, 100% 75%, 100% 100%, 0 100%);
          height: 3em;
          transform: rotate(-45deg);
          transform-origin: 50% 2.25em;
        }

        .pl__dot:nth-child(1) { transform: rotate(0deg) translateX(5em) rotate(0deg); z-index: 5; }
        .pl__dot:nth-child(1), .pl__dot:nth-child(1):before, .pl__dot:nth-child(1):after { animation-delay: 0s; }
        .pl__dot:nth-child(2) { transform: rotate(-30deg) translateX(5em) rotate(30deg); z-index: 4; }
        .pl__dot:nth-child(2), .pl__dot:nth-child(2):before, .pl__dot:nth-child(2):after { animation-delay: -0.1666666667s; }
        .pl__dot:nth-child(3) { transform: rotate(-60deg) translateX(5em) rotate(60deg); z-index: 3; }
        .pl__dot:nth-child(3), .pl__dot:nth-child(3):before, .pl__dot:nth-child(3):after { animation-delay: -0.3333333333s; }
        .pl__dot:nth-child(4) { transform: rotate(-90deg) translateX(5em) rotate(90deg); z-index: 2; }
        .pl__dot:nth-child(4), .pl__dot:nth-child(4):before, .pl__dot:nth-child(4):after { animation-delay: -0.5s; }
        .pl__dot:nth-child(5) { transform: rotate(-120deg) translateX(5em) rotate(120deg); z-index: 1; }
        .pl__dot:nth-child(5), .pl__dot:nth-child(5):before, .pl__dot:nth-child(5):after { animation-delay: -0.6666666667s; }
        .pl__dot:nth-child(6) { transform: rotate(-150deg) translateX(5em) rotate(150deg); z-index: 1; }
        .pl__dot:nth-child(6), .pl__dot:nth-child(6):before, .pl__dot:nth-child(6):after { animation-delay: -0.8333333333s; }
        .pl__dot:nth-child(7) { transform: rotate(-180deg) translateX(5em) rotate(180deg); z-index: 2; }
        .pl__dot:nth-child(7), .pl__dot:nth-child(7):before, .pl__dot:nth-child(7):after { animation-delay: -1s; }
        .pl__dot:nth-child(8) { transform: rotate(-210deg) translateX(5em) rotate(210deg); z-index: 3; }
        .pl__dot:nth-child(8), .pl__dot:nth-child(8):before, .pl__dot:nth-child(8):after { animation-delay: -1.1666666667s; }
        .pl__dot:nth-child(9) { transform: rotate(-240deg) translateX(5em) rotate(240deg); z-index: 4; }
        .pl__dot:nth-child(9), .pl__dot:nth-child(9):before, .pl__dot:nth-child(9):after { animation-delay: -1.3333333333s; }
        .pl__dot:nth-child(10) { transform: rotate(-270deg) translateX(5em) rotate(270deg); z-index: 5; }
        .pl__dot:nth-child(10), .pl__dot:nth-child(10):before, .pl__dot:nth-child(10):after { animation-delay: -1.5s; }
        .pl__dot:nth-child(11) { transform: rotate(-300deg) translateX(5em) rotate(300deg); z-index: 6; }
        .pl__dot:nth-child(11), .pl__dot:nth-child(11):before, .pl__dot:nth-child(11):after { animation-delay: -1.6666666667s; }
        .pl__dot:nth-child(12) { transform: rotate(-330deg) translateX(5em) rotate(330deg); z-index: 6; }
        .pl__dot:nth-child(12), .pl__dot:nth-child(12):before, .pl__dot:nth-child(12):after { animation-delay: -1.8333333333s; }

        .pl__text {
          font-size: 0.75em;
          max-width: 5rem;
          position: relative;
          text-shadow: 0 0 0.1em var(--fg-t);
          transform: rotateZ(-45deg);
        }

        @keyframes shadow724 {
          from {
            animation-timing-function: ease-in;
            box-shadow: 0.1em 0.1em 0 0.1em black, 0.3em 0 0.3em rgba(0, 0, 0, 0.3);
          }
          25% {
            animation-timing-function: ease-out;
            box-shadow: 0.1em 0.1em 0 0.1em black, 0.8em 0 0.8em rgba(0, 0, 0, 0.5);
          }
          50%, to {
            box-shadow: 0.1em 0.1em 0 0.1em black, 0.3em 0 0.3em rgba(0, 0, 0, 0.3);
          }
        }

        @keyframes pushInOut1724 {
          from {
            animation-timing-function: ease-in;
            background-color: var(--bg);
            transform: translate(0, 0);
          }
          25% {
            animation-timing-function: ease-out;
            background-color: var(--primary2);
            transform: translate(-71%, -71%);
          }
          50%, to {
            background-color: var(--bg);
            transform: translate(0, 0);
          }
        }

        @keyframes pushInOut2724 {
          from {
            animation-timing-function: ease-in;
            background-color: var(--bg);
            clip-path: polygon(0 75%, 100% 75%, 100% 100%, 0 100%);
          }
          25% {
            animation-timing-function: ease-out;
            background-color: var(--primary1);
            clip-path: polygon(0 25%, 100% 25%, 100% 100%, 0 100%);
          }
          50%, to {
            background-color: var(--bg);
            clip-path: polygon(0 75%, 100% 75%, 100% 100%, 0 100%);
          }
        }
      `}</style>
    </div>
  );
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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(() => {
    const persistedStep = readPersistedPublishModalStep(property.id);
    return persistedStep === 'syncing' || persistedStep === 'published';
  });
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [publishModalStep, setPublishModalStep] = useState<PublishModalStep>(() => readPersistedPublishModalStep(property.id) || 'confirm');
  const [publishModalError, setPublishModalError] = useState('');
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
  const publishAuditHistory =
    property.portalProfiles?.imobiliare?.lastPublishAuditHistory?.slice(-5).reverse() || [];
  const heroImage = getPrimaryImage(property);
  const propertyLocationLine = getLocationLine(property);
  const propertyHighlights = [
    property.rooms ? `${property.rooms} camere` : '',
    property.bathrooms ? `${property.bathrooms} bai` : '',
    property.squareFootage ? `${property.squareFootage} mp utili` : '',
    property.floor ? `Etaj ${property.floor}` : '',
  ].filter(Boolean);

  useEffect(() => {
    writePersistedSyncTarget(property.id, syncTarget);
  }, [property.id, syncTarget]);

  useEffect(() => {
    writePersistedPublishModalStep(property.id, isPublishModalOpen ? publishModalStep : null);
  }, [isPublishModalOpen, property.id, publishModalStep]);

  useEffect(() => {
    setSyncTarget(readPersistedSyncTarget(property.id));
    setOptimisticStatus(null);
    setIsSubmitting(false);
  }, [property.id]);

  useEffect(() => {
    const persistedStep = readPersistedPublishModalStep(property.id);
    if (!persistedStep) {
      setPublishModalStep('confirm');
      setPublishModalError('');
      setIsPublishModalOpen(false);
      return;
    }

    setPublishModalStep(persistedStep);
    setIsPublishModalOpen(persistedStep === 'syncing' || persistedStep === 'published');
  }, [property.id]);

  useEffect(() => {
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

  useEffect(() => {
    if (!isPublishModalOpen) {
      return;
    }

    if (publishModalStep === 'syncing' && !isSubmitting && serverStatus === 'published') {
      setPublishModalStep('published');
      setPublishModalError('');
      setIsPublishModalOpen(true);
    }
  }, [isPublishModalOpen, isSubmitting, publishModalStep, serverStatus]);

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

  async function runImobiliarePublishAction(checked: boolean, options?: { keepModalOpen?: boolean }) {
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
      if (!checked || !options?.keepModalOpen) {
        setIsPublishModalOpen(false);
      }
      if (!checked) {
        writePersistedPublishModalStep(property.id, null);
      }
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
      if (checked) {
        setPublishModalStep('confirm');
        setPublishModalError(description);
        setIsPublishModalOpen(true);
      }
    }
  }

  async function handlePublishToggle(portalId: string, checked: boolean) {
    if (portalId !== 'imobiliare') {
      toast({ title: 'In curand', description: `${portalId} nu este integrat inca.` });
      return;
    }

    if (checked) {
      setPublishModalError('');
      setPublishModalStep('confirm');
      setIsPublishModalOpen(true);
      writePersistedPublishModalStep(property.id, 'confirm');
      return;
    }

    await runImobiliarePublishAction(false);
  }

  async function handleConfirmImobiliarePublish() {
    setPublishModalError('');
    setPublishModalStep('syncing');
    setIsPublishModalOpen(true);
    writePersistedPublishModalStep(property.id, 'syncing');
    await runImobiliarePublishAction(true, { keepModalOpen: true });
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

  function renderPromotionEditor() {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#111927] p-4">
        <div className="mb-4 text-center">
          <p className="text-lg font-semibold text-white">Promovare imobiliare.ro</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-white/55">
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
              <SelectTrigger className="border-white/15 bg-[#1F2A37] text-white">
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
              <SelectTrigger className="border-white/15 bg-[#1F2A37] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="online">online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          {PROMOTION_BOOLEAN_FIELDS.map(({ key, label }) => (
            <label
              key={key}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-white/85 transition-colors",
                key === 'promote_imoradar'
                  ? "border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(74,222,128,0.12)] hover:bg-emerald-400/15"
                  : "border-white/8 bg-[#1F2A37] hover:bg-[#202939]"
              )}
            >
              <span className={cn(key === 'promote_imoradar' ? "font-semibold text-emerald-100" : "")}>{label}</span>
              <Checkbox
                checked={promotionForm[key]}
                onCheckedChange={(checked) => updatePromotionForm(key, Boolean(checked))}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label className="text-white/75">Promo zones</Label>
            <Input
              value={promotionForm.promo_zones}
              onChange={(event) => updatePromotionForm('promo_zones', event.target.value)}
              className="border-white/15 bg-[#1F2A37] text-white"
              placeholder="zona1, zona2"
            />
          </div>
          <div className="space-y-2 rounded-2xl border border-[#30374F] bg-[#202939] p-4 shadow-[0_0_0_1px_rgba(48,55,79,0.22)]">
            <div className="space-y-1">
              <Label className="text-base font-semibold text-white">Energy</Label>
              <p className="text-xs text-white/65">
                Acest camp este important pentru performanta promovarii si trebuie completat cu prioritate.
              </p>
            </div>
            <Input
              value={promotionForm.energy}
              onChange={(event) => updatePromotionForm('energy', event.target.value)}
              className="h-11 border-white/15 bg-[#111927] text-white placeholder:text-white/30"
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
    );
  }

  return (
    <>
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

        {publishAuditHistory.length ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/65">
            {publishAuditHistory.map((entry) => (
              <p key={`${entry.attemptedAt}-${entry.stage}`}>
                {new Date(entry.attemptedAt).toLocaleString('ro-RO')}: {entry.stage || 'necunoscut'}
                {entry.responseStatus ? ` (${entry.responseStatus})` : ''}
                {entry.errorMessage ? ` - ${entry.errorMessage}` : ''}
              </p>
            ))}
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

        <Button
          type="button"
          onClick={() => setIsPromotionModalOpen(true)}
          className="h-12 w-full rounded-2xl border border-white/12 bg-[#111927] text-white hover:bg-[#1F2A37]"
        >
          <Zap className="mr-2 h-4 w-4 text-amber-300" />
          Promovare imobiliare.ro
        </Button>

        {isSyncing ? (
          <div className="flex items-center gap-2 px-1 pt-1 text-xs text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sincronizam proprietatea cu imobiliare.ro...
          </div>
        ) : null}
      </CardContent>
    </Card>

      <Dialog
        open={isPublishModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && (publishModalStep === 'syncing' || isSubmitting)) {
            return;
          }
          setIsPublishModalOpen(nextOpen);
          if (!nextOpen && serverStatus !== 'published') {
            setPublishModalStep('confirm');
            setPublishModalError('');
            writePersistedPublishModalStep(property.id, null);
          }
          if (!nextOpen && serverStatus === 'published') {
            writePersistedPublishModalStep(property.id, null);
          }
        }}
      >
        <DialogContent className="imobiliare-publish-modal max-h-[90vh] w-[min(92vw,520px)] overflow-y-auto border border-white/10 bg-[#0D121C] p-0 text-white shadow-[0_22px_60px_rgba(3,8,20,0.42)] backdrop-blur-xl">
          <DialogHeader
            className={cn(
              "border-b border-white/10 px-6 py-5 text-center sm:text-center",
              publishModalStep === 'published' ? "bg-[linear-gradient(180deg,rgba(48,55,79,0.32),rgba(17,25,39,0.94))]" : "bg-[#111927]"
            )}
          >
            {publishModalStep === 'published' ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/12 shadow-[0_0_40px_rgba(16,185,129,0.18)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400 text-[#081426]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 text-emerald-200">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.24em]">Felicitari</span>
                  <Sparkles className="h-4 w-4" />
                </div>
                <DialogTitle className="text-center text-[2rem] font-semibold leading-tight text-white">
                  Anuntul este acum publicat
                </DialogTitle>
                <DialogDescription className="mx-auto max-w-md text-center text-base leading-7 text-white/72">
                  Proprietatea ta este live pe imobiliare.ro. Mai jos ai preview-ul final, linkul anuntului si toate optiunile de promovare.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="text-center text-xl text-white">
                  {publishModalStep === 'confirm' ? 'Publicare pe imobiliare.ro' : 'Sincronizare in curs'}
                </DialogTitle>
                <DialogDescription className="mx-auto max-w-md text-center text-white/65">
                  {publishModalStep === 'confirm'
                    ? 'Verifica prezentarea proprietatii si confirma publicarea in portal.'
                    : 'Pastram modalul deschis pe toata durata sincronizarii, fara bounce in pagina.'}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          <div className="space-y-5 p-6">
            {publishModalStep === 'confirm' ? (
              <>
                <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/10 bg-[#1F2A37] shadow-[0_18px_40px_rgba(3,8,20,0.18)]">
                  {heroImage ? (
                    <div
                      className="h-56 w-full bg-cover bg-center"
                      style={{ backgroundImage: `linear-gradient(180deg, rgba(8,20,38,0.08), rgba(8,20,38,0.56)), url(${heroImage})` }}
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-[#16304f] text-white/45">
                      Fara imagine principala
                    </div>
                  )}
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        Preview ImoDeus
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                        {property.transactionType}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold leading-tight text-white">{property.title}</h3>
                      <p className="text-sm leading-6 text-white/60">{propertyLocationLine}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {propertyHighlights.map((highlight) => (
                        <span key={highlight} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/80">
                          {highlight}
                        </span>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Pret</p>
                      <p className="text-3xl font-semibold text-white">{formatPrice(property.price)} EUR</p>
                    </div>
                  </div>
                </div>

                {publishModalError ? (
                  <div className="rounded-2xl border border-red-300/18 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {publishModalError}
                  </div>
                ) : null}

                <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3">
                  <Button
                    type="button"
                    className="h-12 w-full bg-[#e11d48] text-white hover:bg-[#be123c]"
                    onClick={handleConfirmImobiliarePublish}
                    disabled={isSubmitting}
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    Confirma publicarea pe imobiliare.ro
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => setIsPublishModalOpen(false)}
                  >
                    Anuleaza
                  </Button>
                </div>
              </>
            ) : null}

            {publishModalStep === 'syncing' ? <ImobiliarePublishLoader /> : null}

            {publishModalStep === 'published' ? (
              <div className="space-y-5">
                <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111927] shadow-[0_18px_42px_rgba(3,8,20,0.18)]">
                  <div className="grid gap-0">
                    {heroImage ? (
                      <div
                        className="min-h-[220px] bg-cover bg-center"
                        style={{ backgroundImage: `url(${heroImage})` }}
                      />
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center bg-slate-100 text-slate-400">
                        Fara imagine
                      </div>
                    )}
                    <div className="space-y-4 p-6 text-white">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Publicat pe imobiliare.ro
                        </span>
                        <span className="text-xs uppercase tracking-[0.16em] text-white/45">Preview imobiliare.ro</span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold leading-tight">{property.title}</h3>
                        <p className="text-sm text-white/60">{propertyLocationLine}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {propertyHighlights.map((highlight) => (
                          <span key={highlight} className="rounded-full bg-[#202939] px-3 py-1 text-sm text-white/82">
                            {highlight}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm uppercase tracking-[0.18em] text-white/45">Pret publicat</p>
                          <p className="text-3xl font-semibold">{formatPrice(property.price)} EUR</p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleOpenPublishedListing}
                          className="h-12 w-full bg-[#e11d48] text-white hover:bg-[#be123c]"
                        >
                          Deschide anuntul pe imobiliare.ro
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-[430px]">
                  {renderPromotionEditor()}
                </div>

                <div className="mx-auto w-full max-w-[430px]">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => setIsPublishModalOpen(false)}
                  >
                    Inchide
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isPromotionModalOpen} onOpenChange={setIsPromotionModalOpen}>
        <DialogContent className="imobiliare-publish-modal max-h-[90vh] w-[min(92vw,520px)] overflow-y-auto border border-white/10 bg-[#0D121C] p-0 text-white shadow-[0_22px_60px_rgba(3,8,20,0.42)] backdrop-blur-xl">
          <DialogHeader className="border-b border-white/10 bg-[#111927] px-6 py-5 text-center sm:text-center">
            <DialogTitle className="text-center text-xl text-white">Promovare imobiliare.ro</DialogTitle>
            <DialogDescription className="mx-auto max-w-md text-center text-white/65">
              Configureaza promovarile proprietatii intr-un panou separat, fara sa incarcam cardul principal din pagina.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {renderPromotionEditor()}
          </div>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        .imobiliare-publish-modal {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.42) rgba(15, 23, 42, 0.68);
        }

        .imobiliare-publish-modal::-webkit-scrollbar {
          width: 10px;
        }

        .imobiliare-publish-modal::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.72);
          border-radius: 999px;
        }

        .imobiliare-publish-modal::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(100, 116, 139, 0.8), rgba(71, 85, 105, 0.95));
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.72);
        }

        .imobiliare-publish-modal::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(148, 163, 184, 0.88), rgba(100, 116, 139, 0.98));
        }
      `}</style>
    </>
  );
}
