'use client';

import { LeadCard } from "./LeadCard";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from "../ui/skeleton";
import type { Contact } from "@/lib/types";
import { useAgency } from "@/context/AgencyContext";
import { Card, CardContent } from "../ui/card";

export function LeadList() {
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const contactsCollection = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);

    const { data: cumparatori, isLoading } = useCollection<Contact>(contactsCollection);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    if (!cumparatori || cumparatori.length === 0) {
        return (
            <Card className="shadow-lg rounded-2xl">
                <CardContent className="p-10 text-center text-muted-foreground">
                    Nu ai adăugat niciun cumpărător. Folosește butonul de mai sus pentru a începe.
                </CardContent>
            </Card>
        )
    }
  
    return (
        <div className="space-y-4">
            {cumparatori.map(cumparator => (
                <LeadCard key={cumparator.id} lead={cumparator} />
            ))}
        </div>
    );
}
