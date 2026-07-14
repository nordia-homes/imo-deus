import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck2,
  Layers3,
  LineChart,
  MessageSquareText,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Modul Vizionari pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Programeaza, gestioneaza si urmareste vizionarile intr-un calendar operational conectat cu proprietati, clienti, proprietari si agenti.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "5", label: "vizionari azi" },
  { value: "2h 30m", label: "timp disponibil" },
  { value: "1 flux", label: "client, agent, proprietar" },
];

const viewingSignals = [
  { value: "Calendar", label: "ziua agentiei devine clara" },
  { value: "Sloturi", label: "timpul liber este vizibil" },
  { value: "Context", label: "fiecare vizionare are detalii" },
];

const viewingFlow: FeatureItem[] = [
  {
    icon: CalendarCheck2,
    title: "Programezi rapid",
    text: "Alegi ziua, ora, proprietatea si participantii fara sa pierzi contextul comercial.",
  },
  {
    icon: Users,
    title: "Coordonezi echipa",
    text: "Clientul, proprietarul si agentul stau in aceeasi vizionare, cu actiuni rapide la indemana.",
  },
  {
    icon: Target,
    title: "Vezi sloturile libere",
    text: "Calendarul arata intervalele disponibile, suprapunerile si momentele care pot fi rezervate.",
  },
  {
    icon: LineChart,
    title: "Urmaresti ritmul",
    text: "Managementul vede cate vizionari sunt planificate si unde ziua poate fi optimizata.",
  },
];

const conversionReasons = [
  "Agentii vad imediat ce urmeaza, fara mesaje pierdute sau calendare separate.",
  "Clientul, proprietarul si agentul sunt conectati la aceeasi proprietate si aceeasi ora.",
  "Sloturile libere devin oportunitati rapide pentru programari noi.",
  "Vizionarile raman in CRM si pot alimenta follow-up-ul, rapoartele si urmatorul pas.",
];

const controlCards: FeatureItem[] = [
  {
    icon: Building2,
    title: "Proprietate in context",
    text: "Fiecare vizionare este legata de proprietatea reala, cu imagine, adresa si status vizibil.",
  },
  {
    icon: MessageSquareText,
    title: "Actiuni rapide",
    text: "Agentul poate suna, trimite mesaj sau deschide ruta fara sa sara intre aplicatii.",
  },
  {
    icon: ShieldCheck,
    title: "Program verificabil",
    text: "Ziua ramane clara pentru management: ore ocupate, timp liber si vizionari programate.",
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
          height={1015}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 980px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function ViewingsLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page viewings-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/ai-matching" className="lux-nav-menu__link">
                AI Matching
              </Link>
              <Link href="/vizionari" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="ai-calls-hero viewings-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(650px,1.16fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <CalendarCheck2 className="h-4 w-4 text-emerald-300" />
                Modul premium pentru programari si vizionari
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.35rem]">
                Ziua agentiei devine un calendar de vanzare, nu o lista de promisiuni.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai conecteaza vizionarile cu proprietatea, clientul, proprietarul si agentul, astfel incat
                fiecare programare are context, ora clara si actiune urmatoare.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi vizionarile" />
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

            <div className="ai-calls-hero__visual viewings-hero__visual" aria-label="Previzualizare modul Vizionari">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/viewings-calendar.png"
                alt="Calendar cu rezumatul orelor de vizionari si sloturi libere"
                label="ImoDeus.ai CRM / Vizionari"
                priority
                className="ai-calls-screen--hero viewings-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/viewings-detail.png"
                alt="Detaliu vizionare cu proprietate, client, proprietar si agent"
                label="Detaliu vizionare"
                className="viewings-mini-screen"
              />
              <div className="viewings-time-card">
                <span>Astazi</span>
                <strong>5</strong>
                <p>vizionari planificate</p>
              </div>
              <div className="ai-calls-floating ai-calls-floating--top viewings-floating">
                <BadgeCheck className="h-4 w-4" />
                <span>sloturi libere</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left viewings-floating">
                <Users className="h-4 w-4" />
                <span>client + proprietar</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right viewings-floating">
                <Building2 className="h-4 w-4" />
                <span>proprietate conectata</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section viewings-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Programari clare pentru echipe rapide
              </div>
              <h2>Vizionarile sunt organizate ca un centru operational, nu ca note disparate.</h2>
              <p>
                Calendarul arata ziua, sloturile disponibile, participantii si proprietatile, astfel incat echipa poate
                programa mai repede si poate urmari mai bine conversia.
              </p>
            </div>

            <div className="viewings-signal-grid">
              {viewingSignals.map((signal) => (
                <article key={signal.value} className="viewings-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {viewingFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card viewings-flow-card">
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

        <section className="ai-calls-control viewings-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.65fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media viewings-control__media">
              <ScreenFrame
                image="/landing/screenshots/viewings-detail.png"
                alt="Vizionare programata cu carduri pentru client, proprietar si agent"
                label="ImoDeus.ai CRM / Detaliu vizionare"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Layers3 className="h-4 w-4 text-cyan-300" />
                Context complet pentru fiecare programare
              </div>
              <h2>O vizionare nu este doar o ora. Este o oportunitate cu toate datele la vedere.</h2>
              <p>
                Agentul vede proprietatea, adresa, clientul, proprietarul, agentul responsabil si actiunile rapide, ca
                fiecare intalnire sa fie pregatita comercial.
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

        <section className="ai-calls-command viewings-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel viewings-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Target className="h-4 w-4 text-emerald-300" />
                  Ritm vizibil
                </div>
                <h2>Calendarul arata unde ziua este ocupata si unde mai poti castiga o vizionare.</h2>
                <p>
                  Sloturile libere, intervalele ocupate si lista programarilor dau echipei un mod rapid de a transforma
                  intentia clientilor in intalniri reale.
                </p>
              </div>
              <div className="viewings-command__media">
                <ScreenFrame
                  image="/landing/screenshots/viewings-calendar.png"
                  alt="Rezumat ore vizionari cu intervale libere si programari"
                  label="ImoDeus.ai CRM / Calendar vizionari"
                />
              </div>
              <div className="ai-calls-control-cards viewings-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card viewings-control-card">
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

        <section className="ai-calls-final-cta viewings-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Vizionari care raman conectate la vanzare
              </div>
              <h2>Arata agentiei cum programarile pot deveni un flux clar de conversie.</h2>
              <p>
                Demo-ul pune in fata echipei un calendar complet: proprietate, clienti, agent, disponibilitate, actiuni
                rapide si follow-up in acelasi sistem.
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
