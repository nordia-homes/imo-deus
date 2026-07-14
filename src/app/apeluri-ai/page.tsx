import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  Clock3,
  Headphones,
  History,
  LineChart,
  MessageSquareText,
  PhoneCall,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Apeluri AI pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Prospecteaza si califica proprietari deschisi la colaborare cu apeluri AI controlate de agentie.",
};

const heroMetrics = [
  { value: "AI", label: "prospectare controlata" },
  { value: "09-18", label: "intervale respectate" },
  { value: "100%", label: "istoric vizibil" },
];

const qualificationSteps = [
  {
    icon: Search,
    title: "Alege proprietarii potriviti",
    text: "Pornesti de la anunturi si oportunitati relevante, nu de la liste reci fara context.",
  },
  {
    icon: Bot,
    title: "AI-ul suna dupa regulile agentiei",
    text: "Comision, interval orar, ton si limite de negociere raman setate dinainte.",
  },
  {
    icon: BadgeCheck,
    title: "Calificare clara",
    text: "Agentul vede rapid cine este deschis, cine trebuie recontactat si unde merita insistat.",
  },
  {
    icon: Users,
    title: "Follow-up uman",
    text: "Echipa intra in conversatie doar cand exista intentie, context si sansa reala de colaborare.",
  },
];

const controlCards = [
  {
    icon: SlidersHorizontal,
    title: "Reguli comerciale",
    text: "Comision dorit, comision minim si ferestre de apel ca automatizarea sa nu iasa din strategia agentiei.",
  },
  {
    icon: MessageSquareText,
    title: "Conversatie cu disciplina",
    text: "AI-ul pastreaza mesajul comercial coerent si evita promisiunile care ar pune agentul in dificultate.",
  },
  {
    icon: History,
    title: "Istoric verificabil",
    text: "Managementul vede ce proprietari au fost contactati, ce status au si unde trebuie reluata discutia.",
  },
];

const conversionReasons = [
  "Reduci timpul pierdut cu proprietari nepotriviti.",
  "Pastrezi standardul de negociere pentru toata echipa.",
  "Transformi prospectarea intr-un proces masurabil, nu intr-o activitate sporadica.",
  "Agentii primesc contexte calificate, nu doar numere de telefon.",
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

export default function AiCallsLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai">
              <ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" />
            </Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">
                Platforma
              </Link>
              <Link href="/apeluri-ai" className="lux-nav-menu__link lux-nav-menu__link--active">
                Apeluri AI
              </Link>
              <Link href="/proprietati" className="lux-nav-menu__link">
                Proprietati
              </Link>
              <Link href="/cumparatori" className="lux-nav-menu__link">
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

        <section className="ai-calls-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(620px,1.1fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <PhoneCall className="h-4 w-4 text-emerald-300" />
                Modul premium pentru prospectare proprietari
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.45rem]">
                Apeluri AI care gasesc proprietarii deschisi la colaborare.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai suna proprietarii dupa regulile agentiei, califica intentia comerciala si lasa agentii
                sa intervina cand conversatia are deja context.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi apelurile AI" />
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

            <div className="ai-calls-hero__visual" aria-label="Previzualizare modul Apeluri AI">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/premium-ai-calls.png"
                alt="Setari si istoric pentru apeluri AI catre proprietari"
                label="ImoDeus.ai CRM / Apeluri AI"
                priority
                className="ai-calls-screen--hero"
              />
              <div className="ai-calls-floating ai-calls-floating--top">
                <ShieldCheck className="h-4 w-4" />
                <span>reguli agentie</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left">
                <Clock3 className="h-4 w-4" />
                <span>09:00 - 18:00</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right">
                <Target className="h-4 w-4" />
                <span>proprietar calificat</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Bot className="h-4 w-4 text-teal-600" />
                Prospectare cu control
              </div>
              <h2>Din lista de proprietari pana la oportunitate calificata.</h2>
              <p>
                Modulul transforma apelurile catre proprietari intr-un proces repetabil: cine suna, cand suna, ce
                se poate negocia si ce ramane de facut dupa fiecare conversatie.
              </p>
            </div>

            <div className="ai-calls-flow-grid">
              {qualificationSteps.map((step, index) => {
                const StepIcon = step.icon;

                return (
                  <article key={step.title} className="ai-calls-flow-card">
                    <span className="ai-calls-flow-card__number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="ai-calls-flow-card__icon">
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ai-calls-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media">
              <ScreenFrame
                image="/landing/screenshots/premium-owner-listings.png"
                alt="Anunturi de la proprietari folosite pentru prospectare"
                label="ImoDeus.ai CRM / Anunturi proprietari"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Building2 className="h-4 w-4 text-cyan-300" />
                Sursa de prospectare
              </div>
              <h2>AI-ul nu suna la intamplare. Porneste din oportunitati reale.</h2>
              <p>
                Anunturile de la proprietari, statusul comercial si informatiile din CRM devin combustibil pentru
                apeluri mai bune. Agentia vede rapid unde exista potential si unde nu merita consumata energia.
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

        <section className="ai-calls-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Headphones className="h-4 w-4 text-emerald-300" />
                  Control room pentru apeluri
                </div>
                <h2>Automatizare cu limite comerciale clare.</h2>
                <p>
                  Agentia decide cadrul. AI-ul executa disciplinat, iar istoricul ramane vizibil pentru echipa si
                  management.
                </p>
              </div>
              <div className="ai-calls-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card">
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

        <section className="ai-calls-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <LineChart className="h-4 w-4 text-emerald-300" />
                Mai multe mandate, mai putin zgomot
              </div>
              <h2>Arata agentiei cum poate prospecta proprietari fara sa piarda controlul comercial.</h2>
              <p>
                Pagina demo pune in fata clientului un flux clar: sursa, apel, calificare, istoric si follow-up.
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
