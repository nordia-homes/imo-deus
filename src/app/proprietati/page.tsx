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
  Check,
  CircleDot,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  LineChart,
  MapPinned,
  Megaphone,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Administrare proprietăți pentru agenții imobiliare | ImoDeus.ai",
  description:
    "Tot ce trebuie să știe echipa despre o proprietate: proprietar, ofertă, media, preț, publicare, vizionări, feedback, documente și următorul pas.",
};

type IconItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroSignals = [
  { icon: BadgeCheck, value: "Răspuns imediat", label: "agentul are toate detaliile" },
  { icon: UploadCloud, value: "Publicată", label: "pe portalurile agenției" },
  { icon: Target, value: "Potriviri găsite", label: "cumpărători existenți în CRM" },
];

const capabilities: (IconItem & { meta: string })[] = [
  {
    icon: Camera,
    meta: "EDITARE FOTO & VIDEO AI",
    title: "Fotografii mai bune. Video gata de promovare.",
    text: "Corectezi și pui în valoare fotografiile cu ajutorul AI, apoi transformi galeria proprietății într-un video pregătit pentru promovare.",
  },
  {
    icon: UploadCloud,
    meta: "DESCRIERE & PORTALURI",
    title: "Din câteva detalii, direct într-un anunț publicat.",
    text: "ImoDeus generează descrierea, tu o verifici, iar proprietatea pleacă spre portalurile agenției fără să rescrii aceleași informații.",
  },
  {
    icon: Megaphone,
    meta: "META & TIKTOK",
    title: "Proprietatea intră în feed, nu într-un alt proces.",
    text: "Folosești fotografiile, video-ul și datele deja pregătite pentru promovare automată pe Meta și TikTok, direct din aceeași fișă.",
  },
  {
    icon: Target,
    meta: "AI MATCHING",
    title: "Cumpărătorii potriviți nu mai depind de memorie.",
    text: "AI Matching compară proprietatea cu cerințele contactelor existente și arată agentului cine se potrivește și de ce merită contactat.",
  },
  {
    icon: CalendarCheck2,
    meta: "ADMINISTRARE VIZIONĂRI",
    title: "Vizionările nu mai stau în calendare și chat-uri separate.",
    text: "Programezi întâlnirile, vezi participanții, păstrezi confirmările și notezi feedbackul, totul legat de proprietatea vizionată.",
  },
  {
    icon: BarChart3,
    meta: "PDF & ANALIZĂ DE PIAȚĂ",
    title: "Prezentarea și analiza sunt gata când începe conversația.",
    text: "Generezi o prezentare PDF profesionistă și o analiză de piață clară, folosind datele și media deja validate în proprietate.",
  },
];
const automationPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  {
    icon: UploadCloud,
    eyebrow: "DISTRIBUȚIE AUTOMATĂ",
    title: "Pe portaluri, fără să introduci aceeași proprietate de patru ori.",
    text: "Păstrezi o singură versiune corectă a ofertei, alegi canalele și urmărești de unde este publicată. Dacă actualizezi informația, echipa știe exact care este versiunea bună.",
    chips: ["Imobiliare.ro", "Storia", "OLX", "Publi24"],
  },
  {
    icon: Megaphone,
    eyebrow: "PROMOVARE AUTOMATĂ",
    title: "Din portofoliu, direct în campaniile Meta și TikTok.",
    text: "Folosești media și datele proprietății pentru a pregăti promovarea socială fără exporturi, foldere intermediare și briefuri reconstruite manual.",
    chips: ["Meta Ads", "Facebook", "Instagram", "TikTok"],
  },
  {
    icon: Target,
    eyebrow: "POTRIVIRE AUTOMATĂ",
    title: "În fața cumpărătorilor care caută deja ceva asemănător.",
    text: "Noul stoc este comparat cu cerințele cumpărătorilor din aplicație. Agentul vede rapid cine se potrivește, de ce și cu cine merită să înceapă discuția.",
    chips: ["Cumpărători din CRM", "Scor de potrivire", "Alertă pentru agent"],
  },
];

const prioritySignals: IconItem[] = [
  {
    icon: Target,
    title: "Cumpărător compatibil nou",
    text: "Criteriile lui se potrivesc. Agentul poate porni conversația acum.",
  },
  {
    icon: CalendarCheck2,
    title: "Vizionare de confirmat",
    text: "Ora, participanții și toate detaliile sunt deja în calendar.",
  },
  {
    icon: TrendingUp,
    title: "Ofertă care așteaptă răspuns",
    text: "Suma, condițiile și următorul pas sunt vizibile pentru echipă.",
  },
  {
    icon: Megaphone,
    title: "Anunț care merită optimizat",
    text: "Interesul din piață și feedbackul arată unde trebuie intervenit.",
  },
];

const workflow = [
  {
    icon: Building2,
    title: "Pregătești proprietatea",
    text: "Completezi caracteristicile, prețul, disponibilitatea, media și documentele până când fișa este gata de lucru.",
  },
  {
    icon: UploadCloud,
    title: "O trimiți în piață",
    text: "Publici pe portaluri și pregătești promovarea Meta și TikTok din aceeași sursă de informație.",
  },
  {
    icon: Target,
    title: "Găsești cumpărătorii",
    text: "AI Matching verifică baza existentă, iar agentul răspunde apelurilor având toate detaliile în față.",
  },
  {
    icon: CalendarCheck2,
    title: "Gestionezi interesul",
    text: "Organizezi vizionări, notezi feedbackul, urmărești cumpărătorii și păstrezi ofertele în același istoric.",
  },
  {
    icon: FileText,
    title: "Închizi profesionist",
    text: "Pregătești contractele, prezentările PDF și rapoartele de piață folosind datele deja validate în sistem.",
  },
];

const roleCards = [
  {
    icon: MapPinned,
    overline: "PENTRU AGENT",
    title: "Orice apel începe cu răspunsul în față.",
    text: "Când sună un cumpărător, agentul deschide proprietatea și poate răspunde imediat la întrebările despre preț, suprafețe, dotări, disponibilitate, vizionări sau documente. Apoi programează pasul următor fără să schimbe aplicația.",
    bullets: [
      "toate detaliile în timpul apelului",
      "potriviri și cumpărători la vedere",
      "vizionări, feedback și oferte organizate",
    ],
  },
  {
    icon: Building2,
    overline: "PENTRU MANAGER",
    title: "Vezi portofoliul ca pe un motor comercial.",
    text: "Nu doar câte proprietăți sunt active, ci unde sunt publicate, ce interes primesc, ce vizionări urmează, ce oferte există și unde echipa are nevoie de o decizie.",
    bullets: [
      "status de publicare și promovare",
      "activitate și interes pe proprietate",
      "ofertare și progres spre tranzacție",
    ],
  },
  {
    icon: Megaphone,
    overline: "PENTRU MARKETING & OPERARE",
    title: "Primești proprietatea gata de distribuit și documentat.",
    text: "Media, descrierea și datele verificate alimentează portalurile, campaniile Meta/TikTok, prezentările PDF, contractele și rapoartele fără muncă repetată.",
    bullets: [
      "portaluri dintr-o singură listare",
      "promovare socială din aceeași fișă",
      "PDF-uri, contracte și rapoarte mai rapide",
    ],
  },
];

const propertyAnatomy: IconItem[] = [
  {
    icon: MapPinned,
    title: "Fișa completă a proprietății",
    text: "Adresă, suprafețe, compartimentare, dotări, preț, disponibilitate, galerie și documente — pregătite pentru lucru și pentru răspunsuri rapide.",
  },
  {
    icon: UploadCloud,
    title: "Publicare automată pe portaluri",
    text: "O singură versiune a anunțului, distribuită către portalurile folosite de agenție și urmărită direct din aplicație.",
  },
  {
    icon: Megaphone,
    title: "Promovare automată pe Meta și TikTok",
    text: "Conținutul proprietății devine punctul de plecare pentru campanii și materiale sociale, fără un proces separat.",
  },
  {
    icon: Target,
    title: "Potrivire automată cu baza de cumpărători",
    text: "Proprietatea este comparată cu bugetele, zonele și criteriile contactelor deja existente în CRM.",
  },
  {
    icon: Search,
    title: "Apeluri și discuții cu cumpărătorii",
    text: "Agentul are imediat toate detaliile, istoricul interesului și răspunsurile de care are nevoie în conversație.",
  },
  {
    icon: CalendarCheck2,
    title: "Vizionări, feedback și oferte",
    text: "Programări, participanți, impresii, obiecții, sume și condiții păstrate într-un fir comercial ușor de urmărit.",
  },
  {
    icon: FileText,
    title: "Contracte organizate și redactate mai rapid",
    text: "Datele proprietății și ale părților pot alimenta documentele, păstrând dosarul tranzacției ordonat și coerent.",
  },
  {
    icon: BarChart3,
    title: "Prezentări PDF și rapoarte de piață",
    text: "Generezi materiale pentru cumpărători, prezentări profesionale și argumente de piață din informația deja validată.",
  },
];

const connectedFlow = [
  { icon: Building2, label: "Proprietate" },
  { icon: UploadCloud, label: "Portaluri" },
  { icon: Megaphone, label: "Meta Ads" },
  { icon: Camera, label: "TikTok" },
  { icon: Target, label: "AI Matching" },
  { icon: Users, label: "Cumpărători" },
  { icon: CalendarCheck2, label: "Vizionări" },
  { icon: TrendingUp, label: "Oferte" },
  { icon: FileText, label: "Contract" },
  { icon: BarChart3, label: "Raport" },
];

const questions = [
  {
    question: "Ce vede agentul atunci când sună un cumpărător?",
    answer:
      "Poate deschide imediat proprietatea și vede prețul, disponibilitatea, adresa și zona, suprafețele, compartimentarea, dotările, galeria, documentele, statusul publicării și istoricul de interes. Din aceeași zonă poate continua discuția spre potrivire sau vizionare.",
  },
  {
    question: "Cum funcționează publicarea automată pe portaluri?",
    answer:
      "Echipa pregătește și verifică o singură fișă de proprietate, apoi o distribuie către portalurile configurate pentru agenție. Astfel nu mai introduce aceleași date pe fiecare platformă și poate urmări mai clar unde este activ anunțul.",
  },
  {
    question: "Ce înseamnă promovare automată pe Meta și TikTok?",
    answer:
      "Datele, imaginile și prezentarea proprietății pot fi folosite direct în fluxurile de promovare pentru Meta și TikTok. Echipa pornește de la o ofertă completă, fără să refacă manual brief-ul și fără să caute materialele în alte foldere.",
  },
  {
    question: "Cum sunt găsiți cumpărătorii potriviți?",
    answer:
      "AI Matching compară proprietatea cu cerințele cumpărătorilor deja existenți în aplicație — buget, zonă, tip, camere, suprafață și alte criterii — și arată agentului contactele cu cea mai bună potrivire.",
  },
  {
    question: "Ce se întâmplă după o vizionare sau după primirea unei oferte?",
    answer:
      "Vizionarea, cumpărătorul și proprietatea rămân legate. Agentul notează feedbackul și obiecțiile, înregistrează oferta și condițiile ei și vede clar dacă urmează un follow-up, o negociere, o nouă vizionare sau pregătirea contractului.",
  },
  {
    question: "Cum ajută la contracte, PDF-uri și rapoarte de piață?",
    answer:
      "Informația deja introdusă în proprietate poate fi reutilizată pentru redactarea și organizarea contractelor, generarea prezentărilor PDF și realizarea rapoartelor de piață. Rezultatul este mai rapid, mai coerent și cu mai puține date copiate manual.",
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
    <div className={`lux-screen property-screen ${className}`}>
      <div className="lux-screen__bar">
        <div className="flex items-center gap-1.5" aria-hidden="true">
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
          sizes="(max-width: 767px) 820px, (max-width: 1279px) 92vw, 900px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function PropertiesLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase properties-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai">
              <ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" />
            </Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link>
              <Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link>
              <Link href="/proprietati" className="lux-nav-menu__link lux-nav-menu__link--active">Proprietăți</Link>
              <Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link>
              <Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link>
              <Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link>
              <Link href="/contracte" className="lux-nav-menu__link">Contracte</Link>
              <Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link>
              <Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
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
                <Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <DemoButton className="h-9 px-4 text-sm" label="Demo live" />
            </div>
          </div>
        </header>

        <section className="property-hero">
          <div className="property-hero__grid" />
          <div className="property-hero__orb property-hero__orb--one" />
          <div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark">
                <Sparkles className="h-4 w-4" /> De la listare la contract, fără rupturi
              </div>
              <h1>Când știi tot, <span>vinzi mai bine.</span></h1>
              <p className="property-hero__lead">
                Când sună un cumpărător, agentul are răspunsurile în față. Din aceeași fișă, proprietatea merge pe
                portaluri, în campanii Meta și TikTok, către cumpărătorii potriviți și mai departe spre vizionare,
                ofertă, contract și raportare.
              </p>
              <div className="property-hero__actions">
                <DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" />
                <Button asChild size="lg" variant="outline" className="property-hero__secondary">
                  <Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="property-hero__context" aria-label="Informații conectate în modul">
                <span><Check className="h-3.5 w-3.5" /> Administrare completă</span>
                <span><Check className="h-3.5 w-3.5" /> Distribuție automată</span>
                <span><Check className="h-3.5 w-3.5" /> Traseu comercial clar</span>
              </div>
            </div>

            <div className="property-hero__stage" aria-label="Previzualizare fișă de proprietate">
              <div className="property-hero__stage-glow" />
              <div className="property-hero__stage-label">
                <span><CircleDot className="h-3.5 w-3.5" /> Portofoliu live</span>
                <span>actualizat acum</span>
              </div>
              <ScreenFrame
                image="/landing/screenshots/property-detail-overview.png"
                alt="Fișa unei proprietăți cu galerie, preț, agent și vizionări"
                label="ImoDeus.ai CRM / Proprietate"
                priority
                className="property-hero__screen"
              />
              <div className="property-hero__signals">
                {heroSignals.map((signal) => {
                  const SignalIcon = signal.icon;
                  return (
                    <div key={signal.label} className="property-hero__signal">
                      <span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span>
                      <span><strong>{signal.value}</strong><small>{signal.label}</small></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail" aria-label="Tot parcursul unei proprietăți este conectat">
          <div className="property-connection-rail__fade property-connection-rail__fade--left" />
          <div className="property-connection-rail__fade property-connection-rail__fade--right" />
          <div className="property-connection-rail__track">
            {[...connectedFlow, ...connectedFlow].map((item, index) => {
              const ItemIcon = item.icon;
              return (
                <div key={`${item.label}-${index}`} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}>
                  <span><ItemIcon className="h-4 w-4" /></span>
                  <strong>{item.label}</strong>
                  <ArrowRight className="h-4 w-4" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="property-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered">
              <div>
                <div className="property-eyebrow"><Gauge className="h-4 w-4" /> Proprietatea, ca motor comercial</div>
                <h2 className="property-feature-title">
                  <span className="property-feature-title__item property-feature-title__item--photo">„Editare AI pentru fotografii</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--copy">descriere generată automat</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--portals">publicare pe portaluri</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--video">generare video din fotografii</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--social">promovare Meta și TikTok</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--matching">AI Matching cu cumpărătorii potriviți</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--viewings">administrare vizionări</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--pdf">prezentare PDF</span>
                  <span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--market">analiză de piață</span>
                  <span className="property-feature-title__separator"> și </span>
                  <span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
                </h2>
              </div>
            </div>

            <div className="property-capability-grid">
              {capabilities.map((item, index) => {
                const ItemIcon = item.icon;
                return (
                  <article key={item.title} className={`property-capability-card property-capability-card--${index + 1}`}>
                    <div className="property-capability-card__top">
                      <span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span>
                      <span className="property-capability-card__meta">{item.meta}</span>
                    </div>
                    <div className="property-capability-card__aura" aria-hidden="true">
                      <span className="property-capability-card__aura-ring" />
                      <span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" />
                      <ItemIcon className="property-capability-card__aura-icon" />
                    </div>
                    <div className="property-capability-card__signal" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="property-anatomy">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head">
              <div className="property-eyebrow property-eyebrow--dark">
                <Building2 className="h-4 w-4" /> Anatomia unei proprietăți bine lucrate
              </div>
              <h2 className="property-anatomy__title">
                <span>Tot ce poate face o </span>
                <span className="property-anatomy__title-accent property-anatomy__title-accent--property">proprietate</span>
                <span>, de pe aceeași </span>
                <span className="property-anatomy__title-accent property-anatomy__title-accent--record">fișă.</span>
              </h2>
              <p>
                Nu este un depozit de date. Este punctul din care oferta intră în piață, întâlnește cumpărătorii,
                adună vizionări și oferte și ajunge, organizat, până la contract, prezentare și raport.
              </p>
              <div className="property-anatomy__chips" aria-label="Capabilități conectate">
                <span><UploadCloud className="h-3.5 w-3.5" /> Portaluri</span>
                <span><Megaphone className="h-3.5 w-3.5" /> Meta & TikTok</span>
                <span><Target className="h-3.5 w-3.5" /> AI Matching</span>
                <span><FileText className="h-3.5 w-3.5" /> Contracte & PDF</span>
              </div>
            </div>

            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">
                {propertyAnatomy.slice(0, 4).map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <article key={item.title} className="property-anatomy__item">
                      <span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span>
                      <div><h3>{item.title}</h3><p>{item.text}</p></div>
                    </article>
                  );
                })}
              </div>

              <div className="property-anatomy__visual">
                <div className="property-anatomy__core-glow" />
                <div className="property-anatomy__orbit property-anatomy__orbit--one" />
                <div className="property-anatomy__orbit property-anatomy__orbit--two" />
                <div className="property-anatomy__visual-badge">
                  <CircleDot className="h-3.5 w-3.5" /> Property intelligence core
                </div>
                <div className="property-anatomy__hud property-anatomy__hud--matching">
                  <span className="property-anatomy__hud-icon"><Target className="h-4 w-4" /></span>
                  <span><small>AI MATCHING</small><strong>Cumpărători compatibili</strong></span>
                </div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution">
                  <span className="property-anatomy__hud-icon"><UploadCloud className="h-4 w-4" /></span>
                  <span><small>DISTRIBUȚIE</small><strong>Portaluri + Social</strong></span>
                </div>
                <ScreenFrame
                  image="/landing/screenshots/property-detail-overview.png"
                  alt="Fișă completă de proprietate cu toate informațiile comerciale"
                  label="ImoDeus.ai / Tot ce știe echipa"
                  className="property-anatomy__screen"
                />
                <div className="property-anatomy__visual-proof">
                  <span><BadgeCheck className="h-4 w-4" /> din fișă până în piață</span>
                  <span><Users className="h-4 w-4" /> toată activitatea la vedere</span>
                </div>
              </div>

              <div className="property-anatomy__column property-anatomy__column--right">
                {propertyAnatomy.slice(4).map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <article key={item.title} className="property-anatomy__item">
                      <span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span>
                      <span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span>
                      <div><h3>{item.title}</h3><p>{item.text}</p></div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="property-automation">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head">
              <div>
                <div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei motoare automate</div>
                <h2>Încarci proprietatea o dată. ImoDeus o pune în mișcare.</h2>
              </div>
              <p>
                Distribuția nu mai este o listă de operațiuni separate. Portalurile, promovarea socială și baza de
                cumpărători pornesc din aceeași proprietate completă și verificată.
              </p>
            </div>
            <div className="property-automation__grid">
              {automationPillars.map((pillar, index) => {
                const PillarIcon = pillar.icon;
                return (
                  <article key={pillar.title} className="property-automation__card">
                    <div className="property-automation__card-top">
                      <span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span>
                      <span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <span className="property-automation__eyebrow">{pillar.eyebrow}</span>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.text}</p>
                    <div className="property-automation__chips">
                      {pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <section className="property-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head">
              <div>
                <div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Dimineața începe cu ce contează</div>
                <h2>Nu vezi doar proprietăți. Vezi ce ai de făcut.</h2>
              </div>
              <p>
                Potrivirea nouă, vizionarea de confirmat, oferta care așteaptă răspuns sau anunțul care trebuie
                optimizat ies singure în față. Agentul știe ce urmează. Managerul vede întregul tablou.
              </p>
            </div>

            <div className="property-priority__cockpit">
              <div className="property-priority__media">
                <div className="property-priority__media-toolbar">
                  <span><Search className="h-3.5 w-3.5" /> Caută după adresă, proprietar sau agent</span>
                  <span><CircleDot className="h-3.5 w-3.5" /> Sincronizat live</span>
                </div>
                <ScreenFrame
                  image="/landing/screenshots/properties-list.png"
                  alt="Portofoliu de proprietăți cu filtre și acțiuni rapide"
                  label="ImoDeus.ai CRM / Portofoliu"
                  className="property-priority__screen"
                />
              </div>

              <aside className="property-priority__signals" aria-label="Semnale operaționale din portofoliu">
                <div className="property-priority__signals-head">
                  <div><span>CE MERITĂ MIȘCAT ASTĂZI</span><strong>Portofoliul îți arată singur</strong></div>
                  <span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span>
                </div>
                <div className="property-priority__signal-list">
                  {prioritySignals.map((signal) => {
                    const SignalIcon = signal.icon;
                    return (
                      <article key={signal.title}>
                        <span><SignalIcon className="h-4 w-4" /></span>
                        <div><h3>{signal.title}</h3><p>{signal.text}</p></div>
                        <ArrowRight className="h-4 w-4" />
                      </article>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="property-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head">
              <div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div>
              <h2>Așa ajunge o proprietate din portofoliu în tranzacție.</h2>
              <p>O singură informație bună alimentează publicarea, promovarea, potrivirea, vizionările, oferta și documentele de final.</p>
            </div>
            <div className="property-workflow__track">
              {workflow.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <article key={step.title} className="property-workflow__step">
                    <span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                );
              })}
            </div>
            <div className="property-workflow__result">
              <ShieldCheck className="h-5 w-5" />
              <span><strong>Ce se schimbă:</strong> răspunsuri mai rapide pentru cumpărători, distribuție fără muncă dublă și un traseu comercial pe care echipa îl poate continua fără goluri.</span>
            </div>
          </div>
        </section>

        <section className="property-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head">
              <div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> O echipă care lucrează din aceeași realitate</div>
              <h2>Fiecare vede exact ce are nevoie. Nimeni nu pierde contextul.</h2>
            </div>
            <div className="property-roles__grid">
              {roleCards.map((role, index) => {
                const RoleIcon = role.icon;
                return (
                  <article key={role.overline} className={`property-role-card property-role-card--${index + 1}`}>
                    <div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div>
                    <span className="property-role-card__overline">{role.overline}</span>
                    <h3>{role.title}</h3>
                    <p>{role.text}</p>
                    <ul>
                      {role.bullets.map((bullet) => (
                        <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="property-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro">
              <div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt</div>
              <h2>Întrebările pe care ni le pun agențiile.</h2>
              <p>Fără răspunsuri de broșură. Doar ce face concret modulul și cum se simte în munca de zi cu zi.</p>
              <DemoButton className="mt-7" label="Vezi modulul în demo" />
            </div>
            <div className="property-faq__list">
              {questions.map((item, index) => (
                <article key={item.question}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{item.question}</h3><p>{item.answer}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="property-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div>
              <div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să o vezi pe datele tale</div>
              <h2>O proprietate bună merită mai mult decât un loc într-un tabel.</h2>
              <p>În demo vezi cum o administrezi, o publici, o promovezi, o potrivești cu cumpărători și o duci până la vizionare, ofertă, contract și raportare.</p>
            </div>
            <div className="property-final__actions">
              <DemoButton className="w-full justify-center" label="Vreau o demonstrație" />
              <Button asChild size="lg" variant="outline" className="property-final__secondary">
                <Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link>
            <Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link>
          </div>
        </div>
      </footer>
    </>
  );
}