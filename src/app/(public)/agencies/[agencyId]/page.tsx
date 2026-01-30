
import { initializeFirebase } from '@/firebase/server';
import { doc, getDoc } from 'firebase/firestore';
import type { Agency } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Skeleton } from '@/components/ui/skeleton';


function AgencyHero({ agency, agencyId }: { agency: Agency | null, agencyId: string }) {
    
    if (!agency) {
        return (
             <section className="relative h-[60vh] bg-muted flex items-center justify-center text-center">
                <div className="relative z-10 p-4">
                    <Skeleton className="h-16 w-96 mb-4" />
                    <Skeleton className="h-8 w-80 mb-8" />
                    <div className="flex gap-4 justify-center">
                        <Skeleton className="h-12 w-36" />
                        <Skeleton className="h-12 w-36" />
                    </div>
                </div>
            </section>
        );
    }
    
  const heroImageUrl = agency?.logoUrl || 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2070&auto=format&fit=crop';
  const tagline = agency?.name ? `Partenerul dumneavoastră de încredere în imobiliare.` : 'Găsiți proprietatea visurilor dumneavoastră.';


    return (
        <section className="relative h-[60vh] bg-muted flex items-center justify-center text-center text-white">
            <Image 
            src={heroImageUrl}
            alt={`${agency?.name || 'Real Estate'} hero image`}
            fill
            className="object-cover"
            priority
            />
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10 p-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{agency?.name || 'Agenție Imobiliară'}</h1>
            <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto">
                {tagline}
            </p>
            <div className="mt-8 flex gap-4 justify-center">
                <Button size="lg" asChild>
                <Link href={`/agencies/${agencyId}/properties`}>Vezi Proprietățile</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                <Link href={`/agencies/${agencyId}/contact`}>Contactează-ne</Link>
                </Button>
            </div>
            </div>
        </section>
    );
}

export default async function AgencyHomePage({ params }: { params: { agencyId: string } }) {
  const { agencyId } = params;

  // Server-side data fetching
  const { firestore } = initializeFirebase();
  const agencyDocRef = doc(firestore, 'agencies', agencyId);

  let agency: Agency;
  try {
    const agencySnap = await getDoc(agencyDocRef);

    // Defensive check to ensure the document exists.
    if (!agencySnap.exists()) {
      notFound();
    }
    
    agency = { id: agencySnap.id, ...agencySnap.data() } as Agency;

  } catch (error) {
    console.error("Failed to fetch agency:", error);
    // If there's a more fundamental error (e.g. permissions),
    // throw a generic error to be caught by Next.js error boundary.
    throw new Error("Could not fetch agency data. This may be a permission issue or a server error.");
  }

  return (
    <div>
      <AgencyHero agency={agency} agencyId={agencyId} />
      <FeaturedProperties agencyId={agencyId} />
    </div>
  );
}
