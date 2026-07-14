import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  CalendarCheck2,
  Layers3,
  LineChart,
  MessageSquareText,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Modul Cumparatori pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Administreaza potentialii cumparatori, scorul AI, preferintele, potrivirile si follow-up-ul intr-un pipeline comercial clar.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "80", label: "cumparatori activi" },
  { value: "AI", label: "prioritate explicata" },
  { value: "Next", label: "urmator pas vizibil" },
];

const buyerSignals = [
  { value: "Buget", label: "filtru comercial imediat" },
  { value: "Zona", label: "intentia devine context" },
  { value: "Scor", label: "lead-uri ordonate inteligent" },
];

const buyerFlow: FeatureItem[] = [
  {
    icon: Search,
    title: "Prioritizezi rapid",
    text: "Bugetul, zona, vechimea si scorul AI scot in fata lead-urile care merita primul apel.",
  },
  {
    icon: MessageSquareText,
    title: "Intelegi intentia",
    text: "Profilul cumparatorului aduna preferintele, istoricul si contextul comercial intr-o vedere clara.",
  },
  {
    icon: Building2,
    title: "Potrivesti proprietati",
    text: "AI-ul recomanda optiuni relevante si explica de ce se potrivesc cu cererea clientului.",
  },
  {
    icon: CalendarCheck2,
    title: "Misti lead-ul inainte",
    text: "Agentul transforma rapid analiza in apel, vizionare sau follow-up cu motiv comercial.",
  },
];

const conversionReasons = [
  "Lead-urile bune ies in fata inainte sa se raceasca.",
  "Agentul suna cu motiv, nu cu presupuneri.",
  "Managementul vede pipeline-ul cumparatorilor fara raportari manuale.",
  "Potrivirile AI transforma portofoliul intr-un argument de vanzare.",
];

const controlCards: FeatureItem[] = [
  {
    icon: Target,
    title: "Scor explicabil",
    text: "Prioritatea nu este un numar izolat: agentul vede buget, zona, intentie si semnale de conversie.",
  },
  {
    icon: Bot,
    title: "Matching in context",
    text: "Proprietatile recomandate vin cu motive comerciale, ca agentul sa poata sustine conversatia.",
  },
  {
    icon: LineChart,
    title: "Pipeline vizibil",
    text: "Echipa vede cine trebuie sunat, ce s-a intamplat si unde se poate castiga urmatoarea vizionare.",
  },
];

function DemoButton({ className = "", label = "Vezi demo live" }: { className?: string; label?: string }) {
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
  className = "",
}: {
  image: string;
  alt: string;
  label: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`lux-screen ai-calls-screen ${className}`}>
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
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 980px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function BuyersLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page buyers-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai">
              <ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" />
            </Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">
                Platforma
              </Link>
              <Link href="/apeluri-ai" className="lux-nav-menu__link">
                Apeluri AI
              </Link>
              <Link href="/proprietati" className="lux-nav-menu__link">
                Proprietati
              </Link>
              <Link href="/cumparatori" className="lux-nav-menu__link lux-nav-menu__link--active">
                Cumparatori
              </Link>
              <Link href="/ai-matching" className="lux-nav-menu__link">
                AI Matching
              </Link>
              <Link href="/vizionari" className="lux-nav-menu__link">
                Vizionari
              </Link>
              <Link href="/contracte" className="lux-nav-menu__link">
                Contracte
              </Link>
              <Link href="/marketing-studio" className="lux-nav-menu__link">
                Marketing Studio
              </Link>
              <Link href="/portaluri-online" className="lux-nav-menu__link">
                Portaluri Online
              </Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                asChild
                variant="ghost"
                className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/login">Autentificare</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"
              >
                <Link href="/register">
                  Creeaza cont
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <DemoButton className="h-9 px-4 text-sm" label="Demo live" />
            </div>
          </div>
        </header>

        <section className="ai-calls-hero buyers-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(650px,1.14fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <Users className="h-4 w-4 text-emerald-300" />
                Modul premium pentru administrarea cumparatorilor
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.45rem]">
                Cumparatorii devin pipeline activ, nu contacte pierdute.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai organizeaza potentialii cumparatori dupa buget, zona, intentie si scor AI, astfel incat
                agentii stiu pe cine suna, cu ce oferta si cu ce urmator pas.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi cumparatorii" />
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
              <div className="ai-calls-hero__metrics">
                {heroMetrics.map((metric) => (
                  <div key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-calls-hero__visual buyers-hero__visual" aria-label="Previzualizare modul Cumparatori">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/buyers.png"
                alt="Lista de cumparatori cu buget, scor AI si filtre"
                label="ImoDeus.ai CRM / Cumparatori"
                priority
                className="ai-calls-screen--hero buyers-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Profil de cumparator cu scor si proprietati potrivite"
                label="Profil cumparator"
                className="buyers-mini-screen"
              />
              <div className="buyers-score-card">
                <span>Scor AI</span>
                <strong>78</strong>
                <p>lead prioritar</p>
              </div>
              <div className="ai-calls-floating ai-calls-floating--top buyers-floating">
                <BadgeCheck className="h-4 w-4" />
                <span>prioritate vizibila</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left buyers-floating">
                <Target className="h-4 w-4" />
                <span>intentii clare</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right buyers-floating">
                <Building2 className="h-4 w-4" />
                <span>potriviri AI</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section buyers-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Pipeline comercial pentru cumparatori
              </div>
              <h2>Fiecare lead are context, prioritate si un motiv clar de follow-up.</h2>
              <p>
                Modulul Cumparatori transforma contactele intr-un sistem de lucru: filtre rapide, scor AI, potriviri
                relevante si actiuni care muta lead-ul spre vizionare.
              </p>
            </div>

            <div className="buyers-signal-grid">
              {buyerSignals.map((signal) => (
                <article key={signal.value} className="buyers-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {buyerFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card buyers-flow-card">
                    <span className="ai-calls-flow-card__number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="ai-calls-flow-card__icon">
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ai-calls-control buyers-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media buyers-control__media">
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Detaliu cumparator cu buget, scor AI si recomandari"
                label="ImoDeus.ai CRM / Profil cumparator"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Bot className="h-4 w-4 text-cyan-300" />
                Context pentru apeluri bune
              </div>
              <h2>Agentul suna cu argument, nu cu intrebari generice.</h2>
              <p>
                Profilul cumparatorului combina bugetul, preferintele, istoricul, scorul AI si proprietatile potrivite,
                ca fiecare discutie sa porneasca dintr-un motiv comercial clar.
              </p>
              <div className="ai-calls-reasons">
                {conversionReasons.map((reason) => (
                  <div key={reason}>
                    <BadgeCheck className="h-4 w-4" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-command buyers-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel buyers-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Layers3 className="h-4 w-4 text-emerald-300" />
                  Matching explicabil
                </div>
                <h2>Portofoliul devine raspunsul potrivit pentru fiecare cumparator.</h2>
                <p>
                  Cand AI-ul propune proprietati si explica potrivirea, agentul poate transforma rapid lista de optiuni
                  intr-o conversatie care duce la vizionare.
                </p>
              </div>
              <div className="buyers-command__media">
                <ScreenFrame
                  image="/landing/screenshots/ai-matching-results.png"
                  alt="Rezultate AI cu proprietati potrivite pentru cumparator"
                  label="ImoDeus.ai CRM / Potrivire AI"
                />
              </div>
              <div className="ai-calls-control-cards buyers-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card buyers-control-card">
                      <CardIcon className="h-5 w-5" />
                      <h3>{card.title}</h3>
                      <p>{card.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-final-cta buyers-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Cumparatori care se transforma in vizionari
              </div>
              <h2>Arata echipei cum fiecare lead poate avea prioritate, context si urmator pas.</h2>
              <p>
                Pagina demo pune in fata agentiei un workflow clar: cumparator, profil, scor AI, potriviri, follow-up
                si vizionare in acelasi workspace.
              </p>
            </div>
            <div className="ai-calls-final-cta__actions">
              <DemoButton className="w-full justify-center" label="Intra in demo" />
              <Button asChild size="lg" variant="outline" className="lux-final-secondary h-14 w-full px-7 text-base font-semibold">
                <Link href="/register">
                  Creeaza cont
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">
              Termeni si conditii
            </Link>
            <Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">
              Politica de confidentialitate
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
