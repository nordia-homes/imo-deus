export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Lead' | 'Client' | 'Partner';
  avatarUrl: string;
  lastContacted: string;
  notes: string;
  interactionHistory: Interaction[];
};

export type Interaction = {
  id: string;
  type: 'Email' | 'Call' | 'Meeting';
  date: string;
  notes: string;
};

export type Property = {
  id:string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  description: string;
  imageUrl: string;
  imageHint: string;
  type: 'House' | 'Apartment' | 'Condo';
  status: 'For Sale' | 'Sold' | 'Pending';
};

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  contactId?: string;
  contactName?: string;
};

export type SalesData = {
  month: string;
  sales: number;
};

export type LeadSourceData = {
  source: string;
  count: number;
  fill: string;
};
