'use client';

import { useMemo } from 'react';
import { AiChat } from "@/components/ai/AiChat";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function AiAssistantPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const contactsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'contacts'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'properties'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
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
        <AiChat suggestedPrompts={suggestedPrompts} promptsLoading={isLoading}/>
    </div>
  );
}
