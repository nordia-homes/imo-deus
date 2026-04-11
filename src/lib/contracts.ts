import type {
  Agency,
  Contact,
  ContractTemplate,
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
  { value: 'collaboration', label: 'Contract de intermediere' },
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
  { value: 'contract.number', label: 'Contract: numar' },
  { value: 'contract.city', label: 'Contract: localitate semnare' },
  { value: 'property.cadastralNumber', label: 'Proprietate: numar cadastral' },
  { value: 'property.commissionPercent', label: 'Proprietate: comision (%)' },
  { value: 'reservation.amount', label: 'Rezervare: suma platita' },
  { value: 'buyer.name', label: 'Cumparator: nume' },
  { value: 'buyer.address', label: 'Cumparator: domiciliu complet' },
  { value: 'buyer.personalNumericCode', label: 'Cumparator: CNP' },
  { value: 'buyer.identityDocumentSeries', label: 'Cumparator: serie CI/BI' },
  { value: 'buyer.identityDocumentNumber', label: 'Cumparator: numar CI/BI' },
  { value: 'buyer.phone', label: 'Cumparator: telefon' },
  { value: 'buyer.email', label: 'Cumparator: email' },
  { value: 'owner.name', label: 'Proprietar: nume' },
  { value: 'owner.address', label: 'Proprietar: domiciliu complet' },
  { value: 'owner.personalNumericCode', label: 'Proprietar: CNP' },
  { value: 'owner.identityDocumentSeries', label: 'Proprietar: serie CI/BI' },
  { value: 'owner.identityDocumentNumber', label: 'Proprietar: numar CI/BI' },
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
  { value: 'agency.tradeRegisterNumber', label: 'Agentie: nr. registrul comertului' },
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
      case 'buyer.address':
        nextValue = buyer?.address || '';
        break;
      case 'buyer.personalNumericCode':
        nextValue = buyer?.personalNumericCode || '';
        break;
      case 'buyer.identityDocumentSeries':
        nextValue = buyer?.identityDocumentSeries || '';
        break;
      case 'buyer.identityDocumentNumber':
        nextValue = buyer?.identityDocumentNumber || '';
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
      case 'owner.address':
        nextValue = owner?.address || '';
        break;
      case 'owner.personalNumericCode':
        nextValue = owner?.personalNumericCode || '';
        break;
      case 'owner.identityDocumentSeries':
        nextValue = owner?.identityDocumentSeries || '';
        break;
      case 'owner.identityDocumentNumber':
        nextValue = owner?.identityDocumentNumber || '';
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
      case 'property.cadastralNumber':
        nextValue = property?.cadastralNumber || '';
        break;
      case 'property.commissionPercent':
        nextValue = property?.commissionType === 'percentage' && property?.commissionValue != null ? String(property.commissionValue) : '';
        break;
      case 'property.price':
        nextValue = property?.price != null ? String(property.price) : '';
        break;
      case 'reservation.amount':
        nextValue = field.defaultValue || '';
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
      case 'agency.tradeRegisterNumber':
        nextValue = agency?.tradeRegisterNumber || '';
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
    contract_number: '',
    contract_city: '',
    property_cadastralNumber: property?.cadastralNumber || '',
    property_commissionPercent:
      property?.commissionType === 'percentage' && property?.commissionValue != null ? String(property.commissionValue) : '',
    reservation_amount: '',
    buyer_name: buyer?.name || '',
    buyer_address: buyer?.address || '',
    buyer_personalNumericCode: buyer?.personalNumericCode || '',
    buyer_identityDocumentSeries: buyer?.identityDocumentSeries || '',
    buyer_identityDocumentNumber: buyer?.identityDocumentNumber || '',
    buyer_phone: buyer?.phone || '',
    buyer_email: buyer?.email || '',
    owner_name: owner?.name || '',
    owner_address: owner?.address || '',
    owner_personalNumericCode: owner?.personalNumericCode || '',
    owner_identityDocumentSeries: owner?.identityDocumentSeries || '',
    owner_identityDocumentNumber: owner?.identityDocumentNumber || '',
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
    agency_tradeRegisterNumber: agency?.tradeRegisterNumber || '',
    agency_registeredOffice: agency?.registeredOffice || '',
    agency_legalRepresentative: agency?.legalRepresentative || '',
    agent_name: agent?.name || '',
    agent_email: agent?.email || '',
    agent_phone: agent?.phone || '',
    currentDate,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createVariableSpan(key: string, label: string) {
  return `<span data-contract-variable-key="${escapeHtml(key)}" data-contract-variable-label="${escapeHtml(label)}" class="contract-variable-chip">${escapeHtml(label)}</span>`;
}

function buildBeneficiaryParagraph() {
  return `${createVariableSpan('owner.name', 'Proprietar: nume')} cu domiciliul în ${createVariableSpan('owner.address', 'Proprietar: domiciliu complet')}, CNP ${createVariableSpan('owner.personalNumericCode', 'Proprietar: CNP')} identificat cu CI/BI seria ${createVariableSpan('owner.identityDocumentSeries', 'Proprietar: serie CI/BI')} nr. ${createVariableSpan('owner.identityDocumentNumber', 'Proprietar: numar CI/BI')}, denumit în continuare “Beneficiar”`;
}

function buildProviderParagraph() {
  return `${createVariableSpan('agency.legalCompanyName', 'Agentie: denumire legala')}, cu sediul social in ${createVariableSpan('agency.registeredOffice', 'Agentie: sediu social')}, CUI ${createVariableSpan('agency.companyTaxId', 'Agentie: CUI')}, inregistrat la registrul Comertului cu nr. ${createVariableSpan('agency.tradeRegisterNumber', 'Agentie: nr. registrul comertului')}, fiind reprezentata legal prin ${createVariableSpan('agency.legalRepresentative', 'Agentie: reprezentant legal')}, denumit in continuare “Prestator”`;
}

function buildAgencyAgentParagraph() {
  return `imputernicitul agentiei pentru administrarea proprietatii in portofoliu este ${createVariableSpan('agent.name', 'Agent: nume')}, in calitate de agent, avand numarul de telefon ${createVariableSpan('agent.phone', 'Agent: telefon')}.`;
}

function buildPropertyParagraph() {
  return `Proprietatea care face obiectul acestui contract este situata in ${createVariableSpan('property.address', 'Proprietate: adresa')}, avand numarul cadastral ${createVariableSpan('property.cadastralNumber', 'Proprietate: numar cadastral')} si pretul propus la vanzare de ${createVariableSpan('property.price', 'Proprietate: pret')} EUR.`;
}

export function buildContractHeaderHtml(params: {
  title: string;
  category: ContractTemplateCategory;
}) {
  const { title, category } = params;
  const categoryLabel = getCategoryLabel(category);

  if (category === 'reservation') {
    return `
      <div class="contract-auto-header">
        <div class="contract-auto-header__eyebrow">${escapeHtml(categoryLabel)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p><strong>Numar contract:</strong> ${createVariableSpan('contract.number', 'Numar contract')} | <strong>Data:</strong> ${createVariableSpan('currentDate', 'Data curenta')} | <strong>Loc semnare:</strong> ${createVariableSpan('contract.city', 'Localitate semnare')}</p>
        <h2>Partile contractului</h2>
        <p>${buildBeneficiaryParagraph()}</p>
        <h2>Date agentie</h2>
        <p>${buildProviderParagraph()}</p>
        <p>${buildAgencyAgentParagraph()}</p>
        <p><strong>Cumparator:</strong> ${createVariableSpan('buyer.name', 'Cumparator: nume')} | <strong>Telefon:</strong> ${createVariableSpan('buyer.phone', 'Cumparator: telefon')} | <strong>Email:</strong> ${createVariableSpan('buyer.email', 'Cumparator: email')}</p>
        <h2>Date proprietate si rezervare</h2>
        <p>${buildPropertyParagraph()}</p>
        <p><strong>Suma platita la rezervare:</strong> ${createVariableSpan('reservation.amount', 'Rezervare: suma platita')}</p>
        <hr />
      </div>
    `.trim();
  }

  return `
    <div class="contract-auto-header">
      <div class="contract-auto-header__eyebrow">${escapeHtml(categoryLabel)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p><strong>Numar contract:</strong> ${createVariableSpan('contract.number', 'Numar contract')} | <strong>Data:</strong> ${createVariableSpan('currentDate', 'Data curenta')} | <strong>Loc semnare:</strong> ${createVariableSpan('contract.city', 'Localitate semnare')}</p>
      <h2>Date proprietar</h2>
      <p>${buildBeneficiaryParagraph()}</p>
      <h2>Date agentie</h2>
      <p>${buildProviderParagraph()}</p>
      <p>${buildAgencyAgentParagraph()}</p>
      <h2>Date proprietate</h2>
      <p>${buildPropertyParagraph()}</p>
      <p><strong>Comision (%):</strong> ${createVariableSpan('property.commissionPercent', 'Proprietate: comision (%)')}</p>
      <hr />
    </div>
  `.trim();
}

export function composeContractDocumentHtml(params: {
  templateName: string;
  category: ContractTemplateCategory;
  bodyContent: string;
  headerMode?: ContractTemplate['headerMode'];
}) {
  const { templateName, category, bodyContent, headerMode } = params;
  const normalizedBody = bodyContent?.trim() || '<p></p>';

  if (headerMode === 'legacy') {
    return normalizedBody;
  }

  return `${buildContractHeaderHtml({
    title: templateName,
    category,
  })}\n${normalizedBody}`.trim();
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
    <h2>Clauze contract</h2>
    <p>Agentia poate lipi aici continutul contractului sau poate porni de la acest text de baza si il poate adapta.</p>
    <p>Obiectul contractului: intermedierea tranzactiei care are ca obiect proprietatea mentionata in antetul documentului.</p>
    <p>Partile confirma ca datele de identificare si detaliile proprietatii din antet fac parte integranta din prezentul contract.</p>
    <p>Semnaturi</p>
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
