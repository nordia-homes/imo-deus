type InfoCuiPayload = Record<string, unknown>;

export type CompanyLookupResult = {
  companyTaxId: string;
  legalCompanyName: string;
  tradeRegisterNumber: string;
  registeredOffice: string;
  legalRepresentative: string;
  entityStatus: string;
  entityTypeHint: 'agency' | 'pfa' | null;
};

const INFOCUI_API_URL = 'https://www.infocui.ro/system/api/data';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickString(payload: InfoCuiPayload, keys: string[]): string {
  for (const key of keys) {
    const value = asString(payload[key]);
    if (value) return value;
  }

  return '';
}

export function normalizeTaxId(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/^RO/, '')
    .replace(/[^A-Z0-9]/g, '');
}

function buildRegisteredOffice(payload: InfoCuiPayload): string {
  const directAddress = pickString(payload, ['adresa', 'adresa_sediu', 'sediu_social']);
  if (directAddress) {
    return directAddress;
  }

  const locality = pickString(payload, ['loc', 'localitate']);
  const street = pickString(payload, ['str', 'strada']);
  const number = pickString(payload, ['nr', 'numar']);
  const sector = pickString(payload, ['sect', 'sector']);
  const county = pickString(payload, ['judet']);
  const postalCode = pickString(payload, ['cp', 'cod_postal']);

  return [street, number && `nr. ${number}`, locality, sector && `sector ${sector}`, county, postalCode]
    .filter(Boolean)
    .join(', ');
}

function unwrapPayload(payload: unknown): InfoCuiPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const objectPayload = payload as InfoCuiPayload;

  if (objectPayload.data && typeof objectPayload.data === 'object' && !Array.isArray(objectPayload.data)) {
    return objectPayload.data as InfoCuiPayload;
  }

  return objectPayload;
}

function inferEntityType(tradeRegisterNumber: string): 'agency' | 'pfa' | null {
  const normalized = tradeRegisterNumber.trim().toUpperCase();
  if (normalized.startsWith('F')) return 'pfa';
  if (normalized.startsWith('J')) return 'agency';
  return null;
}

export async function lookupCompanyByTaxId(rawTaxId: string): Promise<CompanyLookupResult> {
  const apiKey = process.env.INFOCUI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('INFOCUI_API_KEY lipseste.');
  }

  const normalizedTaxId = normalizeTaxId(rawTaxId);
  if (!normalizedTaxId) {
    throw new Error('Introdu un CUI / CIF valid.');
  }

  const url = new URL(INFOCUI_API_URL);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cui', normalizedTaxId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Nu am putut prelua datele companiei acum.');
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error('Raspuns invalid primit de la serviciul de verificare.');
  }

  const data = unwrapPayload(payload);

  const legalCompanyName = pickString(data, ['nume', 'denumire']);
  const companyTaxId = pickString(data, ['cod_fiscal']) || normalizedTaxId;
  const tradeRegisterNumber = pickString(data, ['cod_inmatriculare', 'nr_reg_com', 'numar_registru_comert']);
  const registeredOffice = buildRegisteredOffice(data);
  const legalRepresentative = pickString(data, ['reprezentant_legal', 'administrator', 'persoana_contact']);
  const entityStatus = pickString(data, ['stare_firma', 'status', 'stare']);

  if (!legalCompanyName) {
    throw new Error('Nu am gasit date pentru acest CUI / CIF.');
  }

  return {
    companyTaxId,
    legalCompanyName,
    tradeRegisterNumber,
    registeredOffice,
    legalRepresentative,
    entityStatus,
    entityTypeHint: inferEntityType(tradeRegisterNumber),
  };
}
