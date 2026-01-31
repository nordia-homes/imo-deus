







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
  status?: 'Activ' | 'Inactiv' | 'Vândut' | 'Închiriat';
  featured?: boolean;
};


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
    type: 'Apel telefonic' | 'Email' | 'Întâlnire' | 'Vizionare' | 'Ofertă';
    date: string;
    notes: string;
}


export type Contact = {
    id: string;
    name: string;
    phone: string;
    email: string;
    source: string;
    budget?: number;
    status: 'Nou' | 'Contactat' | 'Vizionare' | 'În negociere' | 'Câștigat' | 'Pierdut';
    notes: string;
    contactType: 'Lead' | 'Client' | 'Partener';
    interactionHistory: Interaction[];
    preferences: ContactPreferences;
    city?: string;
    zones?: string[];
    leadScore?: number;
    createdAt?: string;
    agentId?: string | null;
    agentName?: string | null;
    priority?: 'Scăzută' | 'Medie' | 'Ridicată';
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

export type Task = {
  id: string;
  description: string;
  dueDate: string;
  status: 'open' | 'completed';
  contactId?: string | null;
  contactName?: string | null;
  startTime?: string;
  duration?: number;
  agentId?: string | null;
  agentName?: string | null;
};

export type Agency = {
  id: string;
  name: string;
  ownerId: string;
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
  agencyId?: string;
  role?: 'admin' | 'agent';
};

export type Contract = {
  id: string;
  propertyId: string;
  propertyTitle?: string;
  contactId: string;
  contactName?: string;
  contractType: 'Vânzare-Cumpărare' | 'Închiriere';
  status: 'Draft' | 'Trimis' | 'Semnat' | 'Anulat';
  date: string;
  price: number;
  content?: string;
  agentId?: string | null;
  agentName?: string | null;
};

export type Invite = {
  email: string;
  agencyId: string;
  agencyName: string;
  role: 'agent';
  invitedBy: string;
};

export type WithId<T> = T & { id: string };
    

    

    