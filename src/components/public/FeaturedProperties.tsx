
'use client';

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import type { Property } from "@/lib/types";
import { PublicPropertyCard } from "./PublicPropertyCard";
import { Skeleton } from "../ui/skeleton";

export function FeaturedProperties({ agencyId }: { agencyId: string }) {
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'properties'), 
            where('featured', '==', true),
            where('status', '==', 'Activ'),
            limit(3)
        );
    }, [firestore, agencyId]);

    const { data: featuredProperties, isLoading } = useCollection<Property>(propertiesQuery);

    if (isLoading) {
        return (
            <section className="container mx-auto py-16 px-4">
                 <h2 className="text-3xl font-bold text-center mb-8">Proprietăți Recomandate</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                 </div>
            </section>
        )
    }

    if (!featuredProperties || featuredProperties.length === 0) {
        return null; // Don't render the section if there are no featured properties
    }
    
    return (
        <section className="container mx-auto py-16 px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Proprietăți Recomandate</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map(property => (
              <PublicPropertyCard key={property.id} property={property} agencyId={agencyId} />
            ))}
          </div>
        </section>
    )
}
