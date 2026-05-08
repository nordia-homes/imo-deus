import type { BillingPlanId } from '@/lib/billing/plans';

const SMARTBILL_API_BASE = 'https://ws.smartbill.ro/SBORO/api';

type SmartBillConfig = {
  username: string;
  token: string;
  companyVatCode: string;
  seriesName: string;
  useProforma: boolean;
  defaultVatPercent: number;
};

type SmartBillClient = {
  name: string;
  vatCode?: string;
  email?: string;
  address?: string;
  isTaxPayer?: boolean;
};

type SmartBillInvoiceProduct = {
  name: string;
  code?: string;
  quantity: number;
  price: number;
  measuringUnitName?: string;
  currency?: string;
  taxPercentage: number;
  taxName: string;
  isTaxIncluded: boolean;
};

export type SmartBillInvoiceRequest = {
  companyVatCode: string;
  client: SmartBillClient;
  issueDate: string;
  dueDate: string;
  seriesName: string;
  isDraft: boolean;
  currency: string;
  products: SmartBillInvoiceProduct[];
  paymentMethod?: string;
  observations?: string;
};

export function getSmartBillConfig(): SmartBillConfig {
  return {
    username: process.env.SMARTBILL_USERNAME || '',
    token: process.env.SMARTBILL_TOKEN || '',
    companyVatCode: process.env.SMARTBILL_CIF || '',
    seriesName: process.env.SMARTBILL_SERIES || '',
    useProforma: String(process.env.SMARTBILL_USE_PROFORMA || 'false').toLowerCase() === 'true',
    defaultVatPercent: Number(process.env.SMARTBILL_DEFAULT_VAT_PERCENT || 19),
  };
}

export function isSmartBillConfigured() {
  const config = getSmartBillConfig();
  return Boolean(config.username && config.token && config.companyVatCode && config.seriesName);
}

export async function issueSmartBillInvoice(request: SmartBillInvoiceRequest) {
  const config = getSmartBillConfig();
  if (!isSmartBillConfigured()) {
    throw new Error('SmartBill nu este configurat complet.');
  }

  const authorization = Buffer.from(`${config.username}:${config.token}`).toString('base64');
  const response = await fetch(`${SMARTBILL_API_BASE}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.errorText === 'string'
        ? payload.errorText
        : typeof payload?.message === 'string'
          ? payload.message
          : 'SmartBill a raspuns cu o eroare la emiterea facturii.';
    throw new Error(message);
  }

  return payload as {
    number?: string;
    series?: string;
    url?: string;
  };
}

export function buildSmartBillSubscriptionInvoice(params: {
  agency: {
    id: string;
    name?: string;
    legalCompanyName?: string;
    companyTaxId?: string;
    address?: string;
    billingEmail?: string;
    billingCompanyName?: string;
    billingTaxId?: string;
    billingAddress?: string;
  };
  planId: BillingPlanId;
  planName: string;
  seats: number;
  totalAmountEur: number;
  issueDate: string;
  dueDate?: string;
}) {
  const config = getSmartBillConfig();
  const taxPercentage = Number.isFinite(config.defaultVatPercent) ? config.defaultVatPercent : 19;
  const taxName = taxPercentage === 19 ? 'Veche' : 'Normala';
  const clientName =
    params.agency.billingCompanyName ||
    params.agency.legalCompanyName ||
    params.agency.name ||
    `Agentie ${params.agency.id}`;

  return {
    companyVatCode: config.companyVatCode,
    client: {
      name: clientName,
      vatCode: params.agency.billingTaxId || params.agency.companyTaxId || '',
      email: params.agency.billingEmail || '',
      address: params.agency.billingAddress || params.agency.address || '',
      isTaxPayer: Boolean(params.agency.billingTaxId || params.agency.companyTaxId),
    },
    issueDate: params.issueDate,
    dueDate: params.dueDate || params.issueDate,
    seriesName: config.seriesName,
    isDraft: config.useProforma,
    currency: 'EUR',
    paymentMethod: 'Card',
    observations: `Abonament ${params.planName} • ${params.seats} utilizatori`,
    products: [
      {
        name: `Abonament ImoDeus ${params.planName}`,
        code: `subscription-${params.planId}`,
        quantity: 1,
        price: roundAmount(params.totalAmountEur),
        measuringUnitName: 'buc',
        currency: 'EUR',
        taxPercentage,
        taxName,
        isTaxIncluded: false,
      },
    ],
  } satisfies SmartBillInvoiceRequest;
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
