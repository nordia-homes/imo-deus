'use client';

import type { Property } from '@/lib/types';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Home } from 'lucide-react';

interface FeaturedPropertiesProps {
  properties: Property[];
  agencyId: string;
}

export function FeaturedProperties({ properties, agencyId }: FeaturedPropertiesProps) {
  if (!properties || properties.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <Home className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-bold">Proprietăți Recomandate</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} agencyId={agencyId} />
        ))}
      </div>
    </section>
  );
}
