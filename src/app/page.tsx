import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  LineChart,
  MapPinned,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

const heroHighlights = [
  "CRM complet pentru proprietati, lead-uri, task-uri si vizionari",
  "Matching AI intre clienti si proprietati, cu recomandari explicate",
  "Publicare in portaluri, website public si domeniu custom pentru agentie",
];

const featureGroups = [
  {
    icon: Building2,
    title: "Operare imobiliara intr-un singur loc",
    description:
      "Portofoliul de proprietati, detaliile comerciale, proprietarii, notitele interne, materialele media si istoricul statusurilor raman intr-un singur flux de lucru.",
    bullets: [
      "Fise complete pentru proprietati si proprietari",
      "Import de anunturi din owner listings",
      "Promovare, statusuri si comisioane urmarite centralizat",
    ],
  },
  {
    icon: Users,
    title: "Lead management care chiar misca pipeline-ul",
    description:
      "Agentii vad rapid cine merita contactat, ce preferinte are fiecare client si unde se blocheaza conversia dintre contact, vizionare si tranzactie.",
    bullets: [
      "Lead-uri, interactiuni, oferte si prioritati",
      "Scoruri AI si potrivire automata cu proprietatile",
      "Portal de client si formular de preferinte pentru cumparatori",
    ],
  },
  {
    icon: Bot,
    title: "AI aplicat pe operatiunile de zi cu zi",
    description:
      "Asistentul AI nu este doar un chat. Analizeaza CRM-ul, propune actiuni, genereaza continut si poate porni urmatorul pas operational direct din context.",
    bullets: [
      "Briefing zilnic si recomandari de prioritizare",
      "Mesaje, descrieri, rapoarte si insight-uri generate automat",
      "Programare de vizionari si matching direct din asistent",
    ],
  },
  {
    icon: Rocket,
    title: "Distribuire si promovare fara frictiune",
    description:
      "Aplicatia leaga lucrul intern al agentiei de canalele externe unde apar lead-urile si proprietatile, astfel incat echipa sa nu lucreze in sisteme separate.",
    bullets: [
      "Sincronizare cu Imobiliare.ro si pregatire pentru alte portaluri",
      "Promovare asistata pentru grupuri Facebook din desktop app",
      "Website public pentru agentie si pagini dedicate pentru proprietati",
    ],
  },
  {
    icon: CalendarCheck2,
    title: "Coordonare operationala pentru echipa",
    description:
      "Vizionarile, task-urile si actiunile urmatoare raman vizibile pentru intreaga agentie, cu accent pe claritate si viteza de executie.",
    bullets: [
      "Calendar de vizionari si sumar de disponibilitate",
      "Task-uri pe lead-uri si contacte importante",
      "Panou rapid pentru actiunile folosite cel mai des",
    ],
  },
  {
    icon: LineChart,
    title: "Rapoarte care spun ce faci mai departe",
    description:
      "Nu doar afisam cifre. Platforma masoara conversia, calitatea datelor, blocajele din funnel si zonele unde merita intervenit imediat.",
    bullets: [
      "Comisioane, inventar activ si performanta pe perioade",
      "Analiza surselor de lead-uri si forecast operational",
      "Semnale de risc si scoruri pe zonele importante din business",
    ],
  },
];

const operatingFlow = [
  {
    step: "01",
    title: "Aduni portofoliul si lead-urile",
    text: "Importi proprietati, centralizezi contactele si creezi un CRM care nu depinde de fisiere disparate sau mesaje imprastiate.",
  },
  {
    step: "02",
    title: "AI-ul prioritizeaza si potriveste",
    text: "Platforma propune ce lead-uri merita contactate, ce proprietati se potrivesc si unde ai urmatorul pas cu cea mai mare sansa de conversie.",
  },
  {
    step: "03",
    title: "Publici si prezinti profesionist",
    text: "Distribui anunturile in portaluri, activezi paginile publice si folosesti client portal sau formulare de preferinte pentru o experienta moderna.",
  },
  {
    step: "04",
    title: "Urmaresti echipa si optimizezi",
    text: "Vezi in rapoarte unde se pierde pipeline-ul, ce proprietati trebuie imbunatatite si cum creste activitatea agentiei de la o saptamana la alta.",
  },
];

const productSignals = [
  {
    label: "Lead-uri & potrivire",
    value: "AI scoring, matching si portal client",
    icon: Sparkles,
  },
  {
    label: "Proprietati & publicare",
    value: "Fisa completa, portal sync si website public",
    icon: Globe,
  },
  {
    label: "Vizionari & task-uri",
    value: "Coordonare operationala pentru intreaga echipa",
    icon: CalendarCheck2,
  },
  {
    label: "Rapoarte & insight-uri",
    value: "Forecast, funnel, surse si blocaje reale",
    icon: LineChart,
  },
];

const credibilityPills = [
  "Dashboard operational pentru agentii",
  "Portal de client si website public",
  "Integrari cu portaluri imobiliare",
  "Asistent AI conectat la datele reale din CRM",
];

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-surface-border)] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-highlight)] shadow-[var(--agentfinder-pill-shadow)]">
      <Sparkles className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main
      data-app-theme="agentfinder"
      className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7fafe_38%,#eef4fb_100%)] text-[var(--foreground)]"
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(86,121,180,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(182,128,246,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute left-[-10rem] top-24 h-[26rem] w-[26rem] rounded-full bg-sky-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] top-12 h-[30rem] w-[30rem] rounded-full bg-violet-300/20 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-24 lg:pt-8">
          <header className="flex flex-col gap-4 rounded-[32px] border border-[var(--app-surface-border)] bg-white/70 px-5 py-4 shadow-[0_20px_60px_rgba(37,55,88,0.08)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-6">
            <ImoDeusTextLogo className="text-[var(--foreground)] [&_.text-white]:!text-[var(--foreground)] [&_.text-white\\/55]:!text-[var(--muted-foreground)] [&>div:first-child]:border-[var(--app-surface-border)] [&>div:first-child]:bg-white/80" />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[var(--app-surface-border)] bg-white/82 px-5 text-slate-700 hover:bg-white"
              >
                <Link href="/demo">Intra in demo</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-full px-5 text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover-bg)] hover:text-[var(--foreground)]"
              >
                <Link href="/login">Autentificare</Link>
              </Button>
              <Button
                asChild
                className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] px-5 text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
              >
                <Link href="/register">
                  Creeaza cont
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <section className="grid gap-10 pb-14 pt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:items-center lg:gap-12 lg:pb-20 lg:pt-20">
            <div className="max-w-3xl">
              <SectionEyebrow>Prezentarea aplicatiei pentru agentii imobiliare</SectionEyebrow>
              <h1 className="mt-6 max-w-4xl font-headline text-5xl font-bold tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
                CRM-ul care uneste agentia, proprietatile, lead-urile si AI-ul intr-un singur sistem clar.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                ImoDeus.ai CRM este construit pentru agentii care vor sa lucreze rapid, coerent si
                profesionist: de la import si operare interna pana la publicare, prezentare, raportare
                si asistenta AI conectata la datele reale din business.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-[var(--app-surface-border)] bg-white/88 px-6 text-slate-700 hover:bg-white"
                >
                  <Link href="/demo">
                    Exploreaza demo-ul
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full border-0 bg-[var(--agentfinder-primary-button)] px-6 text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
                >
                  <Link href="/register">
                    Incepe cu agentia ta
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-[var(--app-surface-border)] bg-white/80 px-6 text-slate-700 hover:bg-white"
                >
                  <Link href="/login">
                    Intra in platforma
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-[var(--app-surface-border)] bg-white/78 p-4 shadow-[0_16px_38px_rgba(37,55,88,0.06)]"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[var(--app-highlight)]" />
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-16 hidden h-28 w-28 rounded-full bg-sky-200/50 blur-3xl lg:block" />
              <div className="absolute -right-6 bottom-14 hidden h-28 w-28 rounded-full bg-violet-200/50 blur-3xl lg:block" />
              <div className="relative rounded-[36px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-shell-panel)] p-4 shadow-[0_28px_72px_rgba(37,55,88,0.14)] sm:p-5">
                <div className="absolute inset-0 rounded-[36px] bg-[var(--agentfinder-shell-glow)] opacity-80" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white/85 px-4 py-3 shadow-[var(--agentfinder-soft-shadow)]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                        Agentie in control
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">Tablou de operare ImoDeus</p>
                    </div>
                    <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      AI active
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[28px] border border-white/70 bg-white/86 p-5 shadow-[var(--agentfinder-card-shadow)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                            Prioritatile zilei
                          </p>
                          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Echipa vede imediat urmatorul pas.</h2>
                        </div>
                        <div className="rounded-2xl bg-[var(--agentfinder-card-bg-violet)] p-3 text-[var(--primary)]">
                          <Wand2 className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        {productSignals.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.label}
                              className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-[var(--agentfinder-card-bg-soft)] px-4 py-3"
                            >
                              <div className="rounded-2xl bg-white/80 p-2 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{item.value}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="rounded-[28px] border border-white/70 bg-[var(--agentfinder-card-bg-blue)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-white/85 p-2.5 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                            <Search className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Search & AI</p>
                            <p className="text-base font-semibold text-slate-900">Lead, proprietate, task</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[22px] border border-white/80 bg-white/75 px-4 py-3 text-sm text-slate-600">
                          Cautare globala in CRM si context operabil pentru echipa.
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/70 bg-[var(--agentfinder-card-bg-green)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Flux extern</p>
                        <div className="mt-3 space-y-3">
                          {["Portal sync", "Website public", "Client portal"].map((label) => (
                            <div
                              key={label}
                              className="flex items-center justify-between rounded-[20px] border border-white/80 bg-white/75 px-4 py-3"
                            >
                              <span className="text-sm font-medium text-slate-800">{label}</span>
                              <Star className="h-4 w-4 text-[var(--public-accent-soft)]" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/70 bg-[var(--agentfinder-card-bg-violet)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Semnal pentru manager</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Conversie, activitate si claritate</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Aplicatia pune accent pe executie, nu doar pe evidenta.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-[var(--app-surface-border)] bg-white/72 p-6 shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <SectionEyebrow>Ce include produsul in forma lui reala</SectionEyebrow>
                <h2 className="mt-5 font-headline text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  O prezentare construita din functiile deja existente in aplicatie.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Landing-ul promite exact ce platforma livreaza deja: CRM de agentie, AI contextual,
                  promovare, pagini publice, sincronizare cu portaluri, management de vizionari,
                  rapoarte si documente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {credibilityPills.map((pill) => (
                  <div
                    key={pill}
                    className="rounded-full border border-[var(--app-surface-border)] bg-white/82 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                  >
                    {pill}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {featureGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <article
                    key={group.title}
                    className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-5 shadow-[var(--agentfinder-card-shadow)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="rounded-[20px] bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                        Modul
                      </div>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{group.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{group.description}</p>
                    <div className="mt-5 space-y-2">
                      {group.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-start gap-3 rounded-[18px] bg-white/75 px-3.5 py-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-highlight)]" />
                          <p className="text-sm leading-6 text-slate-700">{bullet}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-8 lg:py-20">
            <div className="rounded-[32px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-sky)] p-6 shadow-[var(--agentfinder-card-shadow)] lg:p-7">
              <SectionEyebrow>Cum lucreaza agentia in platforma</SectionEyebrow>
              <h2 className="mt-5 font-headline text-3xl font-bold tracking-[-0.04em] text-slate-950">
                De la intrarea lead-ului pana la promovare, vizionare si raportare.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Aplicatia este gandita ca un sistem de operare pentru agentie, nu ca o colectie de
                pagini separate. Fiecare modul impinge echipa spre urmatoarea actiune utila.
              </p>

              <div className="mt-8 space-y-4">
                {operatingFlow.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[var(--agentfinder-soft-shadow)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--agentfinder-dark-button)] text-sm font-semibold text-white shadow-[var(--agentfinder-dark-button-shadow)]">
                        {item.step}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-5 shadow-[var(--agentfinder-card-shadow)] sm:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      AgentFinder visual language
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      Un landing premium, coerent cu tema din admin.
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-[var(--agentfinder-card-bg-violet)] p-3 text-[var(--primary)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Am pastrat limbajul vizual AgentFinder: fundal rece, carduri elevate, umbre soft,
                  headline expresiv si accente slate blue plus violet, astfel incat prima impresie sa
                  para deja parte din produsul premium pe care agentia urmeaza sa il foloseasca.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-green)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                  <MapPinned className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">Site public si domeniu custom</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Agentia poate publica proprietati si isi poate expune brandul pe propriul domeniu.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-violet)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">Contracte si documente</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Template-uri, placeholdere si generare de documente pentru procesele recurente.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-blue)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">Portal sync si distribuire</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Imobiliare.ro este deja integrat, iar structura platformei pregateste extinderea pe mai multe canale.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-5 shadow-[var(--agentfinder-card-shadow)]">
                <div className="rounded-2xl bg-white/80 p-3 text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">AI conectat la context</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Nu raspunsuri generice, ci recomandari pe baza contactelor, proprietatilor si vizionarilor din agentie.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-[var(--app-surface-border)] bg-[linear-gradient(135deg,rgba(65,87,130,0.98),rgba(56,77,117,0.98))] p-6 text-white shadow-[0_28px_80px_rgba(47,66,104,0.24)] lg:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">
                  Pregatit pentru onboarding
                </p>
                <h2 className="mt-4 font-headline text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
                  Agentiile vad din prima ce castiga: claritate, viteza si prezentare moderna.
                </h2>
                <p className="mt-4 text-base leading-7 text-sky-50/82">
                  Pagina aceasta devine punctul de intrare in produs pentru agentiile care nu sunt
                  conectate inca. Tonul, structura si promisiunea sunt aliniate cu aplicatia reala.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100"
                >
                  <Link href="/register">
                    Creeaza cont pentru agentie
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/30 bg-white/10 px-6 text-white hover:bg-white/16"
                >
                  <Link href="/login">Autentificare</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
