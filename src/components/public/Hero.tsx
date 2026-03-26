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
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={heroImage?.imageUrl || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1920&q=80"}
          alt={agency?.name || 'Real estate agency'}
          fill
          className="object-cover"
          priority
          data-ai-hint={heroImage?.imageHint || "modern house"}
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(5,5,5,0.92)_0%,rgba(8,8,10,0.84)_38%,rgba(12,12,14,0.62)_64%,rgba(17,17,19,0.26)_100%)]" />
      </div>
      <div className="relative container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl rounded-[2rem] border border-[#d4af37]/20 bg-black/50 p-8 shadow-[0_30px_90px_-36px_rgba(0,0,0,0.8)] backdrop-blur-xl md:p-12">
          <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-sm font-medium text-[#f2d27a]">
            Black Edition Collection
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-stone-100 md:text-6xl">
            {agency?.name || 'Agenția Ta Imobiliară'}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300 md:text-xl">
            {agency?.agencyDescription?.split('.')[0] || 'Găsește proprietatea de vis cu ajutorul experților noștri.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-[#d4af37] px-7 text-black hover:bg-[#e2be56]">
              <Link href="#properties">Vezi Proprietăți</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/15 bg-white/[0.04] px-7 text-stone-100 hover:bg-white/[0.08]">
              <Link href={`/agencies/${agency?.id}/contact`}>Discută cu un consultant</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
