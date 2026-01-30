
'use client';

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { Property } from "@/lib/types";
import { PublicPropertyCard } from "./PublicPropertyCard";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FileQuestion } from 'lucide-react';


export function PublicPropertyList({ agencyId }: { agencyId: string }) {
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'properties'),
            where('status', '==', 'Activ'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, agencyId]);

    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    if (isLoading) {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-96 w-full" />
                ))}
             </div>
        );
    }
    
    if (!properties || properties.length === 0) {
        return (
            <div className="max-w-md mx-auto">
              <Alert>
                <FileQuestion className="h-4 w-4" />
                <AlertTitle>Nicio Proprietate Disponibilă</AlertTitle>
                <AlertDescription>
                  Momentan nu există nicio proprietate publică în portofoliul acestei agenții. Vă rugăm să reveniți mai târziu.
                </AlertDescription>
              </Alert>
            </div>
        )
    }
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {properties.map(property => (
            <PublicPropertyCard key={property.id} property={property} agencyId={agencyId} />
          ))}
        </div>
    )
}
