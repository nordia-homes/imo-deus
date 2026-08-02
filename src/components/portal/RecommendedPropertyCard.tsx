'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Property, PortalRecommendation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import { ArrowRight, Bath, BedDouble, Calendar, Heart, MapPin, MessageCircle, Ruler, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';

interface RecommendedPropertyCardProps {
  property: Property;
  recommendation: PortalRecommendation;
  portalId: string;
  agencyId: string;
  contactId: string;
}

export function RecommendedPropertyCard({
  property,
  recommendation,
  portalId,
  agencyId,
  contactId,
}: RecommendedPropertyCardProps) {
  const { toast } = useToast();
  const { isCustomDomain, agency } = usePublicAgency();
  const publicPath = usePublicPath();
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const [comment, setComment] = useState(recommendation.clientComment || '');
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | 'none'>(recommendation.clientFeedback);
  const [isCommentDirty, setIsCommentDirty] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(Boolean(recommendation.clientComment?.trim()));
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [isFavorite] = useState(false);

  const detailHref = isCustomDomain
    ? publicPath(`/properties/${property.id}`)
    : `/agencies/${agencyId}/properties/${property.id}`;
  const primaryImageUrl = property.images?.[0]?.url || 'https://via.placeholder.com/800x500.png?text=Imagine+lipsa';
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const shareImageUrl = `/api/public-property-image?agencyId=${encodeURIComponent(agencyId)}&propertyId=${encodeURIComponent(property.id)}`;

  const feedbackLabel = useMemo(() => {
    if (feedback === 'liked') return 'Apreciata';
    if (feedback === 'disliked') return 'Respinsa';
    return 'Asteapta feedback';
  }, [feedback]);

  const savePortalFeedback = async (update: { clientFeedback?: 'liked' | 'disliked' | 'none'; clientComment?: string }) => {
    const clientEventId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(`/api/client-portal/${encodeURIComponent(portalId)}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: recommendation.id, clientEventId, ...update }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Feedbackul nu a putut fi salvat.');
  };

  const handleFeedback = async (newFeedback: 'liked' | 'disliked') => {
    if (isSavingFeedback) return;
    const previousFeedback = feedback;
    const finalFeedback = feedback === newFeedback ? 'none' : newFeedback;
    setFeedback(finalFeedback);
    setIsSavingFeedback(true);
    try {
      await savePortalFeedback({ clientFeedback: finalFeedback });
      toast({ title: 'Feedback trimis', description: 'Agentul tau vede acum preferinta ta.' });
    } catch (error) {
      setFeedback(previousFeedback);
      toast({ variant: 'destructive', title: 'Feedback nesalvat', description: error instanceof Error ? error.message : 'Incearca din nou.' });
    } finally {
      setIsSavingFeedback(false);
    }
  };

  const handleSaveComment = async () => {
    if (!isCommentDirty || isSavingFeedback) return;
    setIsSavingFeedback(true);
    try {
      await savePortalFeedback({ clientComment: comment });
      setComment(comment.trim());
      setIsCommentDirty(false);
      toast({ title: comment.trim() ? 'Comentariu salvat' : 'Comentariu sters', description: 'Agentul tau a fost instiintat.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Comentariu nesalvat', description: error instanceof Error ? error.message : 'Incearca din nou.' });
    } finally {
      setIsSavingFeedback(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;

    const absoluteUrl = new URL(detailHref, window.location.origin).toString();
    const shareData: ShareData = {
      title: property.title,
      text: `Aceasta proprietate este acum disponibila si poate fi vizionata: ${property.title}`,
      url: absoluteUrl,
    };

    try {
      if (navigator.share) {
        try {
          const imageResponse = await fetch(shareImageUrl, { cache: 'no-store' });
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            const fileExtension = blob.type.split('/')[1] || 'jpg';
            const file = new File([blob], `proprietate-${property.id}.${fileExtension}`, {
              type: blob.type || 'image/jpeg',
            });
            const shareDataWithFile: ShareData = {
              files: [file],
              title: property.title,
              text: `${shareData.text}\n${absoluteUrl}`,
            };

            if (!navigator.canShare || navigator.canShare(shareDataWithFile)) {
              await navigator.share(shareDataWithFile);
              return;
            }
          }
        } catch (error) {
          console.error('Portal property card image share failed:', error);
        }

        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        toast({ title: 'Link copiat!' });
      }
    } catch (error) {
      console.error('Portal property card share failed:', error);
    }
  };

  return (
    <article className="space-y-0 overflow-hidden rounded-[1.75rem]">
      <Card className="group overflow-hidden rounded-t-[1.75rem] rounded-b-none border border-white/10 bg-[#0f1013] text-stone-100 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-34px_rgba(0,0,0,0.85)] md:rounded-[1.75rem]">
        <CardContent className="p-0">
          <div className="relative">
            <Link href={detailHref} className="relative block aspect-[16/10] overflow-hidden rounded-t-[1.75rem]" target="_blank" rel="noopener noreferrer">
              <Image
                src={primaryImageUrl}
                alt={property.title || 'Proprietate'}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </Link>
            <div className="absolute left-3 top-3">
              <Badge
                variant="outline"
                className="border border-transparent bg-[#f8fbff] px-3 py-1 text-[12px] font-semibold tracking-[-0.01em] text-[#1f67c5] shadow-[0_10px_24px_rgba(15,23,42,0.10)]"
              >
                Recomandat
              </Badge>
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className={cn(
                  'h-8 w-8 rounded-full',
                  isAgentfinderTheme
                    ? 'border border-white/90 bg-white text-[#5f7296] shadow-[0_12px_28px_rgba(37,55,88,0.12)] hover:bg-white'
                    : 'bg-black/45 text-stone-100 backdrop-blur-sm hover:bg-black/70'
                )}
              >
                <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
              </Button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex justify-between items-start">
              <Link href={detailHref} className="min-w-0 flex-1" target="_blank" rel="noopener noreferrer">
                <h3 className="truncate font-semibold text-stone-100 transition-colors group-hover:text-[#86efac]" title={property.title}>
                  {property.title}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <p className="truncate" title={property.address}>{property.address}</p>
                </div>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-400">
              <div className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" />
                <span>{property.rooms}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bath className="h-4 w-4" />
                <span>{property.bathrooms}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4" />
                <span>{displaySurface} mp</span>
              </div>
              {property.constructionYear ? (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{property.constructionYear}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xl font-bold text-[#4ade80]">€{property.price.toLocaleString()}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Distribuie proprietatea"
                  aria-label="Distribuie proprietatea"
                  onClick={handleShare}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-stone-100 transition-colors hover:bg-white/[0.12] hover:text-white"
                >
                  <Share2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-stone-100 hover:bg-white/[0.08]">
                  <Link href={detailHref} className="inline-flex items-center gap-2" target="_blank" rel="noopener noreferrer">
                    Vezi Detalii
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className={cn(
          '-mt-px rounded-b-[1.6rem] rounded-t-none p-3 shadow-none md:-mt-1 md:rounded-t-[1.25rem] md:border-t',
          isAgentfinderTheme
            ? 'border border-t-0 border-[var(--app-surface-border)] bg-[var(--agentfinder-shell-panel)] md:shadow-[0_22px_44px_rgba(37,55,88,0.14)]'
            : 'border border-t-0 border-white/10 bg-[#0f1013] md:shadow-[0_22px_44px_-28px_rgba(0,0,0,0.72)]'
        )}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', isAgentfinderTheme ? 'text-[#59709b]' : 'text-stone-300')}>
            Feedback rapid
          </p>
          <p className={cn('text-xs font-medium', isAgentfinderTheme ? 'text-slate-500' : 'text-stone-400')}>Alege o reactie</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleFeedback('liked')}
            disabled={isSavingFeedback}
            className={cn(
              'group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[1.05rem] border px-3 py-2 text-center transition-all duration-200 hover:-translate-y-0.5',
              feedback === 'liked'
                ? isAgentfinderTheme
                  ? 'border-emerald-300/80 bg-[linear-gradient(180deg,#ecfdf3_0%,#d9fbe8_100%)] text-emerald-900 shadow-[0_16px_30px_rgba(34,197,94,0.18)]'
                  : 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100 shadow-[0_16px_30px_rgba(34,197,94,0.12)]'
                : isAgentfinderTheme
                  ? 'border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] text-slate-700 shadow-[0_12px_22px_rgba(37,55,88,0.08)] hover:border-[#9bb0d5] hover:text-slate-900 hover:shadow-[0_16px_28px_rgba(37,55,88,0.12)]'
                  : 'border-white/10 bg-white/[0.04] text-stone-300 shadow-[0_12px_22px_rgba(0,0,0,0.16)] hover:border-emerald-300/25 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
              feedback === 'liked'
                ? isAgentfinderTheme
                  ? 'border-emerald-300 bg-white/75 text-emerald-700'
                  : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                : isAgentfinderTheme
                  ? 'border-slate-200 bg-slate-50 text-[#445b84] group-hover:border-[#b7c7e3] group-hover:bg-white'
                  : 'border-white/10 bg-white/[0.05] text-stone-200 group-hover:border-emerald-300/20 group-hover:bg-white/[0.08]'
            )}>
              <ThumbsUp className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className={cn('text-[13px] font-semibold leading-none tracking-[-0.01em]', isAgentfinderTheme ? 'text-slate-900' : 'text-stone-100')}>Like</span>
          </button>
          <button
            type="button"
            onClick={() => handleFeedback('disliked')}
            disabled={isSavingFeedback}
            className={cn(
              'group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[1.05rem] border px-3 py-2 text-center transition-all duration-200 hover:-translate-y-0.5',
              feedback === 'disliked'
                ? isAgentfinderTheme
                  ? 'border-rose-300/80 bg-[linear-gradient(180deg,#fff1f3_0%,#ffe0e6_100%)] text-rose-900 shadow-[0_16px_30px_rgba(244,63,94,0.15)]'
                  : 'border-rose-300/35 bg-rose-500/12 text-rose-100 shadow-[0_16px_30px_rgba(244,63,94,0.12)]'
                : isAgentfinderTheme
                  ? 'border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] text-slate-700 shadow-[0_12px_22px_rgba(37,55,88,0.08)] hover:border-[#9bb0d5] hover:text-slate-900 hover:shadow-[0_16px_28px_rgba(37,55,88,0.12)]'
                  : 'border-white/10 bg-white/[0.04] text-stone-300 shadow-[0_12px_22px_rgba(0,0,0,0.16)] hover:border-rose-300/25 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
              feedback === 'disliked'
                ? isAgentfinderTheme
                  ? 'border-rose-300 bg-white/75 text-rose-700'
                  : 'border-rose-300/30 bg-rose-500/10 text-rose-100'
                : isAgentfinderTheme
                  ? 'border-slate-200 bg-slate-50 text-[#445b84] group-hover:border-[#b7c7e3] group-hover:bg-white'
                  : 'border-white/10 bg-white/[0.05] text-stone-200 group-hover:border-rose-300/20 group-hover:bg-white/[0.08]'
            )}>
              <ThumbsDown className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className={cn('text-[13px] font-semibold leading-none tracking-[-0.01em]', isAgentfinderTheme ? 'text-slate-900' : 'text-stone-100')}>Dislike</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCommentOpen((current) => !current)}
            className={cn(
              'group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[1.05rem] border px-3 py-2 text-center transition-all duration-200 hover:-translate-y-0.5',
              isCommentOpen
                ? isAgentfinderTheme
                  ? 'border-[#9bb0d5] bg-[linear-gradient(180deg,#eef4ff_0%,#dde8fb_100%)] text-[#263754] shadow-[0_16px_30px_rgba(68,91,132,0.16)]'
                  : 'border-blue-300/35 bg-blue-500/12 text-blue-100 shadow-[0_16px_30px_rgba(59,130,246,0.12)]'
                : isAgentfinderTheme
                  ? 'border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] text-slate-700 shadow-[0_12px_22px_rgba(37,55,88,0.08)] hover:border-[#9bb0d5] hover:text-slate-900 hover:shadow-[0_16px_28px_rgba(37,55,88,0.12)]'
                  : 'border-white/10 bg-white/[0.04] text-stone-300 shadow-[0_12px_22px_rgba(0,0,0,0.16)] hover:border-blue-300/25 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <span className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
              isCommentOpen
                ? isAgentfinderTheme
                  ? 'border-[#b7c7e3] bg-white/75 text-[#445b84]'
                  : 'border-blue-300/30 bg-blue-500/10 text-blue-100'
                : isAgentfinderTheme
                  ? 'border-slate-200 bg-slate-50 text-[#445b84] group-hover:border-[#b7c7e3] group-hover:bg-white'
                  : 'border-white/10 bg-white/[0.05] text-stone-200 group-hover:border-blue-300/20 group-hover:bg-white/[0.08]'
            )}>
              <MessageCircle className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className={cn('text-[13px] font-semibold leading-none tracking-[-0.01em]', isAgentfinderTheme ? 'text-slate-900' : 'text-stone-100')}>Comentariu</span>
          </button>
        </div>

        {isCommentOpen ? (
          <div
            className={cn(
              'mt-3 rounded-[1.15rem] p-0 shadow-none',
              isAgentfinderTheme ? 'border border-[var(--app-surface-border)] bg-transparent' : 'border border-white/10 bg-transparent'
            )}
          >
            <textarea
              placeholder="Scrie aici feedbackul tau pentru agent..."
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                setIsCommentDirty(true);
              }}
              className={cn(
                'block min-h-[128px] w-full resize-none rounded-[1.25rem] px-4 py-3 text-base outline-none',
                isAgentfinderTheme
                  ? 'border border-[#d8e2f1] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(37,55,88,0.06)] placeholder:text-slate-400 focus:border-[#9bb0d5] focus:ring-2 focus:ring-[#dbe7fb]'
                  : 'border border-white/10 bg-[#131722] text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-stone-500 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-400/10'
              )}
              style={{
                background: isAgentfinderTheme ? 'linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%)' : '#131722',
                color: isAgentfinderTheme ? '#1e293b' : '#f5f5f4',
              }}
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={!isCommentDirty || isSavingFeedback}
                className={cn(
                  'block w-full rounded-[1rem] px-5 py-3 text-base font-semibold transition-all duration-200',
                  !isCommentDirty || isSavingFeedback
                    ? isAgentfinderTheme
                      ? 'cursor-not-allowed border border-[#d3ddea] bg-[linear-gradient(180deg,#eef3f9_0%,#e3eaf4_100%)] text-[#6d7f9f] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
                      : 'cursor-not-allowed border border-white/10 bg-white/[0.05] text-stone-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                    : isAgentfinderTheme
                      ? 'border border-[#4b6592] bg-[linear-gradient(135deg,#4b6592_0%,#3f567f_100%)] text-white shadow-[0_18px_34px_rgba(47,66,104,0.26)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#5570a0_0%,#465f8c_100%)] hover:shadow-[0_20px_38px_rgba(47,66,104,0.3)]'
                      : 'border border-emerald-300/25 bg-[linear-gradient(135deg,#22c55e_0%,#16a34a_100%)] text-white shadow-[0_18px_34px_rgba(22,163,74,0.24)] hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#2dd468_0%,#17924a_100%)] hover:shadow-[0_20px_38px_rgba(22,163,74,0.3)]'
                )}
              >
                Salveaza comentariul
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
