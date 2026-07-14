import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  Clock3,
  ClipboardCheck,
  Headphones,
  History,
  Layers3,
  LineChart,
  MessageSquareText,
  PhoneCall,
  Play,
  RadioTower,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Apeluri AI pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Prospecteaza proprietari cu apeluri AI controlate de agentie, calificare comerciala, istoric complet si handoff rapid catre agenti.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type SignalItem = {
  value: string;
  label: string;
};

const heroMetrics: SignalItem[] = [
  { value: "Control", label: "comision, interval, ton si limite" },
  { value: "Calificare", label: "intentia proprietarului devine clara" },
  { value: "Handoff", label: "agentul suna cand exista oportunitate" },
];

const heroFlow = [
  { label: "Sursa", value: "anunt proprietar" },
  { label: "AI", value: "apel cu reguli" },
  { label: "Intentie", value: "deschis / rece / revenire" },
  { label: "Agent", value: "follow-up uman" },
];

const operatingSignals: SignalItem[] = [
  { value: "Fara apeluri la intamplare", label: "AI-ul porneste din surse si reguli definite de agentie." },
  { value: "Fara pierdere de context", label: "Rezultatul ramane legat de anunt, proprietar si agent." },
  { value: "Fara haos managerial", label: "Istoricul arata cine a fost contactat si ce merita urmat." },
];

const qualificationSteps: FeatureItem[] = [
  {
    icon: Search,
    title: "1. Selectezi oportunitatea",
    text: "Pornesti din anunturi de proprietari si filtrezi ce merita contactat, nu arunci timpul pe liste reci.",
  },
  {
    icon: SlidersHorizontal,
    title: "2. Setezi regulile agentiei",
    text: "Comision dorit, minim acceptat, interval orar si limite comerciale sunt clare inainte de orice apel.",
  },
  {
    icon: Bot,
    title: "3. AI-ul suna si califica",
    text: "Conversatia verifica intentia, disponibilitatea si deschiderea la colaborare fara sa oboseasca agentii.",
  },
  {
    icon: Users,
    title: "4. Agentul preia doar ce conteaza",
    text: "Cand proprietarul are potential, echipa intervine cu context, istoric si urmator pas comercial.",
  },
];

const benefitCards: FeatureItem[] = [
  {
    icon: TrendingUp,
    title: "Mai multe sanse de mandate",
    text: "Agentia poate acoperi mai multi proprietari in acelasi timp si descopera mai repede oportunitatile calde.",
  },
  {
    icon: Clock3,
    title: "Timp castigat pentru agenti",
    text: "Agentii nu mai consuma ore in apeluri repetitive; intra doar unde conversatia are sanse reale.",
  },
  {
    icon: ShieldCheck,
    title: "Standard comercial constant",
    text: "Mesajul, comisionul si limitele sunt aplicate consecvent, indiferent cine porneste campania.",
  },
  {
    icon: BarChart3,
    title: "Management masurabil",
    text: "Rezultatele devin vizibile: apeluri finalizate, pozitive, esuate si oportunitati care cer follow-up.",
  },
  {
    icon: MessageSquareText,
    title: "Conversatii mai bune",
    text: "Agentul suna cu motiv clar: stie ce a intrebat AI-ul, ce a raspuns proprietarul si unde e obiectia.",
  },
  {
    icon: RadioTower,
    title: "Prospectare scalabila",
    text: "Un proces care merge zilnic, controlat, fara sa depinda doar de energia individuala a fiecarui agent.",
  },
];

const controlCards: FeatureItem[] = [
  {
    icon: SlidersHorizontal,
    title: "Reguli comerciale",
    text: "Comision dorit, comision minim, tip de comision si ferestre orare definite de agentie.",
  },
  {
    icon: Headphones,
    title: "Ton si disciplina",
    text: "AI-ul pastreaza conversatia in limitele aprobate, fara promisiuni care complica negocierea.",
  },
  {
    icon: History,
    title: "Istoric verificabil",
    text: "Fiecare apel ramane in CRM cu status, telefon, comision, agent si data.",
  },
];

const handoffCards: FeatureItem[] = [
  {
    icon: ClipboardCheck,
    title: "Lead de proprietar pregatit",
    text: "Agentul vede de ce proprietarul merita sunat si ce trebuie clarificat mai departe.",
  },
  {
    icon: Building2,
    title: "Context de proprietate",
    text: "Anuntul, zona, pretul si sursa raman langa rezultatul apelului.",
  },
  {
    icon: LineChart,
    title: "Prioritate pentru echipa",
    text: "Managementul vede care oportunitati sunt calde si unde se pierde potential.",
  },
];

const conversionReasons = [
  "Agentii primesc proprietari calificati, nu doar numere de telefon.",
  "Prospectarea devine zilnica, masurabila si usor de coordonat.",
  "Comisionul si limitele de negociere raman sub controlul agentiei.",
  "Follow-up-ul uman incepe mai tarziu in proces, dar cu sanse mai mari de conversie.",
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
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 1040px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function AiCallsLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page ai-calls-showcase-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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

        <section className="ai-calls-hero ai-calls-premium-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(670px,1.18fr)] lg:items-center lg:px-8 lg:py-16">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <PhoneCall className="h-4 w-4 text-emerald-300" />
                AI outreach pentru proprietari, controlat de agentie
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.15rem] xl:text-[4.55rem]">
                Agentia ta suna piata in timp ce agentii inchid mandate.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai contacteaza proprietarii dupa regulile tale, califica intentia comerciala si trimite catre
                agent doar oportunitatile cu motiv clar de follow-up.
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

            <div className="ai-calls-hero__visual ai-calls-premium-visual" aria-label="Previzualizare modul Apeluri AI">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/premium-ai-calls.png"
                alt="Setari si istoric pentru apeluri AI catre proprietari"
                label="ImoDeus.ai CRM / Apeluri AI"
                priority
                className="ai-calls-screen--hero ai-calls-premium-screen"
              />
              <div className="ai-calls-live-card" aria-hidden="true">
                <div className="ai-calls-live-card__head">
                  <span>
                    <Zap className="h-4 w-4" />
                    Live qualification
                  </span>
                  <strong>Intentie pozitiva</strong>
                </div>
                <div className="ai-calls-live-card__dialog">
                  <p>AI: Sunteti deschis la colaborare cu o agentie pentru promovare?</p>
                  <p>Proprietar: Da, daca primesc o estimare corecta si comisionul e clar.</p>
                </div>
                <div className="ai-calls-live-card__footer">
                  <span>Handoff catre agent</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
              <div className="ai-calls-route-card" aria-hidden="true">
                {heroFlow.map((step) => (
                  <div key={step.label}>
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                  </div>
                ))}
              </div>
              <div className="ai-calls-floating ai-calls-floating--top ai-calls-premium-floating">
                <ShieldCheck className="h-4 w-4" />
                <span>reguli agentie</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left ai-calls-premium-floating">
                <Clock3 className="h-4 w-4" />
                <span>09:00 - 18:00</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right ai-calls-premium-floating">
                <Target className="h-4 w-4" />
                <span>proprietar calificat</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section ai-calls-how-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Bot className="h-4 w-4 text-teal-600" />
                Cum functioneaza, cap-coada
              </div>
              <h2>Din anunt de proprietar in oportunitate calificata, fara haos operational.</h2>
              <p>
                Modulul transforma prospectarea intr-un proces repetabil: alegi sursa, setezi regulile, AI-ul suna,
                iar agentul primeste doar conversatiile care merita energie umana.
              </p>
            </div>

            <div className="ai-calls-signal-grid">
              {operatingSignals.map((signal) => (
                <article key={signal.value} className="ai-calls-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid ai-calls-flow-grid--premium">
              {qualificationSteps.map((step) => {
                const StepIcon = step.icon;

                return (
                  <article key={step.title} className="ai-calls-flow-card ai-calls-flow-card--premium">
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

        <section className="ai-calls-control ai-calls-control-premium">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media ai-calls-control-premium__media">
              <ScreenFrame
                image="/landing/screenshots/premium-owner-listings.png"
                alt="Anunturi de la proprietari folosite ca sursa pentru apeluri AI"
                label="ImoDeus.ai CRM / Sursa proprietari"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Building2 className="h-4 w-4 text-cyan-300" />
                Prospectare din oportunitati reale
              </div>
              <h2>AI-ul nu suna la intamplare. Pleaca din proprietari care exista in piata.</h2>
              <p>
                Anunturile de la proprietari, filtrele, statusul si datele din CRM devin baza de selectie. Agentia
                decide unde merita incercat, iar AI-ul face primul contact cu disciplina.
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

        <section className="ai-calls-section ai-calls-benefit-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Beneficii uriase pentru agentii imobiliare
              </div>
              <h2>Nu este doar automatizare. Este un sistem de crestere pentru mandate.</h2>
              <p>
                Apelurile AI dau agentiei acoperire mai mare, disciplina mai buna si claritate asupra fiecarei
                conversatii cu proprietarii din piata.
              </p>
            </div>

            <div className="ai-calls-benefit-grid">
              {benefitCards.map((card) => {
                const CardIcon = card.icon;

                return (
                  <article key={card.title} className="ai-calls-benefit-card">
                    <CardIcon className="h-5 w-5" />
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ai-calls-command ai-calls-command-premium">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel ai-calls-command-premium__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Headphones className="h-4 w-4 text-emerald-300" />
                  Control room pentru apeluri
                </div>
                <h2>Automatizare puternica, dar cu limite comerciale clare.</h2>
                <p>
                  Agentia decide cadrul. AI-ul executa disciplinat. Agentii primesc oportunitatile calificate.
                  Managementul vede rezultatele fara rapoarte manuale.
                </p>
              </div>
              <div className="ai-calls-command-premium__screen">
                <ScreenFrame
                  image="/landing/screenshots/premium-ai-calls.png"
                  alt="Setari de agentie si istoric pentru apelurile AI"
                  label="ImoDeus.ai CRM / Reguli si istoric"
                />
              </div>
              <div className="ai-calls-control-cards ai-calls-control-cards--premium">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card ai-calls-control-card--premium">
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

        <section className="ai-calls-control ai-calls-handoff-section">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(380px,0.62fr)_minmax(0,1fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Users className="h-4 w-4 text-cyan-300" />
                Ce primeste agentul
              </div>
              <h2>Agentul nu intra rece. Intra cu motiv, context si urmator pas.</h2>
              <p>
                Cea mai mare valoare nu este ca AI-ul suna. Valoarea este ca agentul primeste o conversatie deja
                incalzita, cu intentie, obiectii si date comerciale utile.
              </p>
            </div>
            <div className="ai-calls-handoff-grid">
              {handoffCards.map((card) => {
                const CardIcon = card.icon;

                return (
                  <article key={card.title} className="ai-calls-handoff-card">
                    <CardIcon className="h-5 w-5" />
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ai-calls-final-cta ai-calls-final-premium">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <LineChart className="h-4 w-4 text-emerald-300" />
                Mai multe mandate, mai putin zgomot
              </div>
              <h2>Arata agentiei cum poate prospecta proprietari in fiecare zi, fara sa piarda controlul.</h2>
              <p>
                Demo-ul pune in fata clientului fluxul complet: sursa, reguli, apel AI, calificare, istoric si
                follow-up uman in acelasi sistem.
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
