'use client';

import { useMemo } from 'react';
import { properties as sampleProperties } from '@/lib/data';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Separator } from '@/components/ui/separator';

export function FeaturedProperties({ agencyId }: { agencyId: string }) {
    const featuredProperties = useMemo(() => {
        return sampleProperties.filter(p => p.featured && p.status === 'Activ').slice(0, 4);
    }, []);

    if (featuredProperties.length === 0) {
        return null;
    }

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl md:text-3xl font-bold">Proprietăți Recomandate</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                {featuredProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} agencyId={agencyId} />
                ))}
            </div>
            <Separator className="my-12" />
        </section>
    );
}
