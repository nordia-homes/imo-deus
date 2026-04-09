'use client';

import { useMemo, useState } from 'react';
import type { Property, PortalRecommendation } from '@/lib/types';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Bath, BedDouble, ExternalLink, Heart, MessageSquareText, Ruler, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from '../ui/badge';
import Link from 'next/link';
import Image from 'next/image';

interface RecommendedPropertyCardProps {
  property: Property;
  recommendation: PortalRecommendation;
  portalId: string;
  agencyId: string;
  contactId: string;
}

export function RecommendedPropertyCard({ property, recommendation, portalId, agencyId, contactId }: RecommendedPropertyCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [comment, setComment] = useState(recommendation.clientComment || '');
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | 'none'>(recommendation.clientFeedback);
  const [isCommentDirty, setIsCommentDirty] = useState(false);

  const recommendationRef = doc(firestore, 'portals', portalId, 'recommendations', recommendation.id);
  const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);
  const hasImages = Boolean(property.images?.length);
  const detailHref = `/agencies/${agencyId}/properties/${property.id}`;
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const summaryItems = [
    { icon: <BedDouble className="h-4 w-4" />, label: 'Camere', value: property.rooms || property.bedrooms || '-' },
    { icon: <Bath className="h-4 w-4" />, label: 'Băi', value: property.bathrooms || '-' },
    { icon: <Ruler className="h-4 w-4" />, label: 'Suprafață', value: displaySurface ? `${displaySurface} mp` : '-' },
  ];

  const feedbackLabel = useMemo(() => {
    if (feedback === 'liked') return 'Ți-a plăcut';
    if (feedback === 'disliked') return 'Nu ți se potrivește';
    return 'Așteaptă feedback';
  }, [feedback]);

  const handleFeedback = (newFeedback: 'liked' | 'disliked') => {
    const finalFeedback = feedback === newFeedback ? 'none' : newFeedback;
    setFeedback(finalFeedback);

    updateDocumentNonBlocking(recommendationRef, { clientFeedback: finalFeedback });
    updateDocumentNonBlocking(contactRef, {
      [`recommendationHistory.${recommendation.id}.clientFeedback`]: finalFeedback,
    });

    toast({ title: 'Feedback trimis', description: 'Agentul tău vede acum preferința ta.' });
  };

  const handleSaveComment = () => {
    updateDocumentNonBlocking(recommendationRef, { clientComment: comment });
    updateDocumentNonBlocking(contactRef, {
      [`recommendationHistory.${recommendation.id}.clientComment`]: comment,
    });

    setIsCommentDirty(false);
    toast({ title: 'Comentariu salvat', description: 'Mesajul tău a fost trimis agentului.' });
  };

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.12),transparent_28%),linear-gradient(180deg,rgba(14,18,17,0.98)_0%,rgba(10,12,12,0.99)_100%)] text-stone-100 shadow-[0_26px_80px_-42px_rgba(0,0,0,0.92)]">
      <Carousel opts={{ loop: hasImages }} className="relative">
        <CarouselContent>
          {hasImages ? property.images.map((image, index) => (
            <CarouselItem key={index}>
              <div className="relative aspect-[16/10] overflow-hidden bg-[#101113]">
                <Image
                  src={image.url}
                  alt={image.alt || property.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,6,0.08)_0%,rgba(4,6,6,0.22)_48%,rgba(4,6,6,0.78)_100%)]" />
              </div>
            </CarouselItem>
          )) : (
            <CarouselItem>
              <div className="flex aspect-[16/10] items-center justify-center bg-[#101113] text-sm text-stone-500">
                Imagine indisponibilă
              </div>
            </CarouselItem>
          )}
        </CarouselContent>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <Badge className="rounded-full border border-emerald-300/18 bg-emerald-400/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 shadow-none">
            Recomandare selectată
          </Badge>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-white/78 backdrop-blur-md">
            {feedbackLabel}
          </div>
        </div>
        {hasImages && property.images.length > 1 && (
          <>
            <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 border-white/12 bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60" />
            <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 border-white/12 bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60" />
          </>
        )}
      </Carousel>

      <div className="space-y-6 p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white">{property.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-stone-300">{property.address}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/78">Preț propus</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-white">€{property.price.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-3 py-4 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                  {item.icon}
                </div>
                <p className="mt-3 text-base font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-400">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.45rem] border border-white/8 bg-black/15 p-4">
            <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-stone-300">
              {property.description || 'Agentul tău a considerat această proprietate relevantă pentru ce cauți.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={feedback === 'liked' ? 'default' : 'outline'}
              onClick={() => handleFeedback('liked')}
              className={cn(
                "rounded-full border px-5",
                feedback === 'liked'
                  ? 'border-emerald-300/16 bg-emerald-400 text-black hover:bg-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]'
              )}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              Îmi place
            </Button>
            <Button
              type="button"
              variant={feedback === 'disliked' ? 'default' : 'outline'}
              onClick={() => handleFeedback('disliked')}
              className={cn(
                "rounded-full border px-5",
                feedback === 'disliked'
                  ? 'border-white/16 bg-white text-black hover:bg-stone-200'
                  : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]'
              )}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Nu e pentru mine
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]">
              <Link href={detailHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Vezi detalii complete
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Mesaj pentru agent</p>
              <p className="text-sm text-stone-400">Spune ce îți place sau ce ai vrea diferit.</p>
            </div>
          </div>
          <Textarea
            placeholder="Ex: îmi place zona și compartimentarea, dar aș prefera mai multă lumină sau un etaj mai înalt..."
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setIsCommentDirty(true);
            }}
            className="min-h-[120px] rounded-[1.2rem] border-white/10 bg-black/20 text-stone-100 placeholder:text-stone-500"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Heart className="h-4 w-4 text-emerald-300" />
              Agentul poate folosi feedbackul tău pentru selecții mai bune.
            </div>
            <Button
              type="button"
              onClick={handleSaveComment}
              disabled={!comment.trim() || !isCommentDirty}
              className="rounded-full bg-emerald-400 px-5 text-black hover:bg-emerald-300"
            >
              Salvează comentariul
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
