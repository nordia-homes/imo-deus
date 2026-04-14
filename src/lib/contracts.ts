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
  { value: 'reservation.currency', label: 'Rezervare: moneda' },
  { value: 'reservation.expiryDate', label: 'Rezervare: data expirare' },
  { value: 'buyer.name', label: 'Cumparator: nume' },
  { value: 'buyer.address', label: 'Cumparator: domiciliu complet' },
  { value: 'buyer.personalNumericCode', label: 'Cumparator: CNP' },
  { value: 'buyer.identityDocumentSeries', label: 'Cumparator: serie CI/BI' },
  { value: 'buyer.identityDocumentNumber', label: 'Cumparator: numar CI/BI' },
  { value: 'buyer.legalCompanyName', label: 'Cumparator: denumire legala' },
  { value: 'buyer.companyTaxId', label: 'Cumparator: CUI' },
  { value: 'buyer.tradeRegisterNumber', label: 'Cumparator: nr. registrul comertului' },
  { value: 'buyer.registeredOffice', label: 'Cumparator: sediu social' },
  { value: 'buyer.legalRepresentative', label: 'Cumparator: reprezentant legal' },
  { value: 'buyer.phone', label: 'Cumparator: telefon' },
  { value: 'buyer.email', label: 'Cumparator: email' },
  { value: 'owner.name', label: 'Proprietar: nume' },
  { value: 'owner.address', label: 'Proprietar: domiciliu complet' },
  { value: 'owner.personalNumericCode', label: 'Proprietar: CNP' },
  { value: 'owner.identityDocumentSeries', label: 'Proprietar: serie CI/BI' },
  { value: 'owner.identityDocumentNumber', label: 'Proprietar: numar CI/BI' },
  { value: 'owner.legalCompanyName', label: 'Proprietar: denumire legala' },
  { value: 'owner.companyTaxId', label: 'Proprietar: CUI' },
  { value: 'owner.tradeRegisterNumber', label: 'Proprietar: nr. registrul comertului' },
  { value: 'owner.registeredOffice', label: 'Proprietar: sediu social' },
  { value: 'owner.legalRepresentative', label: 'Proprietar: reprezentant legal' },
  { value: 'owner.bankAccount', label: 'Proprietar: cont bancar' },
  { value: 'owner.bankAccountHolder', label: 'Proprietar: detinator cont bancar' },
  { value: 'owner2.name', label: 'Al doilea proprietar: nume' },
  { value: 'owner2.address', label: 'Al doilea proprietar: domiciliu complet' },
  { value: 'owner2.personalNumericCode', label: 'Al doilea proprietar: CNP' },
  { value: 'owner2.identityDocumentSeries', label: 'Al doilea proprietar: serie CI/BI' },
  { value: 'owner2.identityDocumentNumber', label: 'Al doilea proprietar: numar CI/BI' },
  { value: 'owner2.legalCompanyName', label: 'Al doilea proprietar: denumire legala' },
  { value: 'owner2.companyTaxId', label: 'Al doilea proprietar: CUI' },
  { value: 'owner2.tradeRegisterNumber', label: 'Al doilea proprietar: nr. registrul comertului' },
  { value: 'owner2.registeredOffice', label: 'Al doilea proprietar: sediu social' },
  { value: 'owner2.legalRepresentative', label: 'Al doilea proprietar: reprezentant legal' },
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
  { value: 'agency.phone', label: 'Agentie: telefon' },
  { value: 'agency.email', label: 'Agentie: email' },
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
      case 'buyer.legalCompanyName':
        nextValue = buyer?.legalCompanyName || '';
        break;
      case 'buyer.companyTaxId':
        nextValue = buyer?.companyTaxId || '';
        break;
      case 'buyer.tradeRegisterNumber':
        nextValue = buyer?.tradeRegisterNumber || '';
        break;
      case 'buyer.registeredOffice':
        nextValue = buyer?.registeredOffice || '';
        break;
      case 'buyer.legalRepresentative':
        nextValue = buyer?.legalRepresentative || '';
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
      case 'owner.legalCompanyName':
        nextValue = owner?.legalCompanyName || '';
        break;
      case 'owner.companyTaxId':
        nextValue = owner?.companyTaxId || '';
        break;
      case 'owner.tradeRegisterNumber':
        nextValue = owner?.tradeRegisterNumber || '';
        break;
      case 'owner.registeredOffice':
        nextValue = owner?.registeredOffice || '';
        break;
      case 'owner.legalRepresentative':
        nextValue = owner?.legalRepresentative || '';
        break;
      case 'owner.bankAccount':
        nextValue = '';
        break;
      case 'owner.bankAccountHolder':
        nextValue = '';
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
      case 'reservation.currency':
        nextValue = field.defaultValue || '';
        break;
      case 'reservation.expiryDate':
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
      case 'agency.phone':
        nextValue = agency?.phone || '';
        break;
      case 'agency.email':
        nextValue = agency?.email || '';
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
    reservation_currency: 'EURO',
    reservation_expiryDate: '',
    buyer_name: buyer?.name || '',
    buyer_entityType: buyer?.entityType || 'individual',
    buyer_address: buyer?.address || '',
    buyer_personalNumericCode: buyer?.personalNumericCode || '',
    buyer_identityDocumentSeries: buyer?.identityDocumentSeries || '',
    buyer_identityDocumentNumber: buyer?.identityDocumentNumber || '',
    buyer_legalCompanyName: buyer?.legalCompanyName || '',
    buyer_companyTaxId: buyer?.companyTaxId || '',
    buyer_tradeRegisterNumber: buyer?.tradeRegisterNumber || '',
    buyer_registeredOffice: buyer?.registeredOffice || '',
    buyer_legalRepresentative: buyer?.legalRepresentative || '',
    buyer_phone: buyer?.phone || '',
    buyer_email: buyer?.email || '',
    owner_name: owner?.name || '',
    owner_entityType: owner?.entityType || 'individual',
    owner_address: owner?.address || '',
    owner_personalNumericCode: owner?.personalNumericCode || '',
    owner_identityDocumentSeries: owner?.identityDocumentSeries || '',
    owner_identityDocumentNumber: owner?.identityDocumentNumber || '',
    owner_legalCompanyName: owner?.legalCompanyName || '',
    owner_companyTaxId: owner?.companyTaxId || '',
    owner_tradeRegisterNumber: owner?.tradeRegisterNumber || '',
    owner_registeredOffice: owner?.registeredOffice || '',
    owner_legalRepresentative: owner?.legalRepresentative || '',
    owner_bankAccount: '',
    owner_bankAccountHolder: '',
    owner_phone: owner?.phone || '',
    owner_email: owner?.email || '',
    owner2_name: '',
    owner2_entityType: 'individual',
    owner2_address: '',
    owner2_personalNumericCode: '',
    owner2_identityDocumentSeries: '',
    owner2_identityDocumentNumber: '',
    owner2_legalCompanyName: '',
    owner2_companyTaxId: '',
    owner2_tradeRegisterNumber: '',
    owner2_registeredOffice: '',
    owner2_legalRepresentative: '',
    owner2_phone: '',
    owner2_email: '',
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
    agency_phone: agency?.phone || '',
    agency_email: agency?.email || '',
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
  return `${createVariableSpan('owner.name', 'Proprietar: nume')} cu domiciliul în ${createVariableSpan('owner.address', 'Proprietar: domiciliu complet')}, CNP ${createVariableSpan('owner.personalNumericCode', 'Proprietar: CNP')}, identificat cu CI/BI seria ${createVariableSpan('owner.identityDocumentSeries', 'Proprietar: serie CI/BI')} nr. ${createVariableSpan('owner.identityDocumentNumber', 'Proprietar: numar CI/BI')}, denumit în continuare “Beneficiar”`;
}

function buildBeneficiaryCompanyParagraph() {
  return `${createVariableSpan('owner.legalCompanyName', 'Proprietar: denumire legala')}, cu sediul social in ${createVariableSpan('owner.registeredOffice', 'Proprietar: sediu social')}, CUI ${createVariableSpan('owner.companyTaxId', 'Proprietar: CUI')}, inregistrat la registrul Comertului cu nr. ${createVariableSpan('owner.tradeRegisterNumber', 'Proprietar: nr. registrul comertului')}, fiind reprezentata legal prin ${createVariableSpan('owner.legalRepresentative', 'Proprietar: reprezentant legal')}, denumit in continuare “Beneficiar”`;
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

export type StructuredHeaderBlock =
  | { kind: 'intro'; text: string }
  | { kind: 'party'; index: number; text: string }
  | { kind: 'connector'; text: string }
  | { kind: 'emphasis'; text: string }
  | { kind: 'separator' }
  | { kind: 'namedParagraph'; boldText: string; text: string }
  | { kind: 'paragraph'; text: string };

function getHeaderValue(values: Record<string, string>, key: string, emptyFallback = '') {
  const normalized = normalizeContractText(String(values[key] || ''));
  return normalized || emptyFallback;
}

function buildIdentityClause(params: {
  values: Record<string, string>;
  prefix: 'owner' | 'buyer' | 'owner2';
  emptyFallback?: string;
}) {
  const { values, prefix, emptyFallback = '' } = params;
  const kind = getHeaderValue(values, `${prefix}_identityDocumentKind`, 'standard');
  const number = getHeaderValue(
    values,
    `${prefix}_identityDocumentNumber`,
    getHeaderEmptyFallback(`${prefix}_identityDocumentNumber`, emptyFallback)
  );

  if (kind === 'electronic') {
    return `identificat cu CI/BI nr. document ${number}`;
  }

  const series = getHeaderValue(
    values,
    `${prefix}_identityDocumentSeries`,
    getHeaderEmptyFallback(`${prefix}_identityDocumentSeries`, emptyFallback)
  );

  return `identificat cu CI/BI seria ${series}, nr. ${number}`;
}

function buildFilledBeneficiaryParagraph(values: Record<string, string>) {
  return `${getHeaderValue(values, 'owner_name')} cu domiciliul în ${getHeaderValue(values, 'owner_address')}, CNP ${getHeaderValue(values, 'owner_personalNumericCode')}, ${buildIdentityClause({ values, prefix: 'owner' })}, denumit în continuare “Beneficiar”`;
}

function buildFilledBeneficiaryCompanyParagraph(values: Record<string, string>) {
  return `${getHeaderValue(values, 'owner_legalCompanyName')}, cu sediul social in ${getHeaderValue(values, 'owner_registeredOffice')}, CUI ${getHeaderValue(values, 'owner_companyTaxId')}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'owner_tradeRegisterNumber')}, fiind reprezentata legal prin ${getHeaderValue(values, 'owner_legalRepresentative')}, denumit in continuare “Beneficiar”`;
}

function buildFilledProviderParagraph(values: Record<string, string>) {
  return `${getHeaderValue(values, 'agency_legalCompanyName')}, cu sediul social in ${getHeaderValue(values, 'agency_registeredOffice')}, CUI ${getHeaderValue(values, 'agency_companyTaxId')}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'agency_tradeRegisterNumber')}, fiind reprezentata legal prin ${getHeaderValue(values, 'agency_legalRepresentative')}, denumit in continuare “Prestator”`;
}

function buildFilledAgencyAgentParagraph(values: Record<string, string>) {
  return `imputernicitul agentiei pentru administrarea proprietatii in portofoliu este ${getHeaderValue(values, 'agent_name')}, in calitate de agent, avand numarul de telefon ${getHeaderValue(values, 'agent_phone')}.`;
}

function buildFilledPropertyParagraph(values: Record<string, string>) {
  return `Proprietatea care face obiectul acestui contract este situata in ${getHeaderValue(values, 'property_address')}, avand nr. cadastral ${getHeaderValue(values, 'property_cadastralNumber')} si pretul propus la vanzare de ${getHeaderValue(values, 'property_price')} EUR.`;
}

function buildFilledBuyerParagraph(values: Record<string, string>) {
  return `${getHeaderValue(values, 'buyer_name')}, telefon ${getHeaderValue(values, 'buyer_phone')}, email ${getHeaderValue(values, 'buyer_email')}, denumit in continuare “Rezervant”`;
}

function buildReservationPaymentSentence(values: Record<string, string>, emptyFallback = '') {
  const amount = getHeaderValue(values, 'reservation_amount', emptyFallback);
  const currency = getHeaderValue(values, 'reservation_currency', 'EURO');
  const bankAccount = getHeaderValue(values, 'owner_bankAccount', emptyFallback);
  const bankAccountHolder = getHeaderValue(
    values,
    'owner_bankAccountHolder',
    getHeaderValue(values, 'owner_name', getHeaderEmptyFallback('owner_name', emptyFallback))
  );
  const normalizedCurrency = currency.trim().toUpperCase();
  const currencySuffix = normalizedCurrency === 'RON' ? ' la cursul valutar de astazi' : '';

  return `La semnarea prezentului contract, CUMPARATORUL plateste catre VANZATOR suma de ${amount} ${currency}${currencySuffix}, cu titlu de rezervare in contul bancar ${bankAccount} deschis pe numele ${bankAccountHolder}.`;
}

function buildReservationOwnerParagraph() {
  return `${createVariableSpan('owner.name', 'Proprietar: nume')}, cu domiciliul in ${createVariableSpan('owner.address', 'Proprietar: domiciliu complet')}, avand CNP ${createVariableSpan('owner.personalNumericCode', 'Proprietar: CNP')}, identificat cu CI/BI seria ${createVariableSpan('owner.identityDocumentSeries', 'Proprietar: serie CI/BI')}, nr. ${createVariableSpan('owner.identityDocumentNumber', 'Proprietar: numar CI/BI')}, denumit in continuare "Proprietar",`;
}

function buildReservationOwnerCompanyParagraph() {
  return `${createVariableSpan('owner.legalCompanyName', 'Proprietar: denumire legala')}, cu sediul social in ${createVariableSpan('owner.registeredOffice', 'Proprietar: sediu social')}, CUI ${createVariableSpan('owner.companyTaxId', 'Proprietar: CUI')}, inregistrat la registrul Comertului cu nr. ${createVariableSpan('owner.tradeRegisterNumber', 'Proprietar: nr. registrul comertului')}, reprezentata legal prin ${createVariableSpan('owner.legalRepresentative', 'Proprietar: reprezentant legal')}, denumit in continuare "Proprietar",`;
}

function buildReservationBuyerParagraph() {
  return `${createVariableSpan('buyer.name', 'Cumparator: nume')}, cu domiciliul in ${createVariableSpan('buyer.address', 'Cumparator: domiciliu complet')}, avand CNP ${createVariableSpan('buyer.personalNumericCode', 'Cumparator: CNP')}, identificat cu CI/BI seria ${createVariableSpan('buyer.identityDocumentSeries', 'Cumparator: serie CI/BI')}, nr. ${createVariableSpan('buyer.identityDocumentNumber', 'Cumparator: numar CI/BI')}, denumit in continuare "Cumparator".`;
}

function buildReservationBuyerCompanyParagraph() {
  return `${createVariableSpan('buyer.legalCompanyName', 'Cumparator: denumire legala')}, cu sediul social in ${createVariableSpan('buyer.registeredOffice', 'Cumparator: sediu social')}, CUI ${createVariableSpan('buyer.companyTaxId', 'Cumparator: CUI')}, inregistrat la registrul Comertului cu nr. ${createVariableSpan('buyer.tradeRegisterNumber', 'Cumparator: nr. registrul comertului')}, reprezentata legal prin ${createVariableSpan('buyer.legalRepresentative', 'Cumparator: reprezentant legal')}, denumit in continuare "Cumparator".`;
}

function buildFilledReservationOwnerParagraph(values: Record<string, string>, emptyFallback = '') {
  return `${getHeaderValue(values, 'owner_name', getHeaderEmptyFallback('owner_name', emptyFallback))}, cu domiciliul in ${getHeaderValue(values, 'owner_address', getHeaderEmptyFallback('owner_address', emptyFallback))}, avand CNP ${getHeaderValue(values, 'owner_personalNumericCode', getHeaderEmptyFallback('owner_personalNumericCode', emptyFallback))}, ${buildIdentityClause({ values, prefix: 'owner', emptyFallback })}, denumit in continuare "Proprietar",`;
}

function buildFilledReservationOwnerCompanyParagraph(values: Record<string, string>, emptyFallback = '') {
  return `${getHeaderValue(values, 'owner_legalCompanyName', getHeaderEmptyFallback('owner_legalCompanyName', emptyFallback))}, cu sediul social in ${getHeaderValue(values, 'owner_registeredOffice', getHeaderEmptyFallback('owner_registeredOffice', emptyFallback))}, CUI ${getHeaderValue(values, 'owner_companyTaxId', getHeaderEmptyFallback('owner_companyTaxId', emptyFallback))}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'owner_tradeRegisterNumber', getHeaderEmptyFallback('owner_tradeRegisterNumber', emptyFallback))}, reprezentata legal prin ${getHeaderValue(values, 'owner_legalRepresentative', getHeaderEmptyFallback('owner_legalRepresentative', emptyFallback))}, denumit in continuare "Proprietar",`;
}

function buildFilledReservationBuyerParagraph(values: Record<string, string>, emptyFallback = '') {
  return `${getHeaderValue(values, 'buyer_name', emptyFallback)}, cu domiciliul in ${getHeaderValue(values, 'buyer_address', emptyFallback)}, avand CNP ${getHeaderValue(values, 'buyer_personalNumericCode', emptyFallback)}, ${buildIdentityClause({ values, prefix: 'buyer', emptyFallback })}, denumit in continuare "Cumparator".`;
}

function buildFilledReservationBuyerCompanyParagraph(values: Record<string, string>, emptyFallback = '') {
  return `${getHeaderValue(values, 'buyer_legalCompanyName', emptyFallback)}, cu sediul social in ${getHeaderValue(values, 'buyer_registeredOffice', emptyFallback)}, CUI ${getHeaderValue(values, 'buyer_companyTaxId', emptyFallback)}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'buyer_tradeRegisterNumber', emptyFallback)}, reprezentata legal prin ${getHeaderValue(values, 'buyer_legalRepresentative', emptyFallback)}, denumit in continuare "Cumparator".`;
}

function buildFilledReservationSecondOwnerParagraph(values: Record<string, string>, emptyFallback = '') {
  const ownerEntityType = getHeaderValue(values, 'owner2_entityType', 'individual') === 'company' ? 'company' : 'individual';
  if (ownerEntityType === 'company') {
    return `Impreuna cu ${getHeaderValue(values, 'owner2_legalCompanyName', emptyFallback)}, cu sediul social in ${getHeaderValue(values, 'owner2_registeredOffice', emptyFallback)}, CUI ${getHeaderValue(values, 'owner2_companyTaxId', emptyFallback)}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'owner2_tradeRegisterNumber', emptyFallback)}, reprezentata legal prin ${getHeaderValue(values, 'owner2_legalRepresentative', emptyFallback)}, denumit in continuare "Proprietar",`;
  }

  return `Impreuna cu ${getHeaderValue(values, 'owner2_name', emptyFallback)}, cu domiciliul in ${getHeaderValue(values, 'owner2_address', emptyFallback)}, avand CNP ${getHeaderValue(values, 'owner2_personalNumericCode', emptyFallback)}, ${buildIdentityClause({ values, prefix: 'owner2', emptyFallback })}, denumit in continuare "Proprietar",`;
}

const HEADER_EMPTY_FALLBACKS: Record<string, string> = {
  owner_name: '.'.repeat(78),
  owner_address: '.'.repeat(138),
  owner_personalNumericCode: '.'.repeat(42),
  owner_identityDocumentSeries: '.'.repeat(10),
  owner_identityDocumentNumber: '.'.repeat(10),
  owner_legalCompanyName: '.'.repeat(42),
  owner_registeredOffice: '.'.repeat(96),
  owner_companyTaxId: '.'.repeat(20),
  owner_tradeRegisterNumber: '.'.repeat(30),
  owner_legalRepresentative: '.'.repeat(28),
  property_commissionPercent: '..........',
  property_address: '.'.repeat(138),
  property_cadastralNumber: '.'.repeat(30),
  property_price: '.'.repeat(19),
};

function getHeaderEmptyFallback(key: string, defaultFallback = '') {
  return HEADER_EMPTY_FALLBACKS[key] ?? defaultFallback;
}

function getBodyEmptyFallback(key: string) {
  return HEADER_EMPTY_FALLBACKS[key] ?? '.....';
}

export function buildStructuredHeaderBlocks(
  category: ContractTemplateCategory,
  values: Record<string, string>,
  options?: {
    emptyFallback?: string;
  }
): StructuredHeaderBlock[] {
  const emptyFallback = options?.emptyFallback || '';
  if (category === 'reservation') {
    const ownerEntityType = getHeaderValue(values, 'owner_entityType', 'individual') === 'company' ? 'company' : 'individual';
    const buyerEntityType = getHeaderValue(values, 'buyer_entityType', 'individual') === 'company' ? 'company' : 'individual';
    const hasSecondOwner = Boolean(
      getHeaderValue(values, 'owner2_name', '') ||
      getHeaderValue(values, 'owner2_legalCompanyName', '')
    );
    return [
      {
        kind: 'emphasis',
        text: 'Articolul 1. Partile',
      },
      {
        kind: 'intro',
        text: 'Prezentul Contract de rezervare, denumit in continuare "Contractul", se incheie intre:',
      },
      {
        kind: 'paragraph',
        text:
          ownerEntityType === 'company'
            ? buildFilledReservationOwnerCompanyParagraph(values, emptyFallback)
            : buildFilledReservationOwnerParagraph(values, emptyFallback),
      },
      ...(hasSecondOwner
        ? [
            {
              kind: 'paragraph' as const,
              text: buildFilledReservationSecondOwnerParagraph(values, emptyFallback),
            },
          ]
        : []),
      {
        kind: 'connector',
        text: 'si',
      },
      {
        kind: 'paragraph',
        text:
          buyerEntityType === 'company'
            ? buildFilledReservationBuyerCompanyParagraph(values, emptyFallback)
            : buildFilledReservationBuyerParagraph(values, emptyFallback),
      },
      {
        kind: 'paragraph',
        text: 'Proprietarul si Cumparatorul vor fi denumiti in mod individual "Partea", iar impreuna "Partile".',
      },
      {
        kind: 'separator',
      },
      {
        kind: 'emphasis',
        text: 'Articolul 2. Obiectul contractului',
      },
      {
        kind: 'paragraph',
        text: `Obiectul prezentului Contract il constituie rezervarea imobilului situat in ${getHeaderValue(values, 'property_address', getHeaderEmptyFallback('property_address', emptyFallback))}, avand numar cadastral ${getHeaderValue(values, 'property_cadastralNumber', getHeaderEmptyFallback('property_cadastralNumber', emptyFallback))}, convenit spre vanzare la pretul de ${getHeaderValue(values, 'property_price', getHeaderEmptyFallback('property_price', emptyFallback))} EUR.`,
      },
      {
        kind: 'separator',
      },
      {
        kind: 'emphasis',
        text: 'Articolul 3. Pretul rezervarii',
      },
      {
        kind: 'paragraph',
        text: buildReservationPaymentSentence(values, emptyFallback),
      },
      {
        kind: 'separator',
      },
      {
        kind: 'emphasis',
        text: 'Art. 4. Durata rezervarii',
      },
      {
        kind: 'paragraph',
        text: `Rezervarea este valabila pana la data de ${getHeaderValue(values, 'reservation_expiryDate', emptyFallback)} inclusiv, pana la ora 23:59, perioada in care partile se obliga sa finalizeze actele pentru semnarea promisiunii de vanzare-cumparare (antecontract) sau a contractului de vanzare-cumparare autentic.`,
      },
    ];
  }

  const getFallback = (key: string) => getHeaderEmptyFallback(key, emptyFallback);
  const ownerEntityType = getHeaderValue(values, 'owner_entityType', 'individual') === 'company' ? 'company' : 'individual';
  const blocks: StructuredHeaderBlock[] = [
    {
      kind: 'intro',
      text: 'Prezentul contract (denumit în continuare „Contractul”) se încheie între:',
    },
    ownerEntityType === 'company'
      ? {
          kind: 'namedParagraph' as const,
          boldText: getHeaderValue(values, 'owner_legalCompanyName', getFallback('owner_legalCompanyName')),
          text: `, cu sediul social in ${getHeaderValue(values, 'owner_registeredOffice', getFallback('owner_registeredOffice'))}, CUI ${getHeaderValue(values, 'owner_companyTaxId', getFallback('owner_companyTaxId'))}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'owner_tradeRegisterNumber', getFallback('owner_tradeRegisterNumber'))}, fiind reprezentata legal prin ${getHeaderValue(values, 'owner_legalRepresentative', getFallback('owner_legalRepresentative'))}, denumit in continuare “Beneficiar”,`,
        }
      : {
          kind: 'namedParagraph' as const,
          boldText: getHeaderValue(values, 'owner_name', getFallback('owner_name')),
          text: `, cu domiciliul în ${getHeaderValue(values, 'owner_address', getFallback('owner_address'))}, CNP ${getHeaderValue(values, 'owner_personalNumericCode', getFallback('owner_personalNumericCode'))}, ${buildIdentityClause({ values, prefix: 'owner', emptyFallback })}, denumit în continuare “Beneficiar”,`,
        },
    {
      kind: 'connector',
      text: 'și',
    },
    {
      kind: 'namedParagraph',
      boldText: getHeaderValue(values, 'agency_legalCompanyName', emptyFallback),
      text: `, cu sediul social in ${getHeaderValue(values, 'agency_registeredOffice', emptyFallback)}, CUI ${getHeaderValue(values, 'agency_companyTaxId', emptyFallback)}, inregistrat la registrul Comertului cu nr. ${getHeaderValue(values, 'agency_tradeRegisterNumber', emptyFallback)}, fiind reprezentata legal prin ${getHeaderValue(values, 'agency_legalRepresentative', emptyFallback)}, denumit in continuare “Prestator”.`,
    },
    {
      kind: 'emphasis',
      text: 'Beneficiarul și Prestatorul vor fi denumiți individual „Partea” și împreună „Părțile”.',
    },
    {
      kind: 'paragraph',
      text: `Persoana împuternicită din partea Prestatorului pentru administrarea proprietății în portofoliu este ${getHeaderValue(values, 'agent_name', emptyFallback)}, în calitate de agent, având numărul de telefon ${getHeaderValue(values, 'agent_phone', emptyFallback)}.`,
    },
  ];

  blocks.push({
    kind: 'paragraph',
    text: `Comisionul convenit de Părți, datorat de Beneficiar și plătibil către Prestator în situația în care vânzarea proprietății se realizează prin intermediul agenției sau către un cumpărător identificat și prezentat de aceasta, este de ${getHeaderValue(values, 'property_commissionPercent', getFallback('property_commissionPercent'))}% din prețul de vânzare.`,
  });
  blocks.push({
    kind: 'paragraph',
    text: `Proprietatea care face obiectul prezentului Contract este situată în ${getHeaderValue(values, 'property_address', getFallback('property_address'))}, având nr. cadastral ${getHeaderValue(values, 'property_cadastralNumber', getFallback('property_cadastralNumber'))} și prețul propus la vânzare de ${getHeaderValue(values, 'property_price', getFallback('property_price'))} EUR.`,
  });

  return blocks;
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
        <p><strong>Articolul 1. Partile</strong></p>
        <p>Prezentul Contract de rezervare, denumit in continuare "Contractul", se incheie intre:</p>
        <p>{{reservation.ownerParagraph}}</p>
        <p>{{reservation.ownerSecondParagraph}}</p>
        <p>si</p>
        <p>{{reservation.buyerParagraph}}</p>
        <p>Proprietarul si Cumparatorul vor fi denumiti in mod individual "Partea", iar impreuna "Partile".</p>
        <hr />
        <p><strong>Articolul 2. Obiectul contractului</strong></p>
        <p>Obiectul prezentului Contract il constituie rezervarea imobilului situat in ${createVariableSpan('property.address', 'Proprietate: adresa')}, avand numar cadastral ${createVariableSpan('property.cadastralNumber', 'Proprietate: numar cadastral')}, convenit spre vanzare la pretul de ${createVariableSpan('property.price', 'Proprietate: pret')} EUR.</p>
        <hr />
        <p><strong>Articolul 3. Pretul rezervarii</strong></p>
        <p>La semnarea prezentului contract, CUMPARATORUL plateste catre VANZATOR suma de ${createVariableSpan('reservation.amount', 'Rezervare: suma platita')} ${createVariableSpan('reservation.currency', 'Rezervare: moneda')}, cu titlu de rezervare in contul bancar ${createVariableSpan('owner.bankAccount', 'Proprietar: cont bancar')} deschis pe numele ${createVariableSpan('owner.bankAccountHolder', 'Proprietar: detinator cont bancar')}.</p>
        <hr />
        <p><strong>Art. 4. Durata rezervarii</strong></p>
        <p>Rezervarea este valabila pana la data de ${createVariableSpan('reservation.expiryDate', 'Rezervare: data expirare')} inclusiv, pana la ora 23:59, perioada in care partile se obliga sa finalizeze actele pentru semnarea promisiunii de vanzare-cumparare (antecontract) sau a contractului de vanzare-cumparare autentic.</p>
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
      <p><strong>Comision (%):</strong> ${createVariableSpan('property.commissionPercent', 'Proprietate: comision (%)')}</p>
      <h2>Date proprietate</h2>
      <p>${buildPropertyParagraph()}</p>
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
  const mappedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value == null ? '' : String(value)])
  ) as Record<string, string>;

  const buildReservationPaymentSentenceFromValues = () => {
    const amount = values.reservation_amount == null ? '' : String(values.reservation_amount);
    const currency = values.reservation_currency == null ? 'EURO' : String(values.reservation_currency || 'EURO');
    const bankAccount = values.owner_bankAccount == null ? '' : String(values.owner_bankAccount);
    const bankAccountHolder = values.owner_bankAccountHolder == null ? '' : String(values.owner_bankAccountHolder);
    const ownerName = values.owner_name == null ? '' : String(values.owner_name);
    const normalizedCurrency = currency.trim().toUpperCase();
    const renderedAmount = amount.trim() ? amount : getBodyEmptyFallback('reservation_amount');
    const renderedCurrency = currency.trim() ? currency : 'EURO';
    const renderedBankAccount = bankAccount.trim() ? bankAccount : getBodyEmptyFallback('owner_bankAccount');
    const renderedBankAccountHolder = bankAccountHolder.trim()
      ? bankAccountHolder
      : ownerName.trim()
        ? ownerName
        : getBodyEmptyFallback('owner_bankAccountHolder');
    const currencySuffix = normalizedCurrency === 'RON' ? ' la cursul valutar de astazi' : '';

    return `La semnarea prezentului contract, CUMPARATORUL plateste catre VANZATOR suma de ${renderedAmount} ${renderedCurrency}${currencySuffix}, cu titlu de rezervare in contul bancar ${renderedBankAccount} deschis pe numele ${renderedBankAccountHolder}.`;
  };

  const buildReservationOwnerParagraphFromValues = () =>
    String(values.owner_entityType || 'individual') === 'company'
      ? buildFilledReservationOwnerCompanyParagraph(mappedValues, '')
      : buildFilledReservationOwnerParagraph(mappedValues, '');

  const buildReservationBuyerParagraphFromValues = () =>
    String(values.buyer_entityType || 'individual') === 'company'
      ? buildFilledReservationBuyerCompanyParagraph(mappedValues, '')
      : buildFilledReservationBuyerParagraph(mappedValues, '');

  const buildReservationSecondOwnerParagraphFromValues = () =>
    String(values.owner2_name || values.owner2_legalCompanyName || '').trim()
      ? buildFilledReservationSecondOwnerParagraph(mappedValues, '')
      : '';

  const withVisualVariablesResolved = content.replace(
    /<span[^>]*data-contract-variable-key="([^"]+)"[^>]*>(.*?)<\/span>/gi,
    (_, rawKey: string) => {
      const normalizedKey = rawKey.replace(/\./g, '_');
      const value = values[normalizedKey];
      if (value == null || String(value).trim() === '') {
        return getBodyEmptyFallback(normalizedKey);
      }
      return String(value);
    }
  );

  return withVisualVariablesResolved.replace(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}/g, (_, rawKey: string) => {
    if (rawKey === 'reservation.paymentSentence') {
      return buildReservationPaymentSentenceFromValues();
    }
    if (rawKey === 'reservation.ownerParagraph') {
      return buildReservationOwnerParagraphFromValues();
    }
    if (rawKey === 'reservation.buyerParagraph') {
      return buildReservationBuyerParagraphFromValues();
    }
    if (rawKey === 'reservation.ownerSecondParagraph') {
      return buildReservationSecondOwnerParagraphFromValues();
    }

    const normalizedKey = rawKey.replace(/\./g, '_');
    const value = values[normalizedKey];
    if (value == null || String(value).trim() === '') {
      return getBodyEmptyFallback(normalizedKey);
    }
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

export function decodeContractEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function normalizeContractText(value: string) {
  return decodeContractEntities(value).replace(/\s+/g, ' ').trim();
}

export function extractContractParagraphsFromHtml(value: string) {
  return stripHtmlTags(
    value
      .replace(/<\/h1>/gi, '</h1>\n')
      .replace(/<\/h2>/gi, '</h2>\n')
      .replace(/<hr[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
  )
    .split(/\r?\n/)
    .map((chunk) => normalizeContractText(chunk))
    .filter(Boolean);
}
