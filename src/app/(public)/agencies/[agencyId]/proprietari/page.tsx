'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Camera, ChartColumn, FileSearch, Handshake, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicAgency } from '@/context/PublicAgencyContext';

const sectionShellClassName =
  'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';

const highlightCardClassName =
  'rounded-[1.75rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(14,18,17,0.96)_0%,rgba(10,13,12,0.98)_100%)] shadow-[0_24px_70px_-42px_rgba(0,0,0,0.72)]';

const ownersIntroVideoUrl =
  'https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/Video%20introducere%20pentru%20proprietari.mp4?alt=media&token=f4163f0e-2265-4d02-b2ef-3f3a70fa2c48';

export default function AgencyOwnersPage() {
  const { agency, agencyId } = usePublicAgency();

  const ownerServices = [
    {
      icon: <ChartColumn className="h-5 w-5" />,
      badge: 'Strategie',
      title: 'Pozitionare corecta in piata',
      description:
        'Analizam proprietatea, concurenta si ritmul pietei, astfel incat pretul de pornire sa fie competitiv si credibil.',
    },
    {
      icon: <Camera className="h-5 w-5" />,
      badge: 'Prezentare',
      title: 'Promovare care pune proprietatea in valoare',
      description:
        'Construim prezentari clare, cu fotografii bune, text relevant si un anunt care atrage exact tipul potrivit de interes.',
    },
    {
      icon: <BadgeCheck className="h-5 w-5" />,
      badge: 'Calificare',
      title: 'Selectam clientii cu potential real',
      description:
        'Nu iti ocupam timpul cu discutii fara directie. Filtram interesul si programam doar interactiuni care au sens.',
    },
    {
      icon: <Handshake className="h-5 w-5" />,
      badge: 'Negociere',
      title: 'Te reprezentam in fiecare discutie importanta',
      description:
        'Gestionam ofertele, argumentam corect valoarea proprietatii si pastram controlul asupra negocierii.',
    },
    {
      icon: <FileSearch className="h-5 w-5" />,
      badge: 'Organizare',
      title: 'Coordonare pana la semnare',
      description:
        'Punem in ordine pasii importanti, documentele si comunicarea dintre parti, astfel incat procesul sa fie mai simplu.',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      badge: 'Siguranta',
      title: 'Mai putin stres, mai multa claritate',
      description:
        'Iti spunem din timp ce conteaza, ce riscuri trebuie evitate si unde merita sa fii atent in tranzactie.',
    },
    {
      icon: <BadgeCheck className="h-5 w-5" />,
      badge: 'Relatie',
      title: 'Comunicare clara pe tot parcursul colaborarii',
      description:
        'Ramai conectat la fiecare pas important, stii ce urmeaza si primesti feedback clar, astfel incat procesul sa nu para niciodata opac sau greu de urmarit.',
    },
  ];

  const ownerSteps = [
    'Stabilim impreuna obiectivul, pretul si ritmul potrivit de promovare.',
    'Pregatim proprietatea pentru listare si construim prezentarea publica.',
    'Filtram interesul, organizam vizionari si gestionam discutiile importante.',
    'Mergem mai departe spre negociere, documente si inchiderea tranzactiei.',
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-black lg:hidden">
        <div className="relative mx-auto w-full max-w-[1600px] overflow-hidden">
          <video
            className="h-auto w-full object-contain"
            src={ownersIntroVideoUrl}
            autoPlay
            muted={false}
            loop
            playsInline
            controls
          />
        </div>
      </section>

      <section className={`${sectionShellClassName} overflow-hidden rounded-t-none border-t-0 p-6 md:rounded-t-[2rem] md:border-t md:p-8`}>
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Pentru proprietari
            </div>
            <h1 className="mt-5 max-w-3xl text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.12] tracking-tight text-white">
              Servicii dedicate proprietarilor care vor mai multa claritate si mai putin stres.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/78 md:text-lg">
              Daca vrei sa vinzi sau sa inchiriezi cu o strategie coerenta, {agency?.name || 'echipa noastra'} te poate ajuta
              sa iti pozitionezi corect proprietatea, sa atragi interes relevant si sa mergi mai sigur spre tranzactie.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300">
                <Link href={`/agencies/${agencyId}/contact`}>
                  Discuta cu un consultant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08]">
                <Link href={`/agencies/${agencyId}/properties`}>Vezi proprietatile active</Link>
              </Button>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[1.9rem] border border-emerald-300/18 bg-black shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)] lg:block">
            <video
              className="max-h-[560px] w-full object-contain"
              src={ownersIntroVideoUrl}
              autoPlay
              muted={false}
              loop
              playsInline
              controls
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-8 px-4 pb-5 pt-8 md:space-y-12 md:pb-8 md:pt-12">
      <section className="space-y-8">
        <div className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Ce oferim proprietarilor</p>
            <h2 className="mt-3 text-[clamp(1.7rem,4vw,3.2rem)] font-semibold tracking-tight text-white">
              Servicii gandite pentru rezultate, nu doar pentru prezenta in piata.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/78 md:text-lg">
              Fiecare proprietate are un context diferit. De aceea, modul in care o prezentam, o promovam si o negociem trebuie adaptat, nu tratat generic.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ownerServices.map((service, index) => (
            <article
              key={service.title}
              className={`p-6 ${
                index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii'
                  ? 'rounded-[1.9rem] border border-emerald-300/25 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_34%),linear-gradient(145deg,rgba(8,20,14,0.98)_0%,rgba(11,14,13,0.98)_55%,rgba(16,28,20,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.88)] md:col-span-2 xl:col-span-2'
                  : highlightCardClassName
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                {service.icon}
                {service.badge}
              </div>
              <h3 className={`mt-4 font-semibold tracking-tight text-white ${index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii' ? 'text-3xl md:max-w-xl' : 'text-2xl'}`}>
                {service.title}
              </h3>
              <p className={`mt-3 leading-7 ${index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii' ? 'max-w-2xl text-base text-emerald-50/82' : 'text-sm text-emerald-50/72'}`}>
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${sectionShellClassName} p-6 md:p-8`}>
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Cum lucram</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Un proces clar pentru proprietari care vor sa stie ce urmeaza.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-emerald-50/76">
              Comunicarea buna si organizarea conteaza la fel de mult ca promovarea. De aceea, iti explicam de la inceput cum arata drumul pana la tranzactie.
            </p>
          </div>

          <div className="grid gap-3">
            {ownerSteps.map((step, index) => (
              <article key={step} className={`${highlightCardClassName} flex gap-4 p-4`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
                  0{index + 1}
                </div>
                <p className="text-sm leading-7 text-emerald-50/78">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pt-2 md:pt-4">
        <article className="rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.16),transparent_30%),linear-gradient(145deg,rgba(10,18,14,0.98)_0%,rgba(8,10,10,0.99)_52%,rgba(12,22,16,0.98)_100%)] p-6 shadow-[0_34px_100px_-42px_rgba(0,0,0,0.92)] md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/12 px-4 py-1.5 text-sm font-semibold text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Sparkles className="h-4 w-4" />
            Pentru proprietari
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Daca vrei sa discutam despre proprietatea ta, putem incepe simplu.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/80 md:text-lg">
            Spune-ne ce tip de proprietate ai, ce obiectiv urmaresti si in ce orizont de timp vrei sa te misti. De acolo construim pasii potriviti.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-emerald-50/80">
              Stabilim daca discutam despre vanzare, inchiriere sau repozitionare in piata.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-emerald-50/80">
              Iti spunem ce putem face concret pentru proprietatea ta si cum ar arata colaborarea.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-emerald-50/80">
              Intri rapid intr-o discutie clara, fara pasi inutili si fara promisiuni vagi.
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
            >
              <Link href={`/agencies/${agencyId}/contact`}>
                Programeaza o discutie
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08]"
            >
              <Link href={`/agencies/${agencyId}`}>Inapoi la prima pagina</Link>
            </Button>
          </div>
        </article>
      </section>
      </div>
    </>
  );
}
