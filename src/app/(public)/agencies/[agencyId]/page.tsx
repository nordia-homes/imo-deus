'use client';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import type { Property } from '@/lib/types';
import { useMemo } from 'react';
import { Hero } from '@/components/public/Hero';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function AgencyHomePage() {
  const { agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const firestore = useFirestore();

  // Fetch properties from Firestore
  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
        collection(firestore, 'agencies', agencyId, 'properties'),
        where('status', '==', 'Activ')
    );
  }, [firestore, agencyId]);

  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  // Filter featured properties from the fetched data
  const featuredProperties = useMemo(() => {
    if (!properties) return [];
    return properties.filter(p => p.featured).slice(0, 4);
  }, [properties]);

  const isLoading = isAgencyContextLoading || arePropertiesLoading;

  if (isLoading) {
    return (
        <>
            <Hero />
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
            </div>
        </>
    )
  }

  return (
    <>
      <Hero />
      <div className="container mx-auto py-8 px-4 space-y-12">
        <FeaturedProperties properties={featuredProperties} agencyId={agencyId!} />
        <div className="text-center">
            <Button asChild size="lg">
                <Link href={`/agencies/${agencyId}/properties`}>Vezi toate proprietățile</Link>
            </Button>
        </div>
      </div>
    </>
  );
}
