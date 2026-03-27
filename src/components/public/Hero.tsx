'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, Headphones, MapPinned, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const statCardClassName =
  'rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,21,23,0.9)_0%,rgba(11,13,14,0.96)_100%)] px-4 py-4 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl';

export function Hero() {
  const { agency } = usePublicAgency();
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero');

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={
            heroImage?.imageUrl ||
            'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1920&q=80'
          }
          alt={agency?.name || 'Real estate agency'}
          fill
          priority
          className="object-cover object-center"
          data-ai-hint={heroImage?.imageHint || 'modern house'}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.18),transparent_28%),linear-gradient(110deg,rgba(5,7,7,0.92)_0%,rgba(8,10,10,0.86)_32%,rgba(10,12,12,0.7)_55%,rgba(10,12,12,0.38)_100%)]" />
      </div>

      <div className="relative container mx-auto px-4 py-10 md:py-14 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-end">
          <div className="max-w-3xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,17,18,0.78)_0%,rgba(11,13,14,0.88)_100%)] p-6 shadow-[0_32px_90px_-42px_rgba(0,0,0,0.82)] backdrop-blur-xl md:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Proprietati atent alese
            </div>

            <h1 className="mt-5 max-w-2xl text-[clamp(2.1rem,5vw,4.75rem)] font-semibold tracking-[-0.04em] text-white">
              {agency?.name || 'Agentia ta imobiliara'}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-200/88 md:text-lg">
              Gasesti proprietati prezentate detaliat, cu fotografii clare, informatii utile si un mod simplu de a
              intra in legatura cu noi atunci cand ceva iti atrage atentia.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_42px_-16px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
              >
                <Link href="#properties">
                  Vezi proprietatile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/10 bg-white/[0.05] px-7 text-white hover:bg-white/[0.1]"
              >
                <Link href={`/agencies/${agency?.id}/contact`}>Contacteaza agentia</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className={statCardClassName}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">Portofoliu activ</p>
                  <p className="text-sm text-stone-300">Anunturi disponibile acum, pregatite sa fie descoperite</p>
                </div>
              </div>
            </div>

            <div className={statCardClassName}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">Zone relevante</p>
                  <p className="text-sm text-stone-300">Proprietati din zone cautate, usor de comparat</p>
                </div>
              </div>
            </div>

            <div className={statCardClassName}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">Experienta curata</p>
                  <p className="text-sm text-stone-300">Un site aerisit, gandit sa-ti arate repede ce conteaza</p>
                </div>
              </div>
            </div>

            <div className={statCardClassName}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">Asistenta dedicata</p>
                  <p className="text-sm text-stone-300">Suntem aici pentru intrebari, recomandari si vizionari</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
