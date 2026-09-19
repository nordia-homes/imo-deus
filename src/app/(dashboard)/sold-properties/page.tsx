'use client';

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { BadgeCheck, Building2, Search, TrendingUp, X } from 'lucide-react';
import { PropertyList } from '@/components/properties/PropertyList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

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
      <div className="tt-design settings-tiktok">
        <style>{`
          .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
          .settings-tiktok .tt-hero { grid-template-columns: minmax(0,0.9fr) minmax(520px,1.1fr) !important; }
          @media (max-width: 900px) {
            .settings-tiktok .tt-hero { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <header className="tt-hero">
          <div>
            <div className="tt-hero-kicker">
              <BadgeCheck size={17} />
              <span className="tt-eyebrow">TRANZACȚII FINALIZATE</span>
            </div>
            <h1>Proprietăți <em>Vândute</em></h1>
            <p className="tt-hero-lead">
              Istoricul tău de rezultate.
              <br />
              <strong>Volumul și ritmul agenției, la vedere.</strong>
            </p>
            <p>
              Proprietățile marcate ca vândute sunt păstrate aici, cu prețul final și data schimbării de status.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Total
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {soldProperties.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">Proprietăți vândute</p>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                <TrendingUp className="h-4 w-4" />
                Volum
              </div>
              <p className="mt-3 break-words text-xl font-semibold tracking-[-0.04em] text-slate-950">
                {formatCurrency(totalSoldValue)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Valoare finală</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                <BadgeCheck className="h-4 w-4" />
                Ultima
              </div>
              <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                {lastSoldAt}
              </p>
              <p className="mt-1 text-xs text-slate-500">Tranzacție finalizată</p>
            </div>
          </div>
        </header>
      </div>

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
