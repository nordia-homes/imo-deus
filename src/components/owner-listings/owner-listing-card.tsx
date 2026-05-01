'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, formatDistanceToNow, fromUnixTime, parse } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ArrowDownToLine,
  BedDouble,
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Rocket,
  Ruler,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CollaborationStatus, OwnerListing, OwnerListingContactOutcome, OwnerListingFavorite } from '@/components/owner-listings/types';
import { extractPrice, extractRoomsValue, formatAreaValue, formatPriceNumber, isListingNew } from '@/components/owner-listings/utils';

function FavoriteHeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M12 20.4c-.3 0-.6-.1-.8-.3C7.1 16.7 4 13.9 4 10.3 4 7.7 5.9 6 8.3 6c1.5 0 2.9.7 3.7 1.9A4.46 4.46 0 0 1 15.7 6C18.1 6 20 7.7 20 10.3c0 3.6-3.1 6.4-7.2 9.8-.2.2-.5.3-.8.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type OwnerListingCardProps = {
  listing: OwnerListing;
  favoriteMeta?: OwnerListingFavorite | null;
  currentAgentId?: string | null;
  currentTimestamp?: number;
  collaborationStatus?: CollaborationStatus | null;
  isFavorite?: boolean;
  isLoadingImport?: boolean;
  collaborationMode?: 'hidden' | 'readonly' | 'interactive';
  showImportAction?: boolean;
  onImport?: (listing: OwnerListing) => void;
  onToggleFavorite?: (listing: OwnerListing) => void;
  onSetCollaborationStatus?: (listing: OwnerListing, status: CollaborationStatus | null) => void;
  onSetReserved?: (listing: OwnerListing) => void;
  onSetTaken?: (listing: OwnerListing) => void;
  onSetOutcome?: (listing: OwnerListing, outcome: OwnerListingContactOutcome) => void;
};

export function OwnerListingCard({
  listing,
  favoriteMeta,
  currentAgentId,
  currentTimestamp,
  collaborationStatus,
  isFavorite = false,
  isLoadingImport = false,
  collaborationMode = 'readonly',
  showImportAction = true,
  onImport,
  onToggleFavorite,
  onSetCollaborationStatus,
  onSetReserved,
  onSetTaken,
  onSetOutcome,
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

  const now = currentTimestamp ?? Date.now();
  const reservationExpiresAt = favoriteMeta?.reservedAt ? new Date(favoriteMeta.reservedAt).getTime() + 4 * 60 * 60 * 1000 : null;
  const isReservationExpired = Boolean(
    favoriteMeta?.reservedByAgentId && !favoriteMeta?.takenByAgentId && !favoriteMeta?.contactOutcome && reservationExpiresAt && now >= reservationExpiresAt,
  );

  const activeWorkflowStatus = useMemo(() => {
    if (isReservationExpired) return 'expired_reserved';
    if (favoriteMeta?.takenByAgentName) return 'taken';
    if (favoriteMeta?.contactOutcome === 'follow_up') return 'follow_up';
    if (favoriteMeta?.contactOutcome === 'negative') return 'negative';
    if (favoriteMeta?.reservedByAgentName) return 'reserved';
    return 'none';
  }, [favoriteMeta, isReservationExpired]);
  const canShowWorkflowActions = Boolean(onSetReserved || onSetTaken || onSetOutcome);
  const outcomeValue = favoriteMeta?.contactOutcome ?? 'none';
  const statusOwnerAgentId =
    activeWorkflowStatus === 'reserved'
      ? favoriteMeta?.reservedByAgentId
      : activeWorkflowStatus === 'taken'
        ? favoriteMeta?.takenByAgentId
        : activeWorkflowStatus === 'follow_up' || activeWorkflowStatus === 'negative'
          ? favoriteMeta?.contactOutcomeByAgentId
          : null;
  const canInteractWithStatus = activeWorkflowStatus === 'none' || activeWorkflowStatus === 'expired_reserved' || statusOwnerAgentId === currentAgentId;
  const workflowDescription = useMemo(() => {
    if (activeWorkflowStatus === 'expired_reserved' && favoriteMeta?.reservedByAgentName) {
      return `Rezervarea lui ${favoriteMeta.reservedByAgentName} a expirat. Anuntul este disponibil din nou.`;
    }

    if (activeWorkflowStatus === 'reserved' && favoriteMeta?.reservedByAgentName) {
      return `Proprietate rezervata de ${favoriteMeta.reservedByAgentName}`;
    }

    if (activeWorkflowStatus === 'taken' && favoriteMeta?.takenByAgentName) {
      return `Proprietate preluata de ${favoriteMeta.takenByAgentName}`;
    }

    if (activeWorkflowStatus === 'follow_up') {
      const agentName = favoriteMeta?.contactOutcomeByAgentName || favoriteMeta?.reservedByAgentName;
      return agentName ? `Follow-up necesar pentru ${agentName}` : 'Follow-up necesar';
    }

    if (activeWorkflowStatus === 'negative') {
      return 'Indisponibil pentru colaborare';
    }

    return '';
  }, [activeWorkflowStatus, favoriteMeta]);

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
                  ? 'border-emerald-300/70 bg-green-500 text-white'
                  : 'border-white/30 bg-white/92 text-slate-800 hover:bg-white',
              )}
            >
              <FavoriteHeartIcon filled={isFavorite} />
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
                  className="rounded-full border border-emerald-300/30 bg-[linear-gradient(135deg,rgba(24,63,49,0.96)_0%,rgba(20,86,65,0.98)_52%,rgba(16,115,81,0.98)_100%)] px-3 text-[13px] text-white shadow-[0_18px_38px_-22px_rgba(0,0,0,0.52),0_0_24px_-10px_rgba(34,197,94,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(135deg,rgba(28,76,58,0.98)_0%,rgba(24,102,76,1)_52%,rgba(18,133,92,1)_100%)]"
                  size="sm"
                  onClick={() => onImport(listing)}
                  disabled={isLoadingImport}
                >
                  {isLoadingImport ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />}
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

          {canShowWorkflowActions ? (
            <div className="grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-[auto_auto_1fr]">
              <Button
                type="button"
                variant={activeWorkflowStatus === 'reserved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSetReserved?.(listing)}
                disabled={!canInteractWithStatus}
                className={cn(
                  'rounded-full text-[12px]',
                  activeWorkflowStatus === 'reserved'
                    ? '!border-emerald-400 !bg-emerald-500 !text-white shadow-[0_16px_34px_-20px_rgba(34,197,94,0.95)] hover:!bg-emerald-500'
                    : 'border-white/15 bg-white/5 text-stone-100 hover:bg-white/10',
                )}
              >
                Rezervat
              </Button>

              <Button
                type="button"
                variant={activeWorkflowStatus === 'taken' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSetTaken?.(listing)}
                disabled={!canInteractWithStatus}
                className={cn(
                  'rounded-full text-[12px]',
                  activeWorkflowStatus === 'taken'
                    ? '!border-emerald-400 !bg-emerald-500 !text-white shadow-[0_16px_34px_-20px_rgba(34,197,94,0.95)] hover:!bg-emerald-500'
                    : 'border-white/15 bg-white/5 text-stone-100 hover:bg-white/10',
                )}
              >
                Preluat
              </Button>

              <Select
                value={outcomeValue}
                onValueChange={(value) => value !== 'none' && onSetOutcome?.(listing, value as OwnerListingContactOutcome)}
                disabled={!canInteractWithStatus}
              >
                <SelectTrigger
                  className={cn(
                    'h-9 rounded-full border-white/15 text-[12px] text-stone-100',
                    activeWorkflowStatus === 'follow_up'
                      ? '!border-emerald-300 !bg-emerald-500 !text-white shadow-[0_16px_34px_-20px_rgba(34,197,94,0.95)]'
                      : activeWorkflowStatus === 'negative'
                        ? '!border-emerald-300 !bg-emerald-500 !text-white shadow-[0_16px_34px_-20px_rgba(34,197,94,0.95)]'
                        : 'bg-white/5',
                  )}
                >
                  <SelectValue placeholder="Status final" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Status</SelectItem>
                  <SelectItem value="negative">Negativ</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {workflowDescription ? (
            <p className={cn('text-[12px]', activeWorkflowStatus === 'expired_reserved' ? 'text-amber-300' : 'text-stone-300')}>{workflowDescription}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
