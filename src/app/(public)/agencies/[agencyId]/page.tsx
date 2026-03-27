'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  MapPinned,
  PhoneCall,
  Sparkles,
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

  const buyerServices = [
    {
      badge: 'Consultanta',
      title: 'Strategie de achizitie',
      description:
        'Definim impreuna ce merita urmarit si ce trebuie evitat, in functie de buget, obiectiv si prioritati reale.',
    },
    {
      badge: 'Precalificare',
      title: 'Selectie relevanta',
      description:
        'Reducem zgomotul din piata si aducem in fata ta doar proprietati care au sens.',
    },
    {
      badge: 'Disponibilitate extinsa',
      title: 'Vizionari flexibile',
      description:
        'Organizam vizionari in functie de programul tau, inclusiv seara sau in weekend, pentru ca procesul de cautare sa fie eficient si confortabil.',
    },
    {
      badge: 'Analiza de piata',
      title: 'Analiza de valoare',
      description:
        'Punem fiecare proprietate in contextul ei real de pret, pozitionare si potential.',
    },
    {
      badge: 'Asistenta juridica',
      title: 'Verificare si siguranta',
      description:
        'Identificam din timp aspectele sensibile si contribuim la o decizie mai clara si mai sigura.',
    },
    {
      badge: 'Suntem cu tine',
      title: 'Coordonare completa',
      description:
        'Ordonam intregul proces, de la selectie si negociere pana la finalizarea tranzactiei.',
    },
    {
      badge: 'Tranzitie usoara',
      title: 'Suport post-achizitie',
      description:
        'Ramanem alaturi de tine si dupa semnare, inclusiv cu sprijin in preluarea utilitatilor si in pasii practici necesari pentru transferul proprietatii.',
    },
  ];

  const isLoading = isAgencyContextLoading || arePropertiesLoading;

  if (isLoading) {
    return (
      <>
        <Hero />
        <div className="container mx-auto space-y-8 px-4 py-8 md:space-y-12 md:py-12">
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
        <section className={`${highlightCardClassName} p-5 md:p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Avantaj pentru cumparator</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Cumperi cu sprijin profesionist, fara comision din partea ta
              </h2>
              <p className="mt-3 text-sm leading-7 text-emerald-50/75 md:text-base">
                Consultanta, selectie, vizionari si coordonare, fara comision perceput cumparatorului.
              </p>
            </div>
            <div className="inline-flex w-fit items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-5 py-2 text-sm font-semibold text-emerald-200">
              Zero comision pentru cumparator
            </div>
          </div>
        </section>

        <FeaturedProperties properties={featuredProperties} agencyId={agencyId!} />

        <section className={`${sectionShellClassName} p-6 md:p-8`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Nu te opri aici
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Daca vrei sa vezi mai mult, portofoliul complet e la un click distanta.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-emerald-50/72">
                Pe homepage am pastrat doar o selectie. In pagina de proprietati poti rasfoi mai multe anunturi si le
                poti filtra mai usor dupa ce te intereseaza.
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

        <section className="overflow-visible md:overflow-hidden md:rounded-[2rem] md:border md:border-emerald-400/15 md:bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] md:p-8 md:shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.2),transparent_28%),linear-gradient(135deg,rgba(7,18,12,0.96)_0%,rgba(10,10,12,0.98)_52%,rgba(16,24,18,0.96)_100%)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]">
                <div className="relative overflow-hidden p-6 md:p-7">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(134,239,172,0.16),transparent_48%)]" />
                  <div className="relative space-y-4">
                    <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                      Finantare premium
                    </div>
                    <div className="space-y-2">
                      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        Proprietatea potrivita merita si finantarea potrivita.
                      </h2>
                      <p className="max-w-2xl text-sm leading-7 text-emerald-50/85 md:text-base">
                        Iti oferim acces gratuit la servicii de broker de credite, astfel incat sa compari mai usor
                        variantele bancare, sa intelegi costurile reale si sa alegi o solutie potrivita pentru bugetul
                        tau.
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm text-emerald-100/90 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                        Analiza gratuita a eligibilitatii
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                        Oferte de la cele mai bune banci
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                        Suport complet pana la semnare
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-between">
                      <p className="max-w-xl text-sm text-stone-300">
                        Daca vrei, te punem in legatura cu un partener de incredere care te poate ghida de la
                        preaprobare pana la aprobarea finala.
                      </p>
                      <Button
                        asChild
                        size="lg"
                        className="rounded-full bg-emerald-400 px-7 text-black shadow-[0_18px_44px_-18px_rgba(74,222,128,0.7)] hover:bg-emerald-300"
                      >
                        <Link href={`/agencies/${agencyId}/contact`}>
                          Cere consultanta financiara
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden gap-4 md:grid md:grid-cols-2">
              <div className={`${highlightCardClassName} p-5 sm:col-span-2`}>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Cum te poate ajuta brokerul</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Verifici eligibilitatea
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Compari oferte din banci
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Intelegi costurile reale
                  </span>
                  <span className="rounded-full border border-emerald-400/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                    Mergi mai sigur spre aprobare
                  </span>
                </div>
              </div>
              <div className={`${highlightCardClassName} p-5`}>
                <MapPinned className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-xl font-semibold text-white">Claritate financiara</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-100/72">
                  Afli din timp ce suma poti sustine si ce varianta de finantare are cel mai bun sens pentru tine.
                </p>
              </div>
              <div className={`${highlightCardClassName} p-5`}>
                <PhoneCall className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-xl font-semibold text-white">Sprijin pana la capat</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-100/72">
                  Brokerul te poate ghida de la prima discutie pana la aprobarea finala, cu pasi mai simpli si mai clari.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className={`${sectionShellClassName} p-6 md:p-8`}>
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Servicii pentru cumparatori</p>
              <h2 className="mt-3 whitespace-nowrap text-[clamp(1.35rem,4.5vw,3rem)] font-semibold tracking-tight text-white">
                Ce oferim Cumparatorilor?
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/78 md:text-lg">
                La Nordia, rolul nostru nu este sa te expunem la cat mai multe optiuni, ci sa te conducem catre alegerea
                potrivita. Filtram piata cu atentie, evaluam obiectiv fiecare oportunitate si reducem riscurile pe care
                un cumparator fara experienta nu le poate anticipa. Pentru ca tu sa cumperi nu doar cu incredere, ci si
                cu discernamant.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {buyerServices.map((service) => (
              <article
                key={service.title}
                className={`${highlightCardClassName} p-6 ${
                  service.title === 'Suport post-achizitie' ? 'md:hidden' : ''
                }`}
              >
                <div className="inline-flex items-center rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  {service.badge}
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-emerald-50/72">{service.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <article className={`${highlightCardClassName} p-6 md:p-8`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Urmatorul pas</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Daca ai vazut ceva interesant, hai sa transformam cautarea intr-o alegere buna.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/72">
              Ne spui ce proprietate ti-a atras atentia sau ce cauti mai exact, iar noi te ajutam sa clarifici rapid
              optiunile bune, pasii urmatori si varianta potrivita pentru tine.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-emerald-50/78">
                Discutam concret despre buget, zona si tipul de proprietate care are sens pentru tine.
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-emerald-50/78">
                Iti spunem direct ce merita urmarit, ce poate fi evitat si unde merita sa te opresti mai atent.
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-emerald-50/78">
                Daca vrei, mergem mai departe spre vizionare, finantare sau o selectie suplimentara mai bine tintita.
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
                <Link href={`/agencies/${agencyId}/properties`}>Vezi din nou proprietatile</Link>
              </Button>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
