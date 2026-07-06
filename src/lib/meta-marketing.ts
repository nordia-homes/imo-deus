import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import type {
  Agency,
  MetaMarketingCampaignDraft,
  MetaMarketingIntegrationPrivate,
  MetaMarketingIntegrationPublicStatus,
  Property,
} from '@/lib/types';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';

const META_PROVIDER = 'meta';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';
const OAUTH_STATE_COLLECTION = 'metaOauthStates';
const GRAPH_API_BASE_URL = 'https://graph.facebook.com/v23.0';
const META_DIALOG_URL = 'https://www.facebook.com/v23.0/dialog/oauth';
const REQUIRED_SCOPES = [
  'public_profile',
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
];

type MetaApiError = Error & {
  status?: number;
  payload?: unknown;
};

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type MetaGraphList<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
};

type MetaBusiness = {
  id: string;
  name?: string;
};

type MetaAdAccount = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
};

type MetaPage = {
  id: string;
  name?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
    name?: string;
  };
};

type MetaUser = {
  id: string;
  name?: string;
};

type AssetSelection = {
  businessId: string;
  adAccountId: string;
  pageId: string;
  instagramAccountId?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function getPrivateDocId(agencyId: string) {
  return `${agencyId}__${META_PROVIDER}`;
}

function getPrivateDocRef(agencyId: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(getPrivateDocId(agencyId));
}

function getPublicDocRef(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(META_PROVIDER);
}

function getOauthStateRef(state: string) {
  return adminDb.collection(OAUTH_STATE_COLLECTION).doc(state);
}

function getCampaignDraftRef(agencyId: string, campaignId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('metaCampaignDrafts').doc(campaignId);
}

function getCampaignDraftsCollection(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('metaCampaignDrafts');
}

function getMetaAppId() {
  return (process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '').trim();
}

function getMetaAppSecret() {
  return (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim();
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://imodeus.ro'
  ).replace(/\/+$/, '');
}

function getRedirectUri() {
  return `${getAppBaseUrl()}/auth/meta/callback`;
}

function getLoginConfigurationId() {
  return (process.env.META_LOGIN_CONFIG_ID || '').trim();
}

function requireMetaConfig() {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) {
    throw new Error('Configureaza META_APP_ID si META_APP_SECRET in environment variables.');
  }
  return { appId, appSecret };
}

function getTokenEncryptionKey() {
  const configured = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY || '';
  const source = configured || getMetaAppSecret();
  if (!source) {
    throw new Error('Configureaza META_TOKEN_ENCRYPTION_KEY pentru stocarea securizata a token-urilor Meta.');
  }
  return createHash('sha256').update(source).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Tokenul Meta salvat are un format invalid.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getTokenEncryptionKey(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractMetaError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: string; error_user_msg?: string } }).error;
    return error?.error_user_msg || error?.message || fallback;
  }
  return fallback;
}

async function metaRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${GRAPH_API_BASE_URL}${path}${separator}access_token=${encodeURIComponent(accessToken)}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(extractMetaError(payload, `Meta API a raspuns cu ${response.status}.`)) as MetaApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function requestShortLivedToken(code: string) {
  const { appId, appSecret } = requireMetaConfig();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: getRedirectUri(),
    code,
  });
  const response = await fetch(`${GRAPH_API_BASE_URL}/oauth/access_token?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(extractMetaError(payload, 'Nu am putut obtine tokenul OAuth Meta.'));
  }
  return payload as MetaTokenResponse;
}

async function exchangeForLongLivedToken(shortToken: string) {
  const { appId, appSecret } = requireMetaConfig();
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  const response = await fetch(`${GRAPH_API_BASE_URL}/oauth/access_token?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(extractMetaError(payload, 'Nu am putut extinde tokenul Meta.'));
  }
  return payload as MetaTokenResponse;
}

async function getPrivateIntegration(agencyId: string) {
  const snapshot = await getPrivateDocRef(agencyId).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as MetaMarketingIntegrationPrivate;
}

async function getAccessTokenForAgency(agencyId: string) {
  const integration = await getPrivateIntegration(agencyId);
  if (!integration?.encryptedAccessToken) {
    throw new Error('Conecteaza mai intai contul Meta al agentiei.');
  }
  return {
    integration,
    accessToken: decryptToken(integration.encryptedAccessToken),
  };
}

async function setPublicStatus(agencyId: string, patch: Partial<MetaMarketingIntegrationPublicStatus>) {
  await getPublicDocRef(agencyId).set(
    {
      provider: META_PROVIDER,
      connected: false,
      updatedAt: nowIso(),
      ...patch,
    },
    { merge: true }
  );
}

async function upsertPrivateIntegration(agencyId: string, payload: MetaMarketingIntegrationPrivate) {
  await getPrivateDocRef(agencyId).set(payload, { merge: true });
}

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
}

function toPublicIntegration(privateIntegration: MetaMarketingIntegrationPrivate): MetaMarketingIntegrationPublicStatus {
  const {
    encryptedAccessToken,
    tokenEncryptionVersion,
    agencyId,
    ...publicFields
  } = privateIntegration;
  void encryptedAccessToken;
  void tokenEncryptionVersion;
  void agencyId;
  return publicFields;
}

async function fetchAllPages<T>(path: string, accessToken: string): Promise<T[]> {
  let nextPath: string | null = path;
  const all: T[] = [];

  while (nextPath) {
    const payload: MetaGraphList<T> = nextPath.startsWith('http')
      ? await fetch(nextPath, { cache: 'no-store' }).then(async (response) => {
          const json = await safeJson(response);
          if (!response.ok) {
            throw new Error(extractMetaError(json, 'Meta API a refuzat paginarea.'));
          }
          return json as MetaGraphList<T>;
        })
      : await metaRequest<MetaGraphList<T>>(nextPath, accessToken);
    all.push(...(payload.data || []));
    nextPath = payload.paging?.next || null;
  }

  return all;
}

export async function createMetaAuthorization(params: { agencyId: string; requestedByUid: string }) {
  const { appId } = requireMetaConfig();
  const state = randomBytes(24).toString('hex');
  await getOauthStateRef(state).set({
    state,
    agencyId: params.agencyId,
    requestedByUid: params.requestedByUid,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  const url = new URL(META_DIALOG_URL);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', REQUIRED_SCOPES.join(','));
  url.searchParams.set('auth_type', 'rerequest');
  const configId = getLoginConfigurationId();
  if (configId) {
    url.searchParams.set('config_id', configId);
  }

  return {
    state,
    authorizationUrl: url.toString(),
  };
}

export async function finalizeMetaAuthorization(params: { code: string; state: string }) {
  const stateSnapshot = await getOauthStateRef(params.state).get();
  if (!stateSnapshot.exists) {
    throw new Error('State-ul de autorizare Meta nu mai este valid. Reincearca din pagina Marketing.');
  }

  const stateData = stateSnapshot.data() as {
    agencyId: string;
    requestedByUid?: string | null;
    expiresAt?: string | null;
  };

  if (stateData.expiresAt && new Date(stateData.expiresAt).getTime() < Date.now()) {
    await getOauthStateRef(params.state).delete().catch(() => undefined);
    throw new Error('Autorizarea Meta a expirat. Reincearca din pagina Marketing.');
  }

  const shortToken = await requestShortLivedToken(params.code);
  const longToken = await exchangeForLongLivedToken(shortToken.access_token).catch(() => shortToken);
  const accessToken = longToken.access_token || shortToken.access_token;
  const expiresIn = longToken.expires_in || shortToken.expires_in || null;
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const me = await metaRequest<MetaUser>('/me?fields=id,name', accessToken);
  const debug = await metaRequest<{
    data?: {
      scopes?: string[];
      granular_scopes?: Array<{ scope?: string }>;
    };
  }>(`/debug_token?input_token=${encodeURIComponent(accessToken)}&fields=scopes,granular_scopes`, `${getMetaAppId()}|${getMetaAppSecret()}`);
  const scopes = debug.data?.scopes?.length
    ? debug.data.scopes
    : (debug.data?.granular_scopes || []).map((item) => item.scope).filter((item): item is string => Boolean(item));

  const privatePayload: MetaMarketingIntegrationPrivate = {
    provider: META_PROVIDER,
    agencyId: stateData.agencyId,
    connected: true,
    connectedAt: nowIso(),
    updatedAt: nowIso(),
    encryptedAccessToken: encryptToken(accessToken),
    accessTokenExpiresAt: expiresAt,
    tokenEncryptionVersion: 1,
    lastError: null,
    lastAuthorizedByUid: stateData.requestedByUid || null,
    metaUserId: me.id,
    metaUserName: me.name || null,
    scopes,
    selectedBusiness: null,
    selectedAdAccount: null,
    selectedPage: null,
    selectedInstagramAccount: null,
    accessTier: 'development',
  };

  await upsertPrivateIntegration(stateData.agencyId, privatePayload);
  await setPublicStatus(stateData.agencyId, toPublicIntegration(privatePayload));
  await getOauthStateRef(params.state).delete().catch(() => undefined);

  return {
    connected: true,
    agencyId: stateData.agencyId,
  };
}

export async function disconnectMetaMarketing(agencyId: string) {
  await getPrivateDocRef(agencyId).delete().catch(() => undefined);
  await setPublicStatus(agencyId, {
    connected: false,
    connectedAt: null,
    lastError: null,
    selectedBusiness: null,
    selectedAdAccount: null,
    selectedPage: null,
    selectedInstagramAccount: null,
  });
  return { connected: false };
}

export async function getMetaMarketingStatus(agencyId: string) {
  const publicSnapshot = await getPublicDocRef(agencyId).get();
  const publicStatus = publicSnapshot.exists
    ? publicSnapshot.data() as MetaMarketingIntegrationPublicStatus
    : null;

  return {
    provider: META_PROVIDER,
    connected: Boolean(publicStatus?.connected),
    ...(publicStatus || {}),
  } satisfies MetaMarketingIntegrationPublicStatus;
}

export async function listMetaMarketingAssets(agencyId: string) {
  const { accessToken, integration } = await getAccessTokenForAgency(agencyId);
  const businesses = await fetchAllPages<MetaBusiness>(
    '/me/businesses?fields=id,name&limit=100',
    accessToken
  );
  const adAccounts = await fetchAllPages<MetaAdAccount>(
    '/me/adaccounts?fields=id,account_id,name,currency,timezone_name&limit=100',
    accessToken
  );
  const pages = await fetchAllPages<MetaPage>(
    '/me/accounts?fields=id,name,instagram_business_account{id,username,name}&limit=100',
    accessToken
  );

  return {
    businesses: businesses.map((business) => ({ id: business.id, name: business.name || business.id })),
    adAccounts: adAccounts.map((account) => ({
      id: account.id,
      accountId: account.account_id || account.id.replace(/^act_/, ''),
      name: account.name || account.id,
      currency: account.currency || null,
      timezoneName: account.timezone_name || null,
    })),
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name || page.id,
      instagramBusinessAccount: page.instagram_business_account?.id
        ? {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username || null,
            name: page.instagram_business_account.name || null,
          }
        : null,
    })),
    selected: {
      business: integration.selectedBusiness || null,
      adAccount: integration.selectedAdAccount || null,
      page: integration.selectedPage || null,
      instagramAccount: integration.selectedInstagramAccount || null,
    },
  };
}

export async function selectMetaMarketingAssets(agencyId: string, selection: AssetSelection) {
  const assets = await listMetaMarketingAssets(agencyId);
  const business = assets.businesses.find((item) => item.id === selection.businessId);
  const adAccount = assets.adAccounts.find((item) => item.id === selection.adAccountId);
  const page = assets.pages.find((item) => item.id === selection.pageId);

  if (!business || !adAccount || !page) {
    throw new Error('Selectia Meta nu este valida pentru contul conectat.');
  }

  const instagramAccount = page.instagramBusinessAccount && (!selection.instagramAccountId || page.instagramBusinessAccount.id === selection.instagramAccountId)
    ? page.instagramBusinessAccount
    : null;

  const patch = {
    selectedBusiness: { id: business.id, name: business.name },
    selectedAdAccount: {
      id: adAccount.id,
      accountId: adAccount.accountId,
      name: adAccount.name,
      currency: adAccount.currency,
      timezoneName: adAccount.timezoneName,
    },
    selectedPage: { id: page.id, name: page.name },
    selectedInstagramAccount: instagramAccount,
    updatedAt: nowIso(),
    lastError: null,
  };

  await getPrivateDocRef(agencyId).set(patch, { merge: true });
  await setPublicStatus(agencyId, {
    connected: true,
    ...patch,
  });

  return patch;
}

export async function getMetaDashboardSummary(agencyId: string) {
  const [status, campaignsSnapshot] = await Promise.all([
    getMetaMarketingStatus(agencyId),
    getCampaignDraftsCollection(agencyId).orderBy('updatedAt', 'desc').limit(50).get(),
  ]);

  const campaigns = campaignsSnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>),
  })) as MetaMarketingCampaignDraft[];

  const totals = campaigns.reduce(
    (acc, campaign) => {
      const insights = campaign.insights;
      acc.spend += insights?.spend || 0;
      acc.impressions += insights?.impressions || 0;
      acc.clicks += insights?.clicks || 0;
      acc.leads += insights?.leads || 0;
      if (campaign.status === 'published') acc.activeCampaigns += 1;
      if (campaign.status === 'draft' || campaign.status === 'ready') acc.draftCampaigns += 1;
      if (campaign.status === 'error') acc.errors += 1;
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      activeCampaigns: 0,
      draftCampaigns: 0,
      errors: 0,
    }
  );

  return {
    status,
    campaigns,
    totals: {
      ...totals,
      costPerLead: totals.leads > 0 ? totals.spend / totals.leads : null,
    },
  };
}

function buildDefaultCampaignContent(property: Property) {
  const location = [property.city, property.zone].filter(Boolean).join(', ') || property.location || property.address;
  const targetingLocation = property.city || property.location?.split(',')[0]?.trim() || property.address;
  const price = Number.isFinite(property.price) ? `${new Intl.NumberFormat('ro-RO').format(property.price)} EUR` : 'pret disponibil la cerere';
  const headline = property.title || `${property.propertyType || 'Proprietate'} in ${location}`;
  const defaultText = [
    property.title,
    `${price}. ${property.squareFootage || property.totalSurface || ''} mp${property.nearMetro ? ', aproape de metrou' : ''}.`,
    'Vezi fotografii, detalii si programeaza o discutie cu agentul ImoDeus.',
  ].filter(Boolean).join(' ');
  const primaryText = (property.description || defaultText).replace(/\r\n/g, '\n').trim();

  return {
    headline,
    primaryText,
    locationLabel: targetingLocation,
  };
}

async function buildPropertyDestinationUrl(agencyId: string, propertyId: string) {
  const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();
  const agency = agencySnapshot.exists
    ? ({ id: agencySnapshot.id, ...(agencySnapshot.data() as Omit<Agency, 'id'>) } as Agency)
    : ({ id: agencyId } as Agency);
  const publicUrl = buildAgencyPublicUrl(agency, `/properties/${propertyId}`);
  return publicUrl.startsWith('http') ? publicUrl : `${getAppBaseUrl()}${publicUrl}`;
}

export async function createMetaCampaignDraft(params: {
  agencyId: string;
  propertyId: string;
  requestedByUid: string;
  objective?: MetaMarketingCampaignDraft['objective'];
  budgetAmount?: number;
  budgetType?: MetaMarketingCampaignDraft['budgetType'];
  durationDays?: number;
}) {
  const propertySnapshot = await adminDb
    .collection('agencies')
    .doc(params.agencyId)
    .collection('properties')
    .doc(params.propertyId)
    .get();

  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...(propertySnapshot.data() as Omit<Property, 'id'>) } as Property;
  const integration = await getMetaMarketingStatus(params.agencyId);
  if (!integration.connected || !integration.selectedAdAccount || !integration.selectedPage) {
    throw new Error('Conecteaza Meta si selecteaza Business, Ad Account si Page inainte sa pregatesti campania.');
  }

  const [content, destinationUrl] = await Promise.all([
    Promise.resolve(buildDefaultCampaignContent(property)),
    buildPropertyDestinationUrl(params.agencyId, params.propertyId),
  ]);
  const coverImage = property.images?.find((image) => image?.url) || null;
  const propertyMediaItems = (property.images || [])
    .filter((image) => image?.url)
    .slice(0, 10)
    .map((image) => ({
      url: image.url,
      type: 'image' as const,
      alt: image.alt || property.title || null,
      name: null,
      source: 'property' as const,
    }));
  const now = nowIso();
  const draftRef = getCampaignDraftsCollection(params.agencyId).doc();
  const draft: MetaMarketingCampaignDraft = {
    id: draftRef.id,
    agencyId: params.agencyId,
    propertyId: params.propertyId,
    createdAt: now,
    updatedAt: now,
    createdByUid: params.requestedByUid,
    status: 'draft',
    objective: params.objective || 'leads',
    budgetType: params.budgetType || 'daily',
    budgetAmount: params.budgetAmount || 50,
    currency: (integration.selectedAdAccount.currency as MetaMarketingCampaignDraft['currency']) || 'RON',
    durationDays: params.durationDays || 7,
    locationLabel: content.locationLabel,
    headline: content.headline,
    primaryText: content.primaryText,
    creativeFormat: 'single_image',
    imageUrl: coverImage?.url || null,
    imageAlt: coverImage?.alt || property.title || null,
    mediaItems: propertyMediaItems,
    videoUrl: null,
    videoThumbnailUrl: null,
    destinationUrl,
    callToAction: 'LEARN_MORE',
    specialAdCategory: 'HOUSING',
    metaCampaignId: null,
    metaAdSetId: null,
    metaAdId: null,
    metaCreativeId: null,
    lastPublishError: null,
    insights: null,
  };

  await draftRef.set(draft);
  await propertySnapshot.ref.set(
    {
      metaMarketing: {
        latestCampaignDraftId: draft.id,
        status: 'draft',
        updatedAt: now,
      },
    },
    { merge: true }
  );

  return draft;
}

export async function listPropertyMetaCampaigns(agencyId: string, propertyId: string) {
  const snapshot = await getCampaignDraftsCollection(agencyId)
    .where('propertyId', '==', propertyId)
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();

  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>),
  })) as MetaMarketingCampaignDraft[];
}

type CampaignDraftUpdateInput = Partial<Pick<
  MetaMarketingCampaignDraft,
  | 'objective'
  | 'budgetType'
  | 'budgetAmount'
  | 'durationDays'
  | 'locationLabel'
  | 'headline'
  | 'primaryText'
  | 'creativeFormat'
  | 'callToAction'
  | 'imageUrl'
  | 'imageAlt'
  | 'mediaItems'
  | 'videoUrl'
  | 'videoThumbnailUrl'
  | 'destinationUrl'
>>;

function cleanCampaignDraftUpdate(input: CampaignDraftUpdateInput) {
  const patch: CampaignDraftUpdateInput & {
    updatedAt: string;
    status: MetaMarketingCampaignDraft['status'];
    lastPublishError: null;
  } = {
    updatedAt: nowIso(),
    status: 'draft',
    lastPublishError: null,
  };

  if (['leads', 'messages', 'traffic'].includes(String(input.objective))) {
    patch.objective = input.objective;
  }
  if (['daily', 'lifetime'].includes(String(input.budgetType))) {
    patch.budgetType = input.budgetType;
  }
  if (Number.isFinite(Number(input.budgetAmount))) {
    patch.budgetAmount = Math.max(10, Math.round(Number(input.budgetAmount)));
  }
  if (Number.isFinite(Number(input.durationDays))) {
    patch.durationDays = Math.min(90, Math.max(1, Math.round(Number(input.durationDays))));
  }
  if (typeof input.locationLabel === 'string') {
    patch.locationLabel = input.locationLabel.trim().slice(0, 120);
  }
  if (typeof input.headline === 'string') {
    patch.headline = input.headline.trim();
  }
  if (typeof input.primaryText === 'string') {
    patch.primaryText = input.primaryText.replace(/\r\n/g, '\n').trim();
  }
  if (['single_image', 'carousel', 'video'].includes(String(input.creativeFormat))) {
    patch.creativeFormat = input.creativeFormat;
  }
  if (['LEARN_MORE', 'SEND_MESSAGE', 'CONTACT_US'].includes(String(input.callToAction))) {
    patch.callToAction = input.callToAction;
  }
  if (typeof input.imageUrl === 'string' || input.imageUrl === null) {
    patch.imageUrl = input.imageUrl ? input.imageUrl.trim() : null;
  }
  if (typeof input.imageAlt === 'string' || input.imageAlt === null) {
    patch.imageAlt = input.imageAlt ? input.imageAlt.trim().slice(0, 160) : null;
  }
  if (Array.isArray(input.mediaItems)) {
    patch.mediaItems = input.mediaItems
      .filter((item) => item && typeof item.url === 'string' && ['image', 'video'].includes(String(item.type)))
      .slice(0, 10)
      .map((item) => ({
        url: item.url.trim(),
        type: item.type,
        alt: typeof item.alt === 'string' ? item.alt.trim().slice(0, 160) : null,
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : null,
        source: item.source === 'upload' ? 'upload' : 'property',
      }));
  }
  if (typeof input.videoUrl === 'string' || input.videoUrl === null) {
    patch.videoUrl = input.videoUrl ? input.videoUrl.trim() : null;
  }
  if (typeof input.videoThumbnailUrl === 'string' || input.videoThumbnailUrl === null) {
    patch.videoThumbnailUrl = input.videoThumbnailUrl ? input.videoThumbnailUrl.trim() : null;
  }
  if (typeof input.destinationUrl === 'string') {
    patch.destinationUrl = input.destinationUrl.trim().slice(0, 500);
  }

  return patch;
}

export async function updateMetaCampaignDraft(agencyId: string, campaignId: string, input: CampaignDraftUpdateInput) {
  const ref = getCampaignDraftRef(agencyId, campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }

  const draft = { id: snapshot.id, ...(snapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  if (draft.agencyId !== agencyId) {
    throw new Error('Campania Meta nu apartine acestei agentii.');
  }

  const patch = cleanCampaignDraftUpdate(input);
  await ref.set(patch, { merge: true });
  const updatedSnapshot = await ref.get();
  return {
    id: updatedSnapshot.id,
    ...(updatedSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>),
  } as MetaMarketingCampaignDraft;
}

export async function refreshMetaCampaignInsights(agencyId: string, campaignId: string) {
  const { accessToken, integration } = await getAccessTokenForAgency(agencyId);
  const draftSnapshot = await getCampaignDraftRef(agencyId, campaignId).get();
  if (!draftSnapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }
  const draft = { id: draftSnapshot.id, ...(draftSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  if (!draft.metaCampaignId) {
    return draft;
  }

  const adAccountId = integration.selectedAdAccount?.id;
  if (!adAccountId) {
    throw new Error('Nu exista un Ad Account Meta selectat.');
  }

  const payload = await metaRequest<MetaGraphList<Record<string, string>>>(
    `/${normalizeAdAccountId(adAccountId)}/insights?fields=campaign_id,spend,impressions,reach,clicks,actions&level=campaign&filtering=${encodeURIComponent(JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: draft.metaCampaignId }]))}`,
    accessToken
  );
  const row = payload.data?.[0] || {};
  const rawActions = (row as unknown as { actions?: unknown }).actions;
  const actions = Array.isArray(rawActions)
    ? rawActions as Array<{ action_type?: string; value?: string }>
    : [];
  const leads = actions
    .filter((action) => /lead|onsite_conversion\.lead_grouped/i.test(action.action_type || ''))
    .reduce((sum, action) => sum + Number(action.value || 0), 0);
  const spend = Number(row.spend || 0);
  const insights: NonNullable<MetaMarketingCampaignDraft['insights']> = {
    spend,
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    clicks: Number(row.clicks || 0),
    leads,
    costPerLead: leads > 0 ? spend / leads : null,
    updatedAt: nowIso(),
  };

  await draftSnapshot.ref.set({ insights, updatedAt: nowIso() }, { merge: true });
  return {
    ...draft,
    insights,
  };
}

export async function markMetaCampaignReady(agencyId: string, campaignId: string) {
  const ref = getCampaignDraftRef(agencyId, campaignId);
  await ref.set(
    {
      status: 'ready',
      updatedAt: nowIso(),
      specialAdCategory: 'HOUSING',
      lastPublishError: null,
    },
    { merge: true }
  );
  return { id: campaignId, status: 'ready' };
}

export async function recordMetaApiError(agencyId: string, error: unknown) {
  await setPublicStatus(agencyId, {
    lastError: error instanceof Error ? error.message : 'A aparut o eroare Meta necunoscuta.',
    updatedAt: nowIso(),
  }).catch(() => undefined);
}

export async function deleteExpiredMetaOauthStates() {
  const snapshot = await adminDb
    .collection(OAUTH_STATE_COLLECTION)
    .where('expiresAt', '<', nowIso())
    .limit(50)
    .get();
  if (snapshot.empty) return { deleted: 0 };
  const batch = adminDb.batch();
  snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
  await batch.commit();
  return { deleted: snapshot.size };
}

export async function touchMetaIntegration(agencyId: string) {
  await getPublicDocRef(agencyId).set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function disconnectMetaMarketingByMetaUser(metaUserId: string) {
  if (!metaUserId) return { disconnected: 0 };

  const snapshot = await adminDb
    .collection(PRIVATE_COLLECTION)
    .where('provider', '==', META_PROVIDER)
    .where('metaUserId', '==', metaUserId)
    .limit(20)
    .get();

  let disconnected = 0;
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data() as MetaMarketingIntegrationPrivate;
    if (!data.agencyId) continue;
    await disconnectMetaMarketing(data.agencyId);
    disconnected += 1;
  }

  return { disconnected };
}
