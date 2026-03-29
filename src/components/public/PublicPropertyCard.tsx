'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Bath, BedDouble, MapPin, Ruler } from 'lucide-react';
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

export function PublicPropertyCard({ property, agencyId }: { property: Property; agencyId: string }) {
  const primaryImageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600';
  const publicPath = usePublicPath();

  return (
    <Link href={publicPath(`/properties/${property.id}`)} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden rounded-[1.9rem] border border-emerald-400/14 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.12),transparent_28%),linear-gradient(180deg,rgba(15,18,17,0.96)_0%,rgba(10,12,12,0.98)_100%)] shadow-[0_26px_80px_-42px_rgba(0,0,0,0.86)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/24 hover:shadow-[0_32px_90px_-38px_rgba(0,0,0,0.92)]">
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
            <p className="text-2xl font-semibold tracking-tight text-white md:text-[1.85rem]">
              {formatPrice(property.price)}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
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
              <p className="mt-2 font-medium text-white">{property.squareFootage || '-'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">Mp</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
            <span className="text-sm font-medium text-emerald-200">Vezi detalii</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200 transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
