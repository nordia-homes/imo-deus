import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  FileText,
  Globe2,
  Layers3,
  LineChart,
  MapPinned,
  MessageSquareText,
  Play,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

type ProductScreen = {
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  stat: string;
  statLabel: string;
};

type Capability = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroStats = [
  { value: "1 workspace", label: "pentru intreaga agentie" },
  { value: "AI live", label: "matching, scoring, briefing" },
  { value: "Go live", label: "website si publicare conectate" },
];

const proofSignals = [
  {
    icon: Layers3,
    value: "1 flux",
    label: "lead, proprietate, vizionare, contract",
  },
  {
    icon: Sparkles,
    value: "AI in context",
    label: "scor, matching si briefing comercial",
  },
  {
    icon: Globe2,
    value: "Go live",
    label: "website public si distributie conectate",
  },
];

const flowSteps = [
  { icon: Search, title: "Lead captat", text: "intentia intra direct in pipeline" },
  { icon: Sparkles, title: "Scor AI", text: "prioritatea devine vizibila" },
  { icon: Building2, title: "Potrivire", text: "proprietati alese cu motiv" },
  { icon: CalendarCheck2, title: "Vizionare", text: "echipa merge pe urmatorul pas" },
  { icon: FileText, title: "Contract", text: "documentele raman in context" },
  { icon: Globe2, title: "Publicare", text: "promovarea pleaca din CRM" },
];

const capabilities: Capability[] = [
  {
    icon: Search,
    title: "Lead-uri prioritizate",
    text: "Buget, zona, intentie si scor AI intr-o vedere usor de actionat.",
  },
  {
    icon: Building2,
    title: "Proprietati ca centre de operare",
    text: "Media, proprietar, agent, vizionari si distributie in acelasi context.",
  },
  {
    icon: Bot,
    title: "AI in fluxul de vanzare",
    text: "Matching, recomandari si continut generate exact unde se ia decizia.",
  },
  {
    icon: LineChart,
    title: "Claritate pentru management",
    text: "Rapoarte si KPI-uri care arata ce misca agentia inainte.",
  },
];

const productScreens: ProductScreen[] = [
  {
    eyebrow: "Control room",
    title: "Dashboard-ul iti arata pulsul agentiei, nu doar cifre frumoase.",
    text: "Comisioane, cumparatori activi, vizionari, conversii si actiuni rapide intr-un singur ecran care se simte ca un centru de comanda.",
    image: "/landing/screenshots/dashboard.png",
    alt: "Dashboard ImoDeus cu KPI-uri, grafice si actiuni rapide",
    icon: BarChart3,
    stat: "Live",
    statLabel: "agentie demo",
  },
  {
    eyebrow: "Lead intelligence",
    title: "Fiecare cumparator vine cu context, scor si urmatorul pas.",
    text: "Profilul, bugetul, potrivirile si explicatia AI stau impreuna, ca agentul sa sune cu un motiv clar, nu cu o presupunere.",
    image: "/landing/screenshots/lead-matching-detail.png",
    alt: "Detaliu lead cu scor AI si proprietati recomandate",
    icon: Users,
    stat: "AI",
    statLabel: "matching explicat",
  },
  {
    eyebrow: "Property hub",
    title: "Fisa proprietatii devine locul unde se castiga viteza.",
    text: "Galerie, pret, agent dedicat, proprietar, vizionari si promovare sunt legate de aceeasi proprietate, fara context switching.",
    image: "/landing/screenshots/property-detail-overview.png",
    alt: "Fisa unei proprietati cu galerie si panou de actiuni",
    icon: Building2,
    stat: "360",
    statLabel: "vedere completa",
  },
  {
    eyebrow: "Distribution",
    title: "Publicarea si promovarea pleaca din acelasi sistem.",
    text: "Website public, harta, portaluri si promovare sociala sunt conectate la datele operationale ale agentiei.",
    image: "/landing/screenshots/map-publishing.png",
    alt: "Publicare proprietate in portaluri si promovare cu harta",
    icon: Globe2,
    stat: "Go live",
    statLabel: "din CRM",
  },
];

const moduleScreens = [
  {
    eyebrow: "Portofoliu",
    title: "Lista de proprietati",
    image: "/landing/screenshots/properties-list.png",
    alt: "Portofoliu proprietati afisat in carduri cu imagini si pret",
    icon: Layers3,
  },
  {
    eyebrow: "Cumparatori",
    title: "Pipeline activ",
    image: "/landing/screenshots/buyers.png",
    alt: "Lista de cumparatori cu buget, scor AI si filtre",
    icon: Users,
  },
  {
    eyebrow: "AI assistant",
    title: "Asistent contextual",
    image: "/landing/screenshots/ai-assistant.png",
    alt: "Asistent AI cu sugestii si input de chat",
    icon: MessageSquareText,
  },
  {
    eyebrow: "Matching",
    title: "Rezultate explicabile",
    image: "/landing/screenshots/ai-matching-results.png",
    alt: "Rezultate de potrivire AI intre cumparator si proprietati",
    icon: Sparkles,
  },
  {
    eyebrow: "Agenda",
    title: "Task-uri si follow-up",
    image: "/landing/screenshots/tasks.png",
    alt: "Pagina de task-uri cu KPI-uri si moduri de vizualizare",
    icon: CalendarCheck2,
  },
  {
    eyebrow: "Documente",
    title: "Contracte si template-uri",
    image: "/landing/screenshots/contracts.png",
    alt: "Modul de contracte si template-uri",
    icon: ClipboardCheck,
  },
  {
    eyebrow: "Echipa",
    title: "Agenti si roluri",
    image: "/landing/screenshots/agents.png",
    alt: "Pagina cu echipa agentiei si carduri pentru agenti",
    icon: Crown,
  },
  {
    eyebrow: "Website public",
    title: "Domeniu custom",
    image: "/landing/screenshots/custom-domain.png",
    alt: "Configurare domeniu custom pentru website-ul agentiei",
    icon: RadioTower,
  },
];

function DemoButton({
  className = "",
  label = "Intra in demo live",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button asChild size="lg" className={`lux-primary-button h-14 px-6 text-base font-semibold ${className}`}>
      <Link href="/demo">
        <Play className="h-4 w-4 fill-current" />
        {label}
      </Link>
    </Button>
  );
}

function ScreenFrame({
  image,
  alt,
  label,
  priority = false,
  direct = false,
  className = "",
}: {
  image: string;
  alt: string;
  label: string;
  priority?: boolean;
  direct?: boolean;
  className?: string;
}) {
  const eager = priority || image.endsWith("/dashboard.png");

  return (
    <div className={`lux-screen ${className}`}>
      <div className="lux-screen__bar">
        <div className="flex items-center gap-1.5">
          <span className="lux-dot bg-[#fb7185]" />
          <span className="lux-dot bg-[#fbbf24]" />
          <span className="lux-dot bg-[#34d399]" />
        </div>
        <span>{label}</span>
      </div>
      <div className="lux-screen__viewport">
        <Image
          src={image}
          alt={alt}
          width={1900}
          height={912}
          priority={priority}
          unoptimized={direct}
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 980px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <main className="lux-shell min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <ImoDeusTextLogo className="w-[9.5rem] brightness-0 invert sm:w-[12rem]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                asChild
                variant="ghost"
                className="hidden h-11 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/login">Autentificare</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="hidden h-11 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"
              >
                <Link href="/register">
                  Creeaza cont
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <DemoButton className="h-11 px-4 text-sm" label="Demo live" />
            </div>
          </div>
        </header>

        <section className="lux-hero">
          <div className="lux-hero__grid" />
          <div className="lux-hero-inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(640px,1.18fr)] lg:items-center lg:px-8 lg:pb-24 lg:pt-16">
            <div className="lux-hero-copy relative z-10 max-w-3xl">
              <div className="lux-pill">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                Platforma AI pentru agentii imobiliare care vor sa conduca piata
              </div>
              <h1 className="lux-hero-title mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.45rem] xl:text-[5rem]">
                Agentia ta, orchestrata intr-un singur sistem premium.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai aduce lead-uri, proprietati, AI, task-uri, rapoarte si publicare intr-un workspace
                care arata si se simte ca un produs de top.
              </p>

              <div className="lux-hero-actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Deschide demo-ul" />
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-16 w-full rounded-full border-white/[0.15] bg-white/[0.08] px-8 text-base font-semibold text-white hover:bg-white/[0.14] hover:text-white sm:w-auto"
                >
                  <Link href="/register">
                    Creeaza cont
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="lux-hero-stats mt-9 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="lux-hero-stat">
                    <p>{stat.value}</p>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lux-hero-stage">
              <ScreenFrame
                image="/landing/screenshots/dashboard.png"
                alt="Dashboard ImoDeus cu KPI-uri, grafice si actiuni rapide"
                label="ImoDeus.ai CRM / Dashboard"
                priority
                className="lux-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Detaliu lead cu scor AI si proprietati recomandate"
                label="Lead intelligence"
                priority
                direct
                className="lux-screen--float lux-screen--float-left"
              />
              <ScreenFrame
                image="/landing/screenshots/property-detail-overview.png"
                alt="Fisa unei proprietati cu galerie si panou de actiuni"
                label="Property hub"
                priority
                className="lux-screen--float lux-screen--float-right"
              />
              <div className="lux-orbit-card">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <div>
                  <p>Demo sigur</p>
                  <span>Date separate, produs complet.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lux-proof">
          <div className="mx-auto grid w-full max-w-[1500px] gap-3 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:px-8">
            {proofSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.value} className="lux-proof-item">
                  <Icon className="h-5 w-5" />
                  <div>
                    <strong>{signal.value}</strong>
                    <span>{signal.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lux-light-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(540px,1.14fr)] lg:items-end">
              <div>
                <div className="lux-light-pill">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Pozitionare de lider
                </div>
                <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                  Nu doar CRM. Un layer premium pentru vanzare, management si AI.
                </h2>
              </div>
              <p className="text-lg leading-8 text-slate-600">
                Tot ce conteaza pentru o agentie imobiliara moderna este legat intr-un flux coerent:
                oportunitati, portofoliu, echipa, documente, publicare si raportare.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="lux-capability">
                    <div className="lux-capability__icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="lux-flow-map mt-8">
              {flowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="lux-flow-step">
                    <span>
                      <Icon className="h-4 w-4" />
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lux-showcase">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <div className="lux-pill lux-pill--muted">
                <MapPinned className="h-4 w-4 text-cyan-300" />
                Produsul in miscare
              </div>
              <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-white sm:text-5xl">
                Fiecare ecran spune o poveste de control, viteza si incredere.
              </h2>
            </div>

            <div className="mt-12 space-y-10">
              {productScreens.map((screen, index) => {
                const Icon = screen.icon;
                return (
                  <article key={screen.title} className={`lux-feature ${index % 2 ? "lux-feature--reverse" : ""}`}>
                    <span className="lux-feature__index">0{index + 1}</span>
                    <div className="lux-feature__copy">
                      <div className="lux-pill lux-pill--mini">
                        <Icon className="h-4 w-4" />
                        {screen.eyebrow}
                      </div>
                      <h3>{screen.title}</h3>
                      <p>{screen.text}</p>
                      <div className="lux-feature__stat">
                        <strong>{screen.stat}</strong>
                        <span>{screen.statLabel}</span>
                      </div>
                    </div>
                    <ScreenFrame image={screen.image} alt={screen.alt} label={`ImoDeus.ai CRM / ${screen.eyebrow}`} />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lux-module-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(520px,1fr)] lg:items-end">
              <div>
                <div className="lux-pill lux-pill--muted">
                  <Layers3 className="h-4 w-4 text-emerald-300" />
                  Suita completa
                </div>
                <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-white sm:text-5xl">
                  O platforma care pare construita pentru agentii mari din prima zi.
                </h2>
              </div>
              <p className="text-lg leading-8 text-slate-300">
                Modulele sunt prezentate ca un produs matur: vizual, dens, scanabil si gata de folosit.
              </p>
            </div>

            <div className="lux-module-grid mt-10">
              {moduleScreens.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.title} className="lux-module">
                    <div className="lux-module__top">
                      <div>
                        <span>{module.eyebrow}</span>
                        <h3>{module.title}</h3>
                      </div>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ScreenFrame image={module.image} alt={module.alt} label={module.eyebrow} className="lux-screen--module" />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lux-final">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.48fr)] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="lux-light-pill">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Demo first
              </div>
              <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                Cel mai bun argument este produsul deschis in fata clientului.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                Intra intr-o agentie demo si vezi cum arata o zi de lucru cand CRM-ul, AI-ul si website-ul public
                sunt conectate in acelasi sistem.
              </p>
            </div>
            <div className="lux-final-card">
              <p>Experienta completa</p>
              <h3>CRM, AI, website public si operatiuni intr-un singur loc.</h3>
              <div className="lux-final-checks">
                {["Demo separat de date reale", "Toate modulele conectate", "Flux clar pentru decizie"].map((item) => (
                  <div key={item} className="lux-final-check">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <DemoButton className="mt-6 w-full justify-center" label="Intra in demo acum" />
              <Button
                asChild
                size="lg"
                variant="outline"
                className="mt-3 h-14 w-full rounded-full border-slate-200 bg-white px-7 text-base font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Link href="/register">
                  Creeaza cont
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/termeni-si-conditii" className="font-medium text-slate-700 transition-colors hover:text-sky-700">
              Termeni si conditii
            </Link>
            <Link href="/confidentialitate" className="font-medium text-slate-700 transition-colors hover:text-sky-700">
              Politica de confidentialitate
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
