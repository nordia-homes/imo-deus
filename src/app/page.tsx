import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  Globe2,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

const commandCards = [
  {
    title: "Lead fierbinte",
    value: "Raspuns in 4 min",
    text: "AI-ul sugereaza urmatorul pas si proprietatea potrivita.",
    icon: Sparkles,
    tone: "landing-card-emerald",
  },
  {
    title: "Property sync",
    value: "Ready to publish",
    text: "Website public si portaluri pornite din acelasi flux.",
    icon: Globe2,
    tone: "landing-card-blue",
  },
  {
    title: "Ziua echipei",
    value: "12 actiuni live",
    text: "Vizionari, task-uri si follow-up-uri ordonate instant.",
    icon: CalendarCheck2,
    tone: "landing-card-violet",
  },
];

const featureCards = [
  {
    icon: Building2,
    title: "CRM care pare deja viu",
    text: "Intri intr-un workspace care arata ca o agentie reala, nu ca un demo gol.",
  },
  {
    icon: Bot,
    title: "AI vazut exact unde conteaza",
    text: "Briefing, scoring, matching si continut generat direct din contextul CRM-ului.",
  },
  {
    icon: BarChart3,
    title: "Claritate operationala instant",
    text: "Primele secunde iti arata daca produsul are sau nu substanta. Aici o vezi imediat.",
  },
];

const leftFeatureCards = [
  {
    icon: Building2,
    label: "Proprietati",
    title: "Fise complete",
    text: "Proprietati, media, proprietari si statusuri comerciale intr-un singur loc.",
  },
  {
    icon: Users,
    label: "Lead-uri",
    title: "Pipeline clar",
    text: "Lead-uri, interactiuni, scoruri si prioritizare automata pentru echipa.",
  },
  {
    icon: Bot,
    label: "AI Assistant",
    title: "Context operabil",
    text: "Briefing, matching, recomandari si continut generat direct in context.",
  },
  {
    icon: CalendarCheck2,
    label: "Vizionari",
    title: "Agenda live",
    text: "Vizionari, task-uri si urmatorii pasi coordonati pentru toata agentia.",
  },
  {
    icon: Globe2,
    label: "Publicare",
    title: "Portal sync",
    text: "Website public si canale externe pornite din acelasi flux de lucru.",
  },
  {
    icon: BarChart3,
    label: "Rapoarte",
    title: "Claritate",
    text: "Activitate, performanta si semnale utile pentru deciziile agentiei.",
  },
];

function DemoButton({ className = "" }: { className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`landing-button-pulse h-14 rounded-full border border-white/40 bg-[linear-gradient(135deg,#ffffff_0%,#e2e8f0_45%,#bfdbfe_100%)] px-7 text-base font-semibold text-slate-950 shadow-[0_20px_60px_rgba(59,130,246,0.22)] transition-transform duration-300 hover:scale-[1.02] hover:opacity-100 ${className}`}
    >
      <Link href="/demo">
        Intra in demo acum
        <Play className="h-4 w-4 fill-current" />
      </Link>
    </Button>
  );
}

export default function HomePage() {
  return (
    <main
      data-app-theme="agentfinder"
      className="landing-grid landing-dark-shell min-h-screen overflow-x-clip text-slate-950"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-cyan" />
        <div className="landing-orb landing-orb-violet" />
        <div className="landing-orb landing-orb-emerald" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1380px] flex-col px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pb-24 lg:pt-8">
        <header className="landing-glass-panel flex flex-col gap-4 rounded-[30px] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <ImoDeusTextLogo className="w-[11.5rem] sm:w-[12.5rem]" />
          <div className="flex flex-wrap items-center gap-3">
            <DemoButton className="h-12 px-5 text-sm sm:text-base" />
            <Button
              asChild
              variant="ghost"
              className="rounded-full px-5 text-slate-600 hover:bg-white/80 hover:text-slate-950"
            >
              <Link href="/login">Autentificare</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-slate-200 bg-white/82 px-5 text-slate-700 hover:bg-white"
            >
              <Link href="/register">
                Creeaza cont
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative grid gap-10 pb-16 pt-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(560px,1.06fr)] lg:items-center lg:gap-10 lg:pb-24 lg:pt-10">
          <div className="relative z-10 max-w-2xl self-start pt-2 lg:pt-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-100/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-800 shadow-[0_10px_30px_rgba(59,130,246,0.10)] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Hero orientat spre demo
            </div>

            <h1 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-[0.92] tracking-[-0.08em] text-slate-950 sm:text-5xl lg:text-[4.85rem]">
              <span className="block">Vezi un demo live,</span>
              <span className="landing-gradient-text block">nu o prezentare moarta.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
              Intra direct intr-o agentie demo ImoDeus.ai CRM si simte produsul live: lead-uri,
              proprietati, task-uri, AI si publicare, toate deja in miscare.
            </p>

            <div className="mt-8">
              <DemoButton className="landing-hero-primary h-16 w-full justify-between px-8 text-lg sm:text-xl" />
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-[24px] border border-emerald-300/50 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.08)] backdrop-blur">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Demo-ul este separat de date reale. Poti explora fara risc.
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {leftFeatureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="landing-metric-card rounded-[26px] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-[18px] border border-slate-200/80 bg-white/92 p-2.5 text-sky-700 shadow-[0_10px_24px_rgba(37,55,88,0.06)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {card.label}
                      </p>
                    </div>
                    <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                      {card.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-[540px] lg:min-h-[680px]">
            <div className="landing-floating-chip landing-float-slow left-0 top-8 hidden lg:flex">
              <Search className="h-4 w-4 text-sky-200" />
              Cautare globala + AI
            </div>

            <div className="landing-floating-chip landing-float-fast right-4 top-24 hidden lg:flex">
              <Users className="h-4 w-4 text-slate-500" />
              Agentie demo live
            </div>

            <div className="landing-floating-score landing-float-slow hidden lg:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Demo launch
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">1 click</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                intri direct in experienta completa
              </p>
            </div>

            <div className="landing-hero-shell relative mx-auto max-w-[760px] p-3 sm:p-4">
              <div className="landing-hero-shell-inner rounded-[34px] p-4 sm:p-5">
                <div className="landing-mockup-panel rounded-[30px] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/80">
                        Experienta demo
                      </p>
                      <h2 className="mt-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-[-0.06em] text-slate-950 sm:text-[2.45rem]">
                        Intri intr-un centru de comanda pentru agentie.
                      </h2>
                      <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-[15px]">
                        Nu doar vezi produsul. Il simti: dashboard, lead-uri, proprietati, agenda si AI
                        deja conectate intr-un flux care pare viu.
                      </p>
                    </div>
                    <div className="rounded-full border border-sky-300/40 bg-sky-100/85 px-3 py-1 text-xs font-semibold text-sky-800">
                      Demo live
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {commandCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <article
                          key={card.title}
                          className={`landing-command-card ${card.tone} rounded-[24px] p-4`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 text-sky-700 shadow-[0_10px_24px_rgba(37,55,88,0.06)]">
                              <Icon className="h-4 w-4" />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {card.title}
                            </p>
                          </div>
                          <p className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-slate-950">
                            {card.value}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                        </article>
                      );
                    })}
                  </div>

                  <div className="landing-section-band mt-5 rounded-[24px] px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Functionalitati cheie
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          In demo vezi exact modulele care muta agentia din haos intr-un sistem clar.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="landing-inline-proof">crm complet</div>
                        <div className="landing-inline-proof">ai contextual</div>
                        <div className="landing-inline-proof">publicare</div>
                      </div>
                    </div>
                  </div>

                  <div className="landing-demo-cta mt-5 rounded-[28px] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="max-w-xl">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/80">
                          Acces demo
                        </p>
                        <p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-[-0.05em] text-slate-950 sm:text-3xl">
                          Deschide demo-ul si vezi toate functionalitatile in actiune.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Intri direct in dashboard-ul demo, fara pasi inutili si fara date reale afectate.
                        </p>
                      </div>
                      <DemoButton className="h-16 min-w-[240px] justify-center px-8 text-lg shadow-[0_24px_70px_rgba(59,130,246,0.24)]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="landing-feature-card rounded-[30px] p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex rounded-[20px] border border-slate-200/80 bg-white/92 p-3 text-sky-700 shadow-[0_14px_30px_rgba(59,130,246,0.08)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-[-0.05em] text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.text}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-[34px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,246,255,0.86),rgba(237,242,247,0.82))] p-6 shadow-[0_28px_90px_rgba(37,99,235,0.08)] lg:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/80">
                  Demo first
                </p>
                <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-[-0.06em] text-slate-950 sm:text-4xl">
                  Daca pagina trebuie sa convinga, butonul de demo trebuie sa fie imposibil de ratat.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Asta face versiunea noua: ultra-product, focus total pe demo, carduri cu prezenta,
                  glow controlat si un ritm vizual bun si pe mobil.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <DemoButton />
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full border-slate-200 bg-white/82 px-7 text-slate-700 hover:bg-white"
                >
                  <Link href="/register">Creeaza cont dupa demo</Link>
                </Button>
              </div>
            </div>
        </section>
      </div>
    </main>
  );
}
