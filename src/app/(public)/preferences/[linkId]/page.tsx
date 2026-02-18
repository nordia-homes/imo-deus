
'use client';
import { useParams, notFound } from 'next/navigation';
import { BuyerPreferencesForm } from '@/components/public/BuyerPreferencesForm';
import { Menu } from 'lucide-react';

function PreferencesPageContent() {
    const params = useParams();
    const linkId = params.linkId as string;

    if (!linkId) {
        notFound();
        return null;
    }

    return (
        <div className="max-w-md mx-auto px-4 py-8 min-h-screen">
             <header className="flex justify-between items-center w-full mb-4">
                <h1 className="text-3xl font-bold text-slate-800">Căutare Proprietăți</h1>
                <button aria-label="Menu">
                    <Menu className="h-6 w-6 text-slate-800" />
                </button>
            </header>
            <p className="text-slate-500 mb-8">Setează-ți preferințele pentru a găsi proprietatea dorită.</p>
            <BuyerPreferencesForm linkId={linkId} />
        </div>
    );
}

export default function BuyerPreferencesPage() {
  return <PreferencesPageContent />;
}
