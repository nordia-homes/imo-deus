import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Download,
  FileText,
  Layers3,
  LineChart,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Contracte pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Creeaza, editeaza, completeaza si exporta contractele agentiei din acelasi CRM in care lucreaza agentii, proprietatile si clientii.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "CRM", label: "date completate automat" },
  { value: "Word", label: "template-uri importate" },
  { value: "PDF", label: "export pregatit" },
];

const contractSignals = [
  { value: "Template-uri", label: "biblioteca juridica a agentiei" },
  { value: "Variabile", label: "client, proprietate, pret, comision" },
  { value: "Control", label: "draft, activ, importat, exportat" },
];

const contractFlow: FeatureItem[] = [
  {
    icon: FileText,
    title: "Pornesti din template",
    text: "Contractele agentiei stau intr-o biblioteca editabila, pregatita pentru cazurile recurente.",
  },
  {
    icon: Layers3,
    title: "Completezi din CRM",
    text: "Datele despre client, proprietate, proprietar si agent raman in acelasi context operational.",
  },
  {
    icon: Upload,
    title: "Importi documente Word",
    text: "Template-urile existente pot intra in sistem si devin parte din fluxul zilnic al agentiei.",
  },
  {
    icon: Download,
    title: "Livrezi PDF curat",
    text: "Documentul final pleaca pregatit pentru semnare, arhivare si urmarire manageriala.",
  },
];

const conversionReasons = [
  "Template-ul corect, mereu la indemana.",
  "Datele se preiau direct din CRM.",
  "Editezi vizual inainte de export.",
  "PDF pregatit pentru semnare.",
];

const controlCards: FeatureItem[] = [
  {
    icon: ShieldCheck,
    title: "Control juridic",
    text: "Versiunile importante raman centralizate, cu status vizibil si responsabilitate clara.",
  },
  {
    icon: Users,
    title: "Agentii lucreaza mai rapid",
    text: "Documentul se naste din fluxul real: client, proprietate, proprietar, agent si comision.",
  },
  {
    icon: LineChart,
    title: "Inchidere mai fluida",
    text: "De la acord comercial la document final, pasii sunt mai scurti si mai usor de demonstrat.",
  },
];

const documentRows = [
  { name: "Contract intermediere", status: "Activ" },
  { name: "Promisiune bilaterala", status: "Draft" },
  { name: "Proces verbal predare", status: "PDF" },
];

const roleBenefits: FeatureItem[] = [
  {
    icon: Building2,
    title: "Managerul pastreaza standardul",
    text: "Biblioteca spune clar ce template este activ, ce trebuie revizuit si din ce documente lucreaza agentia.",
  },
  {
    icon: ShieldCheck,
    title: "Operatiunile raman controlate",
    text: "Versiunile de lucru nu se mai imprastie in foldere, conversatii si atasamente trimise intre colegi.",
  },
  {
    icon: Users,
    title: "Agentul actioneaza mai repede",
    text: "Porneste de la datele reale ale clientului si proprietatii, apoi ajusteaza doar ce este specific tranzactiei.",
  },
];

const contractQuestions = [
  {
    question: "Putem porni de la contractele pe care le folosim deja?",
    answer: "Da. Importi template-urile Word existente in biblioteca agentiei, apoi le pregatesti pentru utilizare recurenta in CRM.",
  },
  {
    question: "Agentul poate adapta un document pentru un caz particular?",
    answer: "Da. Datele se completeaza din CRM, iar documentul poate fi ajustat vizual inainte de exportul PDF final.",
  },
  {
    question: "Ce ramane sub controlul agentiei?",
    answer: "Agentia vede ce template-uri sunt active, draft sau importate si pastreaza baza documentara in acelasi workspace cu tranzactiile.",
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
          height={900}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 1040px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function ContractsLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page contracte-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/vizionari" className="lux-nav-menu__link">
                Vizionari
              </Link>
              <Link href="/contracte" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="ai-calls-hero contracte-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(670px,1.18fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <FileText className="h-4 w-4 text-amber-300" />
                Modul premium pentru contracte editabile
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.35rem]">
                Contractul potrivit, in exact momentul potrivit.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai leaga template-urile aprobate, datele din CRM, editarea vizuala si exportul PDF intr-un
                singur flux. Pentru agentii care vor sa fie gata cand clientul spune "da".
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi contractele" />
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

            <div className="ai-calls-hero__visual contracte-hero__visual" aria-label="Previzualizare modul Contracte">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/contracts.png"
                alt="Modul Contracte cu template-uri editabile, statusuri si biblioteca de contracte"
                label="ImoDeus.ai CRM / Contracte"
                priority
                className="ai-calls-screen--hero contracte-screen--hero"
              />
              <div className="contracte-context-rail" aria-hidden="true">
                <div className="contracte-context-rail__head">
                  <span>Date conectate</span>
                  <strong>din CRM</strong>
                </div>
                <div className="contracte-context-rail__items">
                  <span><i /> Client</span>
                  <span><i /> Proprietate</span>
                  <span><i /> Comision</span>
                </div>
                <div className="contracte-context-rail__result">
                  <BadgeCheck className="h-4 w-4" />
                  <span>Document pregatit</span>
                </div>
              </div>
              <div className="contracte-doc-panel" aria-hidden="true">
                <div className="contracte-doc-panel__top">
                  <span>Biblioteca</span>
                  <strong>3 template-uri</strong>
                </div>
                {documentRows.map((row) => (
                  <div key={row.name} className="contracte-doc-row">
                    <FileText className="h-4 w-4" />
                    <span>{row.name}</span>
                    <strong>{row.status}</strong>
                  </div>
                ))}
              </div>
              <div className="contracte-signature-card" aria-hidden="true">
                <BadgeCheck className="h-4 w-4" />
                <span>Variabile verificate</span>
                <strong>client + proprietate + comision</strong>
              </div>
              <div className="ai-calls-floating ai-calls-floating--top contracte-floating">
                <Upload className="h-4 w-4" />
                <span>import Word</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left contracte-floating">
                <ClipboardCheck className="h-4 w-4" />
                <span>template activ</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right contracte-floating">
                <Download className="h-4 w-4" />
                <span>export PDF</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section contracte-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Documente care stau in fluxul comercial
              </div>
              <h2>Contractele devin o extensie naturala a CRM-ului, nu o etapa separata.</h2>
              <p>
                Agentia pastreaza sabloanele importante, agentii completeaza rapid documentele, iar fiecare contract
                ramane legat de proprietatea, clientul si tranzactia corecta.
              </p>
            </div>

            <div className="contracte-signal-grid">
              {contractSignals.map((signal) => (
                <article key={signal.value} className="contracte-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {contractFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card contracte-flow-card">
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

        <section className="contracte-roles">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-end lg:px-8 lg:py-20">
            <div className="contracte-roles__intro">
              <div className="lux-pill lux-pill--muted">
                <Layers3 className="h-4 w-4 text-amber-300" />
                Acelasi flux, clar pentru fiecare rol
              </div>
              <h2>O biblioteca pentru agentie. Un avantaj concret pentru fiecare agent.</h2>
              <p>
                Contractele devin o parte fireasca a felului in care echipa vinde: control pentru agentie, viteza
                pentru agent si context pastrat pentru fiecare tranzactie.
              </p>
            </div>
            <div className="contracte-role-grid">
              {roleBenefits.map((benefit, index) => {
                const BenefitIcon = benefit.icon;

                return (
                  <article key={benefit.title} className="contracte-role-card">
                    <span className="contracte-role-card__index">0{index + 1}</span>
                    <BenefitIcon className="h-5 w-5" />
                    <h3>{benefit.title}</h3>
                    <p>{benefit.text}</p>
                    <span className="contracte-role-card__footer">un singur workspace</span>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ai-calls-control contracte-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.65fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media contracte-control__media">
              <ScreenFrame
                image="/landing/screenshots/contracts.png"
                alt="Biblioteca de contracte si template-uri cu actiuni de creare si completare"
                label="ImoDeus.ai CRM / Biblioteca Contracte"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <Building2 className="h-4 w-4 text-cyan-300" />
                Pentru agentii si agenti imobiliari
              </div>
              <h2>Datele tranzactiei, direct in document.</h2>
              <p>
                Alegi template-ul, completezi, ajustezi si exporti. Totul ramane in acelasi CRM.
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

        <section className="ai-calls-command contracte-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel contracte-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <ShieldCheck className="h-4 w-4 text-amber-300" />
                  Biblioteca controlata
                </div>
                <h2>Biblioteca documentelor, sub control.</h2>
                <p>
                  Template-uri clare pentru agentie. Viteza pentru fiecare agent.
                </p>
              </div>
              <div className="contracte-command__media">
                <ScreenFrame
                  image="/landing/screenshots/contracts.png"
                  alt="Modul de contracte cu statistici si biblioteca de template-uri"
                  label="ImoDeus.ai CRM / Template-uri"
                />
              </div>
              <div className="ai-calls-control-cards contracte-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card contracte-control-card">
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

        <section className="contracte-questions">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:px-8 lg:py-20">
            <div className="contracte-questions__intro">
              <div className="lux-pill lux-pill--muted">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                Clar de la primul document
              </div>
              <h2>Intrebari pe care echipa ta le va avea.</h2>
              <p>
                Un modul bun de contracte nu inseamna doar un editor. Inseamna un flux pe care fiecare coleg il
                intelege din prima, fara instructiuni greu de urmat.
              </p>
            </div>
            <div className="contracte-question-list">
              {contractQuestions.map((item, index) => (
                <details key={item.question} className="contracte-question" open={index === 0}>
                  <summary>
                    <span>{item.question}</span>
                    <ArrowRight className="h-4 w-4" />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="ai-calls-final-cta contracte-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <ClipboardCheck className="h-4 w-4 text-amber-300" />
                Contracte care inchid bucla de vanzare
              </div>
              <h2>Arata agentiei cum documentele pot ramane in acelasi sistem cu tranzactia.</h2>
              <p>
                Demo-ul pune in fata echipei un flux clar: template-uri, completare din CRM, editare, import Word,
                export PDF si control managerial intr-un singur workspace.
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
