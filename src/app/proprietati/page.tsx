import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck2,
  Camera,
  FileText,
  Layers3,
  LineChart,
  MapPinned,
  Megaphone,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Modul Proprietati pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Administreaza portofoliul, proprietarii, media, preturile, vizionarile si publicarea intr-un singur hub operational.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "360", label: "vedere pe proprietate" },
  { value: "Live", label: "status comercial" },
  { value: "1 hub", label: "media, pret, vizionari" },
];

const operatingFlow: FeatureItem[] = [
  {
    icon: Layers3,
    title: "Portofoliu ordonat",
    text: "Stoc activ, status, pret, imagini si agent responsabil intr-o vedere usor de scanat.",
  },
  {
    icon: Camera,
    title: "Media si pret in context",
    text: "Galeria, evaluarea, pretul si promovarea stau pe aceeasi fisa, nu prin tab-uri rupte.",
  },
  {
    icon: CalendarCheck2,
    title: "Vizionari conectate",
    text: "Urmatorul pas comercial ramane legat de proprietate, agent si cumparator.",
  },
  {
    icon: Megaphone,
    title: "Publicare pregatita",
    text: "Cand proprietatea este gata, distributia pleaca din acelasi sistem operational.",
  },
];

const conversionReasons = [
  "Agentii gasesc instant proprietatile care cer actiune.",
  "Managementul vede statusul comercial fara raportari manuale.",
  "Proprietarul, media, vizionarile si pretul raman in acelasi context.",
  "Echipa poate trece mai rapid de la administrare la vanzare.",
];

const controlCards: FeatureItem[] = [
  {
    icon: ShieldCheck,
    title: "Control comercial",
    text: "Statusuri, agent dedicat, proprietar si urmatoarele actiuni raman vizibile pentru toata echipa.",
  },
  {
    icon: MapPinned,
    title: "Context complet",
    text: "Zona, caracteristici, galerie, pret si istoric sunt citibile dintr-un singur loc.",
  },
  {
    icon: FileText,
    title: "Documente si operare",
    text: "Contracte, rapoarte, vizionari si publicare se leaga natural de fisa proprietatii.",
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

export default function PropertiesLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page properties-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/proprietati" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="ai-calls-hero properties-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(650px,1.14fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <Building2 className="h-4 w-4 text-emerald-300" />
                Modul premium pentru administrarea proprietatilor
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.45rem]">
                Proprietatile devin centrul de comanda al fiecarei vanzari.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai strange galeria, pretul, proprietarul, agentul, vizionarile si actiunile de promovare
                intr-o fisa vie, construita pentru ritm comercial.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi proprietatile" />
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

            <div className="ai-calls-hero__visual properties-hero__visual" aria-label="Previzualizare modul Proprietati">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/property-detail-overview.png"
                alt="Fisa proprietatii cu galerie, pret, agent si vizionari"
                label="ImoDeus.ai CRM / Proprietati"
                priority
                className="ai-calls-screen--hero properties-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/properties-list.png"
                alt="Lista de proprietati administrate in portofoliu"
                label="Portofoliu"
                className="properties-mini-screen"
              />
              <div className="ai-calls-floating ai-calls-floating--top properties-floating">
                <BadgeCheck className="h-4 w-4" />
                <span>stoc activ</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left properties-floating">
                <Camera className="h-4 w-4" />
                <span>media si pret</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right properties-floating">
                <CalendarCheck2 className="h-4 w-4" />
                <span>vizionari live</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section properties-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Portofoliu actionabil
              </div>
              <h2>Nu doar inventar. Un sistem care spune ce trebuie facut mai departe.</h2>
              <p>
                Modulul Proprietati transforma administrarea portofoliului intr-un flux comercial: stoc, status,
                proprietar, media, vizionari, rapoarte si publicare.
              </p>
            </div>

            <div className="ai-calls-flow-grid">
              {operatingFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card properties-flow-card">
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

        <section className="ai-calls-control properties-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media">
              <ScreenFrame
                image="/landing/screenshots/properties-list.png"
                alt="Portofoliu de proprietati cu filtre si actiuni rapide"
                label="ImoDeus.ai CRM / Portofoliu"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <LineChart className="h-4 w-4 text-cyan-300" />
                Pipeline de proprietati
              </div>
              <h2>Lista devine un panou de prioritizare, nu un tabel static.</h2>
              <p>
                Fiecare proprietate arata repede ce este activ, ce merita promovat, unde exista interes si cine
                trebuie sa faca urmatorul pas.
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

        <section className="ai-calls-command properties-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel properties-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <BarChart3 className="h-4 w-4 text-emerald-300" />
                  Operating room pentru fiecare proprietate
                </div>
                <h2>Tot ce misca vanzarea ramane legat de aceeasi fisa.</h2>
                <p>
                  Agentul nu mai sare intre fisiere, conversatii si platforme. Proprietatea devine locul unde se
                  decide pretul, se pregateste promovarea si se urmareste progresul.
                </p>
              </div>
              <div className="ai-calls-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card properties-control-card">
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

        <section className="ai-calls-final-cta properties-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <Users className="h-4 w-4 text-emerald-300" />
                Administrare care vinde
              </div>
              <h2>Arata clientului cum portofoliul poate functiona ca un sistem premium de vanzare.</h2>
              <p>
                Pagina demo pune in fata agentiei un flux clar: proprietate, media, pret, agent, vizionari,
                publicare si raportare in acelasi workspace.
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
