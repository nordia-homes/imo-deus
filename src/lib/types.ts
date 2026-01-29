
export type Property = {
  id:string;
  address: string; // Used in property-matcher
  title: string;
  tagline: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  description: string;
  images: { url: string; alt: string }[];
  location: string;
  amenities: string[];
  agent: {
    name: string;
    avatarUrl: string;
  },
  latitude: number;
  longitude: number;

  // Additional fields for matcher
  imageUrl: string;
  imageHint: string;
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
    budget: number;
    status: 'Nou' | 'Contactat' | 'Vizionare' | 'În negociere' | 'Câștigat' | 'Pierdut';
    notes: string;
    interactionHistory: Interaction[];
    preferences: ContactPreferences;
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
