'use client';
import { PublicPropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { useMemo } from 'react';

export default function AgencyHomePage() {
  const { agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const firestore = useFirestore();

  // Fetch active properties for the main list
  const activePropertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(collection(firestore, 'agencies', agencyId, 'properties'), where('status', '==', 'Activ'));
  }, [firestore, agencyId]);
  const { data: activeProperties, isLoading: isActiveLoading } = useCollection<Property>(activePropertiesQuery);

  // Fetch featured properties
  const featuredPropertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
      collection(firestore, 'agencies', agencyId, 'properties'),
      where('status', '==', 'Activ'),
      where('featured', '==', true),
      limit(4)
    );
  }, [firestore, agencyId]);
  const { data: featuredProperties, isLoading: isFeaturedLoading } = useCollection<Property>(featuredPropertiesQuery);

  const isLoading = isAgencyContextLoading || isActiveLoading || isFeaturedLoading;

  if (isLoading) {
    return (
        <div className="container mx-auto py-8 px-4 space-y-12">
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

            <Skeleton className="h-px w-full" />
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                {[...Array(8)].map((_, i) => (
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

  return (
    <div className="container mx-auto py-8 px-4 space-y-12">
      <FeaturedProperties properties={featuredProperties || []} agencyId={agencyId!} />
      <div id="properties">
         <PublicPropertyList properties={activeProperties || []} agencyId={agencyId!} />
      </div>
    </div>
  );
}
