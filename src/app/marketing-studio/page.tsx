import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Megaphone,
  MousePointerClick,
  Palette,
  Play,
  RadioTower,
  Send,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

export const metadata: Metadata = {
  title: "Marketing Studio pentru agentii imobiliare | ImoDeus.ai",
  description:
    "Creeaza videoclipuri, gestioneaza continut media si publica reclame Meta pentru proprietati direct din ImoDeus.ai.",
};

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroMetrics = [
  { value: "AI", label: "video editor" },
  { value: "Meta", label: "campanii conectate" },
  { value: "Go", label: "publicare rapida" },
];

const studioSignals = [
  { value: "Media", label: "foto si video intr-un loc" },
  { value: "Storyboard", label: "ordine, ritm si hook" },
  { value: "Ads", label: "campanii pregatite pentru proprietati" },
];

const studioFlow: FeatureItem[] = [
  {
    icon: ImageIcon,
    title: "Strangi materialele",
    text: "Fotografiile, camerele si detaliile proprietatii intra intr-un flux creativ pregatit pentru continut.",
  },
  {
    icon: Sparkles,
    title: "AI-ul construieste conceptul",
    text: "Hook, storyboard, voce si subtitrare sunt organizate intr-un sistem care scurteaza munca de productie.",
  },
  {
    icon: Film,
    title: "Editezi videoclipul",
    text: "Agentia poate controla ritmul, mesajul si tonul materialului fara sa iasa din CRM.",
  },
  {
    icon: Megaphone,
    title: "Lansezi promovarea",
    text: "Campaniile Meta sunt pregatite pentru proprietati, cu buget, durata, status si rezultate vizibile.",
  },
];

const conversionReasons = [
  "Transformi o proprietate intr-un material video vandabil fara brief-uri pierdute.",
  "Pastrezi media, mesajul, reclama si rezultatele in acelasi context operational.",
  "Agentii promoveaza mai repede proprietatile bune, iar managementul vede ce pleaca live.",
  "Proprietarul primeste un argument premium: agentia nu doar listeaza, ci produce si distribuie continut.",
];

const controlCards: FeatureItem[] = [
  {
    icon: Palette,
    title: "Control creativ",
    text: "Brand, ton, voce, hook si subtitrare raman coerente pentru agentia care vrea sa arate premium.",
  },
  {
    icon: RadioTower,
    title: "Distributie conectata",
    text: "Video-ul si reclama nu sunt fisiere izolate: sunt legate de proprietate, campanie si canal.",
  },
  {
    icon: BarChart3,
    title: "Performanta vizibila",
    text: "Spend, lead-uri, click-uri si cost per lead ajung intr-un dashboard pe care echipa il poate actiona.",
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

export default function MarketingStudioLandingPage() {
  return (
    <>
      <main className="lux-shell ai-calls-page marketing-studio-page min-h-screen overflow-x-clip bg-[#06101d] text-white">
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
              <Link href="/marketing-studio" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="ai-calls-hero marketing-studio-hero">
          <div className="ai-calls-hero__grid" />
          <div className="ai-calls-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(650px,1.14fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-hero__copy">
              <div className="lux-pill marketing-studio-pill">
                <Clapperboard className="h-4 w-4 text-pink-200" />
                Modul premium pentru continut si reclame
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.35rem]">
                Marketing Studio transforma proprietatile in continut care vinde.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Creezi videoclipuri cu AI, controlezi hook-ul, vocea si subtitrarea, apoi pregatesti campanii Meta
                conectate la proprietati si rezultate.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Vezi studio-ul" />
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

            <div className="ai-calls-hero__visual marketing-studio-hero__visual" aria-label="Previzualizare Marketing Studio">
              <div className="ai-calls-visual-plane ai-calls-visual-plane--back" />
              <div className="ai-calls-visual-plane ai-calls-visual-plane--front marketing-studio-plane" />
              <ScreenFrame
                image="/landing/screenshots/premium-tiktok-studio.png"
                alt="TikTok Studio cu AI Video Editor, storyboard si publicare"
                label="ImoDeus.ai CRM / TikTok Studio"
                priority
                className="marketing-studio-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/premium-meta-advertising.png"
                alt="Meta Advertising cu conexiune Business Manager si campanii pentru proprietati"
                label="Meta Advertising"
                className="marketing-studio-mini-screen"
              />
              <div className="marketing-studio-orbit marketing-studio-orbit--video">
                <Video className="h-4 w-4" />
                <span>AI video</span>
              </div>
              <div className="marketing-studio-orbit marketing-studio-orbit--ads">
                <MousePointerClick className="h-4 w-4" />
                <span>campanii Meta</span>
              </div>
              <div className="marketing-studio-card">
                <span>Studio conectat</span>
                <strong>video + reclame</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-calls-section marketing-studio-flow-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-section__head">
              <div className="lux-light-pill">
                <Sparkles className="h-4 w-4 text-pink-500" />
                Productie creativa, nu haos operational
              </div>
              <h2>De la fotografii la video, de la video la reclame, totul ramane in acelasi sistem.</h2>
              <p>
                Marketing Studio leaga proprietatea, materialele media, conceptul AI si campania Meta intr-un flux
                care ajuta agentia sa arate premium si sa se miste rapid.
              </p>
            </div>

            <div className="marketing-studio-signal-grid">
              {studioSignals.map((signal) => (
                <article key={signal.value} className="marketing-studio-signal-card">
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </article>
              ))}
            </div>

            <div className="ai-calls-flow-grid">
              {studioFlow.map((item, index) => {
                const ItemIcon = item.icon;

                return (
                  <article key={item.title} className="ai-calls-flow-card marketing-studio-flow-card">
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

        <section className="ai-calls-control marketing-studio-control">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.66fr)] lg:items-center lg:px-8 lg:py-20">
            <div className="ai-calls-control__media marketing-studio-control__media">
              <ScreenFrame
                image="/landing/screenshots/premium-tiktok-studio.png"
                alt="Editor AI video pentru proprietati cu pasi de productie"
                label="ImoDeus.ai CRM / AI Video Editor"
              />
            </div>
            <div className="ai-calls-control__copy">
              <div className="lux-pill lux-pill--muted marketing-studio-pill">
                <Film className="h-4 w-4 text-pink-200" />
                Video-uri care pleaca din date reale
              </div>
              <h2>Agentia produce continut cu ritm, mesaj si control, fara sa piarda legatura cu proprietatea.</h2>
              <p>
                AI-ul structureaza materialul: media, storyboard, hook, voce, subtitrari si publicare. Agentul ramane
                in control, iar brandul agentiei ramane coerent.
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

        <section className="ai-calls-command marketing-studio-command">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="ai-calls-command__panel marketing-studio-command__panel">
              <div className="ai-calls-command__copy">
                <div className="lux-pill lux-pill--mini">
                  <Megaphone className="h-4 w-4 text-emerald-300" />
                  Reclame Meta conectate la portofoliu
                </div>
                <h2>Promovarea nu mai incepe intr-un tool separat. Pleaca din CRM, langa proprietate.</h2>
                <p>
                  Campaniile Meta pastreaza contextul comercial: proprietate, buget, durata, status, lead-uri si cost.
                  Echipa vede rapid ce merita accelerat.
                </p>
              </div>
              <div className="marketing-studio-command__media">
                <ScreenFrame
                  image="/landing/screenshots/premium-meta-advertising.png"
                  alt="Promovare Meta pentru proprietati cu status, buget si rezultate"
                  label="ImoDeus.ai CRM / Meta Advertising"
                />
              </div>
              <div className="ai-calls-control-cards marketing-studio-control-cards">
                {controlCards.map((card) => {
                  const CardIcon = card.icon;

                  return (
                    <article key={card.title} className="ai-calls-control-card marketing-studio-control-card">
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

        <section className="ai-calls-final-cta marketing-studio-final-cta">
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-20">
            <div>
              <div className="lux-pill marketing-studio-pill">
                <Target className="h-4 w-4 text-pink-200" />
                Marketing care arata ca un avantaj competitiv
              </div>
              <h2>Arata proprietarilor ca agentia ta creeaza continut, lanseaza reclame si masoara rezultatele.</h2>
              <p>
                Demo-ul pune in fata clientului un studio complet: AI Video Editor, media, storyboard, publicare si
                campanii Meta conectate la proprietati.
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
