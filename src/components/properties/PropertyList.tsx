
'use client';
import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Property } from '@/lib/types';
import { PropertyCard } from "./PropertyCard";
import { Skeleton } from '../ui/skeleton';
import { Card } from '../ui/card';

export function PropertyList() {
    const { user } = useUser();
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'properties');
    }, [firestore, user]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <Skeleton className="aspect-video w-full" />
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-8 w-1/3 mt-4" />
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    if (!properties || properties.length === 0) {
        return <p className="text-center text-muted-foreground py-10">Nu există proprietăți de afișat. Adaugă una pentru a începe.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(property => (
                <PropertyCard key={property.id} property={property} />
            ))}
        </div>
    )
}
