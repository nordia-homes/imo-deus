export type CollaborationAccount = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  organizationName: string;
  organizationId: string;
  agencyId?: string;
  accountType: 'crm' | 'collaborator_only';
};

export type CollaborationListing = {
  id: string;
  sourceAgencyId: string;
  propertyId: string;
  ownerAgentUid: string;
  ownerAgencyName: string;
  ownerAgentName: string;
  ownerAgentPhone: string;
  ownerAgentEmail: string;
  title: string;
  description: string;
  city: string;
  zone: string;
  price: number;
  rooms: number;
  squareFootage: number;
  propertyType: string;
  transactionType: string;
  images: { url: string; alt: string }[];
  terms: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
};

export type BuyerCollaborationListing = Pick<CollaborationListing,
  'title' | 'description' | 'city' | 'zone' | 'price' | 'rooms' | 'squareFootage' | 'propertyType' | 'transactionType' | 'images'>;

export type CollaborationLink = {
  id: string;
  listingId: string;
  collaboratorUid: string;
  collaboratorOrganizationId: string;
  collaboratorName: string;
  collaboratorPhone: string;
  collaboratorEmail: string;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
};

export type CollaborationLead = {
  id: string;
  listingId: string;
  linkId: string;
  collaboratorUid: string;
  collaboratorOrganizationId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  kind: 'message' | 'viewing';
  status: 'new' | 'contacted' | 'case_opened';
  createdAt: string;
  updatedAt: string;
};

export type CollaborationCase = {
  id: string;
  listingId: string;
  leadId: string;
  collaboratorUid: string;
  collaboratorOrganizationId: string;
  ownerAgentUid: string;
  ownerAgencyId: string;
  propertyTitle: string;
  collaboratorName: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  status: 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  viewingAt?: string;
  offerAmount?: number;
  offerStatus?: 'pending' | 'accepted' | 'declined';
  terms: string;
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
};
