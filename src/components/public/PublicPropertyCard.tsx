'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Bath, BedDouble, MapPin, Ruler, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { usePublicPath } from '@/context/PublicAgencyContext';

function formatPrice(price: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price);
}

export function PublicPropertyCard({
  property,
  agencyId,
  variant = 'default',
}: {
  property: Property;
  agencyId: string;
  variant?: 'default' | 'compact';
}) {
  const primaryImageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600';
  const publicPath = usePublicPath();
  const displaySurface = property.totalSurface ?? property.squareFootage;
  const [isCopied, setIsCopied] = useState(false);
  const propertyUrl = publicPath(`/properties/${property.id}`);
  const shareImageUrl = `/api/public-property-image?agencyId=${encodeURIComponent(agencyId)}&propertyId=${encodeURIComponent(property.id)}`;
  const priceClassName =
    variant === 'compact'
      ? 'text-xl font-semibold tracking-tight text-white md:text-[1.45rem]'
      : 'text-2xl font-semibold tracking-tight text-white md:text-[1.85rem]';
  const detailLabel = variant === 'compact' ? 'Vezi detalii' : 'Vezi detalii';

  const handleShare = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === 'undefined') {
      return;
    }

    const absoluteUrl = new URL(propertyUrl, window.location.origin).toString();
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
          console.error('Property card image share failed:', error);
        }

        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 1800);
      }
    } catch (error) {
      console.error('Property card share failed:', error);
    }
  }, [property.id, property.title, propertyUrl, shareImageUrl]);

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-[1.9rem] border border-emerald-400/14 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.12),transparent_28%),linear-gradient(180deg,rgba(15,18,17,0.96)_0%,rgba(10,12,12,0.98)_100%)] shadow-[0_26px_80px_-42px_rgba(0,0,0,0.86)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/24 hover:shadow-[0_32px_90px_-38px_rgba(0,0,0,0.92)]">
      <Link href={propertyUrl} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={primaryImageUrl}
            alt={property.title || 'Proprietate'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,6,0.05)_0%,rgba(5,6,6,0.18)_42%,rgba(5,6,6,0.72)_100%)]" />
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-emerald-300/18 bg-emerald-400/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 backdrop-blur-sm">
              {property.transactionType}
            </div>
            <div className="rounded-full border border-white/10 bg-black/25 p-2 text-white/80 backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className={priceClassName}>
              {formatPrice(property.price)}
            </p>
          </div>
        </div>
      </Link>

        <div className="flex flex-1 flex-col p-5">
          <Link href={propertyUrl} className="block">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-xl font-semibold tracking-tight text-white">{property.title}</h3>
            <div className="flex items-start gap-2 text-sm text-stone-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="line-clamp-2">{property.address}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-stone-200/88">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
              <BedDouble className="mx-auto h-4 w-4 text-emerald-300" />
              <p className="mt-2 font-medium text-white">{property.rooms || property.bedrooms || '-'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">Camere</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
              <Bath className="mx-auto h-4 w-4 text-emerald-300" />
              <p className="mt-2 font-medium text-white">{property.bathrooms || '-'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">Bai</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
              <Ruler className="mx-auto h-4 w-4 text-emerald-300" />
              <p className="mt-2 font-medium text-white">{displaySurface || '-'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">Mp</p>
            </div>
          </div>
          </Link>

          <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={handleShare}
              title={isCopied ? 'Link copiat' : 'Distribuie proprietatea'}
              aria-label={isCopied ? 'Link copiat' : 'Distribuie proprietatea'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-stone-100 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <Link
              href={propertyUrl}
              className="ml-3 flex h-11 flex-1 items-center justify-between rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-200 transition-transform duration-300 hover:bg-emerald-400/14"
            >
              <span>{detailLabel}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
    </Card>
  );
}
