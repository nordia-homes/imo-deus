import type {
  Agency,
  Contact,
  ContractTemplateCategory,
  ContractTemplateField,
  ContractTemplateFieldSource,
  ContractTemplateFieldType,
  Property,
  UserProfile,
} from '@/lib/types';

export const CONTRACT_TEMPLATE_CATEGORIES: Array<{
  value: ContractTemplateCategory;
  label: string;
}> = [
  { value: 'reservation', label: 'Contract de rezervare' },
  { value: 'collaboration', label: 'Contract de colaborare' },
  { value: 'exclusivity', label: 'Contract de exclusivitate' },
  { value: 'custom', label: 'Alt contract' },
];

export const CONTRACT_FIELD_TYPES: Array<{
  value: ContractTemplateFieldType;
  label: string;
}> = [
  { value: 'text', label: 'Text scurt' },
  { value: 'textarea', label: 'Text lung' },
  { value: 'number', label: 'Numar' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista' },
  { value: 'checkbox', label: 'Checkbox' },
];

export const CONTRACT_FIELD_SOURCES: Array<{
  value: ContractTemplateFieldSource;
  label: string;
}> = [
  { value: 'manual', label: 'Completare manuala' },
  { value: 'buyer.name', label: 'Cumparator: nume' },
  { value: 'buyer.phone', label: 'Cumparator: telefon' },
  { value: 'buyer.email', label: 'Cumparator: email' },
  { value: 'owner.name', label: 'Proprietar: nume' },
  { value: 'owner.phone', label: 'Proprietar: telefon' },
  { value: 'owner.email', label: 'Proprietar: email' },
  { value: 'property.address', label: 'Proprietate: adresa' },
  { value: 'property.price', label: 'Proprietate: pret' },
  { value: 'property.city', label: 'Proprietate: oras' },
  { value: 'property.zone', label: 'Proprietate: zona' },
  { value: 'property.title', label: 'Proprietate: titlu' },
  { value: 'agency.name', label: 'Agentie: nume' },
  { value: 'agency.legalCompanyName', label: 'Agentie: denumire legala' },
  { value: 'agency.companyTaxId', label: 'Agentie: CUI' },
  { value: 'agency.registeredOffice', label: 'Agentie: sediu social' },
  { value: 'agency.legalRepresentative', label: 'Agentie: reprezentant legal' },
  { value: 'agent.name', label: 'Agent: nume' },
  { value: 'agent.email', label: 'Agent: email' },
  { value: 'agent.phone', label: 'Agent: telefon' },
  { value: 'currentDate', label: 'Data curenta' },
];

export function createContractField(partial?: Partial<ContractTemplateField>): ContractTemplateField {
  const id = partial?.id || `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    key: partial?.key || id.replace(/[^a-zA-Z0-9]+/g, '_'),
    label: partial?.label || 'Camp nou',
    type: partial?.type || 'text',
    required: partial?.required ?? false,
    page: partial?.page ?? 0,
    x: partial?.x ?? 0.12,
    y: partial?.y ?? 0.18,
    width: partial?.width ?? 0.24,
    height: partial?.height ?? 0.05,
    fontSize: partial?.fontSize ?? 11,
    align: partial?.align ?? 'left',
    defaultValue: partial?.defaultValue || '',
    placeholder: partial?.placeholder || '',
    options: partial?.options || [],
    source: partial?.source || 'manual',
    multiline: partial?.multiline ?? false,
  };
}

export function getCategoryLabel(category: ContractTemplateCategory): string {
  return CONTRACT_TEMPLATE_CATEGORIES.find((item) => item.value === category)?.label || category;
}

export const CONTRACT_PLACEHOLDERS: Array<{
  key: ContractTemplateFieldSource;
  token: string;
  label: string;
}> = CONTRACT_FIELD_SOURCES.map((entry) => ({
  key: entry.value,
  token: entry.value === 'manual' ? '{{manual_value}}' : `{{${entry.value}}}`,
  label: entry.label,
}));

export function buildContractPrefillValues(params: {
  fields: ContractTemplateField[];
  buyer?: Contact | null;
  owner?: Contact | null;
  property?: Property | null;
  agency?: Agency | null;
  agent?: UserProfile | null;
}): Record<string, string> {
  const { fields, buyer, owner, property, agency, agent } = params;
  const values: Record<string, string> = {};

  const today = new Date();
  const dateValue = [
    today.getDate().toString().padStart(2, '0'),
    (today.getMonth() + 1).toString().padStart(2, '0'),
    today.getFullYear().toString(),
  ].join('.');

  fields.forEach((field) => {
    let nextValue = field.defaultValue || '';

    switch (field.source) {
      case 'buyer.name':
        nextValue = buyer?.name || '';
        break;
      case 'buyer.phone':
        nextValue = buyer?.phone || '';
        break;
      case 'buyer.email':
        nextValue = buyer?.email || '';
        break;
      case 'owner.name':
        nextValue = owner?.name || '';
        break;
      case 'owner.phone':
        nextValue = owner?.phone || '';
        break;
      case 'owner.email':
        nextValue = owner?.email || '';
        break;
      case 'property.address':
        nextValue = property?.address || '';
        break;
      case 'property.price':
        nextValue = property?.price != null ? String(property.price) : '';
        break;
      case 'property.city':
        nextValue = property?.city || property?.location || '';
        break;
      case 'property.zone':
        nextValue = property?.zone || '';
        break;
      case 'property.title':
        nextValue = property?.title || '';
        break;
      case 'agency.name':
        nextValue = agency?.name || '';
        break;
      case 'agency.legalCompanyName':
        nextValue = agency?.legalCompanyName || '';
        break;
      case 'agency.companyTaxId':
        nextValue = agency?.companyTaxId || '';
        break;
      case 'agency.registeredOffice':
        nextValue = agency?.registeredOffice || '';
        break;
      case 'agency.legalRepresentative':
        nextValue = agency?.legalRepresentative || '';
        break;
      case 'agent.name':
        nextValue = agent?.name || '';
        break;
      case 'agent.email':
        nextValue = agent?.email || '';
        break;
      case 'agent.phone':
        nextValue = agent?.phone || '';
        break;
      case 'currentDate':
        nextValue = dateValue;
        break;
      default:
        nextValue = field.defaultValue || '';
        break;
    }

    values[field.key] = nextValue;
  });

  return values;
}

export function buildContractPlaceholderMap(params: {
  buyer?: Contact | null;
  owner?: Contact | null;
  property?: Property | null;
  agency?: Agency | null;
  agent?: UserProfile | null;
}): Record<string, string> {
  const { buyer, owner, property, agency, agent } = params;
  const today = new Date();
  const currentDate = [
    today.getDate().toString().padStart(2, '0'),
    (today.getMonth() + 1).toString().padStart(2, '0'),
    today.getFullYear().toString(),
  ].join('.');

  return {
    buyer_name: buyer?.name || '',
    buyer_phone: buyer?.phone || '',
    buyer_email: buyer?.email || '',
    owner_name: owner?.name || '',
    owner_phone: owner?.phone || '',
    owner_email: owner?.email || '',
    property_address: property?.address || '',
    property_price: property?.price != null ? String(property.price) : '',
    property_city: property?.city || property?.location || '',
    property_zone: property?.zone || '',
    property_title: property?.title || '',
    agency_name: agency?.name || '',
    agency_legalCompanyName: agency?.legalCompanyName || '',
    agency_companyTaxId: agency?.companyTaxId || '',
    agency_registeredOffice: agency?.registeredOffice || '',
    agency_legalRepresentative: agency?.legalRepresentative || '',
    agent_name: agent?.name || '',
    agent_email: agent?.email || '',
    agent_phone: agent?.phone || '',
    currentDate,
  };
}

export function renderContractContent(
  content: string,
  values: Record<string, string | number | boolean | null | undefined>
) {
  const withVisualVariablesResolved = content.replace(
    /<span[^>]*data-contract-variable-key="([^"]+)"[^>]*>(.*?)<\/span>/gi,
    (_, rawKey: string) => {
      const normalizedKey = rawKey.replace(/\./g, '_');
      const value = values[normalizedKey];
      if (value == null) return '';
      return String(value);
    }
  );

  return withVisualVariablesResolved.replace(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}/g, (_, rawKey: string) => {
    const normalizedKey = rawKey.replace(/\./g, '_');
    const value = values[normalizedKey];
    if (value == null) return '';
    return String(value);
  });
}

export function createDefaultContractHtml() {
  return `
    <h1>CONTRACT</h1>
    <p>Subsemnatul <strong>{{owner.name}}</strong>, in calitate de proprietar, declar ca pun la dispozitia clientului <strong>{{buyer.name}}</strong> imobilul situat in <strong>{{property.address}}</strong>.</p>
    <p>Pretul convenit pentru rezervare sau colaborare este de <strong>{{property.price}}</strong> EUR.</p>
    <p>Contractul se incheie astazi, <strong>{{currentDate}}</strong>, prin intermediul agentului <strong>{{agent.name}}</strong>, reprezentand agentia <strong>{{agency.name}}</strong>.</p>
    <p>Semnaturi:</p>
    <p>Proprietar: ____________________</p>
    <p>Cumparator: ____________________</p>
    <p>Agent: ____________________</p>
  `.trim();
}

export function stripHtmlTags(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|ul|ol|br)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
