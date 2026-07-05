'use client';

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { BadgeCheck, Search, X } from 'lucide-react';
import { PropertyList } from '@/components/properties/PropertyList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Property } from '@/lib/types';
import { cn } from '@/lib/utils';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getPropertySearchText(property: Property) {
  const displaySurface = property.totalSurface ?? property.squareFootage;
  return [
    property.title,
    property.address,
    property.location,
    property.city,
    property.zone,
    property.description,
    property.status,
    property.propertyType,
    property.transactionType,
    property.agentName,
    property.ownerName,
    property.ownerPhone,
    property.price,
    property.soldPrice,
    property.soldPrice ? `${property.soldPrice} eur` : null,
    property.rooms,
    property.rooms ? `${property.rooms} camere` : null,
    property.bathrooms,
    property.bathrooms ? `${property.bathrooms} bai` : null,
    displaySurface,
    displaySurface ? `${displaySurface} mp` : null,
    property.constructionYear,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SoldPropertiesPage() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [propertySearch, setPropertySearch] = useState('');

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'properties');
  }, [firestore, agencyId]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);
  const normalizedPropertySearch = useMemo(() => normalizeSearch(propertySearch), [propertySearch]);

  const soldProperties = useMemo(() => {
    const sold = (properties || [])
      .filter((property) => property.status === 'Vândut')
      .filter((property) => {
        if (!normalizedPropertySearch) return true;
        const searchableText = getPropertySearchText(property);
        return normalizedPropertySearch
          .split(/\s+/)
          .every((token) => searchableText.includes(token));
      });

    return [...sold].sort((left, right) => {
      const leftTime = left.statusUpdatedAt ? new Date(left.statusUpdatedAt).getTime() : 0;
      const rightTime = right.statusUpdatedAt ? new Date(right.statusUpdatedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [normalizedPropertySearch, properties]);

  const totalSoldValue = useMemo(
    () => soldProperties.reduce((sum, property) => sum + (property.soldPrice || property.price || 0), 0),
    [soldProperties]
  );

  const lastSoldAt = soldProperties[0]?.statusUpdatedAt
    ? new Date(soldProperties[0].statusUpdatedAt).toLocaleDateString('ro-RO')
    : 'N/A';

  const searchPlaceholder = isMobile
    ? 'Cauta vandute...'
    : 'Cauta proprietati vandute dupa titlu, adresa, zona, pret, agent...';
  const searchInput = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
      <Input
        value={propertySearch}
        onChange={(event) => setPropertySearch(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-12 rounded-2xl border-white/12 bg-[#152A47] pl-11 pr-12 text-white placeholder:text-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:ring-emerald-300/35"
      />
      {propertySearch ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setPropertySearch('')}
          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Sterge cautarea"
          title="Sterge cautarea"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={cn('agentfinder-sold-properties-page space-y-6', isMobile ? 'p-0' : 'px-3')}>
      <Card className="overflow-hidden border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] text-white shadow-[0_28px_70px_-34px_rgba(0,0,0,0.55)] lg:rounded-[30px]">
        <CardHeader className="px-5 py-5 lg:px-7 lg:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/85">
                <BadgeCheck className="h-3.5 w-3.5" />
                Tranzactii finalizate
              </div>
              <CardTitle className="mt-4 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                Proprietati Vandute
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68 lg:text-base lg:leading-7">
                Proprietatile marcate ca vandute de agentie sunt pastrate aici, cu pretul final si data schimbarii de status.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Total</p>
                <p className="mt-1 text-3xl font-semibold text-white">{soldProperties.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Volum</p>
                <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(totalSoldValue)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Ultima</p>
                <p className="mt-1 text-xl font-semibold text-white">{lastSoldAt}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="px-2 lg:px-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          {searchInput}
          {propertySearch ? (
            <div className="hidden rounded-2xl border border-white/10 bg-[#152A47] px-4 py-3 text-sm text-white/65 sm:block">
              {soldProperties.length} rezultate
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-2 lg:px-0">
        <PropertyList properties={soldProperties} isLoading={isLoading} />
      </div>
    </div>
  );
}
