'use client';

import { useParams, notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Property } from '@/lib/types';
import { PropertyClientView } from '@/components/public/PropertyClientView';
import { Skeleton } from '@/components/ui/skeleton';
import { properties as sampleProperties } from '@/lib/data';

export default function PublicPropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  
  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Simulate async fetch
    const foundProperty = sampleProperties.find(p => p.id === propertyId);
    setProperty(foundProperty || null);
    setIsLoading(false);
  }, [propertyId]);
  
  const error = !property && !isLoading;

  // Loading state
  if (isLoading || property === undefined) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <Skeleton className="h-[60vh] w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="md:col-span-1">
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        </div>
    );
  }

  // Not found or error state
  if (error || !property) {
    notFound();
    return null;
  }
  
  // The property must be active to be visible.
  if (property.status !== 'Activ') {
      notFound();
      return null;
  }

  return <PropertyClientView property={property} />;
}
