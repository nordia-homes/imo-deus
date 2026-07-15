import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, Building2, CalendarCheck2, Check, CircleDot, Clock3,
  FileText, Gauge, Layers3, LineChart, MapPinned, MessageSquareText, Navigation,
  Play, Search, ShieldCheck, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Administrare vizionări pentru agenții imobiliare | ImoDeus.ai",
  description: "Calendar centralizat, proprietăți și cumpărători conectați, participanți, confirmări, feedback, follow-up și oferte într-un singur flux operațional.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: CalendarCheck2, value: "Programată", label: "data, ora și durata sunt clare" },
  { icon: Users, value: "Toți conectați", label: "cumpărător, agent și proprietate" },
  { icon: Target, value: "Următor pas", label: "feedback, follow-up sau ofertă" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: CalendarCheck2, meta: "PROGRAMARE RAPIDĂ", title: "Din interes real, direct într-o oră rezervată.", text: "Alegi proprietatea, cumpărătorul, agentul, data și durata. Vizionarea apare imediat în calendar, cu toate detaliile de care echipa are nevoie." },
  { icon: Users, meta: "PARTICIPANȚI & CONFIRMĂRI", title: "Toată lumea știe unde și când trebuie să ajungă.", text: "Cumpărătorul, agentul și persoanele implicate rămân legate de aceeași programare, cu statusul și datele de contact la vedere." },
  { icon: Building2, meta: "CONTEXT COMPLET", title: "Nu deschizi trei fișe înainte să pleci la întâlnire.", text: "Adresa, fotografiile, prețul, caracteristicile proprietății și criteriile cumpărătorului sunt disponibile din aceeași vizionare." },
  { icon: Navigation, meta: "RUTĂ & CONTACT RAPID", title: "Ajungi la adresă și la oameni fără ocoluri.", text: "Deschizi traseul, suni sau trimiți mesaj direct din programare, fără să cauți numere, adrese sau conversații în alte aplicații." },
  { icon: MessageSquareText, meta: "FEEDBACK & OBIECȚII", title: "După vizionare rămâne mai mult decât «revenim».", text: "Notezi impresiile, nivelul de interes, ce a plăcut, ce a blocat decizia și ce criterii trebuie rafinate pentru recomandările următoare." },
  { icon: TrendingUp, meta: "FOLLOW-UP & OFERTĂ", title: "Interesul primește un pas următor, cât este încă proaspăt.", text: "Programezi revenirea, pregătești o nouă selecție sau înregistrezi oferta și condițiile, păstrând totul în același fir comercial." },
];

const journeyPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: CalendarCheck2, eyebrow: "ÎNAINTE DE VIZIONARE", title: "Programarea este confirmată și întâlnirea este pregătită.", text: "Echipa vede ora, durata, participanții, adresa și toate detaliile proprietății. Agentul pleacă la întâlnire cu contextul cumpărătorului și cu răspunsurile importante la îndemână.", chips: ["Calendar", "Participanți", "Adresă & rută", "Detalii proprietate"] },
  { icon: Users, eyebrow: "ÎN TIMPUL ÎNTÂLNIRII", title: "Agentul rămâne atent la client, nu la căutarea informațiilor.", text: "Prețul, suprafețele, dotările, disponibilitatea și istoricul cererii sunt deja în aplicație. Dacă apare o întrebare sau trebuie contactat cineva, acțiunea este la un tap distanță.", chips: ["Context complet", "Apel rapid", "Mesaj", "Notițe"] },
  { icon: Target, eyebrow: "DUPĂ VIZIONARE", title: "Feedbackul se transformă imediat în următorul pas.", text: "Impresiile și obiecțiile rafinează cererea. Agentul poate continua cu follow-up, altă proprietate, o a doua vizionare sau o ofertă, fără să lase interesul să se răcească.", chips: ["Feedback", "Obiecții", "Follow-up", "Ofertă"] },
];

const prioritySignals: IconItem[] = [
  { icon: Clock3, title: "Vizionare de confirmat astăzi", text: "Ora este rezervată, dar unul dintre participanți mai trebuie confirmat." },
  { icon: CalendarCheck2, title: "Slot liber în program", text: "Există un interval disponibil în care poate fi introdusă rapid o nouă vizionare." },
  { icon: MessageSquareText, title: "Feedback încă neînregistrat", text: "Întâlnirea s-a încheiat, iar impresiile cumpărătorului trebuie păstrate acum." },
  { icon: TrendingUp, title: "Interes ridicat fără pas următor", text: "Semnalele sunt bune, dar follow-up-ul sau oferta nu au fost încă programate." },
];

const workflow: IconItem[] = [
  { icon: Building2, title: "Alegi contextul", text: "Pornești de la proprietatea și cumpărătorul potrivit, fără să reconstruiești manual informația." },
  { icon: CalendarCheck2, title: "Stabilești programarea", text: "Alegi data, ora, durata, agentul și participanții, iar vizionarea intră în calendarul echipei." },
  { icon: ShieldCheck, title: "Confirmi și pregătești", text: "Verifici disponibilitatea, accesul, traseul și detaliile importante înainte ca agentul să plece la adresă." },
  { icon: MessageSquareText, title: "Păstrezi feedbackul", text: "Notezi interesul, impresiile și obiecțiile cât conversația este încă proaspătă și relevantă." },
  { icon: TrendingUp, title: "Continui spre decizie", text: "Programezi follow-up-ul, recomanzi alte opțiuni, stabilești o nouă întâlnire sau înregistrezi oferta." },
];

const roleCards = [
  { icon: MapPinned, overline: "PENTRU AGENT", title: "Fiecare întâlnire începe pregătită și se termină cu un pas clar.", text: "Agentul vede programul zilei, traseul, proprietatea, cumpărătorul și toate detaliile comerciale. După vizionare, notează feedbackul și continuă imediat spre follow-up sau ofertă.", bullets: ["programul zilei și sloturile disponibile", "rută, contacte și context înainte de întâlnire", "feedback și următor pas după vizionare"] },
  { icon: LineChart, overline: "PENTRU MANAGER", title: "Vezi activitatea din teren, nu doar întâlnirile din calendar.", text: "Managerul înțelege câte vizionări sunt programate, confirmate sau finalizate, ce agenți sunt ocupați și câte întâlniri produc feedback, follow-up și oferte.", bullets: ["încărcarea echipei și distribuția programărilor", "vizionări fără confirmare sau fără feedback", "progresul real de la întâlnire la ofertă"] },
  { icon: Sparkles, overline: "PENTRU EXPERIENȚA CLIENTULUI", title: "Cumpărătorul primește o experiență atentă, nu o programare improvizată.", text: "Ora și locul sunt clare, agentul vine pregătit, iar feedbackul este folosit pentru recomandările următoare. Clientul simte că fiecare vizionare îl apropie de proprietatea potrivită.", bullets: ["comunicare clară înainte de întâlnire", "agent informat și recomandări relevante", "continuitate firească după vizionare"] },
];

const viewingIntelligence: IconItem[] = [
  { icon: CalendarCheck2, title: "Data, ora, durata și statusul", text: "Programarea este vizibilă în calendar cu intervalul ocupat și starea ei operațională." },
  { icon: Building2, title: "Proprietatea care se vizionează", text: "Adresa, prețul, fotografiile și informațiile importante sunt legate direct de întâlnire." },
  { icon: Users, title: "Cumpărătorul și criteriile lui", text: "Agentul vede ce caută clientul și de ce această proprietate merită prezentată." },  { icon: MapPinned, title: "Agentul, participanții și accesul", text: "Responsabilul, persoanele implicate, contactele și detaliile de acces rămân într-un singur loc." },
  { icon: ShieldCheck, title: "Confirmări și pregătire", text: "Echipa verifică participanții, disponibilitatea și informațiile care trebuie clarificate înainte de întâlnire." },
  { icon: Navigation, title: "Rută și acțiuni rapide", text: "Deschizi traseul, suni sau trimiți mesaj fără să ieși din contextul vizionării." },
  { icon: MessageSquareText, title: "Feedback, interes și obiecții", text: "Păstrezi reacția reală a cumpărătorului și motivele care îl apropie sau îl îndepărtează de decizie." },
  { icon: TrendingUp, title: "Follow-up, ofertă și rezultat", text: "Fiecare întâlnire continuă cu o acțiune urmărită: revenire, recomandare, altă vizionare sau ofertă." },
];

const connectedFlow = [
  { icon: Building2, label: "Proprietate" }, { icon: Users, label: "Cumpărător" },
  { icon: CalendarCheck2, label: "Programare" }, { icon: ShieldCheck, label: "Confirmare" },
  { icon: Navigation, label: "Rută" }, { icon: MapPinned, label: "Vizionare" },
  { icon: MessageSquareText, label: "Feedback" }, { icon: Search, label: "Rafinare" },
  { icon: Clock3, label: "Follow-up" }, { icon: TrendingUp, label: "Ofertă" },
];

const questions = [
  { question: "Ce informații conține o vizionare în ImoDeus?", answer: "Data, ora, durata, statusul, proprietatea, cumpărătorul, agentul responsabil, participanții, adresa, contactele și informațiile necesare pregătirii. După întâlnire, aceeași vizionare păstrează feedbackul, nivelul de interes, obiecțiile și următorul pas." },
  { question: "Cum vede agentul programul și sloturile disponibile?", answer: "Calendarul centralizează vizionările echipei și arată intervalele ocupate și libere. Agentul poate înțelege rapid ce urmează în ziua lui și unde există loc pentru o programare nouă, fără să compare calendare sau conversații separate." },
  { question: "Cum sunt conectate proprietatea și cumpărătorul?", answer: "Vizionarea leagă direct fișa proprietății de profilul cumpărătorului. Agentul vede caracteristicile ofertei, criteriile clientului, istoricul relevant și motivul pentru care proprietatea a fost recomandată." },
  { question: "Ce poate face agentul înainte și în timpul vizionării?", answer: "Poate verifica adresa și detaliile proprietății, deschide ruta, suna participanții, trimite un mesaj și consulta informațiile comerciale importante. Astfel, întâlnirea este pregătită fără căutări prin alte aplicații." },
  { question: "Cum este folosit feedbackul după vizionare?", answer: "Agentul notează ce i-a plăcut cumpărătorului, ce obiecții are și cât de ridicat este interesul. Informația rafinează cererea, ajută la selectarea următoarelor proprietăți și oferă context pentru discuția cu proprietatea și pentru negociere." },
  { question: "Cum continuă vizionarea spre ofertă?", answer: "Imediat după feedback, agentul poate programa follow-up-ul, trimite alte opțiuni, stabili o nouă vizionare sau înregistra o ofertă cu suma și condițiile ei. Managerul vede astfel nu doar întâlnirea, ci și progresul comercial produs de ea." },
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

export default function ViewingsLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase viewing-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link lux-nav-menu__link--active">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero viewing-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> De la programare la ofertă, fără goluri</div>
              <h1>Vizionarea începe înainte <span>să ajungi la adresă.</span></h1>
              <p className="property-hero__lead">ImoDeus leagă într-o singură programare proprietatea, cumpărătorul, agentul și toate detaliile întâlnirii. Înainte ai context. După ai feedback, follow-up și un pas clar spre decizie.</p>              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>
              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> Calendar centralizat</span><span><Check className="h-3.5 w-3.5" /> Context complet</span><span><Check className="h-3.5 w-3.5" /> Feedback acționabil</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare calendar de vizionări">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Calendar live</span><span>sincronizat acum</span></div>
              <ScreenFrame image="/landing/screenshots/viewings-calendar.png" alt="Calendar cu vizionările și sloturile disponibile ale echipei" label="ImoDeus.ai CRM / Vizionări" priority className="property-hero__screen viewing-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail viewing-connection-rail" aria-label="Tot parcursul unei vizionări este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview viewing-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><Gauge className="h-4 w-4" /> Vizionarea, ca moment comercial</div><h2 className="property-feature-title viewing-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Calendar centralizat</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">programare rapidă</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">proprietate și cumpărător conectați</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">confirmări și participanți</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">rută și contact rapid</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">feedback și obiecții</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">follow-up și ofertă</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy viewing-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><CalendarCheck2 className="h-4 w-4" /> Viewing intelligence, într-un singur fir</div><h2 className="property-anatomy__title"><span>Tot ce trebuie să știi despre o </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">vizionare</span><span>, înainte și </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">după.</span></h2><p>Nu este doar o oră într-un calendar. Este întâlnirea dintre o proprietate și un cumpărător, pregătită cu toate detaliile și continuată cu feedback, follow-up și ofertă.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><CalendarCheck2 className="h-3.5 w-3.5" /> Programare</span><span><Users className="h-3.5 w-3.5" /> Participanți</span><span><MessageSquareText className="h-3.5 w-3.5" /> Feedback</span><span><TrendingUp className="h-3.5 w-3.5" /> Ofertă</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{viewingIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual viewing-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Viewing intelligence core</div>                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><ShieldCheck className="h-4 w-4" /></span><span><small>ÎNAINTE</small><strong>Confirmată & pregătită</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><TrendingUp className="h-4 w-4" /></span><span><small>DUPĂ</small><strong>Feedback + follow-up</strong></span></div>
                <ScreenFrame image="/landing/screenshots/viewings-detail.png" alt="Fișa completă a unei vizionări cu proprietate și participanți" label="ImoDeus.ai / Tot contextul întâlnirii" className="property-anatomy__screen viewing-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> întâlnire pregătită</span><span><Target className="h-4 w-4" /> următorul pas la vedere</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{viewingIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation viewing-journey">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> O întâlnire, trei momente decisive</div><h2>Programezi o dată. ImoDeus ține tot parcursul în mișcare.</h2></div><p>Pregătirea, întâlnirea și follow-up-ul nu mai sunt etape rupte. Toate pornesc din aceeași programare și păstrează contextul comercial până la următoarea decizie.</p></div>
            <div className="property-automation__grid">{journeyPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority viewing-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Clock3 className="h-4 w-4" /> Ziua de teren, pusă în ordine</div><h2>Nu vezi doar programări. Vezi ce poate apropia următoarea ofertă.</h2></div><p>Vizionarea neconfirmată, slotul liber, feedbackul lipsă sau interesul ridicat fără follow-up ies singure în față. Calendarul devine un instrument de conversie, nu doar de organizare.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după proprietate, cumpărător sau agent</span><span><CircleDot className="h-3.5 w-3.5" /> Calendar sincronizat</span></div><ScreenFrame image="/landing/screenshots/viewings-calendar.png" alt="Calendarul vizionărilor cu programări și sloturi disponibile" label="ImoDeus.ai CRM / Calendar operațional" className="property-priority__screen viewing-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale pentru vizionări"><div className="property-priority__signals-head"><div><span>CE MERITĂ REZOLVAT ASTĂZI</span><strong>Calendarul îți arată singur</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow viewing-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa transformi o programare într-un pas real spre tranzacție.</h2><p>De la alegerea proprietății și a cumpărătorului până la feedback, follow-up și ofertă, echipa lucrează pe un singur traseu, cu același context.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puține întâlniri improvizate, mai mult feedback util și un follow-up care începe înainte ca interesul cumpărătorului să se răcească.</span></div>
          </div>
        </section>

        <section className="property-roles viewing-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> Aceeași întâlnire, văzută complet</div><h2>Agentul vine pregătit. Managerul vede rezultatul. Clientul simte diferența.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq viewing-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără broșură</div><h2>Întrebările pe care ni le pun agențiile despre modulul Vizionări.</h2><p>Răspunsuri concrete despre calendar, participanți, proprietăți, pregătirea întâlnirii, feedback și pașii care duc spre ofertă.</p><DemoButton className="mt-7" label="Vezi modulul în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>

        <section className="property-final viewing-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe programul echipei tale</div><h2>O vizionare bună nu se termină la ușa proprietății.</h2><p>În demo vezi cum o programezi, pregătești participanții, păstrezi contextul, înregistrezi feedbackul și continui natural spre follow-up, ofertă și decizie.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}