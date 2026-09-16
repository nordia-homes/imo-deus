'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, Target } from 'lucide-react';
import type { Property } from '@/lib/types';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ACTION_CARD_INTERACTIVE_CLASSNAME,
  ACTION_ICON_WRAPPER_CLASSNAME,
  ACTION_PILL_CLASSNAME,
} from './cardStyles';

type TikTokAdsStatus = {
  configured: boolean;
  connected: boolean;
  advertiserId: string | null;
  advertiserName: string | null;
  advertiserCount: number;
  requiresReconnect?: boolean;
  role?: 'admin' | 'agent' | 'platform_admin';
};

export function TikTokAdsCard({ property }: { property: Property }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [status, setStatus] = useState<TikTokAdsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const authorizedFetch = useCallback(async (url: string) => {
    if (!user) throw new Error('Autentifică-te din nou pentru a continua.');
    const token = await user.getIdToken(true);
    return fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function loadStatus() {
      await Promise.resolve();
      if (cancelled) return;
      setIsLoading(true);
      setStatus(null);
      try {
        const response = await authorizedFetch('/api/marketing/tiktok-ads/status');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Status TikTok Ads indisponibil.');
        if (!cancelled) setStatus(payload as TikTokAdsStatus);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStatus();
    return () => { cancelled = true; };
  }, [authorizedFetch, user]);

  async function connect() {
    setIsConnecting(true);
    try {
      const returnTo = `/properties/${property.id}`;
      const response = await authorizedFetch(`/api/marketing/tiktok-ads/connect?returnTo=${encodeURIComponent(returnTo)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload?.message || 'Conectarea nu a putut fi pornită.');
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'TikTok Ads neconectat',
        description: error instanceof Error ? error.message : 'Conectarea nu a putut fi pornită.',
      });
      setIsConnecting(false);
    }
  }

  const connected = Boolean(user) && status?.connected === true;
  const configured = status?.configured !== false;
  const canConnect = status?.role === 'admin';

  return (
    <Card className={`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0`}>
      <CardContent className="space-y-4 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
              <TikTokIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">Promovare TikTok</p>
              <p className="text-xs text-white/60">Campanii plătite prin TikTok for Business MCP.</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-white/70 bg-white font-semibold text-slate-950 shadow-sm hover:bg-white hover:text-slate-950"
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Ads API
          </Badge>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Status</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {isLoading ? 'Se verifică...' : status?.requiresReconnect ? 'Reconectare Full MCP necesară' : connected ? status?.advertiserName || 'Cont publicitar conectat' : configured ? 'Neconectată' : 'Necesită configurare MCP'}
              </p>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-white/45" /> : <Target className="h-5 w-5 text-cyan-200" />}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['Spend', 'Click-uri', 'Conversii'].map((label) => (
              <div key={label} className="rounded-xl bg-black/10 p-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">-</p>
              </div>
            ))}
          </div>
        </div>

        {connected ? (
          <Button asChild className={`w-full rounded-full ${ACTION_PILL_CLASSNAME}`}>
            <Link href={`/marketing/tiktok-ads?propertyId=${encodeURIComponent(property.id)}`}>{status?.requiresReconnect ? 'Reconectează TikTok Ads' : 'Configurează și publică reclama'}</Link>
          </Button>
        ) : (
          <Button type="button" className="w-full rounded-full bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={isLoading || isConnecting || !configured || !canConnect} onClick={() => void connect()}>
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TikTokIcon className="mr-2 h-4 w-4" />}
            {!configured ? 'Configurează TikTok Ads MCP' : canConnect ? status?.requiresReconnect ? 'Reconectează TikTok Ads' : 'Conectează TikTok Ads' : 'Conectare disponibilă administratorului'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
