

export type PromotionStatus = {
  status: 'unpublished' | 'pending' | 'published' | 'error';
  lastSync?: string;
  link?: string;
  views?: number;
}

export type Property = {
  id: string;
  title: string;
  address: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number; // Suprafata Utila
  totalSurface?: number; // Suprafata Construita
  description?: string;
  images: { url: string; alt: string; }[];
  amenities?: string[];
  agent?: {
    name: string;
    avatarUrl: string;
  };
  latitude?: number;
  longitude?: number;

  // New detailed fields
  propertyType: string; // Apartament, Casa, etc.
  transactionType: string; // Vanzare, Inchiriere
  constructionYear?: number;
  floor?: string; // Parter, 1, 2...
  totalFloors?: number;
  comfort?: string; // e.g. 'Lux'
  interiorState?: string; // Renovat, Buna, etc.
  furnishing?: string; // Complet, Partial, Nemobilat
  heatingSystem?: string; // Centrala proprie, Termoficare
  parking?: string; // Garaj, Exterior
  keyFeatures?: string; // Used for AI, comma separated
  
  // For compatibility with existing components that might use these
  tagline?: string;
  createdAt?: string;
  promotions?: {
    [portalName: string]: PromotionStatus;
  };
  agentId?: string | null;
  agentName?: string | null;
  status?: 'Activ' | 'Inactiv' | 'Vândut' | 'Închiriat' | 'Rezervat';
  featured?: boolean;
  statusUpdatedAt?: string;
  notes?: string;
  salesScore?: 'Scăzut' | 'Mediu' | 'Ridicată';
  ownerName?: string;
  ownerPhone?: string;
};

export type MatchedProperty = Property & { matchScore: number; reasoning: string };

export type ContactPreferences = {
    desiredPriceRangeMin: number;
    desiredPriceRangeMax: number;
    desiredBedrooms: number;
    desiredBathrooms: number;
    desiredSquareFootageMin: number;
    desiredSquareFootageMax: number;
    desiredFeatures: string;
    locationPreferences: string;
}

export type Interaction = {
    id: string;
    type: 'Apel telefonic' | 'Email' | 'Întâlnire' | 'Vizionare' | 'Ofertă' | 'WhatsApp' | 'Notiță';
    date: string;
    notes: string;
    agent?: {
      name: string;
    }
}

export type Offer = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  price: number;
  status: 'În așteptare' | 'Acceptată' | 'Refuzată';
  date: string;
}

export type FinancialStatus = 'Neprecalificat' | 'Credit Pre-aprobat' | 'Credit Aprobat' | 'Cash';


export type Contact = {
    id: string;
    name: string;
    phone: string;
    email: string;
    source: string;
    budget?: number;
    status: 'Nou' | 'Contactat' | 'Vizionare' | 'În negociere' | 'Câștigat' | 'Pierdut';
    description?: string;
    contactType: 'Lead' | 'Client' | 'Partener';
    interactionHistory?: Interaction[];
    preferences?: Partial<ContactPreferences>;
    city?: string;
    zones?: string[];
    leadScore?: number;
    leadScoreReason?: string;
    createdAt?: string;
    agentId?: string | null;
    agentName?: string | null;
    priority?: 'Scăzută' | 'Medie' | 'Ridicată';
    portalId?: string | null;
    tags?: string[];
    sourcePropertyId?: string;
    offers?: Offer[];
    financialStatus?: FinancialStatus;
    recommendationHistory?: { [propertyId: string]: PortalRecommendation };
}

export type SalesData = {
  month: string;
  sales: number;
};

export type LeadSourceData = {
  source: string;
  count: number;
  fill: string;
};

export type ConversionData = {
  date: string;
  vizionari: number;
  tranzactii: number;
};

export type Task = {
  id: string;
  description: string;
  dueDate: string;
  status: 'open' | 'completed';
  contactId?: string | null;
  contactName?: string | null;
  propertyId?: string | null;
  propertyTitle?: string | null;
  startTime?: string;
  duration?: number;
  agentId?: string | null;
  agentName?: string | null;
};

export type Agency = {
  id: string;
  name: string;
  ownerId: string;
  agencyDescription?: string;
  logoUrl?: string;
  primaryColor?: string;
  agentIds?: string[];
  address?: string;
  phone?: string;
  email?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
}

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  agentBio?: string;
  agencyId?: string;
  role?: 'admin' | 'agent';
};

export type Invite = {
  email: string;
  agencyId: string;
  agencyName: string;
  role: 'agent';
  invitedBy: string;
};

export type ClientPortal = {
  id: string;
  contactId: string;
  agencyId: string;
  contactName: string;
  agentName: string;
  createdAt: string;
};

export type PortalRecommendation = {
  id: string;
  propertyId: string;
  addedAt: string;
  clientFeedback: 'liked' | 'disliked' | 'none';
  clientComment?: string;
};

export type Viewing = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  contactId: string;
  contactName: string;
  agentId: string;
  agentName?: string;
  viewingDate: string; // ISO string
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
};


export type WithId<T> = T & { id: string };

// Types for CMA
export type ComparableProperty = {
    id: string;
    address: string;
    status: 'Activ' | 'Vândut' | 'Închiriat' | 'Inactiv';
    price: number;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
    similarity: string;
}

export type PriceAdjustment = {
    feature: string;
    adjustment: string;
    reason: string;
}

export type CMA = {
    subjectPropertyId: string;
    subjectPropertyAddress: string;
    comparableProperties: ComparableProperty[];
    priceAdjustments: PriceAdjustment[];
    estimatedValueRange: {
        min: number;
        max: number;
    };
    notes: string;
}
