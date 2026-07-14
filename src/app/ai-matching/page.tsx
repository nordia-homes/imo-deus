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
  title: "AI Matching pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Potriveste potentialii cumparatori cu proprietatile relevante prin scor AI, explicatii comerciale si urmatorul pas clar pentru agent.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "100", label: "scor de potrivire" },
  { value: "AI", label: "motiv comercial" },
  { value: "Next", label: "urmator pas clar" },
];

const matchingSignals = [
  { value: "Buget", label: "compatibilitate financiara" },
  { value: "Zona", label: "preferinte reale" },
  { value: "Timing", label: "intentia devine actiune" },
];

const matchingFlow: FeatureItem[] = [
  {
    icon: Users,
    title: "Citeste intentia",
    text: "Bugetul, zona, camerele, istoricul si preferintele devin un profil comercial usor de actionat.",
  },
  {
    icon: Building2,
    title: "Scaneaza portofoliul",
    text: "AI-ul compara cererea cu proprietatile active si scoate in fata variantele cu sanse reale.",
  },
  {
    icon: Sparkles,
    title: "Explica potrivirea",
    text: "Agentul vede motivul: ce se potriveste, unde exista compromisuri si ce merita prezentat.",
  },
  {
    icon: CalendarCheck2,
    title: "Trimite spre vizionare",
    text: "O recomandare buna devine apel, WhatsApp, oferta sau vizionare fara cautari manuale.",
  },
];

const conversionReasons = [
  "Cumparatorul primeste recomandari relevante cat intentia este inca activa.",
  "Agentul prezinta proprietatile cu argument, nu cu o lista rece.",
  "Portofoliul existent este valorificat mai bine, inclusiv proprietatile usor trecute cu vederea.",
  "Managementul vede ce potriviri pot produce conversatii si vizionari.",
];

const controlCards: FeatureItem[] = [
  {
    icon: Target,
    title: "Scor transparent",
    text: "Fiecare rezultat arata un scor si motivul din spate, astfel incat agentul intelege rapid de ce merita propus.",
  },
  {
    icon: MessageSquareText,
    title: "Conversatie pregatita",
    text: "Potrivirea vine cu context comercial, iar agentul poate suna cu o recomandare concreta si credibila.",
  },
  {
    icon: LineChart,
    title: "Prioritate vizibila",
    text: "Echipa vede unde exista sanse de vizionare si care cumparatori trebuie mutati imediat in urmatorul pas.",
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

export default function AiMatchingLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page matching-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/cumparatori" className="lux-nav-menu__link">
                Cumparatori
              </Link>
              <Link href="/ai-matching" className="lux-nav-menu__link lux-nav-menu__link--active">
                AI Matching
              </Link>
              <Link href="/vizionari" className="lux-nav-menu__link">
                Vizionari
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

        <section className="ai-calls-hero matching-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(650px,1.16fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                Modul premium pentru potriviri explicabile
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.35rem]">
                Proprietatea potrivita apare exact cand cumparatorul e pregatit.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai citeste intentia cumparatorului si scaneaza portofoliul agentiei, apoi propune proprietati
                cu scor, motiv si urmator pas clar pentru agent.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi AI Matching" />
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

            <div className="ai-calls-hero__visual matching-hero__visual" aria-label="Previzualizare modul AI Matching">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/ai-matching-results.png"
                alt="Rezultate AI Matching cu proprietati potrivite pentru cumparator"
                label="ImoDeus.ai CRM / Potrivire AI"
                priority
                className="ai-calls-screen--hero matching-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Profil de cumparator cu scor si proprietati recomandate"
                label="Profil cumparator"
                className="matching-mini-screen"
              />
              <div className="matching-score-card">
                <span>Potrivire</span>
                <strong>100</strong>
                <p>argument explicat</p>
              </div>
              <div className="ai-calls-floating ai-calls-floating--top matching-floating">
                <BadgeCheck className="h-4 w-4" />
                <span>scor verificabil</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left matching-floating">
                <Target className="h-4 w-4" />
                <span>shortlist rapid</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right matching-floating">
                <MessageSquareText className="h-4 w-4" />
                <span>motiv de apel</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section matching-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Bot className="h-4 w-4 text-teal-600" />
                Matching comercial, nu cautare manuala
              </div>
              <h2>AI-ul transforma portofoliul intr-o selectie clara pentru fiecare cumparator.</h2>
              <p>
                In loc ca agentul sa caute printre proprietati, sistemul le compara cu intentia clientului si livreaza
                recomandari care pot fi prezentate imediat.
              </p>
            </div>

            <div className="matching-signal-grid">
              {matchingSignals.map((signal) => (
                <article key={signal.value} className="matching-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {matchingFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card matching-flow-card">
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

        <section className="ai-calls-control matching-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.65fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media matching-control__media">
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Profil cumparator cu buget, scor AI si optiuni recomandate"
                label="ImoDeus.ai CRM / Profil cumparator"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Users className="h-4 w-4 text-cyan-300" />
                De la intentie la recomandare
              </div>
              <h2>Fiecare cumparator primeste o lista scurta cu motiv, scor si context.</h2>
              <p>
                Profilul cumparatorului devine briefing-ul agentului: AI-ul citeste bugetul, preferintele si istoricul,
                apoi arata de ce anumite proprietati merita prezentate primele.
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

        <section className="ai-calls-command matching-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel matching-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Layers3 className="h-4 w-4 text-emerald-300" />
                  Rezultate explicabile
                </div>
                <h2>Agentul nu trimite proprietati la intamplare. Trimite argumente.</h2>
                <p>
                  Fiecare rezultat AI Matching poate fi transformat intr-un mesaj, un apel sau o invitatie la vizionare
                  pentru ca motivul potrivirii este deja vizibil.
                </p>
              </div>
              <div className="matching-command__media">
                <ScreenFrame
                  image="/landing/screenshots/ai-matching-results.png"
                  alt="Lista de rezultate AI Matching cu proprietati recomandate"
                  label="ImoDeus.ai CRM / Rezultate AI"
                />
              </div>
              <div className="ai-calls-control-cards matching-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card matching-control-card">
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

        <section className="ai-calls-final-cta matching-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Mai multe vizionari din aceeasi baza de cumparatori
              </div>
              <h2>Arata agentiei cum AI Matching transforma datele existente in oportunitati reale.</h2>
              <p>
                Demo-ul pune in fata echipei un workflow complet: profil cumparator, scor, proprietati recomandate,
                explicatie comerciala si urmator pas.
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
