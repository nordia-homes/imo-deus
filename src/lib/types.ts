





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
  images?: { url: string; alt: string; }[];
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
  imageUrl?: string;
  imageHint?: string;
  createdAt?: string;
  promotions?: {
    [portalName: string]: PromotionStatus;
  };
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
    interactionHistory: Interaction[];
    preferences: ContactPreferences;
    city?: string;
    zones?: string[];
    leadScore?: number;
    createdAt?: string;
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
  contactId?: string;
  contactName?: string;
  startTime?: string;
  duration?: number;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  agencyName?: string;
  agencyLogoUrl?: string;
  agencyPrimaryColor?: string;
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
};

    
