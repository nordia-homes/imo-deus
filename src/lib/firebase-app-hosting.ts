import { GoogleAuth } from 'google-auth-library';
import { adminDb, adminAuth } from '@/firebase/admin';
import { normalizeDomain, getCanonicalCustomDomain, getDomainAliases } from '@/lib/domain-routing';
import type { CustomDomainApiResult, CustomDomainInstructionRow } from '@/lib/types';

const APP_HOSTING_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const APP_HOSTING_API_BASE = 'https://firebaseapphosting.googleapis.com/v1';

export type DomainAction = 'ADD' | 'REMOVE' | 'UNSPECIFIED';

export type AppHostingDnsRecord = {
  domainName: string;
  type: string;
  rdata: string;
  requiredAction: DomainAction;
};

export type AppHostingDnsRecordSet = {
  domainName?: string;
  records?: AppHostingDnsRecord[];
};

export type AppHostingDnsUpdate = {
  checkTime?: string;
  domainName?: string;
  desired: AppHostingDnsRecordSet[];
  discovered: AppHostingDnsRecordSet[];
};

export type AppHostingDomainStatus = {
  hostState?: string;
  ownershipState?: string;
  certState?: string;
  requiredDnsUpdates: AppHostingDnsUpdate[];
  issues: { code?: number; message?: string }[];
};

export type AppHostingDomain = {
  name: string;
  domainName: string;
  serve?: unknown;
  customDomainStatus?: AppHostingDomainStatus;
  createTime?: string;
  updateTime?: string;
};

type DecodedTokenContext = {
  uid: string;
  agencyId: string;
  role: 'admin' | 'agent' | undefined;
};

type AppHostingOperation = {
  name: string;
  done?: boolean;
  error?: {
    code?: number;
    message?: string;
  };
  response?: unknown;
};

class AppHostingApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppHostingApiError';
    this.status = status;
    this.details = details;
  }
}

function getAppHostingProjectId() {
  return process.env.FIREBASE_APP_HOSTING_PROJECT_ID
    || process.env.FIREBASE_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || '';
}

function getAppHostingLocation() {
  return process.env.FIREBASE_APP_HOSTING_LOCATION || 'us-central1';
}

function getAppHostingBackendId() {
  return process.env.FIREBASE_APP_HOSTING_BACKEND_ID || 'studio';
}

function getServiceAccountCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variabilele de mediu Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) nu sunt setate corect în fișierul .env.'
    );
  }

  return {
    projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function getBackendResourceName() {
  const projectId = getAppHostingProjectId();
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID sau FIREBASE_APP_HOSTING_PROJECT_ID trebuie setat pentru integrarea App Hosting.');
  }

  return `projects/${projectId}/locations/${getAppHostingLocation()}/backends/${getAppHostingBackendId()}`;
}

function getDomainResourceName(domain: string) {
  return `${getBackendResourceName()}/domains/${normalizeDomain(domain)}`;
}

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: getServiceAccountCredentials(),
    projectId: getAppHostingProjectId() || getServiceAccountCredentials().projectId,
    scopes: [APP_HOSTING_SCOPE],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  if (!token) {
    throw new Error('Nu am putut obtine tokenul OAuth pentru Firebase App Hosting API.');
  }

  return token;
}

async function appHostingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${APP_HOSTING_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new AppHostingApiError(
      `Firebase App Hosting API a raspuns cu ${response.status}.`,
      response.status,
      payload
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requireAgencyAdminFromBearerToken(authorizationHeader: string | null | undefined): Promise<DecodedTokenContext> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new AppHostingApiError('Lipseste tokenul de autentificare.', 401);
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const decoded = await adminAuth.verifyIdToken(token);
  const userSnapshot = await adminDb.collection('users').doc(decoded.uid).get();
  const userData = userSnapshot.data() as { agencyId?: string; role?: 'admin' | 'agent' } | undefined;

  if (!userData?.agencyId) {
    throw new AppHostingApiError('Utilizatorul nu este asociat unei agentii.', 403);
  }

  if (userData.role !== 'admin') {
    throw new AppHostingApiError('Doar administratorii agentiei pot configura domeniul custom.', 403);
  }

  return {
    uid: decoded.uid,
    agencyId: userData.agencyId,
    role: userData.role,
  };
}

async function getDomainIfExists(domain: string): Promise<AppHostingDomain | null> {
  try {
    return await appHostingRequest<AppHostingDomain>(`/${getDomainResourceName(domain)}`);
  } catch (error) {
    if (error instanceof AppHostingApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createDomainLink(domain: string) {
  const normalized = normalizeDomain(domain);
  return appHostingRequest<AppHostingOperation>(
    `/${getBackendResourceName()}/domains?domainId=${encodeURIComponent(normalized)}`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

async function waitForOperation(operationName?: string) {
  if (!operationName) return true;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const operation = await appHostingRequest<AppHostingOperation>(`/${operationName}`);
    if (operation.done) {
      if (operation.error?.message) {
        throw new AppHostingApiError(operation.error.message, operation.error.code || 500, operation);
      }
      return true;
    }
    await sleep(1500);
  }

  return false;
}

async function ensureDomainExists(domain: string) {
  const normalized = normalizeDomain(domain);
  const existing = await getDomainIfExists(normalized);
  if (existing) {
    return existing;
  }

  try {
    const operation = await createDomainLink(normalized);
    const completed = await waitForOperation(operation.name);

    if (!completed) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const current = await getDomainIfExists(normalized);
        if (current) {
          return current;
        }
        await sleep(2000);
      }

      throw new Error('Firebase a primit cererea pentru domeniu, dar inca il pregateste. Apasa "Verifica din nou" peste 30-60 de secunde.');
    }
  } catch (error) {
    if (!(error instanceof AppHostingApiError) || error.status !== 409) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await getDomainIfExists(normalized);
    if (current) {
      return current;
    }
    await sleep(1200);
  }

  throw new Error(`Domeniul ${normalized} nu a putut fi recuperat din Firebase App Hosting dupa creare.`);
}

async function deleteDomainLinkIfExists(domain: string) {
  const normalized = normalizeDomain(domain);
  const existing = await getDomainIfExists(normalized);
  if (!existing?.name) {
    return;
  }

  try {
    await appHostingRequest(`/${existing.name}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof AppHostingApiError && error.status === 404) {
      return;
    }
    throw error;
  }
}

function flattenDnsUpdates(updates: AppHostingDnsUpdate[] | undefined): CustomDomainInstructionRow[] {
  const rows = new Map<string, CustomDomainInstructionRow>();

  (updates || []).forEach((update) => {
    (update.desired || []).forEach((recordSet) => {
      (recordSet.records || []).forEach((record) => {
        const host = record.domainName || recordSet.domainName || update.domainName || '';
        const value = record.rdata || '';
        const key = `${record.requiredAction}|${record.type}|${host}|${value}`;
        rows.set(key, {
          action: record.requiredAction || 'ADD',
          type: record.type,
          host,
          value,
        });
      });
    });

    (update.discovered || []).forEach((recordSet) => {
      (recordSet.records || []).forEach((record) => {
        if ((record.requiredAction || 'UNSPECIFIED') === 'UNSPECIFIED') return;
        const host = record.domainName || recordSet.domainName || update.domainName || '';
        const value = record.rdata || '';
        const key = `${record.requiredAction}|${record.type}|${host}|${value}`;
        rows.set(key, {
          action: record.requiredAction,
          type: record.type,
          host,
          value,
        });
      });
    });
  });

  return Array.from(rows.values());
}

function extractDomainName(domain: AppHostingDomain) {
  return domain.domainName || domain.name.split('/').pop() || '';
}

function computeOverallStatus(domains: AppHostingDomain[]): 'pending' | 'connected' | 'error' {
  if (!domains.length) return 'pending';

  const hasIssues = domains.some((domain) => (domain.customDomainStatus?.issues || []).length > 0);
  if (hasIssues) return 'error';

  const allConnected = domains.every((domain) => {
    const status = domain.customDomainStatus;
    return (
      status?.hostState === 'HOST_ACTIVE' &&
      status?.ownershipState === 'OWNERSHIP_ACTIVE' &&
      status?.certState === 'CERT_ACTIVE' &&
      (status.requiredDnsUpdates || []).length === 0
    );
  });

  return allConnected ? 'connected' : 'pending';
}

function buildResult(agencyId: string, primaryDomain: string, domains: AppHostingDomain[]): CustomDomainApiResult {
  return {
    agencyId,
    primaryDomain,
    aliases: domains.map((domain) => extractDomainName(domain)).filter(Boolean),
    overallStatus: computeOverallStatus(domains),
    domains: domains.map((domain) => ({
      domainName: extractDomainName(domain),
      resourceName: domain.name,
      hostState: domain.customDomainStatus?.hostState,
      ownershipState: domain.customDomainStatus?.ownershipState,
      certState: domain.customDomainStatus?.certState,
      issues: (domain.customDomainStatus?.issues || []).map((issue) => issue.message || 'Problema necunoscuta'),
      instructions: flattenDnsUpdates(domain.customDomainStatus?.requiredDnsUpdates),
    })),
  };
}

async function persistAgencyDomainState(params: {
  agencyId: string;
  primaryDomain: string;
  aliases: string[];
  status: 'pending' | 'connected' | 'error';
  resourceNames: string[];
  previousPrimaryDomain?: string;
}) {
  const {
    agencyId,
    primaryDomain,
    aliases,
    status,
    resourceNames,
    previousPrimaryDomain,
  } = params;

  const agencyRef = adminDb.collection('agencies').doc(agencyId);

  await agencyRef.set({
    customDomain: primaryDomain,
    customDomainAliases: aliases,
    customDomainStatus: status,
    customDomainResourceNames: resourceNames,
    customDomainLastCheckedAt: new Date().toISOString(),
  }, { merge: true });

  const batch = adminDb.batch();
  const previousAliases = previousPrimaryDomain ? getDomainAliases(previousPrimaryDomain) : [];

  previousAliases
    .filter((alias) => !aliases.includes(alias))
    .forEach((alias) => {
      batch.delete(adminDb.collection('publicDomains').doc(alias));
    });

  aliases.forEach((alias) => {
    batch.set(
      adminDb.collection('publicDomains').doc(alias),
      {
        agencyId,
        hostname: alias,
        canonicalHostname: primaryDomain,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

export async function setupAgencyCustomDomain(agencyId: string, requestedDomain: string): Promise<CustomDomainApiResult> {
  const primaryDomain = getCanonicalCustomDomain(requestedDomain);
  if (!primaryDomain) {
    throw new AppHostingApiError('Introdu un domeniu valid.', 400);
  }

  const agencyRef = adminDb.collection('agencies').doc(agencyId);
  const agencySnapshot = await agencyRef.get();
  if (!agencySnapshot.exists) {
    throw new AppHostingApiError('Agentia nu a fost gasita.', 404);
  }

  const agencyData = agencySnapshot.data() as { customDomain?: string } | undefined;
  const previousPrimaryDomain = getCanonicalCustomDomain(agencyData?.customDomain);

  const aliases = getDomainAliases(primaryDomain);
  const domains = await Promise.all(aliases.map((alias) => ensureDomainExists(alias)));

  if (previousPrimaryDomain && previousPrimaryDomain !== primaryDomain) {
    const previousAliases = getDomainAliases(previousPrimaryDomain);
    for (const alias of previousAliases) {
      if (!aliases.includes(alias)) {
        await deleteDomainLinkIfExists(alias);
      }
    }
  }

  const result = buildResult(agencyId, primaryDomain, domains);

  await persistAgencyDomainState({
    agencyId,
    primaryDomain,
    aliases,
    status: result.overallStatus,
    resourceNames: domains.map((domain) => domain.name),
    previousPrimaryDomain,
  });

  return result;
}

export async function refreshAgencyCustomDomainStatus(agencyId: string, requestedDomain: string): Promise<CustomDomainApiResult> {
  const primaryDomain = getCanonicalCustomDomain(requestedDomain);
  if (!primaryDomain) {
    throw new AppHostingApiError('Introdu un domeniu valid.', 400);
  }

  const aliases = getDomainAliases(primaryDomain);
  const domains = await Promise.all(
    aliases.map(async (alias) => {
      const existing = await getDomainIfExists(alias);
      if (!existing) {
        throw new AppHostingApiError(`Domeniul ${alias} nu este inca legat in Firebase App Hosting.`, 404);
      }
      return existing;
    })
  );

  const result = buildResult(agencyId, primaryDomain, domains);

  await persistAgencyDomainState({
    agencyId,
    primaryDomain,
    aliases,
    status: result.overallStatus,
    resourceNames: domains.map((domain) => domain.name),
  });

  return result;
}

export function formatAppHostingError(error: unknown) {
  if (error instanceof AppHostingApiError) {
    const fallback = error.message;
    const apiMessage =
      typeof error.details === 'object' &&
      error.details !== null &&
      'error' in (error.details as Record<string, unknown>) &&
      typeof (error.details as { error?: { message?: string } }).error?.message === 'string'
        ? (error.details as { error: { message: string } }).error.message
        : null;

    return {
      status: error.status,
      message: apiMessage || fallback,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: 'A aparut o eroare neasteptata.',
  };
}
