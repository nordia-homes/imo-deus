'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, formatDistanceToNow, fromUnixTime, parse } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  BedDouble,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Home,
  Loader2,
  Rocket,
  Ruler,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CollaborationStatus, OwnerListing } from '@/components/owner-listings/types';
import { extractPrice, extractRoomsValue, formatAreaValue, formatPriceNumber, isListingNew } from '@/components/owner-listings/utils';

type OwnerListingCardProps = {
  listing: OwnerListing;
  collaborationStatus?: CollaborationStatus | null;
  isFavorite?: boolean;
  isLoadingImport?: boolean;
  collaborationMode?: 'hidden' | 'readonly' | 'interactive';
  showImportAction?: boolean;
  onImport?: (listing: OwnerListing) => void;
  onToggleFavorite?: (listing: OwnerListing) => void;
  onSetCollaborationStatus?: (listing: OwnerListing, status: CollaborationStatus | null) => void;
};

export function OwnerListingCard({
  listing,
  collaborationStatus,
  isFavorite = false,
  isLoadingImport = false,
  collaborationMode = 'readonly',
  showImportAction = true,
  onImport,
  onToggleFavorite,
  onSetCollaborationStatus,
}: OwnerListingCardProps) {
  const locationDisplay = useMemo(() => {
    if (!listing.location) {
      return '';
    }

    if (listing.location.includes(' - Reactualizat azi la ')) {
      const locationPart = listing.location.split(' - Reactualizat azi la ')[0];
      return `${locationPart} - Act. azi`;
    }

    const parts = listing.location.split(' - Reactualizat la ');
    if (parts.length === 2) {
      const locationPart = parts[0];
      const datePart = parts[1];
      try {
        const date = parse(datePart, 'dd MMMM yyyy', new Date(), { locale: ro });
        const formattedDate = format(date, 'dd/MM/yyyy');
        return `${locationPart} - Act. ${formattedDate}`;
      } catch {
        return listing.location.replace('Reactualizat la', 'Act.');
      }
    }

    return listing.location;
  }, [listing.location]);

  const calculateTimeAgo = (timestamp: number) => {
    try {
      if (!timestamp || typeof timestamp !== 'number') {
        return 'Data necunoscuta';
      }
      const postDate = fromUnixTime(timestamp);
      let timeAgo = formatDistanceToNow(postDate, { locale: ro });
      timeAgo = timeAgo.replace('circa ', '');
      timeAgo = timeAgo.replace('aproximativ ', '');
      timeAgo = timeAgo.replace('mai putin de un minut', 'un minut');
      return timeAgo.replace('in urma', '').trim();
    } catch {
      return 'Data invalida';
    }
  };

  const year = listing.constructionYear || listing.year;
  const roomsValue = extractRoomsValue(listing.rooms);
  const areaValue = formatAreaValue(listing.area);
  const imageToDisplay =
    listing.imageUrl && listing.imageUrl.startsWith('http')
      ? listing.imageUrl
      : listing.image && listing.image.startsWith('http')
        ? listing.image
        : null;
  const badgeLabel = listing.originSourceLabel || listing.sourceLabel;
  const showNewBadge = isListingNew(listing);

  let displayPrice = 'Pret negociabil';
  if (listing.price) {
    const numericPrice = extractPrice(listing.price);
    if (numericPrice !== null) {
      displayPrice = `EUR ${formatPriceNumber(numericPrice)}`;
    }
  }

  const collaborationButtons =
    collaborationMode === 'hidden' ? null : (
      <div className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/55 px-2 py-2 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.95)] backdrop-blur-md">
        {collaborationMode === 'readonly' ? (
          collaborationStatus === 'collaborates' ? (
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#93c5fd] bg-[#2563eb] text-white shadow-[0_0_0_2px_rgba(147,197,253,0.38),0_18px_38px_-18px_rgba(37,99,235,0.95)]">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          ) : collaborationStatus === 'does_not_collaborate' ? (
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500 text-white shadow-[0_14px_30px_-22px_rgba(244,63,94,0.92)]">
              <XCircle className="h-4.5 w-4.5" />
            </div>
          ) : null
        ) : (
          <>
            <button
              type="button"
              title="Proprietarul colaboreaza"
              disabled={collaborationMode !== 'interactive'}
              onClick={() =>
                collaborationMode === 'interactive' && onSetCollaborationStatus
                  ? onSetCollaborationStatus(listing, collaborationStatus === 'collaborates' ? null : 'collaborates')
                  : undefined
              }
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                collaborationStatus === 'collaborates'
                  ? 'border-[#93c5fd] bg-[#2563eb] text-white shadow-[0_0_0_2px_rgba(147,197,253,0.38),0_18px_38px_-18px_rgba(37,99,235,0.95)]'
                  : 'border-white/12 bg-white/10 text-white/78',
                collaborationMode === 'interactive' ? 'hover:border-[#bfdbfe] hover:bg-[#1d4ed8]' : 'cursor-default',
              )}
            >
              <CheckCircle2 className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              title="Proprietarul nu colaboreaza"
              disabled={collaborationMode !== 'interactive'}
              onClick={() =>
                collaborationMode === 'interactive' && onSetCollaborationStatus
                  ? onSetCollaborationStatus(listing, collaborationStatus === 'does_not_collaborate' ? null : 'does_not_collaborate')
                  : undefined
              }
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                collaborationStatus === 'does_not_collaborate'
                  ? 'border-rose-400/70 bg-rose-500 text-white shadow-[0_14px_30px_-22px_rgba(244,63,94,0.92)]'
                  : 'border-white/12 bg-white/10 text-white/78',
                collaborationMode === 'interactive' ? 'hover:border-rose-300 hover:bg-rose-500/90' : 'cursor-default',
              )}
            >
              <XCircle className="h-4.5 w-4.5" />
            </button>
          </>
        )}
      </div>
    );

  return (
    <Card className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f1013] text-stone-100 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-34px_rgba(0,0,0,0.85)]">
      <CardContent className="p-0">
        <div className="relative">
          <Link
            href={listing.link}
            target="_blank"
            rel="noreferrer"
            className="block aspect-[16/10] relative overflow-hidden rounded-t-[1.75rem] bg-muted"
          >
            {imageToDisplay ? (
              <Image
                src={imageToDisplay}
                alt={listing.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gray-100">
                <Home className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </Link>

          <div className="absolute left-3 top-3">
            <div className="inline-flex items-center rounded-full border border-white bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-950 shadow-[0_14px_26px_-22px_rgba(0,0,0,0.95)]">
              {badgeLabel}
            </div>
          </div>

          <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
            <button
              type="button"
              title={isFavorite ? 'Scoate din Favorite' : 'Adauga in Favorite'}
              onClick={() => onToggleFavorite?.(listing)}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_16px_32px_-24px_rgba(15,23,42,0.95)] backdrop-blur-md transition-colors',
                isFavorite
                  ? 'border-rose-300/70 bg-rose-500 text-white'
                  : 'border-white/30 bg-white/92 text-slate-800 hover:bg-white',
              )}
            >
              <Heart className={cn('h-4.5 w-4.5', isFavorite ? 'fill-current' : '')} />
            </button>

            {showNewBadge ? (
              <div className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_-14px_rgba(16,185,129,0.95)]">
                NOU
              </div>
            ) : null}
          </div>

          {collaborationButtons ? <div className="absolute bottom-3 right-3">{collaborationButtons}</div> : null}
        </div>

        <div className="space-y-3 p-4">
          <div className="min-w-0">
            <Link href={listing.link} target="_blank" rel="noreferrer" className="block min-w-0">
              <h3 className="truncate font-semibold text-stone-100 group-hover:text-[#86efac]" title={listing.title}>
                {listing.title}
              </h3>
              {listing.description ? (
                <p className="truncate text-sm text-stone-400" title={listing.description}>
                  {listing.description}
                </p>
              ) : null}
              <p className="truncate text-sm text-stone-400" title={locationDisplay}>
                {locationDisplay}
              </p>
            </Link>
          </div>

          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap text-[13px] text-stone-400">
            {roomsValue !== null ? (
              <div className="flex shrink-0 items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 shrink-0" />
                <span>{roomsValue}</span>
              </div>
            ) : null}

            {areaValue ? (
              <div className="flex shrink-0 items-center gap-1">
                <Ruler className="h-3.5 w-3.5 shrink-0" />
                <span>{areaValue}</span>
              </div>
            ) : null}

            <div className="flex shrink-0 items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{calculateTimeAgo(listing.postedAt)}</span>
            </div>

            {year ? (
              <div className="flex shrink-0 items-center gap-1 text-stone-300">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{year}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="min-w-0 flex-1 text-[0.96rem] font-bold leading-none tracking-[-0.01em] text-stone-100 sm:text-[1rem]">
              {displayPrice}
            </p>

            <div className="flex shrink-0 items-center gap-2">
              {showImportAction && onImport ? (
                <Button
                  className="rounded-full border border-emerald-300/30 bg-[linear-gradient(135deg,rgba(24,63,49,0.96)_0%,rgba(20,86,65,0.98)_52%,rgba(16,115,81,0.98)_100%)] px-4 text-white shadow-[0_18px_38px_-22px_rgba(0,0,0,0.52),0_0_24px_-10px_rgba(34,197,94,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(135deg,rgba(28,76,58,0.98)_0%,rgba(24,102,76,1)_52%,rgba(18,133,92,1)_100%)]"
                  size="sm"
                  onClick={() => onImport(listing)}
                  disabled={isLoadingImport}
                >
                  {isLoadingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Importa anuntul
                </Button>
              ) : null}

              <Button asChild size="icon" className="bg-green-500 text-white hover:bg-green-600">
                <Link href={listing.link} target="_blank">
                  <Rocket className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
