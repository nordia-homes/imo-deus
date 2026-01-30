'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertiesMap } from '@/components/map/PropertiesMap';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';

export default function MapPage() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-headline font-bold">Hartă Proprietăți</h1>
                <p className="text-muted-foreground">
                    Vizualizează toate proprietățile din portofoliul tău pe o hartă interactivă.
                </p>
            </div>
            {isLoading ? (
                 <Skeleton className="flex-1 w-full" />
            ) : (
                <PropertiesMap properties={properties || []} />
            )}
        </div>
    );
}
