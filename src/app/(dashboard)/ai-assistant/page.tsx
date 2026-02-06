'use client';

import { useMemo, Suspense } from 'react';
import { AiChat } from "@/components/ai/AiChat";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Contact, Property, Viewing } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useAgency } from '@/context/AgencyContext';
import { Card } from '@/components/ui/card';

function AiAssistantContent() {
  const { agency, userProfile, agencyId } = useAgency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;

  const contactsQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(collection(firestore, 'agencies', agencyId, 'contacts'), orderBy('createdAt', 'desc'));
  }, [firestore, agencyId]);
  const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(collection(firestore, 'agencies', agencyId, 'properties'), orderBy('createdAt', 'desc'));
  }, [firestore, agencyId]);
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  const viewingsQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'desc'));
  }, [firestore, agencyId]);
  const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

  const suggestedPrompts = useMemo(() => {
    const prompts = [
        "Ce vizionări am azi?",
        "Propune 3 apartamente pentru un buget de 120.000€.",
    ];

    if (contacts && contacts.length > 0) {
        const recentContact = contacts[0];
        if (recentContact) {
            prompts.unshift(`Scrie un follow-up pentru ${recentContact.name}.`);
        }
    }
    
    return prompts.slice(0, 3);
  }, [contacts]);
  
  const isLoading = areContactsLoading || arePropertiesLoading || areViewingsLoading;

  return (
    <Card className="h-full flex flex-col shadow-2xl rounded-2xl">
        <AiChat 
            suggestedPrompts={suggestedPrompts} 
            promptsLoading={isLoading}
            initialPrompt={initialPrompt}
            contacts={contacts || []}
            properties={properties || []}
            viewings={viewings || []}
            agency={agency || undefined}
            user={userProfile || undefined}
        />
    </Card>
  );
}


export default function AiAssistantPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AiAssistantContent />
        </Suspense>
    )
}
