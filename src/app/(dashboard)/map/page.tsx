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

    const headerContent = (
        <div className="text-center px-4 pt-8 lg:pb-6">
            <h1 className="text-3xl font-headline font-bold text-white">Hartă Proprietăți</h1>
            <p className="text-white/70">
                Vizualizează toate proprietățile din portofoliul tău pe o hartă interactivă.
            </p>
        </div>
    );

    const mapContent = (
        <div className="flex-1 min-h-0 px-4 pb-4">
            {isLoading ? (
                <Skeleton className="w-full h-full bg-white/10 rounded-2xl" />
            ) : (
                <PropertiesMap properties={properties || []} />
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            {/* Mobile View */}
            <div className='lg:hidden bg-[#0F1E33] -mt-4 -mb-20 h-full flex flex-col space-y-4'>
                {headerContent}
                {mapContent}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block h-full bg-[#0F1E33] -mt-6 -mx-6 -mb-6 flex flex-col">
                {headerContent}
                {mapContent}
            </div>
        </div>
    );
}
