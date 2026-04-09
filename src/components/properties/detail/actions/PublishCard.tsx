'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/lib/types";
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  const propertyRef = useMemo(() => {
    if (!agencyId) {
      return null;
    }

    return doc(firestore, 'agencies', agencyId, 'properties', property.id);
  }, [agencyId, firestore, property.id]);

  const imobiliarePromotion = property.promotions?.imobiliare;
  const imobiliareProfile = property.portalProfiles?.imobiliare;
  const isPublished = imobiliarePromotion?.status === 'published';
  const isPending = isSubmitting || imobiliarePromotion?.status === 'pending';
  const isErrored = imobiliarePromotion?.status === 'error';
  const persistedError = getPersistedImobiliareError(property);

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
    } finally {
      setIsSubmitting(false);
    }
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
                  <Checkbox
                    id={`portal-${portal.id}`}
                    checked={published || pending}
                    disabled={pending}
                    onCheckedChange={(checked) => handlePublishToggle(portal.id, !!checked)}
                  />
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
