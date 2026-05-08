'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Camera, ChartColumn, FileSearch, Handshake, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

const ownersIntroVideoUrl =
  'https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/Video%20introducere%20pentru%20proprietari.mp4?alt=media&token=f4163f0e-2265-4d02-b2ef-3f3a70fa2c48';

export default function AgencyOwnersPage() {
  const { agency, agencyId } = usePublicAgency();
  const publicPath = usePublicPath();
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const sectionShellClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[2rem]'
    : 'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';
  const highlightCardClassName = isAgentfinderTheme
    ? 'public-premium-soft-panel rounded-[1.75rem]'
    : 'rounded-[1.75rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(14,18,17,0.96)_0%,rgba(10,13,12,0.98)_100%)] shadow-[0_24px_70px_-42px_rgba(0,0,0,0.72)]';
  const eyebrowClassName = isAgentfinderTheme ? 'text-sky-700/80' : 'text-emerald-300/70';
  const titleClassName = isAgentfinderTheme ? 'text-slate-950' : 'text-white';
  const bodyClassName = isAgentfinderTheme ? 'text-slate-600' : 'text-emerald-50/78';
  const chipClassName = isAgentfinderTheme
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200';
  const primaryButtonClassName = isAgentfinderTheme
    ? 'public-premium-primary-button border-0 shadow-none'
    : 'rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300';
  const outlineButtonClassName = isAgentfinderTheme
    ? 'public-premium-outline-button text-slate-700'
    : 'rounded-full border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08]';
  const infoPillClassName = isAgentfinderTheme
    ? 'rounded-2xl border border-slate-200 bg-white/84 px-4 py-4 text-sm text-slate-600'
    : 'rounded-2xl border border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_34%),linear-gradient(160deg,rgba(8,14,11,0.98)_0%,rgba(9,18,14,0.97)_52%,rgba(8,12,10,0.99)_100%)] px-4 py-4 text-sm text-white md:border-white/10 md:bg-white/[0.04] md:text-emerald-50/80';
  const featureLeadCardClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[1.9rem] md:col-span-2 xl:col-span-2'
    : 'rounded-[1.9rem] border border-emerald-300/25 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_34%),linear-gradient(145deg,rgba(8,20,14,0.98)_0%,rgba(11,14,13,0.98)_55%,rgba(16,28,20,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.88)] md:col-span-2 xl:col-span-2';
  const darkFeatureSectionClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[2rem] p-6 md:p-8'
    : 'rounded-[2rem] border border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_34%),linear-gradient(160deg,rgba(7,12,10,0.98)_0%,rgba(9,18,14,0.97)_52%,rgba(8,12,10,0.99)_100%)] p-6 shadow-[0_26px_74px_-42px_rgba(0,0,0,0.84)] md:p-8';
  const stepCardClassName = isAgentfinderTheme
    ? 'flex gap-4 rounded-[1.5rem] border border-slate-200 bg-white/84 p-4'
    : 'flex gap-4 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 shadow-[0_18px_48px_-38px_rgba(0,0,0,0.7)]';

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
      icon: <BadgeCheck className="h-5 w-5" />,
      badge: 'Relatie',
      title: 'Comunicare clara pe tot parcursul colaborarii',
      description:
        'Ramai conectat la fiecare pas important, stii ce urmeaza si primesti feedback clar, astfel incat procesul sa nu para niciodata opac sau greu de urmarit.',
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
            <div className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium", chipClassName)}>
              <Sparkles className="h-4 w-4" />
              Pentru proprietari
            </div>
            <h1 className={cn("mt-5 max-w-3xl text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.12] tracking-tight", titleClassName)}>
              Servicii dedicate proprietarilor care vor mai multa claritate si mai putin stres.
            </h1>
            <p className={cn("mt-4 max-w-2xl text-base leading-7 md:text-lg", bodyClassName)}>
              Daca vrei sa vinzi sau sa inchiriezi, {agency?.name || 'echipa noastra'} te ajuta sa stabilesti corect pretul,
              sa iti promovezi proprietatea relevant si sa mergi mai sigur spre clientul potrivit si spre tranzactie.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className={cn("rounded-full px-7", primaryButtonClassName)}>
                <Link href={publicPath('/contact')}>
                  Discutam despre proprietatea ta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className={cn("hidden rounded-full px-7 sm:inline-flex", outlineButtonClassName)}>
                <Link href={publicPath('/properties')}>Vezi proprietatile active</Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className={infoPillClassName}>
                Pret stabilit in functie de piata, nu din presupuneri.
              </div>
              <div className={infoPillClassName}>
                Promovare care atrage interes relevant, nu doar trafic.
              </div>
              <div className={infoPillClassName}>
                Comunicare clara si pasii importanti explicati din timp.
              </div>
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

      <div className="container mx-auto space-y-8 px-4 pb-5 pt-8 md:space-y-14 md:pb-8 md:pt-12">
      <section className="space-y-8">
        <div className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="max-w-4xl">
            <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>Ce oferim proprietarilor</p>
            <h2 className={cn("mt-3 text-[clamp(1.7rem,4vw,3.2rem)] font-semibold tracking-tight", titleClassName)}>
              Servicii gandite pentru rezultate, nu doar pentru prezenta in piata.
            </h2>
            <p className={cn("mt-4 max-w-3xl text-base leading-7 md:text-lg", bodyClassName)}>
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
                  ? featureLeadCardClassName
                  : highlightCardClassName
              }`}
            >
              <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", chipClassName)}>
                {service.icon}
                {service.badge}
              </div>
              <h3 className={cn(`mt-4 font-semibold tracking-tight ${index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii' ? 'text-3xl md:max-w-xl' : 'text-2xl'}`, titleClassName)}>
                {service.title}
              </h3>
              <p className={cn(`mt-3 leading-7 ${index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii' ? 'max-w-2xl text-base' : 'text-sm'}`, isAgentfinderTheme ? 'text-slate-600' : index === 0 || service.title === 'Comunicare clara pe tot parcursul colaborarii' ? 'text-emerald-50/82' : 'text-emerald-50/72')}>
                {service.description}
              </p>
            </article>
          ))}
        </div>

        <article className={darkFeatureSectionClassName}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>De ce proprietarii lucreaza cu noi</p>
              <h3 className={cn("mt-3 text-3xl font-semibold tracking-tight", titleClassName)}>
                Nu ne limitam la publicarea unui anunt.
              </h3>
              <p className={cn("mt-3 text-base leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/76")}>
                Construim un proces complet: pozitionare, prezentare, selectie de clienti, negociere si coordonare pana la semnare.
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className={cn("rounded-full px-7", primaryButtonClassName)}
            >
              <Link href={publicPath('/contact')}>
                Cere o evaluare initiala
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </article>

        <article className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="max-w-3xl">
            <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>Intrebari frecvente ale proprietarilor</p>
            <h3 className={cn("mt-3 text-3xl font-semibold tracking-tight", titleClassName)}>
              Cele mai importante lucruri se clarifica de la inceput.
            </h3>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <article className={`${highlightCardClassName} p-5`}>
              <h4 className={cn("text-lg font-semibold", titleClassName)}>Cum stabilim pretul?</h4>
              <p className={cn("mt-3 text-sm leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/72")}>
                Ne uitam la proprietate, la concurenta si la ritmul real al pietei, nu doar la preturile cerute in jur.
              </p>
            </article>
            <article className={`${highlightCardClassName} p-5`}>
              <h4 className={cn("text-lg font-semibold", titleClassName)}>Cum filtram interesul?</h4>
              <p className={cn("mt-3 text-sm leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/72")}>
                Calificam discutiile si programam doar interactiuni care au sens, astfel incat sa nu iti consumi timpul inutil.
              </p>
            </article>
            <article className={`${highlightCardClassName} p-5`}>
              <h4 className={cn("text-lg font-semibold", titleClassName)}>Cum arata colaborarea?</h4>
              <p className={cn("mt-3 text-sm leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/72")}>
                Clar, ordonat si cu pasi explicati din timp, de la promovare si vizionari pana la negociere si inchiderea tranzactiei.
              </p>
            </article>
          </div>
        </article>
      </section>

      <section className={darkFeatureSectionClassName}>
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>Cum lucram</p>
            <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight md:text-4xl", titleClassName)}>
              Un proces clar pentru proprietari care vor sa stie ce urmeaza.
            </h2>
            <p className={cn("mt-4 max-w-xl text-base leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/76")}>
              Comunicarea buna si organizarea conteaza la fel de mult ca promovarea. De aceea, iti explicam de la inceput cum arata drumul pana la tranzactie.
            </p>
          </div>

          <div className="grid gap-3">
            {ownerSteps.map((step, index) => (
              <article key={step} className={stepCardClassName}>
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold", isAgentfinderTheme ? "border-sky-200 bg-sky-50 text-sky-700" : "border-emerald-300/18 bg-emerald-400/10 text-emerald-200")}>
                  0{index + 1}
                </div>
                <p className={cn("text-sm leading-7", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/78")}>{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pt-4 md:pt-6">
        <article className={darkFeatureSectionClassName}>
          <div className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", chipClassName)}>
            <Sparkles className="h-4 w-4" />
            Pentru proprietari
          </div>
          <h2 className={cn("mt-5 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl", titleClassName)}>
            Daca vrei sa discutam despre proprietatea ta, putem incepe simplu.
          </h2>
          <p className={cn("mt-4 max-w-2xl text-base leading-7 md:text-lg", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/80")}>
            Spune-ne ce tip de proprietate ai, ce obiectiv urmaresti si in ce orizont de timp vrei sa te misti. De acolo construim pasii potriviti.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className={infoPillClassName}>
              Stabilim daca discutam despre vanzare, inchiriere sau repozitionare in piata.
            </div>
            <div className={infoPillClassName}>
              Iti spunem ce putem face concret pentru proprietatea ta si cum ar arata colaborarea.
            </div>
            <div className={infoPillClassName}>
              Intri rapid intr-o discutie clara, fara pasi inutili si fara promisiuni vagi.
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className={cn("rounded-full px-7", primaryButtonClassName)}
            >
              <Link href={publicPath('/contact')}>
                Stabilim urmatorii pasi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className={cn("rounded-full px-7", outlineButtonClassName)}
            >
              <Link href={publicPath()}>Inapoi la prima pagina</Link>
            </Button>
          </div>
        </article>
      </section>
      </div>
    </>
  );
}
