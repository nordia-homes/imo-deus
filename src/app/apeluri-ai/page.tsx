import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, Bot, Building2, Check,
  CircleDot, Clock3, FileText, Gauge, Headphones, History, Layers3, LineChart,
  MessageSquareText, PhoneCall, Play, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, TrendingUp, Users, Zap,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Apeluri AI pentru agenții imobiliare | ImoDeus.ai",
  description: "Prospectare automată către proprietari, reguli comerciale, intervale orare, calificarea intenției, istoric și handoff către agent într-un singur flux.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: ShieldCheck, value: "Regulile agenției", label: "comision, interval și limite" },
  { icon: Headphones, value: "Conversație calificată", label: "intenție, obiecții și disponibilitate" },
  { icon: Users, value: "Handoff către agent", label: "context și următor pas clar" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Search, meta: "SURSE DE PROPRIETARI", title: "Prospectarea pornește din oportunități reale, nu din liste fără context.", text: "Agenția selectează anunțurile și proprietarii care merită contactați, păstrând lângă apel sursa, zona, prețul și informațiile relevante despre ofertă." },
  { icon: SlidersHorizontal, meta: "REGULI COMERCIALE", title: "Înainte să sune AI-ul, agenția decide cadrul conversației.", text: "Comisionul dorit, limita minimă, tipul colaborării, intervalele orare și regulile de comunicare sunt stabilite clar și aplicate consecvent." },
  { icon: PhoneCall, meta: "APEL AI CONTROLAT", title: "Primul contact se întâmplă fără să consume orele agentului.", text: "AI-ul deschide conversația în intervalul aprobat, prezintă motivul apelului și urmărește obiectivul definit de agenție, fără improvizații comerciale." },
  { icon: Gauge, meta: "CALIFICAREA INTENȚIEI", title: "Nu orice răspuns devine automat oportunitate.", text: "Conversația clarifică dacă proprietarul este deschis la colaborare, când poate reveni echipa, ce obiecții are și cât de relevant este un follow-up uman." },
  { icon: History, meta: "ISTORIC & REZULTAT", title: "După apel rămâne context, nu doar un status colorat.", text: "Rezultatul, momentul apelului, informațiile comerciale și concluziile rămân în CRM, legate de proprietar, anunț și agentul care va continua." },
  { icon: Users, meta: "HANDOFF & FOLLOW-UP", title: "Agentul intră în discuție când există un motiv real să o facă.", text: "Oportunitățile calde sunt scoase în față cu contextul necesar, iar revenirea poate fi organizată ca task, apel uman sau pas spre întâlnire și mandat." },
];

const voicePillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: Search, eyebrow: "ALEGI OPORTUNITATEA", title: "Agenția decide cine merită contactat și de ce.", text: "Anunțul, zona, prețul, sursa și statusul formează contextul inițial. AI-ul nu sună în gol, ci pornește dintr-o oportunitate selectată și ușor de verificat.", chips: ["Anunț proprietar", "Zonă", "Preț", "Sursă"] },
  { icon: Headphones, eyebrow: "AI-UL CALIFICĂ", title: "Conversația urmează regulile și obiectivul comercial stabilit.", text: "Apelul verifică deschiderea la colaborare, disponibilitatea și obiecțiile, respectând intervalul, tonul și limitele de comision aprobate de agenție.", chips: ["Interval orar", "Ton", "Comision", "Obiecții"] },
  { icon: Users, eyebrow: "AGENTUL PREIA", title: "Follow-up-ul uman începe cu informația importantă deja la vedere.", text: "Agentul vede cine este proprietarul, ce s-a discutat, de ce oportunitatea merită continuată și care este momentul potrivit pentru următorul contact.", chips: ["Rezultat", "Context", "Prioritate", "Task de follow-up"] },
];

const prioritySignals: IconItem[] = [
  { icon: TrendingUp, title: "Proprietar deschis la colaborare", text: "Conversația a identificat o oportunitate care merită preluată rapid de un agent." },
  { icon: Clock3, title: "Revenire cerută la o oră precisă", text: "Proprietarul a indicat un moment mai bun, iar follow-up-ul trebuie programat." },
  { icon: MessageSquareText, title: "Obiecție de comision de clarificat", text: "Există interes, dar agentul trebuie să continue personal discuția comercială." },
  { icon: PhoneCall, title: "Apel nepreluat, eligibil pentru reîncercare", text: "Contactul nu a răspuns, iar oportunitatea poate reveni în flux conform regulilor agenției." },
];

const workflow: IconItem[] = [
  { icon: Search, title: "Selectezi sursa", text: "Alegi proprietarii și anunțurile care se potrivesc strategiei de prospectare a agenției." },
  { icon: SlidersHorizontal, title: "Configurezi cadrul", text: "Stabilești intervalele, comisionul, limitele, tonul și obiectivul pe care trebuie să îl urmărească apelul." },
  { icon: Bot, title: "AI-ul poartă discuția", text: "Deschide conversația, clarifică intenția și păstrează interacțiunea în regulile aprobate." },
  { icon: Gauge, title: "Rezultatul este calificat", text: "Statusul, răspunsurile, obiecțiile și momentul potrivit pentru revenire rămân organizate în CRM." },
  { icon: Users, title: "Agentul continuă", text: "Oportunitatea relevantă ajunge la agent cu tot contextul necesar pentru follow-up, întâlnire și mandat." },
];

const roleCards = [
  { icon: Headphones, overline: "PENTRU AGENT", title: "Nu mai începi fiecare apel de la zero.", text: "Agentul intră doar în conversațiile care merită energie umană și vede dinainte cine este proprietarul, ce a răspuns, unde există interes și ce obiecție trebuie clarificată.", bullets: ["mai puține apeluri reci și repetitive", "context complet înainte de follow-up", "mai mult timp pentru întâlniri și mandate"] },
  { icon: LineChart, overline: "PENTRU MANAGER", title: "Prospectarea devine un proces pe care îl poți vedea și coordona.", text: "Managerul urmărește sursele, apelurile, rezultatele și oportunitățile care cer preluare. Poate înțelege unde funcționează mesajul și unde echipa pierde follow-up-uri valoroase.", bullets: ["volum și rezultate fără raportare manuală", "reguli comerciale aplicate consecvent", "oportunități calde și follow-up-uri la vedere"] },
  { icon: Sparkles, overline: "PENTRU CREȘTEREA AGENȚIEI", title: "Acoperi mai mult din piață fără să diluezi experiența comercială.", text: "AI-ul susține primul nivel de prospectare, iar oamenii rămân acolo unde contează: negociere, relație, evaluare și câștigarea mandatului.", bullets: ["acoperire mai mare a proprietarilor din piață", "ritm constant de prospectare", "agenți concentrați pe conversațiile cu potențial"] },
];

const callIntelligence: IconItem[] = [
  { icon: Building2, title: "Anunțul și sursa proprietarului", text: "Zona, prețul, tipul proprietății și canalul de proveniență rămân lângă conversație." },
  { icon: PhoneCall, title: "Contactul și eligibilitatea apelului", text: "Numărul, statusul și regulile de contactare sunt verificate în fluxul definit de agenție." },
  { icon: Clock3, title: "Intervalele orare aprobate", text: "Apelurile sunt organizate în ferestrele stabilite, cu un cadru previzibil pentru întreaga echipă." },  { icon: SlidersHorizontal, title: "Comisionul și limitele comerciale", text: "AI-ul lucrează cu parametrii aprobați și nu trebuie să inventeze condiții în timpul conversației." },
  { icon: Headphones, title: "Obiectivul și disciplina conversației", text: "Motivul apelului, întrebările relevante și tonul urmăresc o calificare clară, nu o discuție fără direcție." },
  { icon: Gauge, title: "Intenția și disponibilitatea", text: "Sistemul diferențiază deschiderea reală, revenirea ulterioară, refuzul și situațiile care cer un agent." },
  { icon: History, title: "Rezultatul, obiecțiile și istoricul", text: "Echipa vede ce s-a întâmplat, ce trebuie clarificat și cum a evoluat contactarea proprietarului." },
  { icon: Users, title: "Agentul responsabil și următorul pas", text: "Oportunitatea calificată continuă cu task, follow-up uman, întâlnire sau discuția pentru mandat." },
];

const connectedFlow = [
  { icon: Building2, label: "Anunț" }, { icon: Search, label: "Selecție" },
  { icon: SlidersHorizontal, label: "Reguli" }, { icon: PhoneCall, label: "Apel AI" },
  { icon: Headphones, label: "Conversație" }, { icon: Gauge, label: "Intenție" },
  { icon: History, label: "Rezultat" }, { icon: Target, label: "Prioritate" },
  { icon: Users, label: "Agent" }, { icon: TrendingUp, label: "Mandat" },
];

const questions = [
  { question: "Pe cine poate contacta modulul Apeluri AI?", answer: "Fluxul pornește din oportunitățile selectate de agenție, de exemplu anunțuri publicate direct de proprietari. Contextul anunțului, zona, prețul și datele disponibile rămân legate de apel, astfel încât prospectarea să nu fie o listă anonimă de numere." },
  { question: "Ce controlează agenția înainte de apel?", answer: "Agenția definește intervalele orare, obiectivul conversației, tonul, tipul de comision, nivelul dorit și limitele comerciale. AI-ul execută în acest cadru, iar setările pot fi verificate de management înainte ca prospectarea să înceapă." },
  { question: "Cum este calificată intenția proprietarului?", answer: "Conversația urmărește dacă proprietarul este deschis la colaborare, când poate fi contactat din nou, ce obiecții are și dacă există suficiente semnale pentru preluarea de către un agent. Rezultatul este organizat într-un status și într-un context comercial ușor de continuat." },
  { question: "Ce vede agentul după apel?", answer: "Agentul vede proprietarul, anunțul și sursa, rezultatul apelului, informațiile comerciale relevante, obiecțiile și momentul recomandat pentru revenire. Astfel, follow-up-ul începe direct din punctul în care conversația AI s-a oprit." },
  { question: "Poate AI-ul să promită condiții în afara regulilor agenției?", answer: "Modulul este construit în jurul parametrilor și limitelor configurate de agenție. Rolul AI-ului este să deschidă și să califice conversația, nu să înlocuiască agentul în negocierea finală sau în construirea relației comerciale." },
  { question: "Ce se întâmplă dacă proprietarul nu răspunde sau cere să fie sunat mai târziu?", answer: "Rezultatul rămâne în istoric. În funcție de regulile stabilite, contactul poate fi eligibil pentru reîncercare sau poate genera un follow-up la ora solicitată, astfel încât echipa să nu piardă promisiunile de revenire." },
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

export default function AiCallsLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase calls-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link lux-nav-menu__link--active">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero calls-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Zap className="h-4 w-4" /> Prospectare AI, în regulile agenției tale</div>
              <h1>AI-ul deschide conversația. <span>Agentul închide mandatul.</span></h1>
              <p className="property-hero__lead">ImoDeus contactează proprietarii selectați de agenție, lucrează cu intervalul și limitele comerciale aprobate, califică intenția și trimite agentului doar conversațiile care merită continuate.</p>              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>
              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> Prospectare scalabilă</span><span><Check className="h-3.5 w-3.5" /> Reguli comerciale</span><span><Check className="h-3.5 w-3.5" /> Handoff calificat</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare modul Apeluri AI">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Voice intelligence live</span><span>prospectare activă</span></div>
              <ScreenFrame image="/landing/screenshots/premium-ai-calls.png" alt="Setări, reguli și istoric pentru apelurile AI către proprietari" label="ImoDeus.ai CRM / Apeluri AI" priority className="property-hero__screen calls-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail calls-connection-rail" aria-label="Tot parcursul unui apel AI este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview calls-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><Bot className="h-4 w-4" /> Apelul AI, ca motor de prospectare</div><h2 className="property-feature-title calls-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Prospectare automată</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">surse de proprietari</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">reguli de comision</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">intervale orare</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">conversații AI</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">calificarea intenției</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">istoric și handoff</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy calls-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><Headphones className="h-4 w-4" /> Voice intelligence, cu control comercial</div><h2 className="property-anatomy__title"><span>Tot ce transformă un apel într-o </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">oportunitate</span><span> pentru </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">agent.</span></h2><p>Nu este un robot care formează numere. Este un flux în care sursa, regulile, conversația, rezultatul și follow-up-ul rămân conectate până când agentul poate continua cu sens.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><Search className="h-3.5 w-3.5" /> Sursă</span><span><SlidersHorizontal className="h-3.5 w-3.5" /> Reguli</span><span><Headphones className="h-3.5 w-3.5" /> Conversație</span><span><Users className="h-3.5 w-3.5" /> Handoff</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{callIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual calls-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Voice intelligence core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><Headphones className="h-4 w-4" /></span><span><small>CONVERSAȚIE</small><strong>Intenție + obiecții</strong></span></div>                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><Users className="h-4 w-4" /></span><span><small>HANDOFF</small><strong>Agent + follow-up</strong></span></div>
                <ScreenFrame image="/landing/screenshots/premium-ai-calls.png" alt="Controlul și istoricul apelurilor AI către proprietari" label="ImoDeus.ai / Control room conversațional" className="property-anatomy__screen calls-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> reguli respectate</span><span><Target className="h-4 w-4" /> oportunități la vedere</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{callIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation calls-engine">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei momente, un singur flux</div><h2>Agenția alege. AI-ul califică. Agentul continuă.</h2></div><p>Automatizarea nu ia controlul din mâna echipei. Ea mută timpul agenților din apelurile repetitive în conversațiile unde experiența umană poate câștiga mandatul.</p></div>
            <div className="property-automation__grid">{voicePillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority calls-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Din volum, direct la oportunitate</div><h2>Nu vezi doar apeluri. Vezi unde trebuie să intre agentul.</h2></div><p>Proprietarul deschis, revenirea cerută, obiecția comercială sau apelul eligibil pentru reîncercare devin semnale clare. Echipa știe ce merită preluat și când.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după proprietar, status, sursă sau agent</span><span><CircleDot className="h-3.5 w-3.5" /> Istoric sincronizat</span></div><ScreenFrame image="/landing/screenshots/premium-ai-calls.png" alt="Lista apelurilor AI cu reguli, rezultate și statusuri" label="ImoDeus.ai CRM / Pipeline apeluri" className="property-priority__screen calls-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale pentru apelurile AI"><div className="property-priority__signals-head"><div><span>CE MERITĂ PRELUAT DE UN AGENT</span><strong>Conversațiile îți arată singure</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow calls-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge un anunț de proprietar într-o conversație pentru mandat.</h2><p>Selecția, regulile, apelul, calificarea și follow-up-ul uman lucrează împreună într-un proces repetabil și ușor de coordonat.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> prospectare zilnică, mai puține ore consumate pe apeluri reci și mai multă energie umană investită în proprietarii care pot deveni mandate.</span></div>
          </div>
        </section>

        <section className="property-roles calls-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> AI pentru volum, oameni pentru relație</div><h2>Agentul primește context. Managerul păstrează controlul. Agenția câștigă acoperire.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq calls-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără promisiuni de robot</div><h2>Întrebările pe care ni le pun agențiile despre Apelurile AI.</h2><p>Răspunsuri concrete despre surse, reguli, comision, calificare, istoric și momentul în care conversația ajunge la agent.</p><DemoButton className="mt-7" label="Vezi Apelurile AI în demo" /></div>            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>

        <section className="property-final calls-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe strategia agenției tale</div><h2>Următorul mandat poate începe cu un apel pe care agentul nu mai trebuie să-l facă rece.</h2><p>În demo vezi cum selectezi proprietarii, configurezi regulile, urmărești rezultatele și trimiți oportunitățile calificate către agentul potrivit.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}