'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, ExternalLink, Loader2, Send, Video } from 'lucide-react';
import { useUser } from '@/firebase';
import type { Property, TikTokMarketingIntegrationPublicStatus, TikTokPostDraft } from '@/lib/types';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ACTION_CARD_INTERACTIVE_CLASSNAME,
  ACTION_ICON_WRAPPER_CLASSNAME,
  ACTION_PILL_CLASSNAME,
} from './cardStyles';

type OrganicPublishingState = {
  integration: TikTokMarketingIntegrationPublicStatus | null;
  drafts: TikTokPostDraft[];
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getDraftLabel(draft: TikTokPostDraft | null) {
  if (!draft) return 'Nepublicat';
  const labels: Record<TikTokPostDraft['status'], string> = {
    draft: 'Draft pregătit',
    ready: 'Gata de publicare',
    publishing: 'Se publică',
    processing: 'TikTok procesează',
    published: 'Publicat',
    error: 'Eroare la publicare',
  };
  return labels[draft.status];
}

export function TikTokOrganicPublishingCard({ property }: { property: Property }) {
  const { user } = useUser();
  const [state, setState] = useState<OrganicPublishingState>({ integration: null, drafts: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsLoading(false);
      return;
    }
    const activeUser = user;

    async function load() {
      try {
        const token = await activeUser.getIdToken(true);
        const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
        const [statusResponse, draftsResponse] = await Promise.all([
          fetch('/api/marketing/tiktok/status', { headers }),
          fetch('/api/marketing/tiktok/post-drafts', { headers }),
        ]);
        const [statusPayload, draftsPayload] = await Promise.all([
          statusResponse.json().catch(() => ({})),
          draftsResponse.json().catch(() => ({})),
        ]);

        if (cancelled) return;
        setState({
          integration: statusResponse.ok ? statusPayload.status || null : null,
          drafts: draftsResponse.ok && Array.isArray(draftsPayload.drafts) ? draftsPayload.drafts : [],
        });
      } catch {
        if (!cancelled) setState({ integration: null, drafts: [] });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [user, property.id]);

  const latestDraft = useMemo(
    () => state.drafts
      .filter((draft) => draft.propertyId === property.id)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] || null,
    [state.drafts, property.id]
  );
  const connected = state.integration?.connected === true;
  const hasReadyVideo = property.videoTour?.status === 'ready' && Boolean(property.videoTour.url);
  const publishedAt = formatDate(latestDraft?.publishedAt || latestDraft?.updatedAt);
  const studioHref = `/marketing/tiktok-studio?propertyId=${encodeURIComponent(property.id)}`;
  const statusLabel = isLoading
    ? 'Se verifică...'
    : !connected
      ? 'Cont TikTok neconectat'
      : getDraftLabel(latestDraft);

  return (
    <Card className={`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0`}>
      <CardContent className="space-y-4 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
              <TikTokIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">Publică pe TikTok</p>
              <p className="text-xs text-white/60">Postare organică, fără buget de promovare.</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-white/70 bg-white font-semibold text-slate-950 shadow-sm hover:bg-white hover:text-slate-950"
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Organic
          </Badge>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Status</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{statusLabel}</p>
              {!isLoading && connected && latestDraft && publishedAt ? (
                <p className="mt-1 truncate text-xs text-white/50">Actualizat {publishedAt}</p>
              ) : !isLoading && connected && !hasReadyVideo ? (
                <p className="mt-1 text-xs text-white/50">Pregătește un video vertical în TikTok Studio.</p>
              ) : null}
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white/45" />
            ) : latestDraft?.status === 'published' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-200" />
            ) : latestDraft?.status === 'publishing' || latestDraft?.status === 'processing' ? (
              <Clock3 className="h-5 w-5 text-cyan-200" />
            ) : (
              <Video className="h-5 w-5 text-cyan-200" />
            )}
          </div>
          {latestDraft?.status === 'error' && latestDraft.lastPublishError ? (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-rose-200">{latestDraft.lastPublishError}</p>
          ) : null}
        </div>

        <Button asChild className={`w-full rounded-full ${ACTION_PILL_CLASSNAME}`}>
          <Link href={studioHref}>
            {connected ? (latestDraft ? 'Deschide publicarea TikTok' : 'Pregătește postarea TikTok') : 'Conectează în TikTok Studio'}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
