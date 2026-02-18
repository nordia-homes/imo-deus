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

    const mapContent = (
        <div className="flex-1 min-h-0">
            {isLoading ? (
                <Skeleton className="w-full h-full bg-white/10 rounded-2xl" />
            ) : (
                <PropertiesMap properties={properties || []} />
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {mapContent}
        </div>
    );
}
