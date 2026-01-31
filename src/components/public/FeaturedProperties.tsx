'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { PropertyCard } from '../properties/PropertyCard';

export function FeaturedProperties({ agencyId }: { agencyId: string }) {

    const firestore = useFirestore();

    const featuredQuery = useMemoFirebase(() => {
        return query(
            collection(firestore, 'agencies', agencyId, 'properties'),
            where('featured', '==', true),
            where('status', '==', 'Activ'),
            limit(8)
        );
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(featuredQuery);

    if (isLoading) {
        return (
             <div>
                <Skeleton className="h-8 w-64 mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-3">
                            <Skeleton className="aspect-square w-full rounded-xl" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-5 w-1/3" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!properties || properties.length === 0) {
        return null; // Don't render the section if there are no featured properties
    }


    return (
        <section>
            <h2 className="text-3xl font-bold tracking-tight mb-8">Proprietăți Recomandate</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                {properties.map(property => (
                    <PropertyCard key={property.id} property={property} agencyId={agencyId} />
                ))}
            </div>
        </section>
    );
}

    