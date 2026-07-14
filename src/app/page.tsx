import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Crown,
  FileText,
  Globe2,
  Layers3,
  LineChart,
  MapPinned,
  MessageSquareText,
  Play,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImoDeusTextLogo } from "@/components/icons/ImoDeusTextLogo";

type ProductScreen = {
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  stat: string;
  statLabel: string;
  signals: string[];
};

type ProductConversionCard = {
  metric: string;
  title: string;
  text: string;
};

type Capability = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const heroStats = [
  { value: "1 workspace", label: "pentru intreaga agentie" },
  { value: "AI live", label: "matching, scoring, briefing" },
  { value: "Go live", label: "website si publicare conectate" },
];

const publishingPartners = [
  { name: "Storia", logo: "/storia-official-logo.svg", width: 109, height: 30 },
  { name: "Imobiliare.ro", logo: "/imobiliare-logo.svg", width: 148, height: 18 },
  { name: "OLX", logo: "/olx-logo.svg", width: 92, height: 34 },
  { name: "Publi24.ro", logo: "/publi24-logo.svg", width: 142, height: 26 },
];

const proofSignals = [
  {
    icon: Layers3,
    value: "1 flux",
    label: "lead, proprietate, vizionare, contract",
  },
  {
    icon: Sparkles,
    value: "AI in context",
    label: "scor, matching si briefing comercial",
  },
  {
    icon: Globe2,
    value: "Go live",
    label: "website public si distributie conectate",
  },
];

const finalDemoMetrics = [
  { value: "1", label: "flux cap-coada" },
  { value: "17", label: "zone de produs" },
  { value: "AI", label: "decizii explicate" },
  { value: "Go", label: "publicare conectata" },
];

const finalProofHighlights = [
  {
    icon: Layers3,
    title: "Pipeline complet",
    text: "lead, proprietate, vizionare si contract in acelasi ritm",
  },
  {
    icon: Sparkles,
    title: "AI explicabil",
    text: "scor, potriviri si urmatorul pas in context",
  },
  {
    icon: RadioTower,
    title: "Distributie conectata",
    text: "portaluri, website public, TikTok si Meta",
  },
  {
    icon: BarChart3,
    title: "Control managerial",
    text: "KPI-uri, rapoarte si responsabilitati vizibile",
  },
];

const finalConsoleNodes = [
  { label: "Lead-uri", icon: Search, className: "lux-final-console__node--leads" },
  { label: "Proprietati", icon: Building2, className: "lux-final-console__node--properties" },
  { label: "Matching", icon: Bot, className: "lux-final-console__node--matching" },
  { label: "Echipa", icon: Users, className: "lux-final-console__node--team" },
  { label: "Portaluri", icon: RadioTower, className: "lux-final-console__node--portals" },
  { label: "Task-uri", icon: ClipboardCheck, className: "lux-final-console__node--tasks" },
  { label: "Contracte", icon: FileText, className: "lux-final-console__node--contracts" },
  { label: "Rapoarte", icon: BarChart3, className: "lux-final-console__node--reports" },
];

const flowSteps = [
  { icon: Search, title: "Lead captat", text: "intentia intra direct in pipeline" },
  { icon: Sparkles, title: "Scor AI", text: "prioritatea devine vizibila" },
  { icon: Building2, title: "Potrivire", text: "proprietati alese cu motiv" },
  { icon: CalendarCheck2, title: "Vizionare", text: "echipa merge pe urmatorul pas" },
  { icon: FileText, title: "Contract", text: "documentele raman in context" },
  { icon: Globe2, title: "Publicare", text: "promovarea pleaca din CRM" },
];

const capabilities: Capability[] = [
  {
    icon: Search,
    title: "Lead-uri prioritizate",
    text: "Buget, zona, intentie si scor AI intr-o vedere usor de actionat.",
  },
  {
    icon: Building2,
    title: "Proprietati ca centre de operare",
    text: "Media, proprietar, agent, vizionari si distributie in acelasi context.",
  },
  {
    icon: Bot,
    title: "AI in fluxul de vanzare",
    text: "Matching, recomandari si continut generate exact unde se ia decizia.",
  },
  {
    icon: LineChart,
    title: "Claritate pentru management",
    text: "Rapoarte si KPI-uri care arata ce misca agentia inainte.",
  },
];

const productScreens: ProductScreen[] = [
  {
    eyebrow: "Control room",
    title: "Dashboard live pentru pulsul agentiei.",
    text: "Comisioane, cumparatori activi, vizionari, conversii si actiuni rapide intr-un singur ecran care se simte ca un centru de comanda.",
    image: "/landing/screenshots/dashboard.png",
    alt: "Dashboard ImoDeus cu KPI-uri, grafice si actiuni rapide",
    icon: BarChart3,
    stat: "Live",
    statLabel: "agentie demo",
    signals: ["KPI-uri live", "actiuni rapide", "ritm operational"],
  },
  {
    eyebrow: "Anunturi Proprietari",
    title: "Oportunitati noi direct din piata proprietarilor.",
    text: "Anunturile de la proprietari sunt filtrate, sortate si pregatite pentru import rapid, astfel incat agentia reactioneaza inaintea concurentei.",
    image: "/landing/screenshots/premium-owner-listings.png",
    alt: "Anunturi de la proprietari cu filtre si carduri de import",
    icon: Building2,
    stat: "3000",
    statLabel: "anunturi scanabile",
    signals: ["owner listings", "filtre rapide", "import in CRM"],
  },
  {
    eyebrow: "Apeluri AI",
    title: "Outreach AI controlat pentru proprietari.",
    text: "Comisionul, limitele de negociere si istoricul apelurilor stau intr-un singur loc, cu setari clare pentru fiecare agentie.",
    image: "/landing/screenshots/premium-ai-calls.png",
    alt: "Setari si istoric pentru apeluri AI catre proprietari",
    icon: Bot,
    stat: "AI",
    statLabel: "outreach automat",
    signals: ["comision controlat", "istoric apeluri", "setari agentie"],
  },
  {
    eyebrow: "Proprietati",
    title: "Portofoliul devine un centru de selectie rapid.",
    text: "Stoc activ, status comercial, imagini, pret si actiuni rapide apar intr-o vedere construita pentru scanare si decizie.",
    image: "/landing/screenshots/properties-list.png",
    alt: "Portofoliu proprietati afisat in carduri cu imagini si pret",
    icon: Layers3,
    stat: "40",
    statLabel: "proprietati active",
    signals: ["stoc activ", "imagini si pret", "actiuni rapide"],
  },
  {
    eyebrow: "Publicare portale",
    title: "Publicarea pleaca din acelasi sistem operational.",
    text: "Portalurile, harta, website-ul si promovarea sunt conectate la proprietatea reala, nu la un export separat.",
    image: "/landing/screenshots/map-publishing.png",
    alt: "Publicare proprietate in portaluri si promovare cu harta",
    icon: Globe2,
    stat: "Go live",
    statLabel: "din CRM",
    signals: ["portaluri", "harta live", "promovare"],
  },
  {
    eyebrow: "Cumparatori",
    title: "Pipeline activ pentru lead-uri prioritizate.",
    text: "Bugetul, zona, vechimea lead-ului si scorul AI sunt vizibile imediat, ca echipa sa stie pe cine suna prima data.",
    image: "/landing/screenshots/buyers.png",
    alt: "Lista de cumparatori cu buget, scor AI si filtre",
    icon: Users,
    stat: "Pipeline",
    statLabel: "prioritate vizibila",
    signals: ["buget", "vechime lead", "scor AI"],
  },
  {
    eyebrow: "Detalii pagina cumparatori",
    title: "Profil de cumparator cu context si urmator pas.",
    text: "Profilul, bugetul, potrivirile si explicatia AI stau impreuna, ca agentul sa sune cu un motiv clar.",
    image: "/landing/screenshots/lead-matching-detail.png",
    alt: "Detaliu lead cu scor AI si proprietati recomandate",
    icon: Users,
    stat: "AI",
    statLabel: "matching explicat",
    signals: ["scor explicabil", "potriviri AI", "urmatorul pas"],
  },
  {
    eyebrow: "Potrivire AI",
    title: "Rezultate AI explicabile, nu doar recomandari.",
    text: "Agentul vede proprietatile potrivite, motivele comerciale si scorurile care transforma matching-ul intr-o conversatie clara.",
    image: "/landing/screenshots/ai-matching-results.png",
    alt: "Rezultate de potrivire AI intre cumparator si proprietati",
    icon: Sparkles,
    stat: "100",
    statLabel: "potrivire maxima",
    signals: ["rezultate AI", "motive clare", "comparatie rapida"],
  },
  {
    eyebrow: "Vizionari",
    title: "Vizionarile raman legate de proprietate si client.",
    text: "Programarile, agentul dedicat si istoricul comercial raman in contextul proprietatii, fara pierdere de informatie intre tab-uri.",
    image: "/landing/screenshots/property-detail-overview.png",
    alt: "Fisa unei proprietati cu galerie, agent si vizionari programate",
    icon: CalendarCheck2,
    stat: "360",
    statLabel: "vedere completa",
    signals: ["programari", "agent dedicat", "follow-up"],
  },
  {
    eyebrow: "Contracte",
    title: "Contracte si template-uri pregatite in CRM.",
    text: "Documentele editabile, template-urile si importurile raman in aceeasi zona operationala in care echipa inchide tranzactiile.",
    image: "/landing/screenshots/contracts.png",
    alt: "Modul de contracte si template-uri",
    icon: ClipboardCheck,
    stat: "Docs",
    statLabel: "context pastrat",
    signals: ["template-uri", "import Word", "export PDF"],
  },
  {
    eyebrow: "TikTok Studio",
    title: "Video tururi generate si pregatite pentru publicare.",
    text: "Media, storyboard AI, hook, voce, subtitrari si publicare TikTok intr-un singur flux creat pentru agentii premium.",
    image: "/landing/screenshots/premium-tiktok-studio.png",
    alt: "TikTok Studio cu AI Video Editor, storyboard si control creativ",
    icon: Sparkles,
    stat: "Video",
    statLabel: "tururi AI",
    signals: ["media studio", "storyboard AI", "publicare TikTok"],
  },
  {
    eyebrow: "Meta Advertising",
    title: "Campanii Meta conectate la proprietatile reale.",
    text: "Business Manager, audiente, buget si performanta sunt urmarite direct pe proprietati, fara fisiere si context pierdut.",
    image: "/landing/screenshots/premium-meta-advertising.png",
    alt: "Promovare Meta pentru proprietati cu campanii si metrici",
    icon: LineChart,
    stat: "Ads",
    statLabel: "in CRM",
    signals: ["Business Manager", "Housing", "performanta"],
  },
  {
    eyebrow: "Asistent AI",
    title: "Asistent contextual pentru munca reala a agentiei.",
    text: "Lead-uri, negocieri, proprietati si urmatoarele actiuni pot fi gestionate conversational, direct in produs.",
    image: "/landing/screenshots/ai-assistant.png",
    alt: "Asistent AI cu sugestii si input de chat",
    icon: MessageSquareText,
    stat: "AI",
    statLabel: "raspuns in context",
    signals: ["chat contextual", "sugestii utile", "actiuni rapide"],
  },
  {
    eyebrow: "Task-uri",
    title: "Ziua de lucru devine clara si actionabila.",
    text: "Task-urile, follow-up-ul si calendarul scot agentia din haosul listelor separate si pun ritmul intr-un singur ecran.",
    image: "/landing/screenshots/tasks.png",
    alt: "Pagina de task-uri cu KPI-uri si moduri de vizualizare",
    icon: CalendarCheck2,
    stat: "44",
    statLabel: "task-uri vizibile",
    signals: ["panou", "lista", "calendar"],
  },
  {
    eyebrow: "Agenti",
    title: "Echipa si rolurile raman sub control.",
    text: "Managementul vede agentii, rolurile, statusul si accesul intr-o structura clara, potrivita pentru agentii in crestere.",
    image: "/landing/screenshots/agents.png",
    alt: "Pagina cu echipa agentiei si carduri pentru agenti",
    icon: Crown,
    stat: "Roluri",
    statLabel: "controlate",
    signals: ["admin", "agenti", "portofoliu"],
  },
  {
    eyebrow: "Domeniu Custom",
    title: "Website-ul public primeste infrastructura proprie.",
    text: "Domeniul agentiei, statusul DNS si instructiunile de conectare sunt integrate in acelasi produs, nu intr-un proces separat.",
    image: "/landing/screenshots/custom-domain.png",
    alt: "Configurare domeniu custom pentru website-ul agentiei",
    icon: RadioTower,
    stat: "Web",
    statLabel: "go live",
    signals: ["DNS", "SSL", "website public"],
  },
  {
    eyebrow: "Rapoarte",
    title: "Managementul vede miscarea agentiei, nu doar cifre.",
    text: "Rapoartele transforma lead-urile, proprietatile, vizionarile si conversiile in semnale usor de citit pentru decizii rapide.",
    image: "/landing/screenshots/reports.png",
    alt: "Rapoarte cu KPI-uri si evolutia performantei agentiei",
    icon: BarChart3,
    stat: "Live",
    statLabel: "management",
    signals: ["KPI-uri", "conversii", "pipeline"],
  },
];

const productConversionCards: Record<string, ProductConversionCard[]> = {
  "Control room": [
    {
      metric: "Decizie in 10 secunde",
      title: "Managementul intelege instant pulsul agentiei.",
      text: "Comisioane, lead-uri si conversii apar in acelasi cadru, astfel incat demo-ul se simte ca un centru de comanda real.",
    },
    {
      metric: "Actiuni rapide",
      title: "Agentul nu mai pleaca din dashboard.",
      text: "Cumparator, proprietate, task si vizionare pornesc direct din primul ecran, cu mai putine click-uri si mai mult ritm.",
    },
    {
      metric: "Proof de produs",
      title: "Arata maturitate operationala din prima secunda.",
      text: "Primul ecran convinge ca platforma nu este doar CRM, ci sistemul zilnic al agentiei.",
    },
  ],
  "Anunturi Proprietari": [
    {
      metric: "Sursa noua",
      title: "Oportunitatile de la proprietari ajung inaintea concurentei.",
      text: "Agentia vede rapid anunturile relevante si poate transforma piata publica intr-un pipeline de prospectare.",
    },
    {
      metric: "Import asistat",
      title: "Din anunt in CRM fara copiere manuala.",
      text: "Cardurile de import reduc frictiunea si fac trecerea de la oportunitate la actiune mult mai naturala.",
    },
    {
      metric: "Mai multa acoperire",
      title: "Conversatia comerciala incepe cu context.",
      text: "Filtrele si sursele vizibile ajuta agentul sa aleaga proprietarii cu cel mai bun potential.",
    },
  ],
  "Apeluri AI": [
    {
      metric: "Outreach scalabil",
      title: "AI-ul contacteaza proprietari dupa regulile agentiei.",
      text: "Comisionul, intervalul orar si limitele sunt setate clar, asa ca automatizarea ramane sub control.",
    },
    {
      metric: "Negociere sigura",
      title: "Fiecare apel pastreaza intentia comerciala corecta.",
      text: "Agentia poate folosi AI fara sa piarda disciplina de vanzare sau standardul conversatiei.",
    },
    {
      metric: "Istoric verificabil",
      title: "Rezultatele raman vizibile pentru echipa.",
      text: "Managementul vede ce s-a incercat, ce a mers si unde merita insistat mai departe.",
    },
  ],
  Proprietati: [
    {
      metric: "Portofoliu scanabil",
      title: "Stocul devine usor de prezentat si de decis.",
      text: "Imaginile, pretul si statusul comercial sunt suficient de clare incat echipa sa gaseasca rapid urmatorul pas.",
    },
    {
      metric: "Actiune din card",
      title: "Fiecare proprietate are context si comenzi la indemana.",
      text: "Agentul poate intra direct in detalii, publicare sau matching fara sa piarda firul.",
    },
    {
      metric: "Imagine premium",
      title: "Portofoliul arata ca un produs de top.",
      text: "Prezentarea vizuala creste increderea clientului si transmite ca agentia lucreaza organizat.",
    },
  ],
  "Publicare portale": [
    {
      metric: "Go live rapid",
      title: "Publicarea nu mai este un proces separat.",
      text: "Portalurile, harta si website-ul raman legate de aceeasi proprietate si aceleasi date operationale.",
    },
    {
      metric: "Mai putine erori",
      title: "Datele pleaca din sursa corecta.",
      text: "Cand promovarea este conectata la CRM, echipa evita fisierele paralele si modificarile pierdute.",
    },
    {
      metric: "Vizibilitate extinsa",
      title: "Agentia poate arata distributie, nu doar administrare.",
      text: "In demo, publicarea devine un argument puternic pentru agentii care vor vanzare, nu doar evidenta.",
    },
  ],
  Cumparatori: [
    {
      metric: "Prioritate reala",
      title: "Echipa stie pe cine suna prima data.",
      text: "Bugetul, zona, vechimea si scorul AI scot lead-urile bune in fata.",
    },
    {
      metric: "Pipeline curat",
      title: "Lead-urile nu mai raman simple randuri in tabel.",
      text: "Fiecare cumparator capata status, context si o directie clara de lucru.",
    },
    {
      metric: "Conversie mai buna",
      title: "Agentul intra in apel cu un motiv concret.",
      text: "Cand informatia e vizibila, follow-up-ul suna mai profesionist si mai relevant.",
    },
  ],
  "Detalii pagina cumparatori": [
    {
      metric: "Context complet",
      title: "Profilul cumparatorului devine briefing comercial.",
      text: "Bugetul, scorul, istoricul si proprietatile potrivite stau impreuna, pregatite pentru apel.",
    },
    {
      metric: "Matching explicat",
      title: "AI-ul arata de ce o proprietate se potriveste.",
      text: "Agentul nu primeste doar o lista, ci un argument pe care il poate folosi in conversatie.",
    },
    {
      metric: "Next step clar",
      title: "Urmatoarea actiune devine evidenta.",
      text: "Pagina reduce ezitarea si transforma analiza intr-un pas comercial concret.",
    },
  ],
  "Potrivire AI": [
    {
      metric: "Lista scurta",
      title: "Matching-ul reduce zgomotul din portofoliu.",
      text: "Agentul vede optiunile cu cel mai bun scor si poate prezenta rapid proprietatile relevante.",
    },
    {
      metric: "Explicatii vandabile",
      title: "Fiecare recomandare vine cu motiv.",
      text: "Argumentele AI fac discutia cu clientul mai convingatoare si mai usor de sustinut.",
    },
    {
      metric: "Timp castigat",
      title: "Mai putina cautare manuala, mai multa vanzare.",
      text: "Echipa petrece mai putin timp filtrand si mai mult timp ducand clientul spre vizionare.",
    },
  ],
  Vizionari: [
    {
      metric: "Programari in context",
      title: "Vizionarile raman legate de proprietatea potrivita.",
      text: "Agentul vede galeria, pretul, proprietarul si programarile fara sa sara intre ecrane.",
    },
    {
      metric: "Follow-up vizibil",
      title: "Nicio vizionare nu ramane fara urmator pas.",
      text: "Contextul complet ajuta echipa sa inchida bucla dupa fiecare intalnire.",
    },
    {
      metric: "Experienta premium",
      title: "Clientul simte ca agentia are control.",
      text: "O fisa coerenta face produsul mai usor de demonstrat si agentia mai usor de ales.",
    },
  ],
  Contracte: [
    {
      metric: "Documente pregatite",
      title: "Contractele nu mai sunt rupte de fluxul de vanzare.",
      text: "Template-urile si documentele raman in acelasi workspace cu lead-urile si proprietatile.",
    },
    {
      metric: "Timp scurtat",
      title: "Echipa ajunge mai repede de la acord la document.",
      text: "Cand totul este centralizat, inchiderea tranzactiei pare mai fluida si mai profesionista.",
    },
    {
      metric: "Control juridic",
      title: "Procesul devine predictibil pentru management.",
      text: "Statusurile si importurile reduc haosul documentelor trimise prin canale separate.",
    },
  ],
  "TikTok Studio": [
    {
      metric: "Video in flux",
      title: "Tururile video pornesc din proprietatea reala.",
      text: "Media, storyboard-ul, vocea si subtitrarile se leaga intr-un proces creativ usor de vandut.",
    },
    {
      metric: "Continut premium",
      title: "Agentia poate produce mai mult fara echipa separata.",
      text: "AI-ul ajuta la ritm, hook si structura, astfel incat promovarea arata mai moderna.",
    },
    {
      metric: "Publicare rapida",
      title: "Continutul pleaca spre TikTok din acelasi sistem.",
      text: "Demo-ul arata clar ca ImoDeus nu se opreste la CRM, ci atinge marketingul real.",
    },
  ],
  "Meta Advertising": [
    {
      metric: "Campanii pe proprietate",
      title: "Promovarea Meta ramane conectata la stoc.",
      text: "Bugetul, lead-urile si performanta se citesc langa proprietatea care genereaza interes.",
    },
    {
      metric: "Control buget",
      title: "Managementul vede unde se duc banii.",
      text: "Metricile de spend, click-uri si cost pe lead fac conversatia comerciala mai concreta.",
    },
    {
      metric: "Argument premium",
      title: "Agentia vinde distributie, nu doar listare.",
      text: "Integrarea Meta arata ca produsul sustine achizitia de cerere, nu doar administrarea ei.",
    },
  ],
  "Asistent AI": [
    {
      metric: "Raspuns in context",
      title: "AI-ul intelege munca din CRM.",
      text: "Sugestiile sunt legate de lead-uri, proprietati si negocieri, nu de un chat izolat.",
    },
    {
      metric: "Mai putina frictiune",
      title: "Agentul primeste ajutor exact unde lucreaza.",
      text: "Intrebarile rapide si actiunile sugerate fac produsul mai usor de adoptat.",
    },
    {
      metric: "Scalare echipa",
      title: "Noii agenti invata mai repede ritmul agentiei.",
      text: "Un asistent contextual transforma regulile operationale in ghidaj zilnic.",
    },
  ],
  "Task-uri": [
    {
      metric: "Zi clara",
      title: "Agentia vede ce trebuie facut astazi.",
      text: "Panoul de task-uri transforma follow-up-ul intr-o rutina vizibila, nu intr-o lista uitata.",
    },
    {
      metric: "Prioritati vizibile",
      title: "Urgentul si importantul ies la suprafata.",
      text: "KPI-urile si modurile de vizualizare ajuta echipa sa pastreze ritmul.",
    },
    {
      metric: "Mai putine pierderi",
      title: "Lead-urile nu mai mor din lipsa de follow-up.",
      text: "Un sistem clar de task-uri sustine conversia dupa fiecare interactiune.",
    },
  ],
  Agenti: [
    {
      metric: "Roluri clare",
      title: "Echipa creste fara sa piarda controlul.",
      text: "Adminii, agentii si responsabilitatile sunt vizibile intr-un cadru curat.",
    },
    {
      metric: "Onboarding rapid",
      title: "Noii agenti intra mai repede in sistem.",
      text: "Cardurile de echipa si accesul controlat fac produsul mai usor de introdus in agentii mari.",
    },
    {
      metric: "Management scalabil",
      title: "Operatiunile nu depind de o singura persoana.",
      text: "Structura de roluri transmite maturitate si incredere in demo.",
    },
  ],
  "Domeniu Custom": [
    {
      metric: "Brand propriu",
      title: "Website-ul agentiei sta pe domeniul ei.",
      text: "Produsul sustine prezenta publica a agentiei, nu doar partea interna.",
    },
    {
      metric: "Go live ghidat",
      title: "DNS, status si instructiuni intr-un singur loc.",
      text: "Procesul tehnic devine usor de urmarit chiar si pentru echipe non-tehnice.",
    },
    {
      metric: "Incredere publica",
      title: "Clientul vede o agentie cu infrastructura serioasa.",
      text: "Domeniul custom transforma CRM-ul intr-o platforma completa pentru imagine si vanzare.",
    },
  ],
  Rapoarte: [
    {
      metric: "Cifre actionabile",
      title: "Rapoartele arata ce trebuie schimbat.",
      text: "Lead-uri, proprietati, vizionari si conversii devin semnale de management, nu doar statistici.",
    },
    {
      metric: "Performanta echipa",
      title: "Managementul vede unde se castiga ritm.",
      text: "Datele ajuta la coaching, prioritizare si decizii rapide pe portofoliu.",
    },
    {
      metric: "Demo convingator",
      title: "Produsul pare pregatit pentru agentii ambitioase.",
      text: "Un layer de raportare live transmite ca ImoDeus poate deveni sistemul principal al agentiei.",
    },
  ],
};

function DemoButton({
  className = "",
  label = "Intra in demo live",
}: {
  className?: string;
  label?: string;
}) {
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
  direct = false,
  className = "",
  width = 1900,
  height = 912,
}: {
  image: string;
  alt: string;
  label: string;
  priority?: boolean;
  direct?: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  const eager = priority || image.endsWith("/dashboard.png");

  return (
    <div className={`lux-screen ${className}`}>
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
          width={width}
          height={height}
          priority={priority}
          unoptimized={direct}
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 767px) 860px, (max-width: 1279px) 92vw, 980px"
          className="lux-screen__image"
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <main className="lux-shell min-h-screen overflow-x-clip bg-[#06101d] text-white">
        <header className="lux-nav">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
            <Link href="/" aria-label="ImoDeus.ai">
              <ImoDeusTextLogo className="w-[7.75rem] brightness-0 invert sm:w-[8.75rem]" />
            </Link>
            <nav className="lux-nav-menu" aria-label="Meniu prezentare">
              <Link href="/" className="lux-nav-menu__link lux-nav-menu__link--active">
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

        <section className="lux-hero">
          <div className="lux-hero__grid" />
          <div className="lux-hero-inner mx-auto grid w-full max-w-[1500px] gap-10 px-4 pb-12 pt-7 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(640px,1.18fr)] lg:items-center lg:px-8 lg:pb-12 lg:pt-8">
            <div className="lux-hero-copy relative z-10 max-w-3xl">
              <div className="lux-pill">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                Platforma AI pentru agentii imobiliare care vor sa conduca piata
              </div>
              <h1 className="lux-hero-title mt-6 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[4.15rem] xl:text-[4.65rem]">
                Agentia ta, orchestrata intr-un singur <span className="whitespace-nowrap">sistem premium.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                ImoDeus.ai aduce lead-uri, proprietati, AI, task-uri, rapoarte si publicare intr-un workspace
                care arata si se simte ca un produs de top.
              </p>

              <div className="lux-hero-actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <DemoButton className="h-16 w-full justify-center px-8 text-lg sm:w-auto" label="Deschide demo-ul" />
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

              <div className="lux-hero-stats mt-9 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="lux-hero-stat">
                    <p>{stat.value}</p>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lux-hero-stage">
              <ScreenFrame
                image="/landing/screenshots/dashboard.png"
                alt="Dashboard ImoDeus cu KPI-uri, grafice si actiuni rapide"
                label="ImoDeus.ai CRM / Dashboard"
                priority
                className="lux-screen--hero"
              />
              <ScreenFrame
                image="/landing/screenshots/lead-matching-detail.png"
                alt="Detaliu lead cu scor AI si proprietati recomandate"
                label="Lead intelligence"
                priority
                direct
                className="lux-screen--float lux-screen--float-left"
              />
              <ScreenFrame
                image="/landing/screenshots/property-detail-overview.png"
                alt="Fisa unei proprietati cu galerie si panou de actiuni"
                label="Property hub"
                priority
                className="lux-screen--float lux-screen--float-right"
              />
            </div>
          </div>

          <div className="lux-publish-marquee">
            <div
              className="lux-publish-marquee__shell"
              aria-label="Publicare automata Storia, Imobiliare.ro, OLX si Publi24.ro"
            >
              <div className="lux-publish-marquee__track" aria-hidden="true">
                {[0, 1].map((groupIndex) => (
                  <div className="lux-publish-marquee__group" key={groupIndex}>
                    {publishingPartners.map((partner) => (
                      <div className="lux-publish-item" key={`${partner.name}-${groupIndex}`}>
                        <span className="lux-publish-item__signal" />
                        <span className="lux-publish-item__copy">Publicare Automata</span>
                        <span className="lux-publish-item__logoWrap">
                          <Image
                            src={partner.logo}
                            alt=""
                            width={partner.width}
                            height={partner.height}
                            className="lux-publish-item__logo"
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lux-proof">
          <div className="mx-auto grid w-full max-w-[1500px] gap-3 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:px-8">
            {proofSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.value} className="lux-proof-item">
                  <Icon className="h-5 w-5" />
                  <div>
                    <strong>{signal.value}</strong>
                    <span>{signal.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lux-light-section">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="lux-system-hero">
              <div className="lux-system-copy">
                <div className="lux-light-pill">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Pozitionare de lider
                </div>
                <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                  Nu doar CRM. Un layer premium pentru vanzare, management si AI.
                </h2>
                <p>
                  Tot ce conteaza pentru o agentie imobiliara moderna este legat intr-un flux coerent:
                  oportunitati, portofoliu, echipa, documente, publicare si raportare.
                </p>
                <div className="lux-system-proof">
                  <span>
                    <strong>360</strong>
                    vedere operationala
                  </span>
                  <span>
                    <strong>AI</strong>
                    decizii in context
                  </span>
                  <span>
                    <strong>Go live</strong>
                    publicare conectata
                  </span>
                </div>
              </div>

              <div className="lux-system-panel" aria-hidden="true">
                <div className="lux-system-panel__top">
                  <span>Operating layer</span>
                  <strong>Live control</strong>
                </div>
                <div className="lux-system-panel__canvas">
                  <div className="lux-system-core">
                    <Sparkles className="h-5 w-5" />
                    <strong>ImoDeus.ai</strong>
                    <span>CRM + AI + publicare</span>
                  </div>
                  {["Lead", "Portofoliu", "AI", "Echipa", "Contract", "Publicare"].map((node) => (
                    <span key={node} className="lux-system-node">
                      {node}
                    </span>
                  ))}
                </div>
                <div className="lux-system-panel__footer">
                  <span>pipeline conectat</span>
                  <span>rapoarte live</span>
                  <span>actiuni rapide</span>
                </div>
              </div>
            </div>

            <div className="lux-capability-grid">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="lux-capability">
                    <span className="lux-capability__glow" />
                    <div className="lux-capability__icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="lux-flow-map">
              {flowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="lux-flow-step">
                    <span>
                      <Icon className="h-4 w-4" />
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lux-showcase">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <div className="lux-pill lux-pill--muted">
                <MapPinned className="h-4 w-4 text-cyan-300" />
                Produsul in miscare
              </div>
              <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-white sm:text-5xl">
                Fiecare ecran spune o poveste de control, viteza si incredere.
              </h2>
            </div>

            <div className="lux-product-tour mt-12">
              {productScreens.map((screen, index) => {
                const Icon = screen.icon;
                const conversionCards = productConversionCards[screen.eyebrow] ?? [];
                return (
                  <Fragment key={screen.title}>
                    <article className={`lux-feature ${index % 2 ? "lux-feature--reverse" : ""}`}>
                      <span className="lux-feature__index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="lux-feature__copy">
                        <div className="lux-feature__meta">
                          <div className="lux-pill lux-pill--mini">
                            <Icon className="h-4 w-4" />
                            {screen.eyebrow}
                          </div>
                          <span>flow {index + 1}</span>
                        </div>
                        <h3>{screen.title}</h3>
                        <p>{screen.text}</p>
                        <div className="lux-feature__signals">
                          {screen.signals.map((signal) => (
                            <span key={signal}>{signal}</span>
                          ))}
                        </div>
                        <div className="lux-feature__stat">
                          <strong>{screen.stat}</strong>
                          <span>{screen.statLabel}</span>
                        </div>
                      </div>
                      <div className="lux-feature__media">
                        <span className="lux-feature__mediaPlate" />
                        <ScreenFrame
                          image={screen.image}
                          alt={screen.alt}
                          label={`ImoDeus.ai CRM / ${screen.eyebrow}`}
                          className="lux-screen--feature"
                        />
                        <div className="lux-feature__status" aria-hidden="true">
                          <span />
                          Sistem conectat
                        </div>
                        <div className="lux-feature__rail" aria-hidden="true">
                          <span>CRM</span>
                          <span>AI</span>
                          <span>Publicare</span>
                        </div>
                      </div>
                    </article>

                    <div className="lux-conversion-grid" aria-label={`Argumente ${screen.eyebrow}`}>
                      {conversionCards.map((card, cardIndex) => (
                        <article key={card.title} className="lux-conversion-card">
                          <span className="lux-conversion-card__number">{String(cardIndex + 1).padStart(2, "0")}</span>
                          <div className="lux-conversion-card__metric">
                            <span />
                            {card.metric}
                          </div>
                          <h4>{card.title}</h4>
                          <p>{card.text}</p>
                          <div className="lux-conversion-card__cue">
                            <span>Argument de vanzare</span>
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </article>
                      ))}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lux-final">
          <div className="lux-final__inner mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.48fr)] lg:items-center lg:px-8 lg:py-24">
            <div className="lux-final__copy">
              <div className="lux-final__pill">
                <ShieldCheck className="h-4 w-4" />
                Demo first
              </div>
              <h2 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-white sm:text-5xl">
                Cel mai bun argument este produsul deschis in fata clientului.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                Intra intr-o agentie demo si vezi cum arata o zi de lucru cand CRM-ul, AI-ul si website-ul public
                sunt conectate in acelasi sistem.
              </p>
              <div className="lux-final__metrics" aria-label="Beneficii demo">
                {finalDemoMetrics.map(({ value, label }) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="lux-final-proof-grid" aria-label="Ce vede clientul in demo">
                {finalProofHighlights.map((proof) => {
                  const ProofIcon = proof.icon;

                  return (
                    <div key={proof.title} className="lux-final-proof">
                      <ProofIcon className="h-4 w-4" />
                      <strong>{proof.title}</strong>
                      <span>{proof.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lux-final-card">
              <span className="lux-final-card__shine" />
              <div className="lux-final-card__header">
                <p>Experienta completa</p>
                <span>demo live</span>
              </div>
              <h3>
                <span>CRM, AI, website public si</span>
                <span>operatiuni intr-un singur loc.</span>
              </h3>
              <div className="lux-final-console" aria-hidden="true">
                <span className="lux-final-console__link lux-final-console__link--one" />
                <span className="lux-final-console__link lux-final-console__link--two" />
                <span className="lux-final-console__link lux-final-console__link--three" />
                <div className="lux-final-console__core">
                  <Sparkles className="h-5 w-5" />
                  <strong>ImoDeus.ai</strong>
                  <span>operating layer</span>
                </div>
                {finalConsoleNodes.map((node) => {
                  const NodeIcon = node.icon;

                  return (
                    <div key={node.label} className={`lux-final-console__node ${node.className}`}>
                      <NodeIcon className="h-4 w-4" />
                      {node.label}
                    </div>
                  );
                })}
              </div>
              <div className="lux-final-actions">
                <DemoButton className="w-full justify-center" label="Intra in demo acum" />
                <Button asChild size="lg" variant="outline" className="lux-final-secondary h-14 w-full px-7 text-base font-semibold">
                  <Link href="/register">
                    Creeaza cont
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>&copy; 2026 ImoDeus.ai CRM. Toate drepturile rezervate.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/termeni-si-conditii" className="font-medium text-slate-700 transition-colors hover:text-sky-700">
              Termeni si conditii
            </Link>
            <Link href="/confidentialitate" className="font-medium text-slate-700 transition-colors hover:text-sky-700">
              Politica de confidentialitate
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
