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
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.86)_42%,rgba(248,250,252,0.52)_68%,rgba(15,23,42,0.10)_100%)]" />
      </div>
      <div className="relative container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl rounded-[2rem] border border-white/70 bg-white/72 p-8 shadow-[0_25px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-12">
          <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Consultanță imobiliară modernă
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            {agency?.name || 'Agenția Ta Imobiliară'}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            {agency?.agencyDescription?.split('.')[0] || 'Găsește proprietatea de vis cu ajutorul experților noștri.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7 shadow-lg shadow-primary/20">
              <Link href="#properties">Vezi Proprietăți</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-300 bg-white/70 px-7 text-slate-700 hover:bg-slate-50">
              <Link href={`/agencies/${agency?.id}/contact`}>Discută cu un consultant</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
