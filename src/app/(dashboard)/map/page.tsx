'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { DashboardMapPageMap } from '@/components/map/DashboardMapPageMap';
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
        <div className="agentfinder-map-page h-full w-full">
            {isLoading ? (
                <Skeleton className="agentfinder-map-skeleton w-full h-full bg-white/10 rounded-2xl" />
            ) : (
                <DashboardMapPageMap properties={properties || []} />
            )}
        </div>
    );
}
