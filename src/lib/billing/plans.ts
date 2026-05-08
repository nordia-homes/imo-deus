export type BillingPlanId = 'esential' | 'avansat' | 'profesional';
export type BillingFeatureKey =
  | 'owner_listings'
  | 'property_management'
  | 'portal_publishing'
  | 'basic_agency_website'
  | 'lead_crm'
  | 'pipeline'
  | 'viewings'
  | 'tasks'
  | 'team_management'
  | 'property_map'
  | 'operational_dashboard'
  | 'ai_assistant'
  | 'ai_matching'
  | 'advanced_reports'
  | 'contracts'
  | 'ocr'
  | 'client_portal'
  | 'lead_scoring'
  | 'custom_domain'
  | 'premium_website_branding'
  | 'executive_forecast'
  | 'social_promotion';

export type BillingTier = {
  quantityMax: number | null;
  unitAmountEur: number;
  discountPercent: number;
};

export type BillingPlanDefinition = {
  id: BillingPlanId;
  name: string;
  headline: string;
  description: string;
  recommended?: boolean;
  baseUnitAmountEur: number;
  tiers: BillingTier[];
  features: BillingFeatureKey[];
};

export const BILLING_FEATURE_LABELS: Record<BillingFeatureKey, string> = {
  owner_listings: 'Anunturi particulari',
  property_management: 'Gestiune proprietati',
  portal_publishing: 'Publicare pe portaluri',
  basic_agency_website: 'Site agentie imobiliara Basic',
  lead_crm: 'CRM cumparatori',
  pipeline: 'Pipeline lead-uri',
  viewings: 'Vizionari',
  tasks: 'Task-uri',
  team_management: 'Management echipa',
  property_map: 'Harta proprietati',
  operational_dashboard: 'Dashboard operational',
  ai_assistant: 'AI Assistant',
  ai_matching: 'Potrivire proprietati AI',
  advanced_reports: 'Rapoarte avansate',
  contracts: 'Contracte si sabloane',
  ocr: 'OCR documente',
  client_portal: 'Portal client',
  lead_scoring: 'Scorare lead-uri si recomandari',
  custom_domain: 'Domeniu custom',
  premium_website_branding: 'Website premium branduit',
  executive_forecast: 'Forecast si alerte executive',
  social_promotion: 'Promovare social media',
};

const CORE_FEATURES: BillingFeatureKey[] = [
  'owner_listings',
  'property_management',
  'portal_publishing',
  'basic_agency_website',
  'lead_crm',
  'pipeline',
  'viewings',
  'tasks',
  'team_management',
  'property_map',
  'operational_dashboard',
];

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: 'esential',
    name: 'Esential',
    headline: 'Pentru agentii care vor un CRM complet de baza.',
    description: 'Operatiunile zilnice ale agentiei intr-un singur loc, fara compromis pe nucleul comercial.',
    baseUnitAmountEur: 9.99,
    tiers: [
      { quantityMax: 3, unitAmountEur: 9.99, discountPercent: 0 },
      { quantityMax: 7, unitAmountEur: 8.49, discountPercent: 15 },
      { quantityMax: 14, unitAmountEur: 7.49, discountPercent: 25 },
      { quantityMax: 30, unitAmountEur: 6.49, discountPercent: 35 },
      { quantityMax: null, unitAmountEur: 5.49, discountPercent: 45 },
    ],
    features: CORE_FEATURES,
  },
  {
    id: 'avansat',
    name: 'Avansat',
    headline: 'Pentru agentii care vor crestere mai rapida si AI util.',
    description: 'Automatizari comerciale, rapoarte si asistenta AI pentru echipe in crestere.',
    recommended: true,
    baseUnitAmountEur: 19.99,
    tiers: [
      { quantityMax: 3, unitAmountEur: 19.99, discountPercent: 0 },
      { quantityMax: 7, unitAmountEur: 16.99, discountPercent: 15 },
      { quantityMax: 14, unitAmountEur: 14.99, discountPercent: 25 },
      { quantityMax: 30, unitAmountEur: 12.99, discountPercent: 35 },
      { quantityMax: null, unitAmountEur: 10.99, discountPercent: 45 },
    ],
    features: [
      ...CORE_FEATURES,
      'ai_assistant',
      'ai_matching',
      'advanced_reports',
      'contracts',
      'ocr',
      'client_portal',
      'lead_scoring',
    ],
  },
  {
    id: 'profesional',
    name: 'Profesional',
    headline: 'Pentru agentii care vor branding premium si control executiv.',
    description: 'Pachetul complet pentru agentii care scaleaza, branduiesc si automatizeaza la nivel superior.',
    baseUnitAmountEur: 29.99,
    tiers: [
      { quantityMax: 3, unitAmountEur: 29.99, discountPercent: 0 },
      { quantityMax: 7, unitAmountEur: 25.49, discountPercent: 15 },
      { quantityMax: 14, unitAmountEur: 22.49, discountPercent: 25 },
      { quantityMax: 30, unitAmountEur: 19.49, discountPercent: 35 },
      { quantityMax: null, unitAmountEur: 16.49, discountPercent: 45 },
    ],
    features: [
      ...CORE_FEATURES,
      'ai_assistant',
      'ai_matching',
      'advanced_reports',
      'contracts',
      'ocr',
      'client_portal',
      'lead_scoring',
      'custom_domain',
      'premium_website_branding',
      'executive_forecast',
      'social_promotion',
    ],
  },
];

export const BILLING_PLANS_BY_ID: Record<BillingPlanId, BillingPlanDefinition> = BILLING_PLANS.reduce(
  (accumulator, plan) => {
    accumulator[plan.id] = plan;
    return accumulator;
  },
  {} as Record<BillingPlanId, BillingPlanDefinition>
);

export function isBillingPlanId(value: string | null | undefined): value is BillingPlanId {
  return value === 'esential' || value === 'avansat' || value === 'profesional';
}
