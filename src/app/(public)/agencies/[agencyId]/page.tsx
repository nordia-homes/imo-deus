'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Agency } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect } from 'react';


function AgencyHero({ agency, agencyId, isLoading }: { agency: Agency | null, agencyId: string, isLoading: boolean }) {
    
    if (isLoading) {
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
    
    // This case will be handled by notFound() in the parent, but it's good practice.
    if (!agency) {
        return null;
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

export default function AgencyHomePage() {
  const params = useParams();
  const agencyId = params.agencyId as string;
  const firestore = useFirestore();

  const agencyDocRef = useMemoFirebase(() => {
      if (!agencyId) return null;
      return doc(firestore, 'agencies', agencyId);
  }, [firestore, agencyId]);

  const { data: agency, isLoading, error } = useDoc<Agency>(agencyDocRef);

  useEffect(() => {
    // If loading is finished and there's still no agency, or there's an error, show 404
    if (!isLoading && (!agency || error)) {
      notFound();
    }
  }, [isLoading, agency, error]);
  
  // Render loading state until notFound() is called or data is available
  if (isLoading || !agency) {
      return (
        <div>
          <AgencyHero agency={null} agencyId={agencyId} isLoading={true} />
          {/* You can also add a skeleton for FeaturedProperties here if you want */}
        </div>
      )
  }

  return (
    <div>
      <AgencyHero agency={agency} agencyId={agencyId} isLoading={isLoading} />
      <FeaturedProperties agencyId={agencyId} />
    </div>
  );
}
