'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  MapPinned,
  PhoneCall,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Hero } from '@/components/public/Hero';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Property } from '@/lib/types';

const sectionShellClassName =
  'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';

const highlightCardClassName =
  'rounded-[1.75rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(14,18,17,0.96)_0%,rgba(10,13,12,0.98)_100%)] shadow-[0_24px_70px_-42px_rgba(0,0,0,0.72)]';

function formatPrice(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AgencyHomePage() {
  const { agency, agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const firestore = useFirestore();

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(collection(firestore, 'agencies', agencyId, 'properties'), where('status', '==', 'Activ'));
  }, [firestore, agencyId]);

  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  const featuredProperties = useMemo(() => {
    if (!properties) return [];
    const featured = properties.filter((property) => property.featured);
    const source = featured.length >= 8 ? featured : properties;
    return source.slice(0, 8);
  }, [properties]);

  const overview = useMemo(() => {
    const safeProperties = properties ?? [];
    const activeCount = safeProperties.length;
    const averagePrice = activeCount
      ? Math.round(safeProperties.reduce((sum, property) => sum + (property.price || 0), 0) / activeCount)
      : 0;
    const saleCount = safeProperties.filter((property) =>
      property.transactionType?.toLowerCase().includes('v')
    ).length;
    const rentCount = safeProperties.filter((property) =>
      property.transactionType?.toLowerCase().includes('inch')
    ).length;
    const uniqueAreas = new Set(
      safeProperties
        .map((property) => property.zone || property.city || property.location || property.address)
        .filter(Boolean)
    ).size;

    return {
      activeCount,
      averagePrice,
      saleCount,
      rentCount,
      featuredCount: featuredProperties.length,
      uniqueAreas,
    };
  }, [featuredProperties.length, properties]);

  const spotlightItems = [
    {
      icon: CheckCircle2,
      eyebrow: 'Claritate',
      title: 'Anunturi usor de inteles',
      description:
        'Vezi rapid pretul, zona, detaliile importante si fotografiile fara sa te pierzi in informatii inutile.',
    },
    {
      icon: Users,
      eyebrow: 'Suport real',
      title: 'Discuti direct cu oameni care te pot ajuta',
      description:
        'Daca ai nevoie de recomandari sau de programarea unei vizionari, agentia este la un mesaj distanta.',
    },
    {
      icon: Building2,
      eyebrow: 'Mai multe optiuni',
      title: 'Portofoliu activ pentru vanzare si inchiriere',
      description:
        'Poti incepe cu recomandarile de pe homepage, apoi continui simplu catre toate proprietatile disponibile.',
    },
  ];

  const isLoading = isAgencyContextLoading || arePropertiesLoading;

  if (isLoading) {
    return (
      <>
        <Hero />
        <div className="container mx-auto space-y-8 px-4 py-8 md:space-y-12 md:py-12">
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-[1.75rem]" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-[2rem]" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-72" />
            <div className="grid gap-6 lg:grid-cols-4">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="aspect-[4/5] rounded-[1.75rem]" />
              ))}
            </div>
          </div>
          <Skeleton className="h-80 rounded-[2rem]" />
        </div>
      </>
    );
  }

  return (
    <>
      <Hero />
      <div className="container mx-auto space-y-8 px-4 py-8 md:space-y-12 md:py-12">
        <FeaturedProperties properties={featuredProperties} agencyId={agencyId!} />

        <section className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Mai multe optiuni
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Vrei sa vezi tot portofoliul disponibil?
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-emerald-50/72">
                Ai vazut selectia de pe homepage. Continua direct spre toate proprietatile si filtreaza mai usor dupa
                buget, zona si tipul de tranzactie.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
            >
              <Link href={`/agencies/${agencyId}/properties`}>
                Vezi toate proprietatile
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className={`${highlightCardClassName} p-6`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Portofoliu activ</p>
              <Building2 className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-5 text-4xl font-semibold tracking-tight text-white">{overview.activeCount}</p>
            <p className="mt-3 text-sm leading-6 text-emerald-100/75">
              proprietati active, dintre care {overview.featuredCount} sunt evidentiate ca recomandari publice.
            </p>
          </div>
          <div className={`${highlightCardClassName} p-6`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Mix de tranzactii</p>
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-5 text-4xl font-semibold tracking-tight text-white">
              {overview.saleCount}
              <span className="ml-2 text-lg font-medium text-emerald-100/60">vanzare</span>
            </p>
            <p className="mt-3 text-sm leading-6 text-emerald-100/75">
              plus {overview.rentCount} optiuni pentru inchiriere, distribuite in {overview.uniqueAreas || 1} zone.
            </p>
          </div>
          <div className={`${highlightCardClassName} p-6`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Pret mediu</p>
              <Clock3 className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-5 text-4xl font-semibold tracking-tight text-white">
              {overview.averagePrice ? formatPrice(overview.averagePrice) : 'La cerere'}
            </p>
            <p className="mt-3 text-sm leading-6 text-emerald-100/75">
              un reper rapid pentru portofoliul public actual, util ca punct de pornire in cautarea ta.
            </p>
          </div>
        </section>

        <section className={`${sectionShellClassName} overflow-hidden p-6 md:p-8`}>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Totul incepe simplu
              </div>
              <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Gaseste mai usor proprietatea potrivita, fara pasi complicati.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/72 md:text-lg">
                {agency?.agencyDescription ||
                  'Aici vezi rapid proprietatile disponibile, intelegi ce ti se potriveste si poti intra imediat in legatura cu agentia.'}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_16px_40px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
                >
                  <Link href={`/agencies/${agencyId}/properties`}>
                    Exploreaza proprietatile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08]"
                >
                  <Link href={`/agencies/${agencyId}/contact`}>Vorbeste cu un consultant</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`${highlightCardClassName} p-5 sm:col-span-2`}>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">De pe homepage poti face imediat</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Vezi 8 proprietati
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Intri in detalii complete
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Contactezi agentia
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Mergi spre toate anunturile
                  </span>
                </div>
              </div>
              <div className={`${highlightCardClassName} p-5`}>
                <MapPinned className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-xl font-semibold text-white">Zone si tipuri variate</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-100/72">
                  Vezi optiuni diferite si compara rapid ce merita pastrat pe lista ta scurta.
                </p>
              </div>
              <div className={`${highlightCardClassName} p-5`}>
                <PhoneCall className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-xl font-semibold text-white">Ajutor rapid</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-100/72">
                  Cand o proprietate ti se pare potrivita, poti trece imediat la contact sau vizionare.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {spotlightItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className={`${highlightCardClassName} p-6`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
                  {item.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-emerald-50/72">{item.description}</p>
              </article>
            );
          })}
        </section>

        <section className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Un proces clar</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Ce faci dupa ce ai gasit o proprietate care iti place.
              </h2>
              <p className="mt-3 text-base leading-7 text-emerald-50/72">
                Am simplificat homepage-ul ca sa fie mai usor de parcurs: vezi selectie, intri in detalii, apoi faci
                urmatorul pas fara blocaje.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-emerald-400/20 bg-emerald-400/10 px-6 text-emerald-100 hover:bg-emerald-400/15"
            >
              <Link href={`/agencies/${agencyId}/about`}>Afla mai multe despre agentie</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <article className={`${highlightCardClassName} p-6`}>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Pasul 1</span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">Parcurgi selectia initiala</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/72">
                Homepage-ul iti arata direct 8 proprietati, ca sa poti incepe repede fara scroll inutil.
              </p>
            </article>
            <article className={`${highlightCardClassName} p-6`}>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Pasul 2</span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">Intri in pagina de detaliu</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/72">
                Acolo vezi fotografii, descriere, informatii detaliate, harta si proprietati similare.
              </p>
            </article>
            <article className={`${highlightCardClassName} p-6`}>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Pasul 3</span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">Contactezi agentia</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/72">
                Cand esti pregatit, mergi direct spre contact, consultanta sau programarea unei vizionari.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <article className={`${highlightCardClassName} p-6 md:p-7`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Date utile</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Tot ce ai nevoie pentru primul pas</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-emerald-50/72">
              <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-white">Agentie</p>
                <p>{agency?.name || 'Agentie imobiliara'}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-white">Adresa</p>
                <p>{agency?.address || 'Disponibila la cerere in pagina de contact.'}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-white">Telefon</p>
                <p>{agency?.phone || 'Disponibil in pagina de contact.'}</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <p className="font-medium text-white">Email</p>
                <p>{agency?.email || 'Trimite-ne un mesaj prin formularul public.'}</p>
              </div>
            </div>
          </article>
          <article className={`${sectionShellClassName} p-6 md:p-8`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Urmatorul pas
            </div>
            <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Daca nu te-ai decis inca, hai sa discutam ce ti se potriveste.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/72">
              Dupa ce ai parcurs homepage-ul si cateva pagini de detaliu, poti cere direct ajutorul agentiei pentru o
              selectie mai buna si pentru programarea urmatorilor pasi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08]"
              >
                <Link href={`/agencies/${agencyId}/contact`}>Solicita consultanta</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
              >
                <Link href={`/agencies/${agencyId}/about`}>
                  Despre agentie
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
