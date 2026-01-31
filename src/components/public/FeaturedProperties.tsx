'use client';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Separator } from '@/components/ui/separator';
import type { Property } from '@/lib/types';

export function FeaturedProperties({ properties, agencyId }: { properties: Property[], agencyId: string }) {

  if (!properties || properties.length === 0) {
    return null; // Don't render anything if there are no featured properties
  }
  
  return (
    <div id="featured-properties">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Proprietăți Recomandate</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {properties.map((property) => (
            <PropertyCard key={property.id} property={property} agencyId={agencyId} />
        ))}
      </div>
      <Separator className="my-12" />
    </div>
  );
}
