'use client';

import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '../ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const heroImageData = PlaceHolderImages.find(img => img.id === 'hero');

export function Hero() {
  const { agency, isAgencyLoading } = usePublicAgency();

  if (isAgencyLoading) {
    return (
        <section className="relative h-[60vh] bg-muted flex items-center justify-center text-center">
            <div className="relative z-10 p-4">
                <Skeleton className="h-16 w-96 mb-4" />
                <Skeleton className="h-8 w-80 mb-8" />
                <Skeleton className="h-12 w-48" />
            </div>
        </section>
    );
  }

  return (
    <section className="relative h-[60vh] bg-black text-white flex items-center justify-center text-center">
      {heroImageData && (
        <Image
            src={heroImageData.imageUrl}
            alt={heroImageData.description}
            fill
            className="object-cover"
            style={{ opacity: 0.4 }}
            data-ai-hint={heroImageData.imageHint}
            priority
        />
      )}
      <div className="relative z-10 p-4">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          {agency?.name || 'Agenția Ta Imobiliară'}
        </h1>
        <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto">
          Găsește proprietatea de vis. Partenerul tău de încredere în imobiliare.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="#properties">Vezi Proprietățile</Link>
        </Button>
      </div>
    </section>
  );
}
