
'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertyClientView } from '@/components/public/PropertyClientView';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicPropertyDetailPage() {
  const params = useParams();
  const agencyId = params.agencyId as string;
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();

  const propertyDocRef = useMemoFirebase(() => {
    if (!agencyId || !propertyId) return null;
    return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
  }, [firestore, agencyId, propertyId]);

  // Use the hook to fetch data on the client
  const { data: property, isLoading, error } = useDoc<Property>(propertyDocRef);

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

  // Not found or error state
  // This also handles the permission error, as `useDoc` will set the `error` state.
  // It also handles if the property is not 'Activ' because the security rule will deny the read.
  if (error || !property) {
    // We can use Next.js's notFound() to render the standard 404 page
    notFound();
    return null;
  }
  
  // The property must be active to be visible, this is an extra client-side check,
  // but the security rule is the primary enforcer.
  if (property.status !== 'Activ') {
      notFound();
      return null;
  }

  return <PropertyClientView property={property} />;
}
