'use client';
import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PublicPropertyCard } from './PublicPropertyCard';
import { Skeleton } from '../ui/skeleton';

export function FeaturedProperties({ agencyId }: { agencyId: string }) {
  const firestore = useFirestore();

  // Query for all active properties, then we will filter client-side.
  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
        collection(firestore, 'agencies', agencyId, 'properties'),
        where('status', '==', 'Activ')
    );
  }, [firestore, agencyId]);
  
  const { data: activeProperties, isLoading } = useCollection<Property>(propertiesQuery);

  // Client-side filtering for featured properties
  const featuredProperties = useMemo(() => {
    if (!activeProperties) return [];
    return activeProperties
        .filter(p => p.featured === true)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3);
  }, [activeProperties]);

  if (isLoading) {
      return (
          <section className="py-12 bg-secondary">
              <div className="container mx-auto px-4">
                  <h2 className="text-3xl font-bold text-center mb-8">Proprietăți Recomandate</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <Skeleton className="h-96" />
                      <Skeleton className="h-96" />
                      <Skeleton className="h-96" />
                  </div>
              </div>
          </section>
      );
  }

  if (featuredProperties.length === 0) {
      return null; // Don't render the section if there are no featured properties
  }

  return (
    <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8">Proprietăți Recomandate</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredProperties.map(property => (
                    <PublicPropertyCard key={property.id} property={property} agencyId={agencyId} />
                ))}
            </div>
        </div>
    </section>
  );
}
