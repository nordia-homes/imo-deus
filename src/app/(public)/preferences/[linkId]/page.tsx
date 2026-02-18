
'use client';
import { useParams, notFound } from 'next/navigation';
import { BuyerPreferencesForm } from '@/components/public/BuyerPreferencesForm';

function PreferencesPageContent() {
    const params = useParams();
    const linkId = params.linkId as string;

    if (!linkId) {
        notFound();
        return null;
    }

    return (
        <div className="container mx-auto max-w-2xl py-12 px-4">
             <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold">Preferințele tale de căutare</h1>
                <p className="text-muted-foreground mt-2">Te rugăm să completezi sau să actualizezi formularul de mai jos pentru a ne ajuta să găsim proprietatea perfectă pentru tine.</p>
            </header>
            <BuyerPreferencesForm linkId={linkId} />
        </div>
    );
}


export default function BuyerPreferencesPage() {
  return <PreferencesPageContent />;
}
