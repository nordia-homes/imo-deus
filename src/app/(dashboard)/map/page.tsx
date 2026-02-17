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

    const content = (
        <>
            <div>
                <h1 className="text-3xl font-headline font-bold text-white">Hartă Proprietăți</h1>
                <p className="text-white/70">
                    Vizualizează toate proprietățile din portofoliul tău pe o hartă interactivă.
                </p>
            </div>
            <div className="flex-1 min-h-0">
                {isLoading ? (
                    <Skeleton className="w-full h-full bg-white/10 rounded-2xl" />
                ) : (
                    <PropertiesMap properties={properties || []} />
                )}
            </div>
        </>
    );


    return (
        <div className="h-full flex flex-col">
            {/* Mobile View */}
            <div className='lg:hidden bg-[#0F1E33] -m-4 -mb-20 p-4 h-full flex flex-col space-y-4'>
                {content}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block h-full bg-[#0F1E33] -mt-6 -mx-6 -mb-6 p-6 flex flex-col space-y-6">
                {content}
            </div>
        </div>
    );
}
