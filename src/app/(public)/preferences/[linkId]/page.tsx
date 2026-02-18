
'use client';
import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { BuyerPreferencesLink, Contact } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { BuyerPreferencesForm } from '@/components/public/BuyerPreferencesForm';

function PreferencesPageContent() {
    const params = useParams();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const linkDocRef = useMemoFirebase(() => doc(firestore, 'buyer-preferences-links', linkId), [firestore, linkId]);
    const { data: linkData, isLoading: isLinkLoading, error: linkError } = useDoc<BuyerPreferencesLink>(linkDocRef);

    if (isLinkLoading) {
        return (
            <div className="container mx-auto max-w-2xl py-12 px-4 space-y-6">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }
    
    if (linkError || !linkData) {
        notFound();
        return null;
    }

    // The contact data is denormalized in the link document itself
    const contactDataForForm: Partial<Contact> = {
        name: linkData.contactName,
        budget: linkData.budget,
        preferences: linkData.preferences,
        city: linkData.city,
        zones: linkData.zones,
        generalZone: linkData.generalZone,
    };

    return (
        <div className="container mx-auto max-w-2xl py-12 px-4">
             <header className="mb-8">
                <h1 className="text-4xl font-bold">Preferințele tale de căutare</h1>
                <p className="text-muted-foreground mt-2">Salut, {contactDataForForm.name}! Te rugăm să completezi sau să actualizezi formularul de mai jos pentru a ne ajuta să găsim proprietatea perfectă pentru tine.</p>
            </header>
            <BuyerPreferencesForm contact={contactDataForForm} linkId={linkId} />
        </div>
    );
}


export default function BuyerPreferencesPage() {
  return <PreferencesPageContent />;
}
