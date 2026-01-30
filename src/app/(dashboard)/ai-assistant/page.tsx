'use client';

import { useMemo, Suspense } from 'react';
import { AiChat } from "@/components/ai/AiChat";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useAgency } from '@/context/AgencyContext';

function AiAssistantContent() {
  const { agencyId } = useAgency();
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

  const suggestedPrompts = useMemo(() => {
    const prompts = [
        "Care este prețul mediu pe metru pătrat în Cluj-Napoca, zona centrală?",
    ];

    if (contacts && contacts.length > 0) {
        const recentContact = contacts[0];
        if (recentContact) {
            prompts.unshift(`Creează un email de follow-up pentru ${recentContact.name}.`);
        }
    }

    if (properties && properties.length > 0) {
        const recentProperty = properties[0];
         if (recentProperty) {
            prompts.unshift(`Generează o descriere pentru proprietatea "${recentProperty.title}".`);
        }
    } else {
         prompts.unshift("Generează o descriere pentru un apartament cu 3 camere în Brașov.");
    }
    
    return prompts.slice(0, 3);
  }, [contacts, properties]);
  
  const isLoading = areContactsLoading || arePropertiesLoading;

  return (
    <div className="h-full flex flex-col">
       <div>
            <h1 className="text-3xl font-headline font-bold">Asistent AI</h1>
            <p className="text-muted-foreground">
                Asistentul tău personal pentru orice întrebare imobiliară.
            </p>
        </div>
        <AiChat 
            suggestedPrompts={suggestedPrompts} 
            promptsLoading={isLoading}
            initialPrompt={initialPrompt}
        />
    </div>
  );
}


export default function AiAssistantPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AiAssistantContent />
        </Suspense>
    )
}
