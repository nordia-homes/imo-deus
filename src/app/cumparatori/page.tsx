import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, Bot, Building2, CalendarCheck2, Check, CircleDot,
  Clock3, FileText, Gauge, Layers3, LineChart, MapPinned, MessageSquareText,
  Play, Search, ShieldCheck, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Administrare cumpărători pentru agenții imobiliare | ImoDeus.ai",
  description: "Profil complet, criterii clare, AI Matching, proprietăți recomandate, conversații, vizionări, feedback și oferte într-un singur pipeline.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: Search, value: "Profil complet", label: "buget, zone și criterii" },
  { icon: Target, value: "Potriviri active", label: "proprietăți din portofoliu" },
  { icon: CalendarCheck2, value: "Următor pas", label: "apel, vizionare sau ofertă" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Search, meta: "CERERE COMPLETĂ", title: "Știi ce caută înainte să începi să cauți.", text: "Buget, zone, tip de proprietate, camere, suprafață și dotări. Cererea rămâne clară pentru orice coleg care preia conversația." },
  { icon: Gauge, meta: "CALIFICARE & PRIORITATE", title: "Un contact devine o cerere pe care poți lucra.", text: "Sursa, intenția, momentul cumpărării, finanțarea și prioritatea arată cât de pregătit este cumpărătorul și ce merită făcut în continuare." },
  { icon: Target, meta: "AI MATCHING", title: "Proprietățile potrivite ies singure în față.", text: "ImoDeus compară automat cererea cu portofoliul și explică de ce se potrivește fiecare ofertă, ca agentul să aleagă repede și cu încredere." },
  { icon: MessageSquareText, meta: "CONVERSAȚII & FOLLOW-UP", title: "Nu mai reiei aceeași discuție de la zero.", text: "Apelurile, notițele, proprietățile trimise și reacțiile cumpărătorului rămân într-un singur istoric, ușor de continuat de întreaga echipă." },
  { icon: CalendarCheck2, meta: "VIZIONĂRI & FEEDBACK", title: "Fiecare vizionare spune ceva despre cererea reală.", text: "Programezi întâlnirile, păstrezi confirmările și notezi feedbackul. Preferințele se rafinează pe baza reacțiilor, nu a presupunerilor." },
  { icon: TrendingUp, meta: "OFERTE & NEGOCIERE", title: "Interesul devine ofertă, nu o conversație uitată.", text: "Suma, condițiile, răspunsurile și pașii de negociere rămân legați de cumpărător și proprietate până la decizia finală." },
];

const conversionPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: Gauge, eyebrow: "CALIFICARE CLARĂ", title: "Dintr-un contact nou, într-un profil pe care agentul îl poate folosi.", text: "Nu este suficient să ai un nume și un telefon. ImoDeus adună criteriile, motivația și momentul cumpărării, astfel încât următoarea conversație să înceapă de unde trebuie.", chips: ["Buget", "Zone", "Tip & camere", "Momentul cumpărării"] },
  { icon: Target, eyebrow: "POTRIVIRE AUTOMATĂ", title: "Portofoliul este verificat pentru fiecare cumpărător.", text: "AI Matching compară cererea cu proprietățile active și cu stocul nou. Agentul primește o selecție explicată, nu o listă lungă pe care trebuie să o filtreze din memorie.", chips: ["Scor de potrivire", "Motive clare", "Stoc nou", "Selecție rapidă"] },
  { icon: CalendarCheck2, eyebrow: "ACȚIUNE COORDONATĂ", title: "De la recomandare la vizionare și ofertă, fără goluri.", text: "Proprietățile trimise, răspunsurile, programările și ofertele construiesc un fir comercial pe care agentul și managerul îl pot înțelege și continua imediat.", chips: ["Follow-up", "Vizionări", "Feedback", "Oferte"] },
];

const prioritySignals: IconItem[] = [
  { icon: Building2, title: "Proprietate nouă compatibilă", text: "A intrat în portofoliu o ofertă care respectă criteriile cumpărătorului." },
  { icon: Clock3, title: "Cumpărător fără follow-up", text: "Interesul este activ, dar următoarea conversație nu a fost încă programată." },
  { icon: CalendarCheck2, title: "Vizionare de confirmat", text: "Ora, participanții și proprietatea sunt pregătite pentru confirmare." },
  { icon: TrendingUp, title: "Ofertă care așteaptă răspuns", text: "Suma și condițiile sunt înregistrate, iar negocierea cere o acțiune." },
];

const workflow: IconItem[] = [
  { icon: Users, title: "Captezi cererea", text: "Contactul intră în CRM cu sursa, datele de contact și motivul pentru care caută o proprietate acum." },
  { icon: Gauge, title: "Califici exact", text: "Clarifici bugetul, finanțarea, zonele, tipul de proprietate, criteriile obligatorii și intervalul de decizie." },
  { icon: Target, title: "Potrivești automat", text: "AI Matching verifică portofoliul, explică potrivirile și revine cu opțiuni noi când apare stoc compatibil." },
  { icon: CalendarCheck2, title: "Organizezi interesul", text: "Trimiți selecția, continui conversația, programezi vizionările și folosești feedbackul pentru a rafina căutarea." },
  { icon: TrendingUp, title: "Conduci spre ofertă", text: "Înregistrezi suma și condițiile, urmărești negocierea și păstrezi toate deciziile în istoricul oportunității." },
];

const roleCards = [
  { icon: MessageSquareText, overline: "PENTRU AGENT", title: "Intri în fiecare apel știind deja ce contează.", text: "Vezi criteriile, proprietățile recomandate, ce i-ai trimis, ce a respins și care este următorul pas. Conversația continuă natural, fără întrebări repetate și fără căutări prin notițe sau chat-uri.", bullets: ["context complet înainte și în timpul apelului", "potriviri explicate și selecții gata de trimis", "follow-up, vizionări și oferte într-un singur loc"] },
  { icon: LineChart, overline: "PENTRU MANAGER", title: "Vezi cererea reală din agenție, nu doar o listă de contacte.", text: "Managerul înțelege câți cumpărători sunt activi, ce bugete și zone caută, cine a primit proprietăți, cine a ajuns la vizionare și unde echipa riscă să piardă o oportunitate.", bullets: ["cerere activă pe bugete și zone", "activitate și conversie pe agent", "blocaje vizibile înainte să devină lead-uri pierdute"] },
  { icon: Sparkles, overline: "PENTRU EXPERIENȚA CLIENTULUI", title: "Cumpărătorul simte că agenția chiar l-a ascultat.", text: "Primește proprietăți relevante, este contactat la momentul potrivit și nu trebuie să își repete criteriile la fiecare discuție. Experiența devine atentă, coerentă și personală.", bullets: ["recomandări mai relevante, nu anunțuri în masă", "comunicare consecventă cu întreaga echipă", "vizionări mai bine pregătite și decizii mai rapide"] },
];

const buyerIntelligence: IconItem[] = [
  { icon: Users, title: "Identitate, contact și sursă", text: "Datele cumpărătorului, canalul prin care a venit și agentul responsabil rămân clare din prima zi." },
  { icon: MapPinned, title: "Criteriile reale de căutare", text: "Buget, zone, tip, camere, suprafață, dotări, criterii obligatorii și lucruri pe care clientul nu le acceptă." },
  { icon: Gauge, title: "Intenție, finanțare și prioritate", text: "Afli cât de pregătit este să cumpere, cum finanțează achiziția și când ar vrea să ia decizia." },
  { icon: Clock3, title: "Conversații, notițe și task-uri", text: "Apelurile, concluziile și promisiunile de follow-up formează un istoric pe care echipa îl poate continua." },  { icon: Target, title: "AI Matching cu portofoliul", text: "Cererea este comparată automat cu proprietățile active, iar potrivirile vin cu motive ușor de verificat." },
  { icon: Building2, title: "Selecții și proprietăți trimise", text: "Vezi ce opțiuni au fost recomandate, când au fost trimise și cum a reacționat cumpărătorul la fiecare." },
  { icon: CalendarCheck2, title: "Vizionări și feedback", text: "Programările, participanții, confirmările, impresiile și obiecțiile rămân legate de cerere și proprietate." },
  { icon: TrendingUp, title: "Oferte, condiții și negociere", text: "Sumele propuse, condițiile și răspunsurile sunt urmărite până la acceptare, refuz sau următorul pas." },
];

const connectedFlow = [
  { icon: Users, label: "Lead" }, { icon: Gauge, label: "Calificare" },
  { icon: Search, label: "Criterii" }, { icon: Target, label: "AI Matching" },
  { icon: Building2, label: "Selecție" }, { icon: MessageSquareText, label: "Conversație" },
  { icon: CalendarCheck2, label: "Vizionare" }, { icon: BadgeCheck, label: "Feedback" },
  { icon: TrendingUp, label: "Ofertă" }, { icon: ShieldCheck, label: "Tranzacție" },
];

const questions = [
  { question: "Ce informații păstrează profilul unui cumpărător?", answer: "Datele de contact și sursa, bugetul, modalitatea de finanțare, zonele, tipul de proprietate, camerele, suprafața, dotările, criteriile obligatorii, momentul cumpărării, notițele, conversațiile, proprietățile trimise, vizionările, feedbackul și ofertele. Profilul devine memoria comercială a relației." },
  { question: "Cum funcționează AI Matching pentru cumpărători?", answer: "ImoDeus compară criteriile cumpărătorului cu proprietățile din portofoliu și calculează potrivirile relevante. Agentul vede atât opțiunile recomandate, cât și motivele: buget, zonă, tip, suprafață, camere și alte preferințe importante." },
  { question: "Ce se întâmplă când intră o proprietate nouă în portofoliu?", answer: "Noua proprietate poate fi comparată automat cu cererile active. Agenții văd ce cumpărători se potrivesc și pot porni rapid o conversație relevantă, fără să caute manual prin contacte sau să se bazeze pe memorie." },
  { question: "Cum ajută istoricul conversațiilor și al proprietăților trimise?", answer: "Înainte de apel, agentul vede ce s-a discutat, ce opțiuni au fost recomandate, ce i-a plăcut cumpărătorului și ce a respins. Astfel continuă firesc conversația și evită recomandările repetate sau nepotrivite." },
  { question: "Cum sunt organizate vizionările și feedbackul?", answer: "Programarea leagă cumpărătorul de proprietatea vizionată. Echipa păstrează ora, participanții, confirmările, impresiile și obiecțiile, apoi folosește feedbackul pentru a rafina căutarea și pentru a pregăti următorul pas." },
  { question: "Pot fi urmărite ofertele și negocierea?", answer: "Da. Oferta, suma, condițiile, termenul și răspunsurile rămân înregistrate în același traseu comercial. Agentul și managerul văd dacă urmează un răspuns, o contraofertă, o nouă discuție sau pregătirea documentelor." },
];

function DemoButton({ className = "", label = "Vezi demo live" }: { className?: string; label?: string }) {
  return <Button asChild size="lg" className={"lux-primary-button h-14 px-6 text-base font-semibold " + className}><Link href="/demo"><Play className="h-4 w-4 fill-current" />{label}</Link></Button>;
}

function ScreenFrame({ image, alt, label, priority = false, className = "" }: { image: string; alt: string; label: string; priority?: boolean; className?: string }) {
  return (
    <div className={"lux-screen property-screen " + className}>
      <div className="lux-screen__bar"><div className="flex items-center gap-1.5" aria-hidden="true"><span className="lux-dot bg-[#fb7185]" /><span className="lux-dot bg-[#fbbf24]" /><span className="lux-dot bg-[#34d399]" /></div><span>{label}</span></div>
      <div className="lux-screen__viewport"><Image src={image} alt={alt} width={1900} height={912} priority={priority} loading={priority ? "eager" : "lazy"} sizes="(max-width: 767px) 820px, (max-width: 1279px) 92vw, 900px" className="lux-screen__image" /></div>
    </div>
  );
}

export default function BuyersLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase buyer-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link lux-nav-menu__link--active">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero buyer-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> De la cerere la ofertă, fără context pierdut</div>
              <h1>Știi ce caută. <span>Vezi ce i se potrivește.</span></h1>
              <p className="property-hero__lead">Fiecare cumpărător are un profil complet: criterii, buget, intenție, conversații, proprietăți recomandate, vizionări, feedback și oferte. Agentul știe ce să trimită, când să revină și cum să ducă interesul spre o decizie.</p>
              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> Cerere calificată</span><span><Check className="h-3.5 w-3.5" /> Matching automat</span><span><Check className="h-3.5 w-3.5" /> Următor pas clar</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare profil cumpărător">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Cerere activă</span><span>actualizat acum</span></div>
              <ScreenFrame image="/landing/screenshots/buyers.png" alt="Lista de cumpărători cu criterii, bugete și priorități" label="ImoDeus.ai CRM / Cumpărători" priority className="property-hero__screen buyer-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail buyer-connection-rail" aria-label="Tot parcursul unui cumpărător este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview buyer-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><Gauge className="h-4 w-4" /> Cumpărătorul, ca oportunitate reală</div><h2 className="property-feature-title buyer-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Profil complet</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">cerințe clare</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">AI Matching</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">proprietăți recomandate</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">conversații organizate</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">vizionări și feedback</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">oferte și negociere</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy buyer-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><Bot className="h-4 w-4" /> Buyer intelligence, fără fișe împrăștiate</div><h2 className="property-anatomy__title"><span>Tot ce știe echipa despre un </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">cumpărător</span><span>, în același </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">profil.</span></h2><p>Nu este o agendă cu nume și numere. Este locul în care cererea capătă criterii, prioritate și istoric, întâlnește portofoliul potrivit și avansează organizat spre vizionare, ofertă și tranzacție.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><Search className="h-3.5 w-3.5" /> Criterii</span><span><Target className="h-3.5 w-3.5" /> AI Matching</span><span><CalendarCheck2 className="h-3.5 w-3.5" /> Vizionări</span><span><TrendingUp className="h-3.5 w-3.5" /> Oferte</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{buyerIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual buyer-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Buyer intelligence core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><Target className="h-4 w-4" /></span><span><small>AI MATCHING</small><strong>Potriviri explicate</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><CalendarCheck2 className="h-4 w-4" /></span><span><small>URMĂTORUL PAS</small><strong>Vizionare + follow-up</strong></span></div>                <ScreenFrame image="/landing/screenshots/lead-matching-detail.png" alt="Profil complet de cumpărător cu criterii și proprietăți potrivite" label="ImoDeus.ai / Tot ce știe echipa" className="property-anatomy__screen buyer-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> din criterii până la ofertă</span><span><Users className="h-4 w-4" /> tot istoricul la vedere</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{buyerIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation buyer-conversion">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Din informație în acțiune</div><h2>Înțelegi cererea o dată. ImoDeus o pune în mișcare.</h2></div><p>Criteriile nu rămân într-o notiță. Ele alimentează prioritatea, potrivirile, recomandările, follow-up-ul, vizionările și ofertele, până când cumpărătorul ia o decizie.</p></div>
            <div className="property-automation__grid">{conversionPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority buyer-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Prioritatea dimineții, deja ordonată</div><h2>Nu vezi doar contacte. Vezi cine are nevoie de următorul pas.</h2></div><p>Proprietatea nouă compatibilă, cumpărătorul fără follow-up, vizionarea de confirmat sau oferta care așteaptă răspuns ies singure în față. Agentul începe ziua cu un motiv concret de acțiune.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după nume, buget, zonă sau agent</span><span><CircleDot className="h-3.5 w-3.5" /> Sincronizat live</span></div><ScreenFrame image="/landing/screenshots/buyers.png" alt="Lista de cumpărători cu filtre și priorități" label="ImoDeus.ai CRM / Pipeline cumpărători" className="property-priority__screen buyer-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale pentru cumpărători"><div className="property-priority__signals-head"><div><span>CINE MERITĂ CONTACTAT ASTĂZI</span><strong>Pipeline-ul îți arată singur</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow buyer-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge un contact nou la vizionare și ofertă.</h2><p>Un profil bine calificat alimentează potrivirile, conversațiile, selecțiile, vizionările și negocierea, fără ca echipa să piardă contextul pe drum.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puține cereri uitate, recomandări mai relevante și un traseu clar de la primul contact până la vizionare, ofertă și decizie.</span></div>
          </div>
        </section>

        <section className="property-roles buyer-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> Aceeași cerere, înțeleasă de toată echipa</div><h2>Agentul lucrează mai personal. Managerul vede imaginea completă.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq buyer-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără broșură</div><h2>Întrebările pe care ni le pun agențiile despre modulul Cumpărători.</h2><p>Răspunsuri concrete despre cum sunt organizate cererile, potrivirile, conversațiile, vizionările și ofertele în munca de zi cu zi.</p><DemoButton className="mt-7" label="Vezi modulul în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>

        <section className="property-final buyer-final">          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe cererile tale</div><h2>Lista ta de cumpărători ascunde deja următoarele vizionări.</h2><p>În demo vezi cum califici cererea, găsești proprietățile potrivite, continui conversația și conduci fiecare oportunitate până la vizionare, ofertă și decizie.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}