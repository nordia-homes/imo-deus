import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, BarChart3, Building2, Check, CircleDot, Clapperboard,
  Clock3, FileText, Film, Gauge, Image as ImageIcon, Layers3, Megaphone,
  Palette, Play, RadioTower, Search, ShieldCheck, Sparkles,
  Target, Users, Video,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Marketing Studio pentru agenții imobiliare | ImoDeus.ai",
  description: "AI Video Editor, storyboard, voce, subtitrări, TikTok Studio și campanii Meta conectate direct la proprietățile din CRM.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: ImageIcon, value: "Media conectată", label: "fotografiile și datele proprietății" },
  { icon: Video, value: "Video construit", label: "hook, storyboard, voce și subtitrări" },
  { icon: Megaphone, value: "Promovare live", label: "TikTok, Meta și rezultate" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Building2, meta: "PROPRIETATE & MEDIA", title: "Studio-ul pornește direct din oferta pe care vrei să o promovezi.", text: "Fotografiile, caracteristicile, prețul și contextul proprietății rămân la îndemână. Nu mai reconstruiești brief-ul și nu mai cauți materialele prin foldere." },
  { icon: Sparkles, meta: "CONCEPT & HOOK AI", title: "Primele secunde primesc un motiv clar să oprească scroll-ul.", text: "AI-ul ajută la structurarea conceptului, a unghiului de prezentare și a hook-ului, folosind avantajele reale ale proprietății și obiectivul materialului." },
  { icon: Film, meta: "STORYBOARD & RITM", title: "Fotografiile devin o poveste, nu un slideshow fără direcție.", text: "Ordinea cadrelor, durata, tranzițiile și mesajul sunt organizate într-un storyboard pe care echipa îl poate înțelege, verifica și ajusta." },
  { icon: Video, meta: "VOCE & SUBTITRĂRI", title: "Video-ul poate fi urmărit cu sunetul pornit sau oprit.", text: "Vocea, textul și subtitrările susțin proprietatea fără să o acopere. Agentul păstrează controlul asupra tonului, mesajului și formei finale." },
  { icon: RadioTower, meta: "TIKTOK STUDIO", title: "Conținutul ajunge în canalul pentru care a fost construit.", text: "Materialul pregătit poate continua în fluxul TikTok Studio, cu proprietatea, media și versiunea creativă păstrate în același context." },
  { icon: Megaphone, meta: "META ADS & REZULTATE", title: "Promovarea nu se termină când reclama pleacă live.", text: "Campania rămâne legată de proprietate, cu buget, durată, status și indicatori precum spend, click-uri, lead-uri și cost per lead." },
];

const studioPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: Sparkles, eyebrow: "CONSTRUIEȘTI CONCEPTUL", title: "Proprietatea oferă informația. AI-ul ajută la transformarea ei într-o idee creativă.", text: "Alegi oferta și materialele, definești unghiul, iar hook-ul și storyboard-ul organizează ceea ce merită spus și arătat în primele secunde.", chips: ["Proprietate", "Media", "Hook", "Storyboard"] },
  { icon: Film, eyebrow: "PRODUCI MATERIALUL", title: "Din fotografii, într-un video coerent și pregătit pentru review.", text: "Cadrele, ritmul, vocea și subtitrările sunt aduse într-un singur flux. Echipa verifică rezultatul și păstrează identitatea agenției înainte de publicare.", chips: ["Ordine cadre", "Ritm", "Voce", "Subtitrări"] },
  { icon: Megaphone, eyebrow: "DISTRIBUI ȘI MĂSORI", title: "TikTok și Meta rămân conectate la proprietate și la rezultate.", text: "Materialul continuă spre publicare sau campanie, iar managementul vede ce este draft, ce este activ și ce performanță produce investiția.", chips: ["TikTok Studio", "Meta Ads", "Buget", "Rezultate"] },
];

const prioritySignals: IconItem[] = [
  { icon: Clock3, title: "Video draft care așteaptă review", text: "Conceptul și storyboard-ul sunt pregătite, dar forma finală trebuie verificată înainte de publicare." },
  { icon: Building2, title: "Proprietate bună fără promovare activă", text: "Oferta are media pregătită, însă nu există încă un material sau o campanie care să o pună în fața audienței." },
  { icon: Megaphone, title: "Campanie pregătită pentru lansare", text: "Proprietatea, bugetul și durata sunt stabilite, iar promovarea poate trece în următorul status." },
  { icon: BarChart3, title: "Campanie cu rezultate de analizat", text: "Spend-ul, click-urile, lead-urile și costul per lead oferă suficiente semnale pentru următoarea decizie." },
];

const workflow: IconItem[] = [
  { icon: Building2, title: "Alegi proprietatea", text: "Pornești din oferta completă, cu fotografii, date și avantajele pe care vrei să le comunici." },
  { icon: Sparkles, title: "Construiești conceptul", text: "Definești unghiul, hook-ul și storyboard-ul folosind contextul real al proprietății și al audienței." },
  { icon: Film, title: "Produci și verifici", text: "Organizezi cadrele, vocea și subtitrările, apoi controlezi forma finală înainte să ajungă publică." },
  { icon: RadioTower, title: "Publici conținutul", text: "Materialul continuă prin TikTok Studio, fără să piardă legătura cu proprietatea și versiunea aprobată." },
  { icon: Megaphone, title: "Promovezi și măsori", text: "Construiești campania Meta, urmărești statusul și folosești rezultatele pentru decizia următoare." },
];

const roleCards = [
  { icon: Video, overline: "PENTRU AGENT", title: "O proprietate bună poate fi promovată fără un mini-proiect separat.", text: "Agentul pornește din fotografiile și datele deja existente, construiește materialul, verifică mesajul și continuă spre publicare sau campanie fără să mute fișiere între aplicații.", bullets: ["media și datele proprietății în același loc", "video construit și verificat mai repede", "promovare pornită direct din contextul ofertei"] },
  { icon: Palette, overline: "PENTRU MARKETING & MANAGER", title: "Brandul rămâne coerent, iar producția devine vizibilă.", text: "Echipa controlează hook-ul, tonul, vocea și subtitrările, vede ce materiale sunt draft sau gata și urmărește campaniile fără rapoarte reconstruite manual.", bullets: ["control creativ și consistență de brand", "status clar pentru conținut și campanii", "buget și performanță la vedere"] },
  { icon: Target, overline: "PENTRU PREZENTAREA AGENȚIEI", title: "Proprietarul vede că promovarea este un serviciu real, nu o promisiune.", text: "Agenția poate arăta cum transformă oferta în video, cum o distribuie și cum urmărește rezultatele. Marketing Studio devine un argument concret în câștigarea mandatului.", bullets: ["diferențiere clară față de simpla listare", "proces de promovare ușor de demonstrat", "rezultate conectate la proprietatea promovată"] },
];

const studioIntelligence: IconItem[] = [
  { icon: Building2, title: "Proprietatea și obiectivul comercial", text: "Oferta, prețul, caracteristicile și motivul promovării formează contextul materialului." },
  { icon: ImageIcon, title: "Galeria foto și materialele disponibile", text: "Cadrele proprietății sunt selectate din media deja organizată, fără transferuri și foldere intermediare." },
  { icon: Target, title: "Audiența și unghiul de comunicare", text: "Mesajul pornește de la oamenii pe care vrei să îi atragi și de la avantajele care contează pentru ei." },  { icon: Sparkles, title: "Hook-ul și ideea creativă", text: "Primele secunde sunt construite în jurul unui motiv clar de atenție, nu al unei descrieri generice." },
  { icon: Film, title: "Storyboard-ul și ordinea cadrelor", text: "Secvența vizuală, ritmul și momentele importante sunt organizate înainte de forma finală." },
  { icon: Video, title: "Vocea, textul și subtitrările", text: "Narațiunea și elementele de text susțin materialul și pot fi verificate de echipă înainte de publicare." },
  { icon: RadioTower, title: "Canalul și statusul publicării", text: "TikTok Studio păstrează materialul, proprietatea și etapa de producție în același fir." },
  { icon: BarChart3, title: "Campania, bugetul și rezultatele", text: "Meta Ads aduce lângă proprietate durata, spend-ul, click-urile, lead-urile și costul per lead." },
];

const connectedFlow = [
  { icon: Building2, label: "Proprietate" }, { icon: ImageIcon, label: "Media" },
  { icon: Sparkles, label: "Concept AI" }, { icon: Film, label: "Storyboard" },
  { icon: Video, label: "Video" }, { icon: Palette, label: "Review" },
  { icon: RadioTower, label: "TikTok" }, { icon: Megaphone, label: "Meta Ads" },
  { icon: Gauge, label: "Buget" }, { icon: BarChart3, label: "Rezultate" },
];

const questions = [
  { question: "De unde pornește un material în Marketing Studio?", answer: "Pornește din proprietatea deja existentă în CRM, împreună cu fotografiile, prețul, caracteristicile și contextul comercial. Echipa nu trebuie să refacă brief-ul sau să adune informația din mai multe surse înainte să înceapă producția." },
  { question: "Cum ajută AI-ul la realizarea video-ului?", answer: "AI-ul ajută la structurarea conceptului, hook-ului și storyboard-ului și susține fluxul de voce și subtitrare. Agentul sau echipa de marketing verifică materialul și păstrează controlul asupra ordinii cadrelor, tonului și formei finale." },
  { question: "Putem păstra identitatea vizuală și tonul agenției?", answer: "Da. Controlul creativ rămâne la echipă: mesajul, hook-ul, vocea, subtitrările și materialul final pot fi verificate înainte de publicare. Scopul este accelerarea producției, nu publicarea automată a unui conținut neverificat." },
  { question: "Cum este folosit TikTok Studio?", answer: "Materialele video pregătite din proprietate continuă în fluxul TikTok Studio, cu media, storyboard-ul și statusul de producție păstrate împreună. Astfel, conținutul nu devine un fișier izolat de oferta pe care o promovează." },
  { question: "Cum funcționează partea de promovare Meta?", answer: "Campania Meta este construită în contextul proprietății, cu buget, durată și status vizibile. Conectarea la ecosistemul Meta permite echipei să organizeze promovarea fără să piardă legătura dintre ofertă, material și campanie." },
  { question: "Ce rezultate pot fi urmărite?", answer: "Modulul poate afișa indicatorii operaționali ai campaniilor, precum spend, click-uri, lead-uri și cost per lead. Managerul vede astfel ce a fost lansat și ce semnale oferă campania pentru următoarea decizie de promovare." },
];

function DemoButton({ className = "", label = "Vezi demo live" }: { className?: string; label?: string }) {
  return <Button asChild size="lg" className={"lux-primary-button h-14 px-6 text-base font-semibold " + className}><Link href="/demo"><Play className="h-4 w-4 fill-current" />{label}</Link></Button>;
}

function ScreenFrame({ image, alt, label, priority = false, className = "" }: { image: string; alt: string; label: string; priority?: boolean; className?: string }) {
  return (
    <div className={"lux-screen property-screen " + className}>
      <div className="lux-screen__bar"><div className="flex items-center gap-1.5" aria-hidden="true"><span className="lux-dot bg-[#fb7185]" /><span className="lux-dot bg-[#fbbf24]" /><span className="lux-dot bg-[#34d399]" /></div><span>{label}</span></div>
      <div className="lux-screen__viewport"><Image src={image} alt={alt} width={1900} height={1015} priority={priority} loading={priority ? "eager" : "lazy"} sizes="(max-width: 767px) 820px, (max-width: 1279px) 92vw, 900px" className="lux-screen__image" /></div>
    </div>
  );
}

export default function MarketingStudioLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase studio-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link lux-nav-menu__link--active">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero studio-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Clapperboard className="h-4 w-4" /> Din portofoliu, direct în feed</div>
              <h1>Proprietatea intră în studio. <span>Conținutul iese gata de promovat.</span></h1>
              <p className="property-hero__lead">Folosești fotografiile și datele deja organizate, construiești hook-ul, storyboard-ul, vocea și subtitrările, apoi continui spre TikTok și campanii Meta fără să rupi proprietatea de promovarea ei.</p>
              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> AI Video Editor</span><span><Check className="h-3.5 w-3.5" /> TikTok Studio</span><span><Check className="h-3.5 w-3.5" /> Meta Ads</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare Marketing Studio">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Creative studio live</span><span>proprietate conectată</span></div>
              <ScreenFrame image="/landing/screenshots/premium-tiktok-studio.png" alt="TikTok Studio cu AI Video Editor și storyboard" label="ImoDeus.ai CRM / Marketing Studio" priority className="property-hero__screen studio-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail studio-connection-rail" aria-label="Tot parcursul unei campanii este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview studio-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Marketingul, ca parte din proprietate</div><h2 className="property-feature-title studio-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Fotografii și date din proprietate</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">concept și hook AI</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">storyboard</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">voce și subtitrări</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">video din fotografii</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">TikTok Studio</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">campanii Meta și rezultate</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy studio-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><Clapperboard className="h-4 w-4" /> Creative intelligence, fără brief-uri pierdute</div><h2 className="property-anatomy__title"><span>Tot ce transformă o </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">proprietate</span><span> într-o poveste care poate fi </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">promovată.</span></h2><p>Nu este doar un editor video. Este locul în care oferta, media, conceptul, producția, distribuția și rezultatele rămân legate într-un singur fir creativ și comercial.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><ImageIcon className="h-3.5 w-3.5" /> Media</span><span><Film className="h-3.5 w-3.5" /> Storyboard</span><span><RadioTower className="h-3.5 w-3.5" /> TikTok</span><span><Megaphone className="h-3.5 w-3.5" /> Meta Ads</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{studioIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual studio-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Creative intelligence core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><Video className="h-4 w-4" /></span><span><small>AI VIDEO</small><strong>Hook + storyboard</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><Megaphone className="h-4 w-4" /></span><span><small>DISTRIBUȚIE</small><strong>TikTok + Meta</strong></span></div>                <ScreenFrame image="/landing/screenshots/premium-tiktok-studio.png" alt="AI Video Editor cu storyboard și publicare" label="ImoDeus.ai / Creative workspace" className="property-anatomy__screen studio-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> material verificat</span><span><BarChart3 className="h-4 w-4" /> rezultate conectate</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{studioIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation studio-engine">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei motoare, un singur studio</div><h2>Construiești conceptul. Produci materialul. Distribui și măsori.</h2></div><p>Marketing Studio unește creativitatea și operațiunile, astfel încât proprietatea să nu piardă contextul când trece din portofoliu în conținut și campanie.</p></div>
            <div className="property-automation__grid">{studioPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority studio-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Studio-ul îți arată ce cere atenție</div><h2>Nu vezi doar materiale și reclame. Vezi ce merită produs, lansat sau optimizat.</h2></div><p>Video-ul în review, proprietatea fără promovare, campania gata de lansare sau rezultatele care cer analiză ies singure în față pentru agent și manager.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după proprietate, material, campanie sau status</span><span><CircleDot className="h-3.5 w-3.5" /> Studio sincronizat</span></div><ScreenFrame image="/landing/screenshots/premium-meta-advertising.png" alt="Campanii Meta conectate la proprietăți și rezultate" label="ImoDeus.ai CRM / Meta Advertising" className="property-priority__screen studio-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale pentru Marketing Studio"><div className="property-priority__signals-head"><div><span>CE MERITĂ MIȘCAT ACUM</span><strong>Studio-ul îți arată singur</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow studio-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge o proprietate din portofoliu în feed și campanie.</h2><p>Oferta, media, conceptul, video-ul, publicarea și rezultatele formează un singur traseu, ușor de urmărit și de continuat.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puține brief-uri refăcute, producție mai rapidă și o legătură clară între proprietatea promovată, materialul creat și rezultatele campaniei.</span></div>
          </div>
        </section>

        <section className="property-roles studio-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> Creativitate pentru agent, control pentru echipă</div><h2>Agentul se mișcă repede. Marketingul păstrează brandul. Proprietarul vede valoarea.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq studio-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără jargon de agenție</div><h2>Întrebările pe care ni le pun agențiile despre Marketing Studio.</h2><p>Răspunsuri concrete despre proprietăți, AI Video Editor, control creativ, TikTok Studio, Meta Ads și indicatorii campaniilor.</p><DemoButton className="mt-7" label="Vezi Marketing Studio în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>
        <section className="property-final studio-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe proprietățile tale</div><h2>O proprietate bună nu ar trebui să aștepte un brief, un folder și încă trei tool-uri.</h2><p>În demo vezi cum pornești din portofoliu, construiești video-ul, continui spre TikTok și Meta și păstrezi promovarea conectată la rezultate.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}