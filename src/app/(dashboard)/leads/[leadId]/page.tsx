'use client';

import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

import { ContactDetailsClient } from "@/components/contacts/contact-details-client";
import { properties } from "@/lib/data"; // Using placeholder properties
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeadDetailPage() {
    const params = useParams();
    const leadId = params.leadId as string;
    
    const { user } = useUser();
    const firestore = useFirestore();

    const contactDocRef = useMemoFirebase(() => {
        if (!user || !leadId) return null;
        return doc(firestore, 'users', user.uid, 'contacts', leadId);
    }, [firestore, user, leadId]);

    const { data: contact, isLoading, error } = useDoc<Contact>(contactDocRef);

    if (isLoading) {
        return (
             <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (error) {
        console.error(error);
        return <div className="text-center text-red-500">A apărut o eroare la încărcarea lead-ului. Este posibil să nu aveți permisiunea de a-l vizualiza.</div>;
    }

    if (!contact) {
        return <div className="text-center text-muted-foreground">Lead-ul nu a fost găsit.</div>;
    }
    
    // Convert property format for the property matcher
    const matcherProperties: (Property & { image: string })[] = properties.map(p => ({
        ...p,
        image: p.images[0]?.url || '',
        imageUrl: p.images[0]?.url || '',
        imageHint: '',
    }));

    return (
        <ContactDetailsClient contact={contact} properties={matcherProperties} />
    );
}
