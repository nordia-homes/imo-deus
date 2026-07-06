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

type MetaCreateResponse = {
  id?: string;
  hash?: string;
  images?: Record<string, { hash?: string; url?: string }>;
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

async function metaFormRequest<T>(path: string, accessToken: string, params: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    body.set(key, String(value));
  });
  return metaRequest<T>(path, accessToken, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
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
    campaignName: `Promovare ${property.title || 'proprietate'}`.slice(0, 120),
    adSetName: `${content.locationLabel || property.location || 'Housing'} - 7 zile`.slice(0, 120),
    adName: `${property.title || 'Proprietate'} - principal`.slice(0, 120),
    objective: params.objective || 'leads',
    budgetType: params.budgetType || 'daily',
    budgetAmount: params.budgetAmount || 50,
    currency: (integration.selectedAdAccount.currency as MetaMarketingCampaignDraft['currency']) || 'RON',
    durationDays: params.durationDays || 7,
    startsAt: null,
    endsAt: null,
    startMode: 'now',
    locationLabel: content.locationLabel,
    radiusKm: 25,
    headline: content.headline,
    primaryText: content.primaryText,
    creativeFormat: 'single_image',
    creativeAspectRatio: '1:1',
    previewDevice: 'mobile',
    placements: ['facebook_feed', 'instagram_feed'],
    optimizationGoal: 'leads',
    billingEvent: 'impressions',
    abTestEnabled: false,
    creativeVariants: [],
    imageUrl: coverImage?.url || null,
    imageAlt: coverImage?.alt || property.title || null,
    mediaItems: propertyMediaItems,
    videoUrl: null,
    videoThumbnailUrl: null,
    destinationUrl,
    destinationType: 'property_page',
    utmEnabled: true,
    utmSource: 'meta',
    utmMedium: 'paid_social',
    utmCampaign: `property_${params.propertyId}`,
    utmContent: 'main_creative',
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
  | 'campaignName'
  | 'adSetName'
  | 'adName'
  | 'objective'
  | 'budgetType'
  | 'budgetAmount'
  | 'durationDays'
  | 'startsAt'
  | 'endsAt'
  | 'startMode'
  | 'locationLabel'
  | 'radiusKm'
  | 'headline'
  | 'primaryText'
  | 'creativeFormat'
  | 'creativeAspectRatio'
  | 'previewDevice'
  | 'placements'
  | 'optimizationGoal'
  | 'billingEvent'
  | 'abTestEnabled'
  | 'creativeVariants'
  | 'callToAction'
  | 'imageUrl'
  | 'imageAlt'
  | 'mediaItems'
  | 'videoUrl'
  | 'videoThumbnailUrl'
  | 'destinationUrl'
  | 'destinationType'
  | 'phoneNumber'
  | 'utmEnabled'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmContent'
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

  if (['leads', 'messages', 'traffic', 'calls'].includes(String(input.objective))) {
    patch.objective = input.objective;
  }
  if (typeof input.campaignName === 'string' || input.campaignName === null) {
    patch.campaignName = input.campaignName ? input.campaignName.trim().slice(0, 120) : null;
  }
  if (typeof input.adSetName === 'string' || input.adSetName === null) {
    patch.adSetName = input.adSetName ? input.adSetName.trim().slice(0, 120) : null;
  }
  if (typeof input.adName === 'string' || input.adName === null) {
    patch.adName = input.adName ? input.adName.trim().slice(0, 120) : null;
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
  if (typeof input.startsAt === 'string' || input.startsAt === null) {
    patch.startsAt = input.startsAt ? input.startsAt.trim().slice(0, 40) : null;
  }
  if (typeof input.endsAt === 'string' || input.endsAt === null) {
    patch.endsAt = input.endsAt ? input.endsAt.trim().slice(0, 40) : null;
  }
  if (['now', 'scheduled'].includes(String(input.startMode))) {
    patch.startMode = input.startMode;
  }
  if (typeof input.locationLabel === 'string') {
    patch.locationLabel = input.locationLabel.trim().slice(0, 120);
  }
  if (Number.isFinite(Number(input.radiusKm))) {
    patch.radiusKm = Math.min(80, Math.max(15, Math.round(Number(input.radiusKm))));
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
  if (['1:1', '4:5', 'original'].includes(String(input.creativeAspectRatio))) {
    patch.creativeAspectRatio = input.creativeAspectRatio;
  }
  if (['mobile', 'desktop'].includes(String(input.previewDevice))) {
    patch.previewDevice = input.previewDevice;
  }
  if (Array.isArray(input.placements)) {
    const allowedPlacements = new Set(['facebook_feed', 'instagram_feed', 'facebook_story', 'instagram_story']);
    patch.placements = input.placements.filter((placement) => allowedPlacements.has(placement)).slice(0, 4);
  }
  if (['leads', 'landing_page_views', 'messages'].includes(String(input.optimizationGoal))) {
    patch.optimizationGoal = input.optimizationGoal;
  }
  if (input.billingEvent === 'impressions') {
    patch.billingEvent = 'impressions';
  }
  if (typeof input.abTestEnabled === 'boolean') {
    patch.abTestEnabled = input.abTestEnabled;
  }
  if (Array.isArray(input.creativeVariants)) {
    patch.creativeVariants = input.creativeVariants
      .filter((variant) => variant && (typeof variant.headline === 'string' || typeof variant.primaryText === 'string'))
      .slice(0, 3)
      .map((variant) => ({
        headline: String(variant.headline || '').trim().slice(0, 120),
        primaryText: String(variant.primaryText || '').replace(/\r\n/g, '\n').trim().slice(0, 5000),
      }));
  }
  if (['LEARN_MORE', 'SEND_MESSAGE', 'CONTACT_US', 'CALL_NOW'].includes(String(input.callToAction))) {
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
  if (['property_page', 'lead_form', 'whatsapp', 'messenger', 'phone_call'].includes(String(input.destinationType))) {
    patch.destinationType = input.destinationType;
  }
  if (typeof input.phoneNumber === 'string' || input.phoneNumber === null) {
    patch.phoneNumber = input.phoneNumber ? input.phoneNumber.replace(/[^\d+()\-\s.]/g, '').trim().slice(0, 32) : null;
  }
  if (typeof input.utmEnabled === 'boolean') {
    patch.utmEnabled = input.utmEnabled;
  }
  if (typeof input.utmSource === 'string' || input.utmSource === null) {
    patch.utmSource = input.utmSource ? input.utmSource.trim().slice(0, 80) : null;
  }
  if (typeof input.utmMedium === 'string' || input.utmMedium === null) {
    patch.utmMedium = input.utmMedium ? input.utmMedium.trim().slice(0, 80) : null;
  }
  if (typeof input.utmCampaign === 'string' || input.utmCampaign === null) {
    patch.utmCampaign = input.utmCampaign ? input.utmCampaign.trim().slice(0, 120) : null;
  }
  if (typeof input.utmContent === 'string' || input.utmContent === null) {
    patch.utmContent = input.utmContent ? input.utmContent.trim().slice(0, 120) : null;
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

async function syncPropertyMetaMarketingStatus(agencyId: string, propertyId: string) {
  const latestSnapshot = await getCampaignDraftsCollection(agencyId)
    .where('propertyId', '==', propertyId)
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  const latestDraft = latestSnapshot.docs[0]
    ? ({
      id: latestSnapshot.docs[0].id,
      ...(latestSnapshot.docs[0].data() as Omit<MetaMarketingCampaignDraft, 'id'>),
    } as MetaMarketingCampaignDraft)
    : null;

  await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .doc(propertyId)
    .set(
      {
        metaMarketing: {
          latestCampaignDraftId: latestDraft?.id || null,
          status: latestDraft?.status || null,
          updatedAt: nowIso(),
        },
      },
      { merge: true }
    );
}

async function updatePublishedMetaCampaignStatus(
  agencyId: string,
  draft: MetaMarketingCampaignDraft,
  status: 'PAUSED' | 'DELETED'
) {
  if (!draft.metaCampaignId) return;
  const { accessToken } = await getAccessTokenForAgency(agencyId);
  await metaRequest<Record<string, unknown>>(`/${draft.metaCampaignId}`, accessToken, {
    method: 'POST',
    body: new URLSearchParams({ status }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export async function pauseMetaCampaignDraft(agencyId: string, campaignId: string) {
  const ref = getCampaignDraftRef(agencyId, campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }

  const draft = { id: snapshot.id, ...(snapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  if (draft.agencyId !== agencyId) {
    throw new Error('Campania Meta nu apartine acestei agentii.');
  }
  if (draft.status === 'draft') {
    throw new Error('Drafturile nu se pun in pauza. Le poti edita sau sterge.');
  }
  if (draft.status === 'paused') {
    return draft;
  }

  await updatePublishedMetaCampaignStatus(agencyId, draft, 'PAUSED');
  const updatedAt = nowIso();
  await ref.set({ status: 'paused', updatedAt, lastPublishError: null }, { merge: true });
  await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .doc(draft.propertyId)
    .set(
      {
        metaMarketing: {
          latestCampaignDraftId: campaignId,
          status: 'paused',
          updatedAt,
        },
      },
      { merge: true }
    );

  const updatedSnapshot = await ref.get();
  return {
    id: updatedSnapshot.id,
    ...(updatedSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>),
  } as MetaMarketingCampaignDraft;
}

export async function deleteMetaCampaignDraft(agencyId: string, campaignId: string) {
  const ref = getCampaignDraftRef(agencyId, campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }

  const draft = { id: snapshot.id, ...(snapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  if (draft.agencyId !== agencyId) {
    throw new Error('Campania Meta nu apartine acestei agentii.');
  }

  await updatePublishedMetaCampaignStatus(agencyId, draft, 'DELETED');
  await ref.delete();
  await syncPropertyMetaMarketingStatus(agencyId, draft.propertyId);
  return { id: campaignId, deleted: true };
}

function appendPublishLog(
  draft: MetaMarketingCampaignDraft,
  entry: NonNullable<MetaMarketingCampaignDraft['publishLog']>[number]
) {
  return [...(draft.publishLog || []), entry].slice(-25);
}

function withDraftUtmParameters(draft: MetaMarketingCampaignDraft) {
  if (!draft.destinationUrl || !draft.utmEnabled) return draft.destinationUrl || '';
  try {
    const url = new URL(draft.destinationUrl);
    if (draft.utmSource) url.searchParams.set('utm_source', draft.utmSource);
    if (draft.utmMedium) url.searchParams.set('utm_medium', draft.utmMedium);
    if (draft.utmCampaign) url.searchParams.set('utm_campaign', draft.utmCampaign);
    if (draft.utmContent) url.searchParams.set('utm_content', draft.utmContent);
    return url.toString();
  } catch {
    return draft.destinationUrl;
  }
}

function getPublishObjective(draft: MetaMarketingCampaignDraft) {
  if (draft.objective === 'traffic') return 'OUTCOME_TRAFFIC';
  if (draft.objective === 'messages') return 'OUTCOME_ENGAGEMENT';
  return 'OUTCOME_LEADS';
}

function getPublishOptimizationGoal(draft: MetaMarketingCampaignDraft) {
  if (draft.objective === 'traffic') return 'LINK_CLICKS';
  if (draft.objective === 'messages') return 'CONVERSATIONS';
  return 'LEADS';
}

function getMetaCtaType(draft: MetaMarketingCampaignDraft) {
  if (draft.objective === 'calls') return 'CALL_NOW';
  return draft.callToAction || 'LEARN_MORE';
}

function buildHousingTargeting(draft: MetaMarketingCampaignDraft, property: Property) {
  const latitude = Number(property.latitude);
  const longitude = Number(property.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      geo_locations: {
        custom_locations: [{
          latitude,
          longitude,
          radius: Math.max(15, Math.min(80, Number(draft.radiusKm || 25))),
          distance_unit: 'kilometer',
        }],
      },
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: draft.placements?.some((placement) => placement === 'facebook_story') ? ['feed', 'story'] : ['feed'],
      instagram_positions: draft.placements?.some((placement) => placement === 'instagram_story') ? ['stream', 'story'] : ['stream'],
    };
  }

  return {
    geo_locations: {
      countries: ['RO'],
    },
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream'],
  };
}

async function validateRemoteMedia(url: string, expectedType: 'image' | 'video') {
  if (!/^https:\/\//.test(url)) {
    throw new Error('Media pentru Meta trebuie sa fie disponibila public prin HTTPS.');
  }
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (response.ok && expectedType === 'image' && contentType && !contentType.startsWith('image/')) {
      throw new Error('Fisierul selectat nu pare sa fie imagine.');
    }
    if (response.ok && expectedType === 'video' && contentType && !contentType.startsWith('video/')) {
      throw new Error('Fisierul selectat nu pare sa fie video.');
    }
    if (contentLength > 0) {
      const maxBytes = expectedType === 'video' ? 250 * 1024 * 1024 : 8 * 1024 * 1024;
      if (contentLength > maxBytes) {
        throw new Error(expectedType === 'video'
          ? 'Video-ul depaseste limita de siguranta de 250 MB.'
          : 'Imaginea depaseste limita de siguranta de 8 MB.');
      }
    }
  } catch (error) {
    if (error instanceof Error && /Media|Fisierul|Video-ul|Imaginea/.test(error.message)) throw error;
  }
}

function validateMetaCampaignForPublish(
  draft: MetaMarketingCampaignDraft,
  integration: MetaMarketingIntegrationPublicStatus,
  property: Property
) {
  const errors: string[] = [];
  const mediaItems = draft.mediaItems || [];
  const imageItems = mediaItems.filter((item) => item.type === 'image');
  const hasVideo = Boolean(draft.videoUrl || mediaItems.some((item) => item.type === 'video'));
  const destinationUrl = withDraftUtmParameters(draft);

  if (!integration.connected) errors.push('Conecteaza Meta inainte de publicare.');
  if (!integration.selectedBusiness) errors.push('Selecteaza Business Manager-ul folosit la reclame.');
  if (!integration.selectedAdAccount) errors.push('Selecteaza Ad Account-ul folosit la reclame.');
  if (!integration.selectedPage) errors.push('Selecteaza pagina Facebook folosita in reclama.');
  if (!draft.campaignName || !draft.adSetName || !draft.adName) errors.push('Completeaza numele campaniei, ad setului si reclamei.');
  if (Number(draft.budgetAmount) < 10) errors.push('Bugetul minim este 10 RON.');
  if (Number(draft.durationDays) < 1) errors.push('Durata campaniei trebuie sa fie de cel putin o zi.');
  if (!draft.headline?.trim() || !draft.primaryText?.trim()) errors.push('Completeaza titlul si textul reclamei.');
  if (!draft.locationLabel?.trim()) errors.push('Completeaza orasul sau zona metropolitana promovata.');
  if (Number(draft.radiusKm || 0) < 15) errors.push('Pentru Housing, raza audientei trebuie sa fie de minimum 15 km.');
  if (!Number.isFinite(Number(property.latitude)) || !Number.isFinite(Number(property.longitude))) {
    errors.push('Proprietatea trebuie sa aiba coordonate valide pentru targetarea Housing pe zona larga.');
  }
  if (!draft.placements?.length) errors.push('Selecteaza cel putin un placement.');
  if (draft.creativeFormat === 'video' && !hasVideo) errors.push('Selecteaza un video pentru formatul video.');
  if (draft.creativeFormat !== 'video' && !imageItems.length) errors.push('Selecteaza cel putin o imagine pentru reclama.');
  if (draft.creativeFormat === 'carousel' && imageItems.length < 2) errors.push('Caruselul are nevoie de cel putin doua imagini.');
  if (draft.objective === 'calls' && !draft.phoneNumber?.trim()) errors.push('Adauga numarul de telefon pentru obiectivul Apeluri.');
  if (!destinationUrl || !/^https:\/\//.test(destinationUrl)) {
    errors.push('Linkul de destinatie trebuie sa fie public si HTTPS.');
  }
  if (draft.utmEnabled && (!draft.utmSource || !draft.utmMedium || !draft.utmCampaign)) {
    errors.push('Completeaza parametrii UTM sau dezactiveaza tracking-ul.');
  }

  return { ok: errors.length === 0, errors, destinationUrl };
}

async function uploadMetaImage(adAccountId: string, accessToken: string, imageUrl: string) {
  await validateRemoteMedia(imageUrl, 'image');
  const response = await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/adimages`, accessToken, {
    url: imageUrl,
  });
  return response.hash || Object.values(response.images || {})[0]?.hash || null;
}

async function uploadMetaVideo(adAccountId: string, accessToken: string, videoUrl: string) {
  await validateRemoteMedia(videoUrl, 'video');
  const response = await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/advideos`, accessToken, {
    file_url: videoUrl,
  });
  return response.id || null;
}

function buildCreativeObjectStorySpec(params: {
  draft: MetaMarketingCampaignDraft;
  pageId: string;
  destinationUrl: string;
  imageHashes: string[];
  videoId?: string | null;
}) {
  const { draft, pageId, destinationUrl, imageHashes, videoId } = params;
  const ctaType = getMetaCtaType(draft);
  const ctaValue = draft.objective === 'calls'
    ? { link: destinationUrl || draft.destinationUrl || undefined, phone_number: draft.phoneNumber || undefined }
    : { link: destinationUrl };

  if (draft.creativeFormat === 'video' && videoId) {
    return {
      page_id: pageId,
      video_data: {
        video_id: videoId,
        title: draft.headline,
        message: draft.primaryText,
        image_url: draft.videoThumbnailUrl || draft.imageUrl || undefined,
        call_to_action: { type: ctaType, value: ctaValue },
      },
    };
  }

  if (draft.creativeFormat === 'carousel' && imageHashes.length > 1) {
    return {
      page_id: pageId,
      link_data: {
        message: draft.primaryText,
        link: destinationUrl,
        caption: 'HOUSING',
        call_to_action: { type: ctaType, value: ctaValue },
        child_attachments: imageHashes.slice(0, 10).map((imageHash) => ({
          link: destinationUrl,
          name: draft.headline,
          description: draft.locationLabel,
          image_hash: imageHash,
        })),
      },
    };
  }

  return {
    page_id: pageId,
    link_data: {
      message: draft.primaryText,
      link: destinationUrl,
      name: draft.headline,
      description: draft.locationLabel,
      image_hash: imageHashes[0],
      call_to_action: { type: ctaType, value: ctaValue },
    },
  };
}

export async function publishMetaCampaign(agencyId: string, campaignId: string, requestedByUid?: string) {
  const ref = getCampaignDraftRef(agencyId, campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }

  let draft = { id: snapshot.id, ...(snapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  if (draft.agencyId !== agencyId) {
    throw new Error('Campania Meta nu apartine acestei agentii.');
  }

  const [{ accessToken, integration }, propertySnapshot] = await Promise.all([
    getAccessTokenForAgency(agencyId),
    adminDb.collection('agencies').doc(agencyId).collection('properties').doc(draft.propertyId).get(),
  ]);
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea campaniei nu a fost gasita.');
  }
  const property = { id: propertySnapshot.id, ...(propertySnapshot.data() as Omit<Property, 'id'>) } as Property;
  const validation = validateMetaCampaignForPublish(draft, integration, property);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const adAccountId = integration.selectedAdAccount?.id;
  const pageId = integration.selectedPage?.id;
  if (!adAccountId || !pageId) {
    throw new Error('Selecteaza Ad Account si Page inainte de publicare.');
  }

  const startedAt = nowIso();
  let publishLog = appendPublishLog(draft, {
    at: startedAt,
    status: 'publishing',
    message: requestedByUid ? `Publicare pornita de ${requestedByUid}.` : 'Publicare pornita.',
  });
  await ref.set({
    status: 'publishing',
    lastPublishAttemptAt: startedAt,
    publishAttempts: (draft.publishAttempts || 0) + 1,
    lastPublishError: null,
    publishLog,
    updatedAt: startedAt,
  }, { merge: true });
  draft = { ...draft, status: 'publishing', publishLog };

  try {
    const campaignResponse = draft.metaCampaignId
      ? { id: draft.metaCampaignId }
      : await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/campaigns`, accessToken, {
        name: draft.campaignName || draft.headline,
        objective: getPublishObjective(draft),
        special_ad_categories: JSON.stringify(['HOUSING']),
        status: 'PAUSED',
      });
    const metaCampaignId = campaignResponse.id;
    if (!metaCampaignId) throw new Error('Meta nu a returnat Campaign ID.');
    publishLog = appendPublishLog(draft, { at: nowIso(), status: 'publishing', message: 'Campaign creat in Meta.', metaObjectId: metaCampaignId });
    draft = { ...draft, metaCampaignId, publishLog };
    await ref.set({
      metaCampaignId,
      publishLog,
    }, { merge: true });

    const imageItems = (draft.mediaItems || []).filter((item) => item.type === 'image');
    const selectedImageItems = draft.creativeFormat === 'carousel'
      ? imageItems.slice(0, 10)
      : imageItems.filter((item) => item.url === draft.imageUrl).slice(0, 1);
    const imageHashes = draft.creativeFormat === 'video'
      ? []
      : await Promise.all((selectedImageItems.length ? selectedImageItems : imageItems.slice(0, 1)).map((item) => uploadMetaImage(adAccountId, accessToken, item.url)));
    const cleanImageHashes = imageHashes.filter(Boolean) as string[];
    const videoUrl = draft.videoUrl || (draft.mediaItems || []).find((item) => item.type === 'video')?.url || '';
    const metaVideoId = draft.creativeFormat === 'video' && videoUrl
      ? await uploadMetaVideo(adAccountId, accessToken, videoUrl)
      : null;
    if (draft.creativeFormat !== 'video' && !cleanImageHashes.length) {
      throw new Error('Meta nu a returnat hash pentru imagine.');
    }
    if (draft.creativeFormat === 'video' && !metaVideoId) {
      throw new Error('Meta nu a returnat Video ID.');
    }

    const adSetResponse = draft.metaAdSetId
      ? { id: draft.metaAdSetId }
      : await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/adsets`, accessToken, {
        name: draft.adSetName || `${draft.locationLabel} - Housing`,
        campaign_id: metaCampaignId,
        billing_event: 'IMPRESSIONS',
        optimization_goal: getPublishOptimizationGoal(draft),
        status: 'PAUSED',
        targeting: JSON.stringify(buildHousingTargeting(draft, property)),
        promoted_object: JSON.stringify({ page_id: pageId }),
        ...(draft.budgetType === 'lifetime'
          ? { lifetime_budget: Math.round(Number(draft.budgetAmount || 0) * 100) }
          : { daily_budget: Math.round(Number(draft.budgetAmount || 0) * 100) }),
        ...(draft.startsAt ? { start_time: draft.startsAt } : {}),
        ...(draft.endsAt ? { end_time: draft.endsAt } : {}),
      });
    const metaAdSetId = adSetResponse.id;
    if (!metaAdSetId) throw new Error('Meta nu a returnat Ad Set ID.');
    publishLog = appendPublishLog(draft, { at: nowIso(), status: 'publishing', message: 'Ad Set creat in Meta.', metaObjectId: metaAdSetId });
    draft = { ...draft, metaAdSetId, metaImageHash: cleanImageHashes[0] || null, metaVideoId, publishLog };
    await ref.set({
      metaAdSetId,
      metaImageHash: cleanImageHashes[0] || null,
      metaVideoId,
      publishLog,
    }, { merge: true });

    const creativeResponse = draft.metaCreativeId
      ? { id: draft.metaCreativeId }
      : await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/adcreatives`, accessToken, {
        name: `${draft.adName || draft.headline} - creative`,
        object_story_spec: JSON.stringify(buildCreativeObjectStorySpec({
          draft,
          pageId,
          destinationUrl: validation.destinationUrl,
          imageHashes: cleanImageHashes,
          videoId: metaVideoId,
        })),
      });
    const metaCreativeId = creativeResponse.id;
    if (!metaCreativeId) throw new Error('Meta nu a returnat Creative ID.');
    publishLog = appendPublishLog(draft, { at: nowIso(), status: 'publishing', message: 'Creative creat in Meta.', metaObjectId: metaCreativeId });
    draft = { ...draft, metaCreativeId, publishLog };
    await ref.set({
      metaCreativeId,
      publishLog,
    }, { merge: true });

    const adResponse = draft.metaAdId
      ? { id: draft.metaAdId }
      : await metaFormRequest<MetaCreateResponse>(`/${normalizeAdAccountId(adAccountId)}/ads`, accessToken, {
        name: draft.adName || draft.headline,
        adset_id: metaAdSetId,
        creative: JSON.stringify({ creative_id: metaCreativeId }),
        status: 'PAUSED',
      });
    const metaAdId = adResponse.id;
    if (!metaAdId) throw new Error('Meta nu a returnat Ad ID.');

    const finishedAt = nowIso();
    publishLog = appendPublishLog({ ...draft, metaAdId }, {
      at: finishedAt,
      status: 'published',
      message: 'Campania a fost publicata in Meta in status PAUSED pentru verificare finala.',
      metaObjectId: metaAdId,
    });
    await ref.set({
      status: 'published',
      metaCampaignId,
      metaAdSetId,
      metaCreativeId,
      metaAdId,
      metaImageHash: cleanImageHashes[0] || null,
      metaVideoId,
      lastPublishError: null,
      updatedAt: finishedAt,
      publishLog,
    }, { merge: true });
    await propertySnapshot.ref.set({
      metaMarketing: {
        latestCampaignDraftId: campaignId,
        status: 'published',
        updatedAt: finishedAt,
      },
    }, { merge: true });

    const updatedSnapshot = await ref.get();
    return {
      id: updatedSnapshot.id,
      ...(updatedSnapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>),
    } as MetaMarketingCampaignDraft;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publicarea Meta a esuat.';
    const failedAt = nowIso();
    await ref.set({
      status: 'error',
      lastPublishError: message,
      updatedAt: failedAt,
      publishLog: appendPublishLog(draft, { at: failedAt, status: 'error', message }),
    }, { merge: true });
    await propertySnapshot.ref.set({
      metaMarketing: {
        latestCampaignDraftId: campaignId,
        status: 'error',
        updatedAt: failedAt,
      },
    }, { merge: true });
    throw error;
  }
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
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Campania Meta nu a fost gasita.');
  }
  const draft = { id: snapshot.id, ...(snapshot.data() as Omit<MetaMarketingCampaignDraft, 'id'>) } as MetaMarketingCampaignDraft;
  const mediaItems = draft.mediaItems || [];
  const imageItems = mediaItems.filter((item) => item.type === 'image');
  const hasMedia = draft.creativeFormat === 'video' ? Boolean(draft.videoUrl || mediaItems.some((item) => item.type === 'video')) : imageItems.length > 0;
  const hasValidDestination = draft.objective === 'calls'
    ? Boolean(draft.phoneNumber)
    : Boolean(draft.destinationUrl && /^https?:\/\//.test(draft.destinationUrl));
  const readyErrors = [
    !draft.campaignName || !draft.adSetName || !draft.adName ? 'Completeaza numele campaniei, ad setului si reclamei.' : null,
    Number(draft.budgetAmount) < 10 || Number(draft.durationDays) < 1 ? 'Bugetul sau durata campaniei nu sunt valide.' : null,
    !draft.headline || !draft.primaryText ? 'Completeaza titlul si textul reclamei.' : null,
    !hasMedia ? 'Selecteaza media pentru reclama.' : null,
    !hasValidDestination ? 'Adauga un link de destinatie valid.' : null,
    draft.objective === 'calls' && !draft.phoneNumber ? 'Adauga numarul de telefon pentru apeluri.' : null,
    !draft.locationLabel || Number(draft.radiusKm || 0) < 15 ? 'Completeaza audienta Housing pe oras sau zona metropolitana.' : null,
    !draft.placements?.length ? 'Selecteaza cel putin un placement.' : null,
    draft.utmEnabled && (!draft.utmSource || !draft.utmMedium || !draft.utmCampaign) ? 'Completeaza parametrii UTM sau dezactiveaza tracking-ul.' : null,
  ].filter(Boolean);
  if (readyErrors.length) {
    throw new Error(readyErrors.join(' '));
  }
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
