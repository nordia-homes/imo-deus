import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, BarChart3, Building2, Check, CircleDot, FileCheck2,
  FileText, Globe2, Inbox, Layers3, MapPinned, MessageSquare,
  MonitorSmartphone, Play, RadioTower, RefreshCw, Search, Send, ShieldCheck,
  Sparkles, Target, UploadCloud, Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Portaluri Online pentru agenții imobiliare | ImoDeus.ai",
  description: "Publicare pe Storia, Imobiliare.ro, OLX și Publi24.ro, statusuri, actualizări și conversații conectate direct la proprietățile din CRM.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: Building2, value: "1 fișă master", label: "datele verificate ale proprietății" },
  { icon: RadioTower, value: "4 portaluri", label: "Storia, Imobiliare.ro, OLX și Publi24.ro" },
  { icon: MessageSquare, value: "Același context", label: "statusuri, actualizări și conversații" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Building2, meta: "FIȘA CARE ALIMENTEAZĂ TOT", title: "Anunțul pornește din proprietate, nu dintr-un formular luat de la zero.", text: "Prețul, suprafețele, dotările, localizarea, fotografiile și agentul responsabil sunt preluate din fișa deja organizată. Echipa verifică informația, fără să o rescrie pentru fiecare canal." },
  { icon: FileCheck2, meta: "CONȚINUT VERIFICAT", title: "Vezi ce pleacă în piață înainte să apeși Publică.", text: "Titlul, descrierea, media și câmpurile comerciale pot fi revizuite într-un singur loc. Astfel, oferta ajunge pe portaluri coerentă, completă și fără versiuni care se contrazic." },
  { icon: UploadCloud, meta: "PUBLICARE MULTI-PORTAL", title: "Alegi canalele. Proprietatea pleacă dintr-un singur flux.", text: "Storia, Imobiliare.ro, OLX și Publi24.ro devin destinații ale aceleiași listări. Agentul nu mai deschide pe rând fiecare platformă ca să reconstruiască același anunț." },
  { icon: RefreshCw, meta: "STATUS & ACTUALIZĂRI", title: "Știi ce este live, ce se procesează și ce cere atenție.", text: "Statusul fiecărui canal rămâne lângă proprietate. Când se schimbă prețul, galeria sau situația comercială, echipa pornește actualizarea din sursa corectă, nu din copii rămase online." },
  { icon: Inbox, meta: "CONVERSAȚII STORIA", title: "Interesul generat de anunț nu mai rămâne izolat în portal.", text: "Mesajele și contextul conversației pot fi urmărite din workspace-ul agenției, astfel încât agentul să răspundă informat și să lege rapid solicitarea de proprietatea promovată." },
  { icon: MapPinned, meta: "WEBSITE & HARTĂ PUBLICĂ", title: "Distribuția continuă și pe canalele deținute de agenție.", text: "Aceeași proprietate poate alimenta prezența publică a agenției și harta ofertelor. Portofoliul, portalurile și website-ul rămân părți ale aceluiași sistem comercial." },
];

const distributionPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: FileCheck2, eyebrow: "PREGĂTEȘTI LISTAREA", title: "Informația este completată o dată și verificată cu ochii pe anunțul final.", text: "Fișa proprietății aduce datele și media, iar agentul controlează titlul, descrierea, prețul și câmpurile care trebuie să ajungă publice.", chips: ["Date proprietate", "Galerie", "Descriere", "Preț"] },
  { icon: RadioTower, eyebrow: "DISTRIBUI PE CANALE", title: "Fiecare portal devine o destinație controlată, nu un proces separat.", text: "Selectezi canalele potrivite, pornești publicarea și urmărești rezultatul pentru Storia, Imobiliare.ro, OLX și Publi24.ro din același loc.", chips: ["Selectare canale", "Publicare", "Status", "Actualizare"] },
  { icon: Inbox, eyebrow: "URMĂREȘTI ȘI RĂSPUNZI", title: "După publicare, echipa vede ce cere atenție și unde apare interesul.", text: "Statusurile, erorile și conversațiile aduc următorul pas lângă proprietate, astfel încât distribuția să rămână activă, corectă și ușor de continuat.", chips: ["Alerte", "Inbox Storia", "Context", "Următorul pas"] },
];

const prioritySignals: IconItem[] = [
  { icon: FileCheck2, title: "Listare incompletă înainte de publicare", text: "Lipsește o informație importantă, o fotografie sau un câmp necesar canalului selectat." },
  { icon: RadioTower, title: "Canal în procesare sau cu status de verificat", text: "Echipa vede portalul care nu a ajuns încă live și poate deschide proprietatea corectă." },
  { icon: RefreshCw, title: "Preț sau galerie schimbată în CRM", text: "Versiunea principală a proprietății s-a modificat și distribuția trebuie adusă la zi controlat." },
  { icon: MessageSquare, title: "Conversație nouă venită din Storia", text: "Agentul găsește mesajul împreună cu proprietatea și informațiile de care are nevoie pentru răspuns." },
];
const workflow: IconItem[] = [
  { icon: Building2, title: "Alegi proprietatea", text: "Pornești din fișa completă, cu datele comerciale, galeria și agentul responsabil deja organizate." },
  { icon: FileCheck2, title: "Verifici anunțul", text: "Revizuiești titlul, descrierea, prețul, media și câmpurile care vor deveni publice." },
  { icon: RadioTower, title: "Selectezi canalele", text: "Alegi portalurile potrivite pentru ofertă, fără să reconstruiești listarea în fiecare platformă." },
  { icon: UploadCloud, title: "Publici și urmărești", text: "Pornești distribuția și vezi separat statusul fiecărui canal direct lângă proprietate." },
  { icon: MessageSquare, title: "Actualizezi și răspunzi", text: "Menții anunțul corect, urmărești interesul și continui conversația cu toate detaliile la îndemână." },
];

const roleCards = [
  { icon: Send, overline: "PENTRU AGENT", title: "Mai puține formulare. Mai mult timp pentru oamenii care răspund la anunț.", text: "Agentul pregătește proprietatea o singură dată, controlează unde este publicată și găsește rapid contextul când apare o întrebare sau o conversație nouă.", bullets: ["publicare pornită din fișa proprietății", "status vizibil pentru fiecare canal", "răspuns informat, fără căutări între platforme"] },
  { icon: BarChart3, overline: "PENTRU MANAGER", title: "Distribuția portofoliului devine vizibilă și ușor de controlat.", text: "Managerul poate înțelege ce proprietăți sunt promovate, ce canale sunt active și unde există blocaje, fără să ceară situații construite manual de fiecare agent.", bullets: ["aceleași reguli pentru întreaga echipă", "listări și statusuri ușor de urmărit", "mai puține anunțuri vechi sau contradictorii"] },
  { icon: Globe2, overline: "PENTRU AGENȚIE", title: "Portalurile, website-ul și harta spun aceeași poveste despre ofertă.", text: "Agenția își păstrează portofoliul coerent pe canalele plătite și pe cele proprii și poate demonstra concret cum duce o proprietate din CRM în piață.", bullets: ["prezență publică legată de portofoliu", "proces de distribuție ușor de prezentat", "serviciu premium, vizibil pentru client"] },
];

const distributionCore: IconItem[] = [
  { icon: Building2, title: "Proprietatea, sursa principală", text: "Adresa, tipul, suprafețele, dotările, prețul și statusul comercial rămân baza întregii distribuții." },
  { icon: MonitorSmartphone, title: "Galeria și ordinea fotografiilor", text: "Media este organizată lângă ofertă și pregătită pentru felul în care proprietatea va fi văzută public." },
  { icon: FileText, title: "Titlul și descrierea anunțului", text: "Mesajul comercial poate fi verificat înainte să fie trimis, fără texte diferite rătăcite prin documente." },
  { icon: Target, title: "Prețul și situația comercială", text: "Valoarea afișată și disponibilitatea rămân conectate la deciziile reale luate în CRM." },
  { icon: RadioTower, title: "Canalele selectate", text: "Storia, Imobiliare.ro, OLX și Publi24.ro sunt gestionate ca destinații ale aceleiași proprietăți." },
  { icon: FileCheck2, title: "Validarea înainte de publicare", text: "Echipa verifică informațiile necesare și corectează ceea ce ar putea bloca sau slăbi listarea." },
  { icon: RefreshCw, title: "Statusul și actualizările", text: "Ce este live, în procesare sau de revizuit rămâne vizibil, iar schimbările pornesc din versiunea corectă." },
  { icon: Inbox, title: "Interesul și conversațiile", text: "Mesajele venite din portal sunt legate de oferta care le-a generat și pot fi continuate cu context." },
];

const connectedFlow = [
  { icon: Building2, label: "Proprietate" }, { icon: MonitorSmartphone, label: "Media" },
  { icon: FileText, label: "Descriere" }, { icon: FileCheck2, label: "Validare" },
  { icon: RadioTower, label: "Storia" }, { icon: Globe2, label: "Imobiliare.ro" },
  { icon: UploadCloud, label: "OLX" }, { icon: Send, label: "Publi24.ro" },
  { icon: RefreshCw, label: "Status" }, { icon: Inbox, label: "Conversații" },
];

const questions = [
  { question: "Pe ce portaluri poate fi publicată o proprietate?", answer: "Modulul este construit pentru distribuția către Storia, Imobiliare.ro, OLX și Publi24.ro. Canalele sunt gestionate din contextul proprietății, astfel încât agentul să nu pregătească separat aceeași ofertă pentru fiecare platformă." },
  { question: "De unde sunt preluate informațiile anunțului?", answer: "Din fișa proprietății din CRM: caracteristici, preț, localizare, galerie, descriere și context comercial. Înainte de publicare, echipa poate verifica informația care urmează să devină publică și poate corecta eventualele lipsuri." },
  { question: "Ce se întâmplă când se schimbă prețul sau fotografiile?", answer: "Modificarea se face în sursa principală, adică în proprietate. De acolo, echipa poate gestiona actualizarea canalelor active fără să caute și să editeze manual copii diferite ale aceluiași anunț." },
  { question: "Vedem dacă un anunț a ajuns live?", answer: "Da. Statusul publicării este urmărit pe canal, astfel încât agentul și managerul să distingă rapid între ceea ce este publicat, în procesare sau are nevoie de verificare. Un blocaj nu mai rămâne ascuns într-un cont separat." },
  { question: "Cum sunt gestionate mesajele venite din Storia?", answer: "Conversațiile pot fi aduse în workspace și păstrate în contextul proprietății care a generat interesul. Agentul vede oferta, datele relevante și mesajul în același flux, ceea ce face răspunsul mai rapid și mai bine informat." },
  { question: "Portalurile sunt singurele canale publice conectate?", answer: "Nu. Proprietatea poate rămâne conectată și la website-ul public și la harta agenției. Astfel, distribuția pe portaluri și prezența proprie a agenției folosesc același portofoliu organizat." },
];

function DemoButton({ className = "", label = "Vezi demo live" }: { className?: string; label?: string }) {
  return <Button asChild size="lg" className={"lux-primary-button h-14 px-6 text-base font-semibold " + className}><Link href="/demo"><Play className="h-4 w-4 fill-current" />{label}</Link></Button>;
}

function ScreenFrame({ image, alt, label, priority = false, className = "" }: { image: string; alt: string; label: string; priority?: boolean; className?: string }) {
  return <div className={"lux-screen property-screen " + className}><div className="lux-screen__bar"><div className="flex items-center gap-1.5" aria-hidden="true"><span className="lux-dot bg-[#fb7185]" /><span className="lux-dot bg-[#fbbf24]" /><span className="lux-dot bg-[#34d399]" /></div><span>{label}</span></div><div className="lux-screen__viewport"><Image src={image} alt={alt} width={1900} height={1015} priority={priority} loading={priority ? "eager" : "lazy"} sizes="(max-width: 767px) 820px, (max-width: 1279px) 92vw, 900px" className="lux-screen__image" /></div></div>;
}

export default function PortaluriOnlineLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase portal-premium-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare"><Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link lux-nav-menu__link--active">Portaluri Online</Link></nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>
        <section className="property-hero portal-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><RadioTower className="h-4 w-4" /> Din portofoliu, direct în piață</div>
              <h1>Publici o singură dată. <span>Controlezi fiecare canal.</span></h1>
              <p className="property-hero__lead">Proprietatea pleacă din CRM către Storia, Imobiliare.ro, OLX și Publi24.ro, iar datele, statusurile, actualizările și conversațiile rămân legate de aceeași fișă.</p>
              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi publicarea" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi întregul flux <ArrowRight className="h-4 w-4" /></Link></Button></div>
              <div className="property-hero__context" aria-label="Canale conectate"><span><Check className="h-3.5 w-3.5" /> Storia</span><span><Check className="h-3.5 w-3.5" /> Imobiliare.ro</span><span><Check className="h-3.5 w-3.5" /> OLX & Publi24.ro</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare Portaluri Online">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Distribution control live</span><span>4 canale conectate</span></div>
              <ScreenFrame image="/landing/screenshots/map-publishing.png" alt="Publicarea proprietății pe portaluri și hartă" label="ImoDeus.ai CRM / Portaluri Online" priority className="property-hero__screen portal-premium-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail portal-premium-connection-rail" aria-label="Întregul traseu al publicării este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview portal-premium-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered">
              <div>
                <div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Distribuția, conectată la proprietate</div>
                <h2 className="property-feature-title portal-premium-feature-title">
                  <span className="property-feature-title__item property-feature-title__item--photo">„O singură fișă verificată</span><span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--copy">publicare pe Storia, Imobiliare.ro, OLX și Publi24.ro</span><span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--portals">status pe fiecare canal</span><span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--video">actualizări controlate</span><span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--social">conversații Storia</span><span className="property-feature-title__separator">, </span>
                  <span className="property-feature-title__item property-feature-title__item--matching">website și hartă publică</span><span className="property-feature-title__separator"> și </span>
                  <span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
                </h2>
              </div>
            </div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy portal-premium-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head">
              <div className="property-eyebrow property-eyebrow--dark"><RadioTower className="h-4 w-4" /> Anatomia unei listări bine distribuite</div>
              <h2 className="property-anatomy__title"><span>Tot ce pleacă spre </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">portaluri</span><span> rămâne legat de </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">proprietatea corectă.</span></h2>
              <p>Nu este doar un export. Este centrul din care informația este pregătită, verificată, distribuită, urmărită și continuată până la conversația cu potențialul cumpărător.</p>
              <div className="property-anatomy__chips"><span><FileCheck2 className="h-3.5 w-3.5" /> Listare verificată</span><span><RadioTower className="h-3.5 w-3.5" /> 4 portaluri</span><span><RefreshCw className="h-3.5 w-3.5" /> Statusuri</span><span><Inbox className="h-3.5 w-3.5" /> Conversații</span></div>
            </div>            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{distributionCore.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual portal-premium-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" />
                <div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Distribution control core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><RadioTower className="h-4 w-4" /></span><span><small>DISTRIBUȚIE</small><strong>4 portaluri conectate</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><Inbox className="h-4 w-4" /></span><span><small>INTERES</small><strong>Conversație în context</strong></span></div>
                <ScreenFrame image="/landing/screenshots/map-publishing.png" alt="Controlul publicării proprietății pe portaluri" label="ImoDeus.ai / Distribution workspace" className="property-anatomy__screen portal-premium-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> sursă verificată</span><span><Globe2 className="h-4 w-4" /> distribuție la vedere</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{distributionCore.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation portal-premium-engine">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei motoare, aceeași proprietate</div><h2>Pregătești listarea. Distribui pe canale. Urmărești și răspunzi.</h2></div><p>Portaluri Online transformă promovarea într-un flux operațional coerent, în care oferta nu își pierde datele și echipa nu își pierde următorul pas.</p></div>
            <div className="property-automation__grid">{distributionPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority portal-premium-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Distribuția îți arată ce cere atenție</div><h2>Nu vezi doar unde ai publicat. Vezi ce trebuie completat, actualizat sau continuat.</h2></div><p>O listare incompletă, un canal în procesare, o schimbare de preț sau o conversație nouă ies singure în față, lângă proprietatea potrivită.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după proprietate, portal, status sau conversație</span><span><CircleDot className="h-3.5 w-3.5" /> Inbox conectat</span></div><ScreenFrame image="/landing/screenshots/premium-storia-inbox.png" alt="Conversații Storia conectate la proprietățile din CRM" label="ImoDeus.ai CRM / Storia Inbox" className="property-priority__screen portal-premium-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale Portaluri Online"><div className="property-priority__signals-head"><div><span>CE MERITĂ REZOLVAT ACUM</span><strong>Distribuția îți arată singură</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>
        <section className="property-workflow portal-premium-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge o proprietate din portofoliu pe portaluri și apoi în conversație.</h2><p>Pregătirea, distribuția, statusul și interesul primit formează un singur traseu pe care agentul îl poate urmări fără să schimbe sistemul.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puțină muncă duplicată, anunțuri mai coerente, statusuri vizibile și un răspuns mai rapid atunci când publicarea generează interes real.</span></div>
          </div>
        </section>

        <section className="property-roles portal-premium-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> Viteză pentru agent, control pentru agenție</div><h2>Agentul publică mai ușor. Managerul vede distribuția. Agenția își păstrează oferta coerentă.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq portal-premium-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără promisiuni vagi</div><h2>Întrebările pe care ni le pun agențiile despre Portaluri Online.</h2><p>Răspunsuri concrete despre canalele conectate, sursa datelor, publicare, actualizări, statusuri, conversații și website-ul agenției.</p><DemoButton className="mt-7" label="Vezi Portaluri Online în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>

        <section className="property-final portal-premium-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe portofoliul tău</div><h2>O proprietate nu ar trebui introdusă de patru ori ca să fie văzută peste tot.</h2><p>În demo vezi cum pornești din fișa proprietății, pregătești anunțul, alegi portalurile și urmărești distribuția și conversațiile din același sistem.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}