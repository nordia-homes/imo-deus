'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Loader2, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { MetaIcon } from '@/components/icons/MetaIcon';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { useUser } from '@/firebase';
import type { MetaMarketingCampaignDraft, Property } from '@/lib/types';
import { ACTION_CARD_CLASSNAME } from './cardStyles';

const PLATFORMS = [
  { key: 'facebook', label: 'Meta', Icon: MetaIcon },
  { key: 'google', label: 'Google', Icon: GoogleIcon },
  { key: 'tiktok', label: 'TikTok', Icon: TikTokIcon },
] as const;

type Currency = 'RON' | 'EUR' | 'USD';
type LoadState = 'loading' | 'ready' | 'error';

function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function PropertyAdCostsCard({ property }: { property: Property }) {
  const { user, isUserLoading } = useUser();
  const fallbackCurrency = property.advertisingCosts?.currency ?? 'RON';
  const [facebookSpend, setFacebookSpend] = useState<number | null>(null);
  const [facebookCurrency, setFacebookCurrency] = useState<Currency>(fallbackCurrency);
  const [facebookState, setFacebookState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;

    if (isUserLoading) return () => {
      cancelled = true;
    };

    if (!user || !property.id) {
      setFacebookSpend(property.advertisingCosts?.facebook ?? null);
      setFacebookCurrency(fallbackCurrency);
      setFacebookState('error');
      return () => {
        cancelled = true;
      };
    }

    const currentUser = user;

    async function loadFacebookSpend() {
      setFacebookState('loading');

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(
          `/api/marketing/meta/property-campaigns?propertyId=${encodeURIComponent(property.id)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'Costurile Meta nu au putut fi incarcate.');
        }

        const campaigns = (payload.campaigns || []) as MetaMarketingCampaignDraft[];
        const campaignCurrency = campaigns.find((campaign) => campaign.currency)?.currency;
        const spend = campaigns.reduce(
          (total, campaign) => total + Math.max(0, Number(campaign.insights?.spend) || 0),
          0
        );

        if (cancelled) return;
        setFacebookSpend(spend);
        setFacebookCurrency(campaignCurrency ?? fallbackCurrency);
        setFacebookState('ready');
      } catch {
        if (cancelled) return;
        setFacebookSpend(property.advertisingCosts?.facebook ?? null);
        setFacebookCurrency(fallbackCurrency);
        setFacebookState('error');
      }
    }

    void loadFacebookSpend();

    return () => {
      cancelled = true;
    };
  }, [fallbackCurrency, isUserLoading, property.advertisingCosts?.facebook, property.id, user]);

  const costs = useMemo(
    () => ({
      facebook: facebookSpend,
      google: property.advertisingCosts?.google ?? null,
      tiktok: property.advertisingCosts?.tiktok ?? null,
    }),
    [facebookSpend, property.advertisingCosts?.google, property.advertisingCosts?.tiktok]
  );

  const knownCosts = Object.values(costs).filter((cost): cost is number => typeof cost === 'number');
  const total = knownCosts.reduce((sum, cost) => sum + cost, 0);

  return (
    <Card className={ACTION_CARD_CLASSNAME}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4" />
          Costuri reclame
        </CardTitle>
        <div className="flex items-center gap-2 text-right">
          <BadgeDollarSign className="h-4 w-4 text-emerald-200" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Total automat</p>
            <p className="text-sm font-semibold text-white">
              {knownCosts.length > 0 ? formatMoney(total, facebookCurrency) : '—'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 p-4 pt-0 sm:grid-cols-3">
        {PLATFORMS.map(({ key, label, Icon }) => {
          const value = costs[key];
          const isFacebookLoading = key === 'facebook' && facebookState === 'loading';
          const hasAutomaticValue = typeof value === 'number';
          const currency = key === 'facebook' ? facebookCurrency : fallbackCurrency;

          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-white">{label}</span>
              </div>

              <div className="mt-3 min-h-10">
                {isFacebookLoading ? (
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se sincronizeaza
                  </div>
                ) : hasAutomaticValue ? (
                  <>
                    <p className="text-base font-semibold text-white">{formatMoney(value, currency)}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">Preluat automat</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white/65">Neintegrat</p>
                    <p className="mt-0.5 text-[11px] text-white/40">Disponibil dupa conectare</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
