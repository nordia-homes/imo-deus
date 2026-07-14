import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  FileText,
  Globe2,
  Layers3,
  MapPinned,
  Megaphone,
  Play,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Portaluri Online pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Publica automat proprietatile pe Storia, Imobiliare.ro, OLX si Publi24.ro direct din CRM-ul ImoDeus.ai.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const portalPartners = [
  { name: "Storia", logo: "/storia-official-logo.svg", width: 109, height: 30 },
  { name: "Imobiliare.ro", logo: "/imobiliare-logo.svg", width: 148, height: 18 },
  { name: "OLX", logo: "/olx-logo.svg", width: 92, height: 34 },
  { name: "Publi24.ro", logo: "/publi24-logo.svg", width: 142, height: 26 },
];

const heroMetrics = [
  { value: "4", label: "portaluri conectate" },
  { value: "Go", label: "publicare din CRM" },
  { value: "1 sursa", label: "date fara duplicate" },
];

const publishingFlow: FeatureItem[] = [
  {
    icon: Building2,
    title: "Alegi proprietatea",
    text: "Pornesti din fisa reala: galerie, pret, zona, agent si status comercial deja sunt acolo.",
  },
  {
    icon: FileText,
    title: "Verifici continutul",
    text: "Datele care pleaca spre portaluri raman coerente cu portofoliul si website-ul agentiei.",
  },
  {
    icon: RadioTower,
    title: "Publici pe canale",
    text: "Storia, Imobiliare.ro, OLX si Publi24.ro devin canale activate din acelasi workspace.",
  },
  {
    icon: BarChart3,
    title: "Urmaresti statusul",
    text: "Echipa vede rapid ce este publicat, ce trebuie actualizat si unde merita insistat.",
  },
];

const conversionReasons = [
  "Elimini copierea manuala intre CRM si portaluri.",
  "Pastrezi pretul, imaginile si descrierea intr-o singura sursa de adevar.",
  "Agentii vad unde este promovata fiecare proprietate fara sa caute in sisteme separate.",
  "Publicarea devine un argument clar de vanzare in fata proprietarului.",
];

const controlCards: FeatureItem[] = [
  {
    icon: Globe2,
    title: "Portaluri sincronizate",
    text: "Canalele importante sunt prezentate langa proprietate, cu status si actiuni usor de citit.",
  },
  {
    icon: MapPinned,
    title: "Harta si website public",
    text: "Distributia nu se opreste la portaluri: proprietatea ramane conectata si la prezenta publica a agentiei.",
  },
  {
    icon: ShieldCheck,
    title: "Control operational",
    text: "Managementul vede ce pleaca live, iar agentii lucreaza cu aceleasi date, fara exporturi paralele.",
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

export default function PortaluriOnlineLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page portal-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/portaluri-online" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="ai-calls-hero portal-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(650px,1.14fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill">
                <RadioTower className="h-4 w-4 text-emerald-300" />
                Modul premium pentru publicare automata
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.45rem]">
                Proprietatile tale apar pe portaluri fara munca duplicata.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai conecteaza fisa proprietatii cu portalurile online, website-ul public si harta, astfel
                incat promovarea pleaca din acelasi sistem operational.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi publicarea" />
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

            <div className="ai-calls-hero__visual portal-hero__visual" aria-label="Previzualizare Portaluri Online">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front" />
              <ScreenFrame
                image="/landing/screenshots/map-publishing.png"
                alt="Publicare proprietate in portaluri si promovare conectata cu harta"
                label="ImoDeus.ai CRM / Portaluri Online"
                priority
                className="ai-calls-screen--hero portal-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/property-detail-overview.png"
                alt="Fisa proprietatii folosita ca sursa pentru publicare"
                label="Sursa proprietatii"
                className="portal-mini-screen"
              />
              <div className="portal-logo-stack" aria-label="Portaluri conectate">
                {portalPartners.map((partner) => (
                  <div key={partner.name} className="portal-logo-pill">
                    <span>Publicare Automata</span>
                    <Image
                      src={partner.logo}
                      alt={partner.name}
                      width={partner.width}
                      height={partner.height}
                      className="portal-logo-pill__image"
                    />
                  </div>
                ))}
              </div>
              <div className="ai-calls-floating ai-calls-floating--top portal-floating">
                <BadgeCheck className="h-4 w-4" />
                <span>date din CRM</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--left portal-floating">
                <Globe2 className="h-4 w-4" />
                <span>website live</span>
              </div>
              <div className="ai-calls-floating ai-calls-floating--right portal-floating">
                <Megaphone className="h-4 w-4" />
                <span>promovare activa</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section portal-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Distributie fara frictiune
              </div>
              <h2>Din portofoliu direct in piata, fara exporturi si copiere manuala.</h2>
              <p>
                Modulul Portaluri Online transforma publicarea intr-un flux controlat: proprietatea ramane sursa,
                portalurile devin canale, iar echipa vede rapid ce este live.
              </p>
            </div>

            <div className="portal-partner-grid">
              {portalPartners.map((partner) => (
                <article key={partner.name} className="portal-partner-card">
                  <span>Canal conectat</span>
                  <Image src={partner.logo} alt={partner.name} width={partner.width} height={partner.height} />
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {publishingFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card portal-flow-card">
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

        <section className="ai-calls-control portal-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media portal-control__media">
              <ScreenFrame
                image="/landing/screenshots/map-publishing.png"
                alt="Zona de distributie cu portaluri, harta si promovare"
                label="ImoDeus.ai CRM / Distributie"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted">
                <RadioTower className="h-4 w-4 text-cyan-300" />
                Portaluri conectate la proprietate
              </div>
              <h2>Publicarea devine parte din operare, nu o etapa separata.</h2>
              <p>
                Agentia nu mai gestioneaza aceeasi proprietate in mai multe locuri. Continutul, pretul, statusul si
                canalele de promovare raman legate de aceeasi fisa.
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

        <section className="ai-calls-command portal-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel portal-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Layers3 className="h-4 w-4 text-emerald-300" />
                  Control de distributie
                </div>
                <h2>Un singur loc pentru toate canalele care aduc vizibilitate.</h2>
                <p>
                  Portalurile online, website-ul public, harta si promovarea pot fi prezentate clientului ca un sistem
                  conectat, cu date clare si actiuni rapide.
                </p>
              </div>
              <div className="ai-calls-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card portal-control-card">
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

        <section className="ai-calls-final-cta portal-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill">
                <Megaphone className="h-4 w-4 text-emerald-300" />
                Publicare care convinge proprietarul
              </div>
              <h2>Arata proprietarului ca promovarea nu depinde de fisiere, ci de un sistem premium.</h2>
              <p>
                In demo, agentia poate prezenta imediat cum proprietatea ajunge din CRM catre portaluri, website si
                actiuni de promovare conectate.
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
