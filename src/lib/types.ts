

export type PromotionStatus = {
  status: 'unpublished' | 'pending' | 'published' | 'error';
  lastSync?: string;
  link?: string;
  views?: number;
  remoteId?: number;
  errorMessage?: string;
  remoteState?: string;
}

export type ImobiliarePromotionSettings = {
  status?: 'draft' | 'online';
  imoradarStatus?: 'draft' | 'online';
  promotions?: {
    special?: boolean;
    top_listing?: boolean;
    top_listing_s?: boolean;
    promo?: boolean;
    promo_zones?: string[];
    pole_position?: boolean;
    promote_imoradar?: boolean;
    bonus?: boolean;
    energy?: number;
    properties_of_the_month?: boolean;
    similar_properties?: boolean;
  };
};

export type ImobiliareMediaLink = {
  type: 'video' | 'virtual_tour';
  link: string;
};

export type ImobiliarePortalProfile = {
  enabled?: boolean;
  customReference?: string;
  titleOverride?: string;
  descriptionOverride?: string;
  categoryApi?: number | null;
  locationId?: number | null;
  locationLabel?: string | null;
  remoteAgentId?: number | null;
  priceCurrency?: 'EUR' | 'RON' | 'USD';
  streetName?: string;
  streetNumber?: string;
  block?: string;
  entrance?: string;
  apartmentNumber?: string;
  mapMarkerType?: 'pin' | 'square_area';
  gridId?: string;
  dataPropertiesOverrides?: Record<string, unknown>;
  mediaLinks?: ImobiliareMediaLink[];
  performanceReportEmail?: string;
  promotionSettings?: ImobiliarePromotionSettings;
  lastValidationError?: string | null;
  lastPublishedAt?: string | null;
  lastPayloadHash?: string | null;
  lastPublishAuditHistory?: Array<{
    attemptedAt: string;
    stage?: string | null;
    responseStatus?: number | null;
    errorMessage?: string | null;
  }> | null;
};

export type ImobiliareSyncJobSummary = {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  updated: number;
  published: number;
  unpublished: number;
  pending: number;
  errors: number;
  failed: number;
  retried?: number;
};

export type ImobiliareAgentMapping = {
  localAgentId: string;
  localAgentName?: string | null;
  localAgentEmail?: string | null;
  remoteAgentId: number;
  remoteAgentName?: string | null;
  remoteAgentEmail?: string | null;
  source: 'manual' | 'matched_by_email' | 'matched_by_name' | 'created_remote' | 'fallback';
  updatedAt: string;
};

export type ImobiliareAnalyticsSummary = {
  totalProperties: number;
  published: number;
  unpublished: number;
  pending: number;
  errors: number;
  totalViews: number;
  lastSyncAt?: string | null;
  topListings: Array<{
    propertyId: string;
    title: string;
    views: number;
    status: PromotionStatus['status'];
  }>;
};

export type PortalIntegrationPublicStatus = {
  connected: boolean;
  username?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
  lastError?: string | null;
  remoteAccountName?: string | null;
  remoteAgentCount?: number;
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
  lastReconcileAt?: string | null;
  lastReconcileSummary?: ImobiliareSyncJobSummary | null;
  lastRetryAt?: string | null;
  lastRetrySummary?: ImobiliareSyncJobSummary | null;
  agentMappings?: ImobiliareAgentMapping[] | null;
  analytics?: ImobiliareAnalyticsSummary | null;
};

export type ImobiliareIntegrationPrivate = {
  provider: 'imobiliare';
  agencyId: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  connectedAt: string;
  updatedAt: string;
  remoteAgentCount?: number;
  remoteAccountName?: string | null;
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
  agentMappings?: ImobiliareAgentMapping[] | null;
};

export type FacebookGroup = {
  name: string;
  url: string;
};

export type FacebookPromotionJob = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyDescription: string;
  propertyImages: { url: string; alt: string }[];
  createdAt: string;
  createdBy: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  groups: Array<FacebookGroup & { status: 'pending' | 'opened' | 'posted' | 'skipped' }>;
};

export type FacebookPromotionSession = {
  jobId: string;
  propertyId: string;
  propertyTitle: string;
  propertyDescription: string;
  propertyImages: { url: string; alt: string }[];
  groups: Array<FacebookGroup & { status: 'pending' | 'opened' | 'posted' | 'skipped' }>;
  currentGroupIndex: number;
  startedAt: string;
};

export type Property = {
  id: string;
  title: string;
  address: string;
  location: string;
  price: number;
  rooms: number;
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
  orientation?: string;
  comfort?: string; // e.g. 'Lux'
  interiorState?: string; // Renovat, Buna, etc.
  furnishing?: string; // Complet, Partial, Nemobilat
  heatingSystem?: string; // Centrala proprie, Termoficare
  parking?: string; // Garaj, Exterior
  keyFeatures?: string; // Used for AI, comma separated
  nearMetro?: boolean;
  
  // New fields from user request
  buildingState?: string;
  seismicRisk?: string;
  balconyTerrace?: string;
  partitioning?: string;
  kitchen?: string;
  lift?: string;
  city?: string;
  zone?: string;
  cadastralNumber?: string;

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
  rlvUrl?: string;
  portalProfiles?: {
    imobiliare?: ImobiliarePortalProfile;
  };

  // Commission fields
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
};

export type ZoneDebugBreakdown = {
  exact: number;
  adjacent: number;
  cluster: number;
  macro: number;
  penalty: number;
};

export type MatchedProperty = Property & {
  matchScore: number;
  reasoning: string;
  zoneReasoning?: string | null;
  zoneDebug?: ZoneDebugBreakdown | null;
};
export type MatchedBuyer = Contact & {
  matchScore: number;
  reasoning: string;
  zoneReasoning?: string | null;
  zoneDebug?: ZoneDebugBreakdown | null;
};

export type ContactPreferences = {
    desiredPriceRangeMin: number;
    desiredPriceRangeMax: number;
    desiredRooms: number;
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
    contactType: 'Cumparator' | 'Client' | 'Partener';
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
    sourcePropertyId?: string | null;
    offers?: Offer[];
    financialStatus?: FinancialStatus;
    recommendationHistory?: { [propertyId: string]: PortalRecommendation };
    photoUrl?: string;
    address?: string;
    personalNumericCode?: string;
    identityDocumentSeries?: string;
    identityDocumentNumber?: string;
    entityType?: 'individual' | 'company';
    legalCompanyName?: string;
    companyTaxId?: string;
    tradeRegisterNumber?: string;
    registeredOffice?: string;
    legalRepresentative?: string;
    preferencesLinkId?: string;
    preferencesChatHistory?: { role: 'user' | 'model'; content: string; }[];
    generalZone?: 'Nord' | 'Sud' | 'Est' | 'Vest' | 'Central' | 'Oricare' | 'all' | null;
    archivedAt?: string | null;
    archivedByAge?: boolean;
};

export type SalesData = {
  month: string;
  sales: number;
};

export type BuyerSourceData = {
  source: string;
  count: number;
  fill: string;
};

export type LeadSourceData = {
  source: string;
  count: number;
  fill: string;
}

export type ConversionData = {
  date: string;
  vizionari: number;
  tranzactii: number;
};

export type ActiveBuyersEvolutionData = {
  date: string;
  count: number;
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
  facebookGroups?: FacebookGroup[];
  shareImageUrl?: string;
  legalCompanyName?: string;
  companyTaxId?: string;
  tradeRegisterNumber?: string;
  registeredOffice?: string;
  legalRepresentative?: string;
  termsAndConditions?: string;
  privacyPolicy?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'connected' | 'error';
  customDomainAliases?: string[];
  customDomainResourceNames?: string[];
  customDomainLastCheckedAt?: string;
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

export type ContractTemplateCategory =
  | 'reservation'
  | 'collaboration'
  | 'exclusivity'
  | 'custom';

export type ContractTemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox';

export type ContractTemplateFieldSource =
  | 'manual'
  | 'contract.number'
  | 'contract.city'
  | 'property.cadastralNumber'
  | 'property.commissionPercent'
  | 'reservation.amount'
  | 'reservation.currency'
  | 'reservation.expiryDate'
  | 'buyer.name'
  | 'buyer.address'
  | 'buyer.personalNumericCode'
  | 'buyer.identityDocumentSeries'
  | 'buyer.identityDocumentNumber'
  | 'buyer.legalCompanyName'
  | 'buyer.companyTaxId'
  | 'buyer.tradeRegisterNumber'
  | 'buyer.registeredOffice'
  | 'buyer.legalRepresentative'
  | 'buyer.phone'
  | 'buyer.email'
  | 'owner.name'
  | 'owner.address'
  | 'owner.personalNumericCode'
  | 'owner.identityDocumentSeries'
  | 'owner.identityDocumentNumber'
  | 'owner.legalCompanyName'
  | 'owner.companyTaxId'
  | 'owner.tradeRegisterNumber'
  | 'owner.registeredOffice'
  | 'owner.legalRepresentative'
  | 'owner.bankAccount'
  | 'owner.bankAccountHolder'
  | 'owner2.name'
  | 'owner2.address'
  | 'owner2.personalNumericCode'
  | 'owner2.identityDocumentSeries'
  | 'owner2.identityDocumentNumber'
  | 'owner2.legalCompanyName'
  | 'owner2.companyTaxId'
  | 'owner2.tradeRegisterNumber'
  | 'owner2.registeredOffice'
  | 'owner2.legalRepresentative'
  | 'owner.phone'
  | 'owner.email'
  | 'property.address'
  | 'property.price'
  | 'property.city'
  | 'property.zone'
  | 'property.title'
  | 'agency.name'
  | 'agency.legalCompanyName'
  | 'agency.companyTaxId'
  | 'agency.tradeRegisterNumber'
  | 'agency.registeredOffice'
  | 'agency.legalRepresentative'
  | 'agency.phone'
  | 'agency.email'
  | 'agent.name'
  | 'agent.email'
  | 'agent.phone'
  | 'currentDate';

export type ContractTemplateField = {
  id: string;
  key: string;
  label: string;
  type: ContractTemplateFieldType;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  source?: ContractTemplateFieldSource;
  multiline?: boolean;
};

export type ContractTemplate = {
  id: string;
  agencyId: string;
  name: string;
  category: ContractTemplateCategory;
  description?: string;
  sourceType?: 'document';
  content?: string;
  headerMode?: 'legacy' | 'crm_prefilled';
  sourceFormat?: 'manual' | 'docx';
  sourcePdfUrl?: string;
  sourcePdfPath?: string;
  fileName?: string;
  pageCount?: number;
  status: 'draft' | 'active';
  fields: ContractTemplateField[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type GeneratedContract = {
  id: string;
  agencyId: string;
  templateId: string;
  templateName: string;
  generatedBy: string;
  createdAt: string;
  values: Record<string, string | number | boolean | null>;
  fileName: string;
  contactId?: string | null;
  propertyId?: string | null;
};

export type CustomDomainInstructionRow = {
  action: 'ADD' | 'REMOVE' | 'UNSPECIFIED';
  type: string;
  host: string;
  value: string;
};

export type CustomDomainApiDomain = {
  domainName: string;
  resourceName: string;
  hostState?: string;
  ownershipState?: string;
  certState?: string;
  issues: string[];
  instructions: CustomDomainInstructionRow[];
};

export type CustomDomainApiResult = {
  primaryDomain: string;
  aliases: string[];
  agencyId: string;
  overallStatus: 'pending' | 'connected' | 'error';
  domains: CustomDomainApiDomain[];
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  agentBio?: string;
  agencyId?: string;
  role?: 'admin' | 'agent' | 'platform_admin';
  pushTokens?: string[];
  pushNotificationsEnabled?: boolean;
  pushNotificationsUpdatedAt?: string;
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
  duration?: number;
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
    rooms: number;
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

export type BriefingSummaryItem = {
  label: string;
  value: number;
};

export type BriefingPriority = {
  text: string;
};

export type BriefingViewing = {
  id: string;
  time: string;
  title: string;
  contact: string;
};

export type BriefingClient = {
  id: string;
  name: string;
  reason: string;
  avatar?: string | null;
};

export type BriefingProperty = {
  id: string;
  name: string;
  reason: string;
  image?: string | null;
};

export type BriefingWhatsappDraft = {
  contactName: string;
  reason: string;
  message: string;
};

export type BriefingNextStepPlan = {
  contactName: string;
  step: string;
  reason: string;
  expectedOutcome: string;
};

export type Briefing = {
  summary: BriefingSummaryItem[];
  priorities: BriefingPriority[];
  upcomingViewings: BriefingViewing[];
  urgentClients: BriefingClient[];
  propertiesToOptimize: BriefingProperty[];
  urgentClientsAnalysis: string;
  propertiesToReviewAnalysis: string;
  executiveSummary?: string;
  dailyFocus?: string;
  opportunities?: string[];
  suggestedPrompts?: string[];
  whatsAppDrafts?: BriefingWhatsappDraft[];
  nextStepPlans?: BriefingNextStepPlan[];
};

export type BuyerPreferencesLink = {
  id: string;
  contactId: string;
  agencyId: string;
  createdAt: string;
};
