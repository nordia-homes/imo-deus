import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, BadgeCheck, Building2, Check, CircleDot, ClipboardCheck, Clock3,
  Download, FileText, Gauge, Layers3, Play, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, Target, Upload, Users,
} from "lucide-react";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contracte pentru agenții imobiliare | ImoDeus.ai",
  description: "Bibliotecă de template-uri, import Word, date completate din CRM, editare vizuală, statusuri și export PDF într-un singur flux contractual.",
};

type IconItem = { icon: LucideIcon; title: string; text: string };

const heroSignals = [
  { icon: Layers3, value: "Template aprobat", label: "echipa pornește din versiunea corectă" },
  { icon: Sparkles, value: "Date din CRM", label: "client, proprietate, agent și comision" },
  { icon: Download, value: "Document pregătit", label: "verificat și exportat PDF" },
];

const capabilities: (IconItem & { meta: string })[] = [
  { icon: Layers3, meta: "BIBLIOTECĂ DE TEMPLATE-URI", title: "Contractul corect nu mai trebuie căutat prin foldere.", text: "Modelele folosite de agenție stau într-o bibliotecă organizată, cu denumire, categorie și status clar, astfel încât echipa pornește din documentul potrivit." },
  { icon: Upload, meta: "IMPORT WORD", title: "Păstrezi documentele bune pe care agenția le folosește deja.", text: "Template-urile Word existente pot fi aduse în CRM și pregătite pentru lucru recurent, fără să reconstruiești de la zero baza contractuală a agenției." },
  { icon: Sparkles, meta: "VARIABILE DIN CRM", title: "Numele, adresa și comisionul nu mai circulă prin copy-paste.", text: "Datele clientului, proprietarului, proprietății, agentului, prețului și comisionului pot completa documentul direct din contextul tranzacției." },
  { icon: FileText, meta: "REDACTARE & EDITARE", title: "Documentul se completează automat, dar rămâne în controlul agentului.", text: "Agentul pornește de la datele corecte, verifică textul și ajustează vizual clauzele sau informațiile specifice fiecărui caz înainte de forma finală." },
  { icon: ShieldCheck, meta: "STATUS & CONTROL", title: "Știi ce este draft, ce este activ și ce este gata de folosit.", text: "Statusurile și organizarea bibliotecii reduc riscul ca echipa să lucreze pe versiuni vechi, documente nefinalizate sau atașamente fără context." },
  { icon: Download, meta: "EXPORT PDF & TRANZACȚIE", title: "Contractul final rămâne lângă oamenii și proprietatea corectă.", text: "După verificare, documentul poate fi exportat PDF și păstrat în fluxul comercial, gata pentru semnare, arhivare și urmărirea tranzacției." },
];

const documentPillars: (IconItem & { eyebrow: string; chips: string[] })[] = [
  { icon: Layers3, eyebrow: "STANDARDIZEZI O DATĂ", title: "Agenția își transformă modelele juridice într-o bibliotecă de lucru.", text: "Importi sau creezi template-urile, stabilești ce model este activ și pregătești variabilele care trebuie completate. Echipa nu mai decide de fiecare dată din ce fișier să pornească.", chips: ["Template-uri", "Import Word", "Categorii", "Status activ"] },
  { icon: Sparkles, eyebrow: "COMPLETEZI DIN CRM", title: "Datele tranzacției intră în document fără muncă repetitivă.", text: "Clientul, proprietarul, proprietatea, agentul, prețul și comisionul sunt deja în sistem. Documentul le folosește ca punct de pornire și reduce rescrierea manuală.", chips: ["Client", "Proprietar", "Proprietate", "Comision"] },
  { icon: ClipboardCheck, eyebrow: "VERIFICI ȘI LIVREZI", title: "Agentul citește, ajustează și exportă forma potrivită cazului.", text: "Completarea automată nu elimină controlul uman. Agentul verifică informațiile, adaptează ce este specific tranzacției și generează PDF-ul final.", chips: ["Editare vizuală", "Verificare", "PDF", "Dosar tranzacție"] },
];

const prioritySignals: IconItem[] = [
  { icon: Clock3, title: "Draft care așteaptă completarea", text: "Documentul a fost pornit, dar lipsesc date necesare înainte de verificare." },
  { icon: ShieldCheck, title: "Template care trebuie revizuit", text: "Un model din bibliotecă are nevoie de actualizare înainte să fie folosit de echipă." },
  { icon: ClipboardCheck, title: "Contract gata de verificarea finală", text: "Datele sunt completate, iar agentul poate valida conținutul și condițiile specifice." },
  { icon: Download, title: "Document pregătit pentru export", text: "Forma finală este verificată și poate fi generată PDF pentru pasul următor." },
];

const workflow: IconItem[] = [
  { icon: Upload, title: "Aduci template-ul", text: "Importi documentul Word folosit deja de agenție sau pornești un model nou în biblioteca contractuală." },
  { icon: SlidersHorizontal, title: "Pregătești variabilele", text: "Stabilești ce informații se completează din CRM și ce rămâne de verificat sau adaptat pentru fiecare caz." },
  { icon: Users, title: "Alegi tranzacția", text: "Legi documentul de client, proprietar, proprietate și agent, folosind informația deja existentă în sistem." },
  { icon: FileText, title: "Verifici și editezi", text: "Controlezi datele completate, ajustezi textul specific și confirmi că documentul reflectă acordul comercial real." },
  { icon: Download, title: "Exporți și păstrezi", text: "Generezi PDF-ul final și păstrezi contractul în același context cu proprietatea și tranzacția." },
];

const roleCards = [
  { icon: FileText, overline: "PENTRU AGENT", title: "Contractul începe aproape complet, nu cu un document gol.", text: "Agentul alege template-ul potrivit, preia datele din CRM, verifică și ajustează doar elementele specifice tranzacției. Mai puțină tastare, mai multă atenție la ceea ce se semnează.", bullets: ["date preluate din client și proprietate", "editare vizuală înainte de export", "document final legat de tranzacția corectă"] },
  { icon: ShieldCheck, overline: "PENTRU MANAGER & OPERAȚIUNI", title: "Biblioteca agenției rămâne coerentă și ușor de controlat.", text: "Managementul vede ce template-uri sunt active, draft sau importate și reduce riscul ca agenții să folosească versiuni vechi ori documente luate din surse diferite.", bullets: ["modele aprobate într-un singur loc", "status clar pentru fiecare template", "mai puține versiuni paralele și atașamente pierdute"] },
  { icon: Building2, overline: "PENTRU TRANZACȚIE", title: "Documentele rămân acolo unde există și contextul comercial.", text: "Contractul nu mai este un fișier separat de CRM. Clientul, proprietarul, proprietatea, comisionul și forma finală rămân parte din același dosar operațional.", bullets: ["legătură clară între document și tranzacție", "informație coerentă pentru întreaga echipă", "predare și arhivare mai ușor de urmărit"] },
];

const contractIntelligence: IconItem[] = [
  { icon: Layers3, title: "Template-ul și categoria potrivită", text: "Tipul documentului, denumirea și utilizarea lui sunt clare înainte ca agentul să înceapă completarea." },
  { icon: Users, title: "Datele clientului sau cumpărătorului", text: "Identitatea și informațiile de contact pot fi preluate din profilul deja existent în CRM." },
  { icon: Building2, title: "Proprietarul și proprietatea", text: "Părțile, adresa, caracteristicile și contextul ofertei rămân legate de document." },  { icon: Target, title: "Agentul și agenția", text: "Datele reprezentantului, responsabilitatea și informațiile agenției intră în același flux contractual." },
  { icon: Gauge, title: "Prețul, comisionul și condițiile", text: "Valorile comerciale importante sunt aduse din tranzacție și verificate înainte de export." },
  { icon: FileText, title: "Clauzele și particularitățile cazului", text: "Textul poate fi revizuit și adaptat acolo unde situația concretă cere o formulare specifică." },
  { icon: ShieldCheck, title: "Statusul și verificarea documentului", text: "Draftul, documentul activ și forma pregătită pentru export sunt ușor de diferențiat." },
  { icon: Download, title: "PDF-ul și dosarul tranzacției", text: "Forma finală este generată și păstrată lângă relația comercială care a produs-o." },
];

const connectedFlow = [
  { icon: Layers3, label: "Template" }, { icon: Upload, label: "Word" },
  { icon: SlidersHorizontal, label: "Variabile" }, { icon: Sparkles, label: "CRM" },
  { icon: Users, label: "Client" }, { icon: Building2, label: "Proprietate" },
  { icon: Gauge, label: "Comision" }, { icon: FileText, label: "Editor" },
  { icon: Download, label: "PDF" }, { icon: ClipboardCheck, label: "Tranzacție" },
];

const questions = [
  { question: "Putem porni de la contractele pe care agenția le folosește deja?", answer: "Da. Template-urile Word existente pot fi importate în biblioteca agenției și pregătite pentru utilizare recurentă. Astfel păstrezi structura documentelor deja validate și le aduci în același flux cu proprietățile, clienții și tranzacțiile." },
  { question: "Ce date pot fi completate din CRM?", answer: "În funcție de template și de informația disponibilă, documentul poate porni de la datele clientului, proprietarului, proprietății, agentului, agenției, prețului și comisionului. Agentul verifică întotdeauna forma rezultată înainte de export." },
  { question: "Agentul poate modifica documentul pentru un caz particular?", answer: "Da. Completarea automată oferă punctul de pornire, iar agentul poate revizui și edita vizual textul înainte de generarea PDF-ului. Particularitățile tranzacției rămân astfel sub control uman." },
  { question: "Cum evităm folosirea unui template greșit sau vechi?", answer: "Biblioteca centralizează modelele și afișează statusul lor: de exemplu activ, draft sau importat. Echipa vede mai clar din ce document trebuie să lucreze, fără să aleagă între fișiere similare împrăștiate în foldere și conversații." },
  { question: "Ce se întâmplă după ce documentul este verificat?", answer: "Contractul poate fi exportat PDF, pregătit pentru semnare și păstrat în contextul tranzacției. Clientul, proprietatea, agentul și valorile comerciale rămân ușor de urmărit împreună cu documentul final." },
  { question: "Modulul înlocuiește verificarea juridică?", answer: "Nu. Modulul organizează template-urile, preia datele și accelerează redactarea operațională. Agenția și profesioniștii responsabili păstrează controlul asupra conținutului juridic, actualizării modelelor și formei care urmează să fie folosită." },
];

function DemoButton({ className = "", label = "Vezi demo live" }: { className?: string; label?: string }) {
  return <Button asChild size="lg" className={"lux-primary-button h-14 px-6 text-base font-semibold " + className}><Link href="/demo"><Play className="h-4 w-4 fill-current" />{label}</Link></Button>;
}

function ScreenFrame({ image, alt, label, priority = false, className = "" }: { image: string; alt: string; label: string; priority?: boolean; className?: string }) {
  return (
    <div className={"lux-screen property-screen " + className}>
      <div className="lux-screen__bar"><div className="flex items-center gap-1.5" aria-hidden="true"><span className="lux-dot bg-[#fb7185]" /><span className="lux-dot bg-[#fbbf24]" /><span className="lux-dot bg-[#34d399]" /></div><span>{label}</span></div>
      <div className="lux-screen__viewport"><Image src={image} alt={alt} width={1900} height={900} priority={priority} loading={priority ? "eager" : "lazy"} sizes="(max-width: 767px) 820px, (max-width: 1279px) 92vw, 900px" className="lux-screen__image" /></div>
    </div>
  );
}

export default function ContractsLandingPage() {
  return (
    <>
      <main className="lux-shell property-showcase contracts-showcase min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai"><ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" /></Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link">Platforma</Link><Link href="/apeluri-ai" className="lux-nav-menu__link">Apeluri AI</Link><Link href="/proprietati" className="lux-nav-menu__link">Proprietăți</Link><Link href="/cumparatori" className="lux-nav-menu__link">Cumpărători</Link><Link href="/ai-matching" className="lux-nav-menu__link">AI Matching</Link><Link href="/vizionari" className="lux-nav-menu__link">Vizionări</Link><Link href="/contracte" className="lux-nav-menu__link lux-nav-menu__link--active">Contracte</Link><Link href="/marketing-studio" className="lux-nav-menu__link">Marketing Studio</Link><Link href="/portaluri-online" className="lux-nav-menu__link">Portaluri Online</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3"><Button asChild variant="ghost" className="hidden h-9 rounded-full px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href="/login">Autentificare</Link></Button><Button asChild variant="outline" className="hidden h-9 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.15] hover:text-white sm:inline-flex"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button><DemoButton className="h-9 px-4 text-sm" label="Demo live" /></div>
          </div>
        </header>

        <section className="property-hero contracts-premium-hero">
          <div className="property-hero__grid" /><div className="property-hero__orb property-hero__orb--one" /><div className="property-hero__orb property-hero__orb--two" />
          <div className="property-hero__inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(440px,0.78fr)_minmax(620px,1.22fr)] lg:items-center lg:px-8">
            <div className="property-hero__copy">
              <div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> De la datele tranzacției la documentul final</div>
              <h1>Contractul pornește din datele corecte. <span>Nu din copy-paste.</span></h1>
              <p className="property-hero__lead">Alegi template-ul aprobat, ImoDeus aduce datele clientului, proprietății, agentului și comisionului, iar tu verifici, ajustezi și exporți PDF-ul final din același CRM.</p>
              <div className="property-hero__actions"><DemoButton className="property-hero__primary" label="Arată-mi cum funcționează" /><Button asChild size="lg" variant="outline" className="property-hero__secondary"><Link href="#cum-functioneaza">Vezi parcursul complet <ArrowRight className="h-4 w-4" /></Link></Button></div>              <div className="property-hero__context" aria-label="Informații conectate în modul"><span><Check className="h-3.5 w-3.5" /> Template-uri controlate</span><span><Check className="h-3.5 w-3.5" /> Completare din CRM</span><span><Check className="h-3.5 w-3.5" /> Export PDF premium</span></div>
            </div>
            <div className="property-hero__stage" aria-label="Previzualizare modul Contracte">
              <div className="property-hero__stage-glow" /><div className="property-hero__stage-label"><span><CircleDot className="h-3.5 w-3.5" /> Document workspace</span><span>bibliotecă sincronizată</span></div>
              <ScreenFrame image="/landing/screenshots/contracts.png" alt="Biblioteca de contracte cu template-uri, statusuri și acțiuni" label="ImoDeus.ai CRM / Contracte" priority className="property-hero__screen contracts-hero__screen" />
              <div className="property-hero__signals">{heroSignals.map((signal) => { const SignalIcon = signal.icon; return <div key={signal.label} className="property-hero__signal"><span className="property-hero__signal-icon"><SignalIcon className="h-4 w-4" /></span><span><strong>{signal.value}</strong><small>{signal.label}</small></span></div>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-connection-rail contracts-connection-rail" aria-label="Tot parcursul unui contract este conectat"><div className="property-connection-rail__track">{[...connectedFlow, ...connectedFlow].map((item, index) => { const ItemIcon = item.icon; return <div key={item.label + "-" + index} className="property-connection-rail__item" aria-hidden={index >= connectedFlow.length}><span><ItemIcon className="h-4 w-4" /></span><strong>{item.label}</strong><ArrowRight className="h-4 w-4" /></div>; })}</div></section>

        <section className="property-overview contracts-overview" id="cum-functioneaza">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-section-head property-section-head--centered"><div><div className="property-eyebrow"><FileText className="h-4 w-4" /> Contractul, ca parte din tranzacție</div><h2 className="property-feature-title contracts-feature-title">
              <span className="property-feature-title__item property-feature-title__item--photo">„Bibliotecă de template-uri</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--copy">import Word</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--portals">variabile din CRM</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--video">completare automată</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--social">editare vizuală</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--matching">status și control</span><span className="property-feature-title__separator">, </span><span className="property-feature-title__item property-feature-title__item--pdf">export PDF</span><span className="property-feature-title__separator"> și </span><span className="property-feature-title__item property-feature-title__item--more">multe altele.”</span>
            </h2></div></div>
            <div className="property-capability-grid">{capabilities.map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className={"property-capability-card property-capability-card--" + (index + 1)}><div className="property-capability-card__top"><span className="property-capability-card__icon"><ItemIcon className="h-5 w-5" /></span><span className="property-capability-card__meta">{item.meta}</span></div><div className="property-capability-card__aura" aria-hidden="true"><span className="property-capability-card__aura-ring" /><span className="property-capability-card__aura-ring property-capability-card__aura-ring--inner" /><ItemIcon className="property-capability-card__aura-icon" /></div><div className="property-capability-card__signal" aria-hidden="true"><span /><span /><span /></div><h3>{item.title}</h3><p>{item.text}</p><span className="property-capability-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="property-capability-card__arrow" aria-hidden="true"><ArrowRight className="h-4 w-4" /></span></article>; })}</div>
          </div>
        </section>

        <section className="property-anatomy contracts-intelligence">
          <div className="property-anatomy__grid" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-anatomy__head"><div className="property-eyebrow property-eyebrow--dark"><ClipboardCheck className="h-4 w-4" /> Document intelligence, cu datele la vedere</div><h2 className="property-anatomy__title"><span>Tot ce transformă un template într-un </span><span className="property-anatomy__title-accent property-anatomy__title-accent--property">contract</span><span> gata de </span><span className="property-anatomy__title-accent property-anatomy__title-accent--record">verificat.</span></h2><p>Nu este doar un editor. Este locul în care documentul preia contextul tranzacției, rămâne sub controlul echipei și ajunge organizat până la PDF-ul final.</p><div className="property-anatomy__chips" aria-label="Capabilități conectate"><span><Layers3 className="h-3.5 w-3.5" /> Template</span><span><Sparkles className="h-3.5 w-3.5" /> Date CRM</span><span><FileText className="h-3.5 w-3.5" /> Editor</span><span><Download className="h-3.5 w-3.5" /> PDF</span></div></div>
            <div className="property-anatomy__stage">
              <div className="property-anatomy__column">{contractIntelligence.slice(0, 4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 1).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
              <div className="property-anatomy__visual contracts-intelligence__visual">
                <div className="property-anatomy__core-glow" /><div className="property-anatomy__orbit property-anatomy__orbit--one" /><div className="property-anatomy__orbit property-anatomy__orbit--two" /><div className="property-anatomy__visual-badge"><CircleDot className="h-3.5 w-3.5" /> Document intelligence core</div>
                <div className="property-anatomy__hud property-anatomy__hud--matching"><span className="property-anatomy__hud-icon"><Sparkles className="h-4 w-4" /></span><span><small>COMPLETARE</small><strong>Client + proprietate</strong></span></div>
                <div className="property-anatomy__hud property-anatomy__hud--distribution"><span className="property-anatomy__hud-icon"><ShieldCheck className="h-4 w-4" /></span><span><small>CONTROL</small><strong>Verificare + PDF</strong></span></div>                <ScreenFrame image="/landing/screenshots/contracts.png" alt="Biblioteca și fluxul documentelor contractuale" label="ImoDeus.ai / Document workspace" className="property-anatomy__screen contracts-intelligence__screen" />
                <div className="property-anatomy__visual-proof"><span><BadgeCheck className="h-4 w-4" /> template controlat</span><span><ClipboardCheck className="h-4 w-4" /> tranzacție documentată</span></div>
              </div>
              <div className="property-anatomy__column property-anatomy__column--right">{contractIntelligence.slice(4).map((item, index) => { const ItemIcon = item.icon; return <article key={item.title} className="property-anatomy__item"><span className="property-anatomy__item-number">{String(index + 5).padStart(2, "0")}</span><span className="property-anatomy__item-icon"><ItemIcon className="h-4 w-4" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div>
            </div>
          </div>
        </section>

        <section className="property-automation contracts-engine">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-automation__head"><div><div className="property-eyebrow"><Sparkles className="h-4 w-4" /> Trei pași, fără documente reconstruite</div><h2>Standardizezi o dată. Completezi din CRM. Livrezi forma potrivită.</h2></div><p>Biblioteca, datele tranzacției și editarea finală lucrează împreună, astfel încât viteza să nu vină în detrimentul controlului.</p></div>
            <div className="property-automation__grid">{documentPillars.map((pillar, index) => { const PillarIcon = pillar.icon; return <article key={pillar.title} className="property-automation__card"><div className="property-automation__card-top"><span className="property-automation__card-icon"><PillarIcon className="h-5 w-5" /></span><span className="property-automation__card-number">{String(index + 1).padStart(2, "0")}</span></div><span className="property-automation__eyebrow">{pillar.eyebrow}</span><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="property-automation__chips">{pillar.chips.map((chip) => <span key={chip}><BadgeCheck className="h-3.5 w-3.5" /> {chip}</span>)}</div></article>; })}</div>
          </div>
        </section>

        <section className="property-priority contracts-priority">
          <div className="property-priority__glow" />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-[4.5rem]">
            <div className="property-priority__head"><div><div className="property-eyebrow property-eyebrow--dark"><ShieldCheck className="h-4 w-4" /> Biblioteca îți arată ce cere atenție</div><h2>Nu vezi doar documente. Vezi ce trebuie completat, verificat sau exportat.</h2></div><p>Draftul incomplet, template-ul de revizuit, contractul gata de verificare și documentul pregătit pentru PDF ies singure în față, fără căutări prin foldere.</p></div>
            <div className="property-priority__cockpit">
              <div className="property-priority__media"><div className="property-priority__media-toolbar"><span><Search className="h-3.5 w-3.5" /> Caută după document, client, proprietate sau status</span><span><CircleDot className="h-3.5 w-3.5" /> Bibliotecă sincronizată</span></div><ScreenFrame image="/landing/screenshots/contracts.png" alt="Biblioteca de contracte cu statusuri și acțiuni" label="ImoDeus.ai CRM / Contracte și template-uri" className="property-priority__screen contracts-priority__screen" /></div>
              <aside className="property-priority__signals" aria-label="Semnale operaționale pentru contracte"><div className="property-priority__signals-head"><div><span>CE MERITĂ REZOLVAT ACUM</span><strong>Documentele îți arată singure</strong></div><span className="property-priority__live"><CircleDot className="h-3 w-3" /> LIVE</span></div><div className="property-priority__signal-list">{prioritySignals.map((signal) => { const SignalIcon = signal.icon; return <article key={signal.title}><span><SignalIcon className="h-4 w-4" /></span><div><h3>{signal.title}</h3><p>{signal.text}</p></div><ArrowRight className="h-4 w-4" /></article>; })}</div></aside>
            </div>
          </div>
        </section>

        <section className="property-workflow contracts-workflow">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-workflow__head"><div className="property-eyebrow"><Layers3 className="h-4 w-4" /> Cum arată în practică</div><h2>Așa ajunge un template din bibliotecă în dosarul tranzacției.</h2><p>Importul, variabilele, datele din CRM, verificarea și exportul PDF formează un singur traseu, ușor de continuat de întreaga echipă.</p></div>
            <div className="property-workflow__track">{workflow.map((step, index) => { const StepIcon = step.icon; return <article key={step.title} className="property-workflow__step"><span className="property-workflow__number">{String(index + 1).padStart(2, "0")}</span><span className="property-workflow__icon"><StepIcon className="h-5 w-5" /></span><h3>{step.title}</h3><p>{step.text}</p></article>; })}</div>
            <div className="property-workflow__result"><ShieldCheck className="h-5 w-5" /><span><strong>Ce se schimbă:</strong> mai puține date rescrise, mai puține versiuni greșite și un document final care rămâne legat de tranzacția pentru care a fost creat.</span></div>
          </div>
        </section>

        <section className="property-roles contracts-roles">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="property-roles__head"><div className="property-eyebrow property-eyebrow--dark"><Users className="h-4 w-4" /> Viteză pentru agent, standard pentru agenție</div><h2>Fiecare lucrează mai repede, fără să piardă controlul documentului.</h2></div>
            <div className="property-roles__grid">{roleCards.map((role, index) => { const RoleIcon = role.icon; return <article key={role.overline} className={"property-role-card property-role-card--" + (index + 1)}><div className="property-role-card__icon"><RoleIcon className="h-6 w-6" /></div><span className="property-role-card__overline">{role.overline}</span><h3>{role.title}</h3><p>{role.text}</p><ul>{role.bullets.map((bullet) => <li key={bullet}><BadgeCheck className="h-4 w-4" /> {bullet}</li>)}</ul></article>; })}</div>
          </div>
        </section>

        <section className="property-faq contracts-faq">
          <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:px-8 lg:py-24">
            <div className="property-faq__intro"><div className="property-eyebrow"><FileText className="h-4 w-4" /> Pe scurt, fără limbaj de broșură</div><h2>Întrebările pe care ni le pun agențiile despre modulul Contracte.</h2><p>Răspunsuri concrete despre template-uri, import Word, date din CRM, editare, controlul versiunilor și export PDF.</p><DemoButton className="mt-7" label="Vezi Contractele în demo" /></div>
            <div className="property-faq__list">{questions.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.question}</h3><p>{item.answer}</p></div></article>)}</div>
          </div>
        </section>

        <section className="property-final contracts-final">          <div className="property-final__orb" />
          <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8 lg:py-24">
            <div><div className="property-eyebrow property-eyebrow--dark"><Sparkles className="h-4 w-4" /> Merită să îl vezi pe documentele agenției tale</div><h2>Când clientul spune „da”, contractul nu ar trebui să înceapă de la zero.</h2><p>În demo vezi cum imporți template-urile, folosești datele din CRM, verifici documentul și generezi PDF-ul final în același sistem cu tranzacția.</p></div>
            <div className="property-final__actions"><DemoButton className="w-full justify-center" label="Vreau o demonstrație" /><Button asChild size="lg" variant="outline" className="property-final__secondary"><Link href="/register">Creează cont <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-[#06101d]"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p><div className="flex flex-wrap items-center gap-3"><Link href="/termeni-si-conditii" className="font-medium text-slate-300 transition-colors hover:text-white">Termeni și condiții</Link><Link href="/confidentialitate" className="font-medium text-slate-300 transition-colors hover:text-white">Politica de confidențialitate</Link></div></div></footer>
    </>
  );
}