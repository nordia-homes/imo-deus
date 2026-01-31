'use client';

import { useParams, notFound } from 'next/navigation';
import { useMemo } from 'react';
import type { Property } from '@/lib/types';
import { PropertyClientView } from '@/components/public/PropertyClientView';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function PublicPropertyDetailPage() {
  const params = useParams();
  const { agencyId, propertyId } = params as { agencyId: string, propertyId: string };
  const firestore = useFirestore();

  const propertyDocRef = useMemoFirebase(() => {
    if (!agencyId || !propertyId) return null;
    return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
  }, [firestore, agencyId, propertyId]);

  const { data: property, isLoading, error: docError } = useDoc<Property>(propertyDocRef);

  // Loading state
  if (isLoading) {
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

  // Not found if there was a doc-level error, if the property doesn't exist,
  // or if the property is not 'Activ'. This is a security check.
  if (docError || !property || property.status !== 'Activ') {
    notFound();
    return null;
  }

  return <PropertyClientView property={property} />;
}
