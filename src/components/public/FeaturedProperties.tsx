'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { PublicPropertyCard } from './PublicPropertyCard';


export function FeaturedProperties({ agencyId }: { agencyId: string }) {
  const firestore = useFirestore();

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    // Query only for properties that are both active and featured.
    // This may require creating a composite index in Firestore.
    // The error message in the console will guide the user to create it.
    return query(
        collection(firestore, 'agencies', agencyId, 'properties'), 
        where('status', '==', 'Activ'),
        where('featured', '==', true),
        limit(3)
    );
  }, [firestore, agencyId]);

  const { data: featuredProperties, isLoading } = useCollection<Property>(propertiesQuery);
  
  const renderContent = () => {
      if (isLoading) {
          return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
             </div>
          );
      }

      if (!featuredProperties || featuredProperties.length === 0) {
          return null; // Don't show the section if there are no featured properties
      }
      
      return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map(prop => (
                  <PublicPropertyCard key={prop.id} property={prop} agencyId={agencyId} />
              ))}
          </div>
      );
  }

  // Only render the section if there's something to show or it's loading
  if (isLoading || (featuredProperties && featuredProperties.length > 0)) {
    return (
        <section className="bg-secondary py-20">
            <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Proprietăți Recomandate</h2>
                <p className="text-muted-foreground">Cele mai bune oferte din portofoliul nostru.</p>
            </div>
            {renderContent()}
            </div>
        </section>
    );
  }

  return null;
}
