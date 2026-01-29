'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertiesMap } from '@/components/map/PropertiesMap';
import { Skeleton } from '@/components/ui/skeleton';

export default function MapPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'properties');
    }, [firestore, user]);

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
