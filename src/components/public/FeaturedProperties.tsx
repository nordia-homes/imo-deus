'use client';

import type { Property } from '@/lib/types';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Home } from 'lucide-react';
import { usePublicPath } from '@/context/PublicAgencyContext';

interface FeaturedPropertiesProps {
  properties: Property[];
  agencyId: string;
}

export function FeaturedProperties({ properties, agencyId }: FeaturedPropertiesProps) {
  const publicPath = usePublicPath();

  if (!properties || properties.length === 0) {
    return null;
  }

  return (
    <section id="properties" className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#22c55e]/25 bg-[#22c55e]/10 text-[#86efac]">
          <Home className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22c55e]/80">Sugestiile noastre</p>
          <h2 className="whitespace-nowrap text-[clamp(1.32rem,5.35vw,2.3rem)] leading-none font-bold tracking-tight text-stone-100">
            Proprietati recomandate
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} agencyId={agencyId} publicBasePath={publicPath()} />
        ))}
      </div>
    </section>
  );
}
