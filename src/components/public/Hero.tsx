'use client';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Hero() {
  const { agency } = usePublicAgency();
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero');

  return (
    <section className="relative text-white">
      <div className="absolute inset-0">
        <Image
          src={heroImage?.imageUrl || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1920&q=80"}
          alt={agency?.name || 'Real estate agency'}
          fill
          className="object-cover"
          priority
          data-ai-hint={heroImage?.imageHint || "modern house"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
      </div>
      <div className="relative container mx-auto px-4 py-32 text-center">
        <h1 className="text-4xl md:text-6xl font-bold drop-shadow-lg">
          {agency?.name || 'Agenția Ta Imobiliară'}
        </h1>
        <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto drop-shadow-md">
          {agency?.agencyDescription?.split('.')[0] || 'Găsește proprietatea de vis cu ajutorul experților noștri.'}
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="#properties">Vezi Proprietăți</Link>
        </Button>
      </div>
    </section>
  );
}
