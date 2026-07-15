import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, Bot, Building2, CalendarCheck2, Check, CircleDot, Clock3,
  FileText, Gauge, Layers3, LineChart, MessageSquareText, Play, Search,
  ShieldCheck, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "AI Matching pentru agenții imobiliare | ImoDeus.ai",
  description: "Comparare automată între cumpărători și proprietăți, scor explicat, criterii, compromisuri, selecții și următorul pas comercial într-un singur flux.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: Target, value: "Scor explicat", label: "vezi de ce se potrivește" },
  { icon: Building2, value: "Portofoliu scanat", label: "proprietățile relevante ies în față" },
  { icon: CalendarCheck2, value: "Gata de acțiune", label: "mesaj, apel sau vizionare" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Users, meta: "PROFIL & CRITERII", title: "AI-ul pornește de la ce caută cumpărătorul în realitate.", text: "Bugetul, zonele, tipul, camerele, suprafața și preferințele formează un profil clar. Nu doar filtre, ci cererea comercială pe care agentul o poate verifica." },
  { icon: Search, meta: "SCANARE AUTOMATĂ", title: "Portofoliul este verificat înainte să îl cauți manual.", text: "ImoDeus compară cererea cu proprietățile active și scoate în față opțiunile relevante, inclusiv cele pe care agentul le-ar putea trece ușor cu vederea." },
  { icon: Gauge, meta: "SCOR DE COMPATIBILITATE", title: "Fiecare rezultat are o ordine și un motiv.", text: "Scorul ajută agentul să înceapă cu proprietățile cele mai apropiate de cerere, fără să transforme recomandarea într-o decizie automată sau opacă." },
  { icon: Sparkles, meta: "MOTIVE & COMPROMISURI", title: "Vezi ce se potrivește perfect și unde există diferențe.", text: "Zona, prețul, suprafața, camerele și dotările sunt explicate pe înțelesul agentului, astfel încât conversația cu clientul să fie sinceră și bine argumentată." },
  { icon: MessageSquareText, meta: "SHORTLIST & CONVERSAȚIE", title: "Din zeci de proprietăți, rămân cele care merită discutate.", text: "Agentul verifică rezultatele, își construiește selecția și pornește un apel sau un mesaj cu recomandări concrete, nu cu un link trimis la întâmplare." },
  { icon: CalendarCheck2, meta: "STOC NOU & VIZIONARE", title: "Când apare ceva relevant, cererea revine în mișcare.", text: "Proprietățile noi pot fi comparate cu cumpărătorii existenți, iar potrivirile bune pot continua rapid spre o selecție actualizată, follow-up și vizionare." },
];

const matchingPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: Users, eyebrow: "ÎNȚELEGE CEREREA", title: "Criteriile cumpărătorului devin un briefing comercial complet.", text: "AI Matching folosește informațiile pe care agentul le-a calificat: ce este obligatoriu, ce este preferabil, ce buget există și cât de pregătit este clientul să decidă.", chips: ["Buget", "Zone", "Tip & camere", "Preferințe"] },
  { icon: Building2, eyebrow: "CITEȘTE PORTOFOLIUL", title: "Fiecare proprietate este privită prin ochii cumpărătorului.", text: "Sistemul compară caracteristicile ofertei cu cererea, ordonează rezultatele și face vizibile atât punctele forte, cât și diferențele care trebuie discutate.", chips: ["Compatibilitate", "Scor", "Motive", "Compromisuri"] },
  { icon: Target, eyebrow: "PORNEȘTE ACȚIUNEA", title: "Potrivirea devine recomandare, conversație și vizionare.", text: "Agentul păstrează controlul, alege ce merită trimis și continuă imediat cu mesaj, apel, follow-up sau programarea unei întâlniri.", chips: ["Shortlist", "Mesaj", "Apel", "Vizionare"] },
];

const prioritySignals: IconItem[] = [
  { icon: Target, title: "Potrivire nouă cu scor ridicat", text: "O proprietate respectă criteriile unui cumpărător activ și merită verificată acum." },
  { icon: MessageSquareText, title: "Selecție bună, încă netrimisă", text: "Rezultatele sunt pregătite, dar conversația cu clientul nu a fost încă pornită." },
  { icon: Building2, title: "Stoc nou pentru o cerere veche", text: "A apărut o ofertă care poate reactiva un cumpărător din baza agenției." },
  { icon: Clock3, title: "Potrivire văzută, fără follow-up", text: "Clientul a primit recomandarea, însă următorul pas nu este încă programat." },
];

const workflow: IconItem[] = [
  { icon: Users, title: "Completezi cererea", text: "Clarifici bugetul, zonele, tipul proprietății, criteriile obligatorii și preferințele cumpărătorului." },
  { icon: Building2, title: "Pregătești portofoliul", text: "Proprietățile au date, preț, localizare, suprafețe și dotări suficient de clare pentru o comparație relevantă." },
  { icon: Gauge, title: "Înțelegi rezultatele", text: "AI Matching ordonează opțiunile și explică scorul, punctele forte și diferențele fiecărei potriviri." },
  { icon: MessageSquareText, title: "Construiești selecția", text: "Agentul verifică, alege recomandările potrivite și pornește conversația cu argumentele deja la vedere." },
  { icon: CalendarCheck2, title: "Conduci spre vizionare", text: "Reacția cumpărătorului, feedbackul și interesul duc mai departe spre follow-up, întâlnire sau o nouă potrivire." },
];

const roleCards = [
  { icon: MessageSquareText, overline: "PENTRU AGENT", title: "Mai puțin timp căutând. Mai mult timp vorbind cu oamenii potriviți.", text: "Agentul primește o listă scurtă, ordonată și explicată. Poate verifica repede recomandările, înțelege compromisurile și porni conversația cu un motiv concret.", bullets: ["proprietăți relevante scoase rapid în față", "scor și explicații ușor de verificat", "selecție, mesaj, apel și vizionare în același flux"] },
  { icon: LineChart, overline: "PENTRU MANAGER", title: "Vezi unde portofoliul și cererea se întâlnesc cu adevărat.", text: "Managerul înțelege ce proprietăți au cumpărători compatibili, ce cereri nu găsesc suficient stoc și ce potriviri bune așteaptă încă o acțiune din partea echipei.", bullets: ["cerere acoperită și cerere fără stoc", "potriviri cu potențial comercial ridicat", "acțiuni și conversie de la match la vizionare"] },
  { icon: ShieldCheck, overline: "PENTRU EXPERIENȚA CLIENTULUI", title: "Cumpărătorul primește recomandări care au sens pentru el.", text: "Nu este bombardat cu anunțuri. Primește o selecție argumentată, înțelege unde proprietatea respectă cererea și poate decide mai repede ce merită vizionat.", bullets: ["mai puține recomandări irelevante", "compromisuri explicate, nu ascunse", "dialog mai personal și decizie mai ușoară"] },
];

const matchingIntelligence: IconItem[] = [
  { icon: Users, title: "Profilul complet al cumpărătorului", text: "Bugetul, finanțarea, zonele, tipul, camerele și momentul cumpărării formează baza potrivirii." },
  { icon: Building2, title: "Datele reale ale proprietății", text: "Prețul, localizarea, suprafețele, compartimentarea și dotările sunt comparate cu cererea." },
  { icon: ShieldCheck, title: "Criterii obligatorii", text: "Condițiile pe care cumpărătorul nu vrea să le negocieze rămân vizibile în evaluarea rezultatului." },  { icon: Sparkles, title: "Preferințe și flexibilitate", text: "Lucrurile dorite, dar negociabile, ajută la descoperirea unor opțiuni bune care nu sunt identice cu brief-ul." },
  { icon: Gauge, title: "Scorul de compatibilitate", text: "Rezultatele sunt ordonate pentru ca agentul să înceapă cu proprietățile care merită atenție." },
  { icon: Target, title: "Motivele potrivirii", text: "Agentul vede concret ce criterii sunt îndeplinite și de ce oferta poate fi relevantă pentru client." },
  { icon: Search, title: "Diferențe și compromisuri", text: "Depășirea de buget, zona apropiată sau o suprafață diferită sunt explicate înainte de recomandare." },
  { icon: CalendarCheck2, title: "Selecție și următorul pas", text: "Potrivirea verificată continuă spre mesaj, apel, vizionare, feedback și o cerere mai bine rafinată." },
];

const connectedFlow = [
  { icon: Users, label: "Cumpărător" }, { icon: Search, label: "Criterii" },
  { icon: Building2, label: "Portofoliu" }, { icon: Sparkles, label: "Comparare AI" },
  { icon: Gauge, label: "Scor" }, { icon: Target, label: "Explicație" },
  { icon: Layers3, label: "Shortlist" }, { icon: MessageSquareText, label: "Conversație" },
  { icon: CalendarCheck2, label: "Vizionare" }, { icon: TrendingUp, label: "Feedback" },
];

const questions = [
  { question: "Ce informații folosește AI Matching?", answer: "Compară criteriile cumpărătorului — buget, zone, tip, camere, suprafață, dotări și alte preferințe — cu informațiile proprietăților din portofoliu. Cu cât datele sunt mai complete și mai bine calificate, cu atât rezultatele sunt mai utile pentru agent." },
  { question: "Ce înseamnă scorul de compatibilitate?", answer: "Scorul ordonează proprietățile după apropierea față de cerere. Nu înlocuiește decizia agentului și nu promite că o proprietate este perfectă. Este un punct de pornire rapid, însoțit de motivele și diferențele pe care agentul le poate verifica." },
  { question: "AI-ul decide ce proprietate primește cumpărătorul?", answer: "Nu. ImoDeus propune și explică rezultatele, iar agentul păstrează controlul. El verifică proprietățile, ține cont de contextul conversației și alege ce intră în selecția trimisă cumpărătorului." },
  { question: "Ce se întâmplă când intră o proprietate nouă?", answer: "Noua proprietate poate fi comparată cu cererile active din CRM. Astfel, agenția vede rapid cumpărătorii compatibili și poate porni conversații relevante cât oferta este proaspătă, fără o căutare manuală prin baza de contacte." },
  { question: "Cum sunt explicate compromisurile?", answer: "Agentul vede unde oferta respectă cererea și unde diferă: de exemplu, preț ușor mai mare, zonă apropiată, suprafață mai mică sau lipsa unei dotări. Acest context îl ajută să decidă dacă proprietatea merită prezentată și cum să formuleze recomandarea." },
  { question: "Cum ajunge o potrivire la vizionare?", answer: "Agentul verifică rezultatele, formează selecția și contactează cumpărătorul cu argumentele relevante. Reacția clientului rămâne în istoric, iar proprietatea aleasă poate continua direct spre follow-up și programarea unei vizionări." },
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

export default function AiMatchingLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase matching-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link lux-nav-menu__link--active">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero matching-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Potriviri explicate, control păstrat de agent</div>
              <h1>Nu mai cauți potrivirea. <span>O vezi explicată.</span></h1>
              <p className="property-hero__lead">Când intră o cerere sau o proprietate nouă, ImoDeus compară automat cumpărătorii cu portofoliul. Agentul vede scorul, motivele, compromisurile și opțiunile care merită transformate în conversație și vizionare.</p>
              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> Comparare automată</span><span><Check className="h-3.5 w-3.5" /> Scor explicabil</span><span><Check className="h-3.5 w-3.5" /> Agentul decide</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare rezultate AI Matching">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Matching activ</span><span>portofoliu scanat acum</span></div>
              <ScreenFrame image="/landing/screenshots/ai-matching-results.png" alt="Rezultate AI Matching cu proprietăți ordonate și explicate" label="ImoDeus.ai CRM / AI Matching" priority className="property-hero__screen matching-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail matching-connection-rail" aria-label="Tot parcursul unei potriviri este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview matching-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><Bot className="h-4 w-4" /> Matching explicabil, nu cutie neagră</div><h2 className="property-feature-title matching-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Profil și criterii complete</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">comparare automată cu portofoliul</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">scor de compatibilitate</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">motive clare</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">compromisuri vizibile</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">shortlist gata de trimis</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">potriviri la stoc nou</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy matching-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Match intelligence, cu logica la vedere</div><h2 className="property-anatomy__title"><span>De la două fișe la o </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">potrivire</span><span> pe care o poți </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">explica.</span></h2><p>AI Matching citește cererea și oferta împreună. Nu ascunde diferențele și nu înlocuiește agentul — ordonează informația, explică rezultatele și face următorul pas mult mai ușor.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><Users className="h-3.5 w-3.5" /> Cerere</span><span><Building2 className="h-3.5 w-3.5" /> Portofoliu</span><span><Gauge className="h-3.5 w-3.5" /> Scor</span><span><Target className="h-3.5 w-3.5" /> Explicație</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{matchingIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual matching-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Match intelligence core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><Gauge className="h-4 w-4" /></span><span><small>COMPATIBILITATE</small><strong>Scor + criterii</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><ShieldCheck className="h-4 w-4" /></span><span><small>CONTROL</small><strong>Agentul verifică</strong></span></div>                <ScreenFrame image="/landing/screenshots/lead-matching-detail.png" alt="Profil de cumpărător cu scor și proprietăți recomandate" label="ImoDeus.ai / Logica potrivirii" className="property-anatomy__screen matching-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> rezultate explicabile</span><span><MessageSquareText className="h-4 w-4" /> conversație pregătită</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{matchingIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation matching-engine">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei motoare, o recomandare bună</div><h2>ImoDeus înțelege cererea, citește portofoliul și pregătește acțiunea.</h2></div><p>Potrivirea nu se oprește la un procent. Criteriile cumpărătorului, datele proprietății și contextul agentului se întâlnesc într-o selecție care poate fi folosită imediat.</p></div>
            <div className="property-automation__grid">{matchingPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority matching-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><Target className="h-4 w-4" /> Oportunitățile ies singure în față</div><h2>Nu vezi doar scoruri. Vezi ce conversație merită pornită acum.</h2></div><p>Potrivirea nouă, selecția netrimisă, stocul care poate reactiva un cumpărător sau rezultatul fără follow-up devin semnale clare pentru agent și manager.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după cumpărător, proprietate sau scor</span><span><CircleDot className="h-3.5 w-3.5" /> Matching recalculat</span></div><ScreenFrame image="/landing/screenshots/ai-matching-results.png" alt="Rezultate de potrivire ordonate după compatibilitate" label="ImoDeus.ai CRM / Rezultate explicate" className="property-priority__screen matching-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale AI Matching"><div className="property-priority__signals-head"><div><span>CE MERITĂ TRANSFORMAT ÎN ACȚIUNE</span><strong>Matching-ul îți arată singur</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow matching-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge o potrivire din date într-o vizionare reală.</h2><p>Cererea completă și proprietatea bine documentată alimentează scorul, explicația, selecția, conversația și următorul pas.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puține căutări manuale, recomandări mai relevante și conversații pornite exact acolo unde portofoliul și cererea se întâlnesc.</span></div>
          </div>
        </section>

        <section className="property-roles matching-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> AI care ajută echipa, fără să îi ia controlul</div><h2>Agentul decide mai repede. Managerul vede oportunitatea. Clientul primește relevanță.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq matching-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără promisiuni magice</div><h2>Întrebările pe care ni le pun agențiile despre AI Matching.</h2><p>Răspunsuri concrete despre date, scor, explicații, controlul agentului și traseul unei potriviri până la vizionare.</p><DemoButton className="mt-7" label="Vezi AI Matching în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>
        <section className="property-final matching-final">
          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe portofoliul tău</div><h2>Portofoliul tău conține deja răspunsuri pentru cumpărătorii din CRM.</h2><p>În demo vezi cum AI Matching le găsește, le ordonează, explică diferențele și ajută agentul să transforme o potrivire bună în conversație, selecție și vizionare.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}