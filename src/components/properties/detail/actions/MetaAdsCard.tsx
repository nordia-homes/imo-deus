'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { BarChart3, CheckCircle2, Loader2, Megaphone, Pencil, ShieldCheck, Target } from 'lucide-react';
import type { MetaMarketingCampaignDraft, Property } from '@/lib/types';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ACTION_CARD_INTERACTIVE_CLASSNAME,
  ACTION_ICON_CLASSNAME,
  ACTION_ICON_WRAPPER_CLASSNAME,
  ACTION_PILL_CLASSNAME,
} from './cardStyles';

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

export function MetaAdsCard({ property }: { property: Property }) {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<MetaMarketingCampaignDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const latestCampaign = campaigns[0] || null;
  const latestInsights = latestCampaign?.insights || null;
  const statusLabel = latestCampaign
    ? latestCampaign.status === 'draft'
      ? 'Draft pregatit'
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
        throw new Error(payload?.message || 'Nu am putut incarca promovatrea Meta.');
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
      setCampaigns((current) => [payload.campaign, ...current]);
      toast({
        title: 'Campanie Meta pregatita',
        description: 'Draftul Housing Ads a fost creat pentru aceasta proprietate.',
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
          <div className="space-y-2">
            <p className="line-clamp-1 text-sm font-medium text-white">{latestCampaign.headline}</p>
            <p className="line-clamp-2 text-xs leading-5 text-white/55">{latestCampaign.primaryText}</p>
            <div className="flex gap-2">
              <Button asChild className={`flex-1 rounded-full ${ACTION_PILL_CLASSNAME}`}>
                <Link href="/marketing">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Vezi Marketing
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`}>
                <Link href="/marketing">
                  <Pencil className="h-4 w-4" />
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
            Pregateste campanie
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
