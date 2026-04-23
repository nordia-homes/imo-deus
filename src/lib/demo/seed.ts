import type { Contact, Property, Task, Viewing } from "@/lib/types";
import type { DemoAgency, DemoAgent, DemoSessionState } from "@/lib/demo/types";

const isoNow = () => new Date().toISOString();

const PROPERTY_COUNT = 40;
const CONTACT_COUNT = 80;
const VIEWING_COUNT = 28;
const TASK_COUNT = 44;

const DEMO_AGENCY: DemoAgency = {
  id: "demo-agency-bucharest",
  name: "Atelier Estate Demo",
  ownerId: "demo-admin",
  themePreset: "agentfinder",
  legalCompanyName: "Atelier Estate SRL",
  companyTaxId: "RO12345678",
  tradeRegisterNumber: "J40/1234/2024",
  registeredOffice: "Calea Dorobanti 118, Bucuresti",
  legalRepresentative: "Andrei Popescu",
  customDomain: "demo.atelierestate.ro",
  customDomainStatus: "connected",
  phone: "+40 721 555 120",
  email: "office@atelierestate-demo.ro",
  address: "Calea Dorobanti 118, Bucuresti",
  agencyDescription:
    "Agentie demo premium pentru prezentarea fluxurilor ImoDeus.ai CRM.",
  cityFocus: "Bucuresti",
  positioning: "apartamente premium, familii active, investitori urbani",
};

const DEMO_AGENTS: DemoAgent[] = [
  {
    id: "demo-admin",
    name: "Andrei Popescu",
    email: "andrei@atelierestate-demo.ro",
    phone: "+40 721 555 111",
    role: "admin",
    photoUrl: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "demo-agent-1",
    name: "Bianca Ionescu",
    email: "bianca@atelierestate-demo.ro",
    phone: "+40 721 555 112",
    role: "agent",
    photoUrl: "https://i.pravatar.cc/150?img=32",
  },
  {
    id: "demo-agent-2",
    name: "Radu Marin",
    email: "radu@atelierestate-demo.ro",
    phone: "+40 721 555 113",
    role: "agent",
    photoUrl: "https://i.pravatar.cc/150?img=15",
  },
];

const PROPERTY_IMAGES = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
];

const OWNER_NAMES = [
  "Mihai Dumitru",
  "Alexandra Barbu",
  "Victor Ilie",
  "Ioana Lazar",
  "Razvan Ene",
  "Ana Pavel",
  "Gabriela Stan",
  "Sergiu Radu",
];

const FIRST_NAMES = [
  "Elena",
  "Sorin",
  "Cristina",
  "Mara",
  "Tudor",
  "Ioana",
  "Andra",
  "Vlad",
  "Roxana",
  "Stefan",
  "Diana",
  "Catalin",
  "Bianca",
  "Paul",
  "Mihnea",
  "Irina",
];

const LAST_NAMES = [
  "Georgescu",
  "Matei",
  "Dobre",
  "Ionescu",
  "Marin",
  "Stan",
  "Popa",
  "Lazar",
  "Preda",
  "Nistor",
  "Enache",
  "Petrescu",
  "Rusu",
  "Ilie",
  "Barbu",
  "Voicu",
];

const SOURCES = ["Website", "Recomandare", "Portal Imobiliar", "Instagram", "Facebook Ads", "Open House"];
const PROPERTY_TYPES = ["Apartament", "Apartament", "Apartament", "Casa", "Penthouse"];
const TRANSACTION_TYPES = ["Vanzare", "Vanzare", "Vanzare", "Vanzare", "Inchiriere"];
const PROPERTY_STATUSES: Property["status"][] = ["Activ", "Activ", "Activ", "Activ", "Rezervat", "Inactiv", "Vândut", "Închiriat"];
const CONTACT_STATUSES: Contact["status"][] = ["Nou", "Contactat", "Vizionare", "Contactat", "În negociere", "Câștigat", "Pierdut"];
const PRIORITIES: NonNullable<Contact["priority"]>[] = ["Ridicată", "Medie", "Scăzută"];
const FINANCIAL_STATUSES: NonNullable<Contact["financialStatus"]>[] = [
  "Cash",
  "Credit Aprobat",
  "Credit Pre-aprobat",
  "Neprecalificat",
];
const TASK_DESCRIPTIONS = [
  "Trimite rezumat dupa discutia de calificare",
  "Confirma disponibilitatea proprietatii",
  "Pregateste comparativul de zona",
  "Solicita feedback dupa vizionare",
  "Actualizeaza prezentarea pentru portal",
  "Revino cu scenariul de negociere",
];

const NEIGHBORHOODS = [
  {
    zone: "Floreasca",
    city: "Bucuresti",
    streets: ["Strada Verdi", "Strada Chopin", "Calea Floreasca"],
    keywords: ["terasa", "parcare", "renovat", "zona premium"],
    roomBase: 3,
    priceBase: 245000,
    surfaceBase: 78,
  },
  {
    zone: "Herastrau",
    city: "Bucuresti",
    streets: ["Soseaua Nordului", "Strada Herastrau", "Aleea Privighetorilor"],
    keywords: ["vedere parc", "paza", "premium", "luminos"],
    roomBase: 4,
    priceBase: 380000,
    surfaceBase: 102,
  },
  {
    zone: "Timpuri Noi",
    city: "Bucuresti",
    streets: ["Bd. Tineretului", "Strada Lunca Bradului", "Strada Nerva Traian"],
    keywords: ["metrou", "investitie", "mobilat", "randament"],
    roomBase: 2,
    priceBase: 152000,
    surfaceBase: 56,
  },
  {
    zone: "Pipera",
    city: "Bucuresti",
    streets: ["Strada Erou Iancu Nicolae", "Bulevardul Pipera", "Strada Drumul Potcoavei"],
    keywords: ["gradina", "garaj", "familie", "scoala internationala"],
    roomBase: 5,
    priceBase: 520000,
    surfaceBase: 186,
  },
  {
    zone: "Dorobanti",
    city: "Bucuresti",
    streets: ["Calea Dorobanti", "Strada Paris", "Strada Roma"],
    keywords: ["boutique", "renovat", "lift", "pozitie buna"],
    roomBase: 3,
    priceBase: 272000,
    surfaceBase: 82,
  },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function pickAgent(index: number) {
  return DEMO_AGENTS[(index % (DEMO_AGENTS.length - 1)) + 1];
}

function buildProperty(index: number): Property {
  const neighborhood = NEIGHBORHOODS[index % NEIGHBORHOODS.length];
  const agent = pickAgent(index);
  const propertyType = PROPERTY_TYPES[index % PROPERTY_TYPES.length];
  const transactionType = TRANSACTION_TYPES[index % TRANSACTION_TYPES.length];
  const forcedRecentSale = index === 3 || index === 11 || index === 19;
  const status = forcedRecentSale ? "Vândut" : PROPERTY_STATUSES[index % PROPERTY_STATUSES.length];
  const rooms = neighborhood.roomBase + (index % 2);
  const bathrooms = Math.max(1, Math.min(4, Math.floor(rooms / 2) + (index % 2)));
  const squareFootage = neighborhood.surfaceBase + (index % 5) * 8;
  const totalSurface = squareFootage + 10 + (index % 4) * 6;
  const price =
    transactionType === "Inchiriere"
      ? 1450 + (index % 7) * 220
      : neighborhood.priceBase + (index % 6) * 18500 + rooms * 9000;
  const street = neighborhood.streets[index % neighborhood.streets.length];
  const number = 10 + index * 3;
  const title =
    propertyType === "Casa"
      ? `Vila ${rooms} camere cu gradina in ${neighborhood.zone}`
      : propertyType === "Penthouse"
        ? `Penthouse ${rooms} camere in ${neighborhood.zone}`
        : `Apartament ${rooms} camere in ${neighborhood.zone}`;

  return {
    id: `demo-property-${pad(index + 1)}`,
    title,
    address: `${street} ${number}, ${neighborhood.zone}, ${neighborhood.city}`,
    location: `${neighborhood.zone}, ${neighborhood.city}`,
    city: neighborhood.city,
    zone: neighborhood.zone,
    price: Math.round(price / (transactionType === "Inchiriere" ? 10 : 1000)) * (transactionType === "Inchiriere" ? 10 : 1000),
    rooms,
    bathrooms,
    squareFootage,
    totalSurface,
    description: `Proprietate demo cu prezentare coerenta pentru ${neighborhood.zone}, gandita astfel incat fluxurile de matching, vizionari si negociere sa para reale pentru o agentie activa.`,
    images: [
      {
        url: PROPERTY_IMAGES[index % PROPERTY_IMAGES.length],
        alt: title,
      },
    ],
    amenities: neighborhood.keywords,
    propertyType,
    transactionType,
    constructionYear: 2012 + (index % 13),
    floor: propertyType === "Casa" ? "P+1" : String((index % 10) + 1),
    totalFloors: propertyType === "Casa" ? 2 : 10,
    orientation: ["Sud", "Est", "Vest", "Nord"][index % 4],
    furnishing: ["Complet", "Partial", "Nemobilat"][index % 3],
    heatingSystem: index % 4 === 0 ? "Pompa de caldura" : "Centrala proprie",
    parking: propertyType === "Casa" ? "Garaj" : index % 2 === 0 ? "Subteran" : "Stradal",
    keyFeatures: neighborhood.keywords.join(", "),
    nearMetro: neighborhood.zone !== "Pipera",
    interiorState: ["Renovat", "Excelenta", "Buna"][index % 3],
    buildingState: index % 3 === 0 ? "Noua" : "Buna",
    balconyTerrace: propertyType === "Casa" ? "Terasa" : index % 2 === 0 ? "Balcon" : "Terasa",
    partitioning: ["Decomandat", "Semidecomandat"][index % 2],
    kitchen: index % 3 === 0 ? "Open space" : "Inchisa",
    lift: propertyType === "Casa" ? "Nu" : "Da",
    cadastralNumber: `CAD-${neighborhood.zone.slice(0, 2).toUpperCase()}-${1000 + index}`,
    createdAt: `2026-03-${pad((index % 28) + 1)}T0${index % 9}:00:00.000Z`,
    agentId: agent.id,
    agentName: agent.name,
    status,
    featured: index % 7 === 0,
    statusUpdatedAt: forcedRecentSale
      ? `2026-04-${pad(8 + (index % 12))}T1${index % 8}:00:00.000Z`
      : `2026-04-${pad((index % 23) + 1)}T1${index % 8}:00:00.000Z`,
    ownerName: OWNER_NAMES[index % OWNER_NAMES.length],
    ownerPhone: `+40 722 ${300 + index} ${100 + index}`,
    commissionType: index % 4 === 0 ? "fixed" : "percentage",
    commissionValue: index % 4 === 0 ? 3500 + (index % 3) * 750 : 2 + (index % 2) * 0.5,
  };
}

function buildContact(index: number, properties: Property[]): Contact {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];
  const agent = pickAgent(index);
  const targetProperty = properties[index % properties.length];
  const backupProperty = properties[(index + 5) % properties.length];
  const budgetBase = targetProperty.transactionType === "Inchiriere" ? targetProperty.price * 12 : targetProperty.price;
  const status = CONTACT_STATUSES[index % CONTACT_STATUSES.length];

  return {
    id: `demo-contact-${pad(index + 1)}`,
    name: `${firstName} ${lastName}`,
    phone: `+40 721 ${600 + index} ${100 + (index % 90)}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@example.com`,
    source: SOURCES[index % SOURCES.length],
    budget: Math.round(budgetBase * (0.92 + (index % 5) * 0.04)),
    status,
    description: `Lead demo interesat in principal de ${targetProperty.zone}, cu criterii suficient de clare pentru a testa matching-ul si urmarirea comerciala.`,
    contactType: "Cumparator",
    city: "Bucuresti",
    zones: [targetProperty.zone || "Bucuresti", backupProperty.zone || "Bucuresti"],
    leadScore: 58 + (index % 8) * 5,
    leadScoreReason: `Buget ${index % 2 === 0 ? "clar" : "aproape clar"}, reactie ${index % 3 === 0 ? "rapida" : "buna"}, interes activ pentru ${targetProperty.zone}.`,
    createdAt: `2026-04-${pad((index % 23) + 1)}T${pad((index % 9) + 8)}:30:00.000Z`,
    agentId: agent.id,
    agentName: agent.name,
    priority: PRIORITIES[index % PRIORITIES.length],
    sourcePropertyId: targetProperty.id,
    financialStatus: FINANCIAL_STATUSES[index % FINANCIAL_STATUSES.length],
    tags: [
      targetProperty.zone || "bucuresti",
      targetProperty.transactionType === "Inchiriere" ? "rental" : "buyer",
      index % 4 === 0 ? "hot" : "de urmarit",
    ],
    preferences: {
      desiredPriceRangeMin: Math.max(50000, Math.round((budgetBase * 0.82) / 1000) * 1000),
      desiredPriceRangeMax: Math.round((budgetBase * 1.04) / 1000) * 1000,
      desiredRooms: Math.max(2, targetProperty.rooms - (index % 2)),
      desiredBathrooms: Math.max(1, targetProperty.bathrooms - (index % 2)),
      desiredSquareFootageMin: Math.max(45, targetProperty.squareFootage - 12),
      desiredSquareFootageMax: targetProperty.squareFootage + 18,
      desiredFeatures: (targetProperty.amenities || []).slice(0, 3).join(", "),
      locationPreferences: [targetProperty.zone, backupProperty.zone].filter(Boolean).join(", "),
    },
  };
}

function buildViewing(index: number, properties: Property[], contacts: Contact[]): Viewing {
  const contact = contacts[index % contacts.length];
  const property = properties[index % properties.length];
  const agent = DEMO_AGENTS.find((item) => item.id === contact.agentId) || pickAgent(index);
  const status: Viewing["status"] = index % 5 === 0 ? "completed" : index % 6 === 0 ? "cancelled" : "scheduled";
  const day = 10 + (index % 18);
  const hour = 10 + (index % 7);

  return {
    id: `demo-viewing-${pad(index + 1)}`,
    propertyId: property.id,
    propertyTitle: property.title,
    propertyAddress: property.address,
    contactId: contact.id,
    contactName: contact.name,
    agentId: agent.id,
    agentName: agent.name,
    viewingDate: `2026-04-${pad(day)}T${pad(hour)}:00:00.000Z`,
    duration: index % 3 === 0 ? 75 : 60,
    notes: `Vizionare demo pentru ${contact.name}, cu focus pe ${property.zone} si pe avantajele comerciale ale listingului.`,
    status,
    createdAt: `2026-04-${pad(Math.max(1, day - 2))}T09:00:00.000Z`,
  };
}

function buildTask(index: number, properties: Property[], contacts: Contact[]): Task {
  const contact = contacts[index % contacts.length];
  const property = properties[(index * 2) % properties.length];
  const agent = DEMO_AGENTS.find((item) => item.id === contact.agentId) || pickAgent(index);

  return {
    id: `demo-task-${pad(index + 1)}`,
    description: `${TASK_DESCRIPTIONS[index % TASK_DESCRIPTIONS.length]} pentru ${contact.name}`,
    dueDate: `2026-04-${pad((index % 24) + 1)}`,
    status: index % 5 === 0 ? "completed" : "open",
    contactId: contact.id,
    contactName: contact.name,
    propertyId: property.id,
    propertyTitle: property.title,
    startTime: `${pad(9 + (index % 7))}:00`,
    duration: 30 + (index % 3) * 15,
    agentId: agent.id,
    agentName: agent.name,
  };
}

function buildDemoSeed() {
  const properties = Array.from({ length: PROPERTY_COUNT }, (_, index) => buildProperty(index));
  const contacts = Array.from({ length: CONTACT_COUNT }, (_, index) => buildContact(index, properties));
  const viewings = Array.from({ length: VIEWING_COUNT }, (_, index) => buildViewing(index, properties, contacts));
  const tasks = Array.from({ length: TASK_COUNT }, (_, index) => buildTask(index, properties, contacts));

  return {
    agency: structuredClone(DEMO_AGENCY),
    agents: structuredClone(DEMO_AGENTS),
    contacts,
    properties,
    viewings,
    tasks,
  };
}

export function createDemoSessionState(): DemoSessionState {
  const now = isoNow();
  const seed = buildDemoSeed();

  return {
    sessionId: `demo-${Math.random().toString(36).slice(2, 10)}`,
    mode: "local-demo",
    createdAt: now,
    lastUpdatedAt: now,
    isDirty: false,
    agency: seed.agency,
    agents: seed.agents,
    contacts: seed.contacts,
    properties: seed.properties,
    viewings: seed.viewings,
    tasks: seed.tasks,
  };
}

export function getDemoProvisionSeed() {
  return buildDemoSeed();
}
