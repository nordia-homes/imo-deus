'use client';

import { PropertyCard } from '@/components/properties/PropertyCard';
import type { Property } from '@/lib/types';
import Link from 'next/link';

export function FeaturedProperties({ properties, agencyId }: { properties: Property[], agencyId: string }) {
  if (!properties || properties.length === 0) {
    return null;
  }

  return (
    <section id="featured-properties">
      <div className="flex justify-between items-baseline mb-6">
        <h2 className="text-3xl font-bold">Proprietăți Recomandate</h2>
        <Link href="#properties" className="text-sm font-medium text-primary hover:underline">
          Vezi toate proprietățile
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {properties.map(property => (
          <PropertyCard key={property.id} property={property} agencyId={agencyId} />
        ))}
      </div>
    </section>
  );
}
