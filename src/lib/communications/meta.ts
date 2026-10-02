import type { Firestore } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import type { Actor, Capability, Connection } from './model';
import { agencyCollection, CommunicationError, nowIso } from './server';
import { seal, stableId, unseal } from './crypto';
import { assertWhatsAppAccess, whatsappAccess, whatsappAppId, whatsappAppSecret, whatsappConfigId } from './whatsapp-config';

export class MetaGraphError extends CommunicationError {
  constructor(message: string, public providerStatus: number, public providerCode?: number) {
    super(message, providerStatus === 401 ? 401 : 502);
  }
}
const version = () => process.env.META_GRAPH_VERSION || 'v23.0';
const appId = () => process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
const appSecret = () => process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
const callback = () => `${(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://imodeus.ro').replace(/\/$/, '')}/auth/communications/callback`;
export async function graph<T = Record<string, any>>(path: string, token: string, body?: Record<string, unknown>): Promise<T> {
  if (!path.startsWith('/') || path.includes('://')) throw new CommunicationError('Cale Meta invalidă.');
  const response = await fetch(`https://graph.facebook.com/${version()}${path}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok || result.error) throw new MetaGraphError(result.error?.message || 'Meta nu a acceptat solicitarea.', response.status, result.error?.code);
  return result as T;
}
export async function graphDelete(path: string, token: string): Promise<void> {
  if (!/^\/\d+(?:_\d+)?$/.test(path)) throw new CommunicationError('ID Meta invalid.');
  const response = await fetch(`https://graph.facebook.com/${version()}${path}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok || result.error || result.success !== true) {
    throw new CommunicationError(result.error?.message || 'Meta nu a confirmat ștergerea postării.', response.status === 401 ? 401 : 502);
  }
}
const scopeGroups = {
  publish: ['pages_manage_posts', 'instagram_basic', 'instagram_content_publish'],
  messaging: ['pages_messaging', 'pages_manage_metadata', 'instagram_basic', 'instagram_manage_messages'],
  comments: ['pages_manage_engagement', 'pages_read_user_content', 'instagram_basic', 'instagram_manage_comments'],
  insights: ['read_insights', 'instagram_basic', 'instagram_manage_insights'],
};
export async function startAuthorization(db: Firestore, actor: Actor, body: unknown) {
  const data = z.object({ features: z.array(z.enum(['publish', 'messaging', 'comments', 'insights'])).min(1) }).parse(body);
  if (!appId() || !appSecret()) throw new CommunicationError('Conectarea Meta nu este configurată pe server.', 503);
  const state = randomBytes(32).toString('hex');
  await db.collection('communicationOAuthStates').doc(stableId(state)).create({ uid: actor.uid, agencyId: actor.agencyId, features: data.features, expiresAt: Date.now() + 600000 });
  const url = new URL(`https://www.facebook.com/${version()}/dialog/oauth`);
  url.searchParams.set('client_id', appId()); url.searchParams.set('redirect_uri', callback());
  url.searchParams.set('state', state); url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [...new Set(['pages_show_list', 'pages_read_engagement', ...data.features.flatMap(f => scopeGroups[f])])].join(','));
  url.searchParams.set('auth_type', 'rerequest');
  if (process.env.META_ORGANIC_LOGIN_CONFIG_ID) url.searchParams.set('config_id', process.env.META_ORGANIC_LOGIN_CONFIG_ID);
  return { authorizationUrl: url.toString() };
}
export async function finishAuthorization(db: Firestore, code: string, state: string) {
  const ref = db.collection('communicationOAuthStates').doc(stableId(state));
  const data = await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const value = snap.data();
    if (!value || value.expiresAt < Date.now() || value.consumed) throw new CommunicationError('Conectarea a expirat. Reîncearcă.');
    tx.update(ref, { consumed: true }); return value;
  });
  const profile = await db.collection('users').doc(data.uid).get();
  if (profile.data()?.agencyId !== data.agencyId || profile.data()?.role !== 'admin') throw new CommunicationError('Accesul administratorului a fost revocat.', 403);
  const exchange = await graph<{ access_token: string }>(`/oauth/access_token?client_id=${encodeURIComponent(appId())}&client_secret=${encodeURIComponent(appSecret())}&redirect_uri=${encodeURIComponent(callback())}&code=${encodeURIComponent(code)}`, '');
  const long = await graph<{ access_token: string; expires_in?: number }>(`/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId())}&client_secret=${encodeURIComponent(appSecret())}&fb_exchange_token=${encodeURIComponent(exchange.access_token)}`, '');
  const me = await graph<{ id: string }>('/me?fields=id', long.access_token);
  await db.collection('communicationGrants').doc(stableId(data.agencyId, 'meta')).set({ agencyId: data.agencyId, token: seal(long.access_token), metaUserId: me.id,
    expiresAt: long.expires_in ? Date.now() + long.expires_in * 1000 : null, updatedAt: nowIso() });
  return data.agencyId as string;
}
export async function listAssets(db: Firestore, agencyId: string) {
  const grant = await db.collection('communicationGrants').doc(stableId(agencyId, 'meta')).get();
  if (!grant.exists) return { pages: [] };
  const token = unseal(grant.data()!.token);
  const pages = await listAuthorizedPages(token);
  return { pages: pages.map(({ id, name, instagram_business_account }) => ({ id, name, instagram_business_account })) };
}
type MetaPage = { id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username?: string } };
export async function listAuthorizedPages(userToken: string): Promise<MetaPage[]> {
  const response = await graph<{ data: MetaPage[] }>('/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100', userToken);
  const pages = new Map(response.data.map(page => [page.id, page]));
  try {
    const debug = await graph<{ data: { app_id?: string; is_valid?: boolean; granular_scopes?: Array<{ scope: string; target_ids?: string[] }>; user_id?: string } }>('/debug_token?input_token=' + encodeURIComponent(userToken), userToken);
    if (debug.data.is_valid && debug.data.app_id === appId()) {
      const ids = debug.data.granular_scopes?.filter(scope => scope.scope === 'pages_show_list').flatMap(scope => scope.target_ids || []) || [];
      for (const id of [...new Set(ids)].filter(id => /^\d+$/.test(id) && !pages.has(id)).slice(0, 100)) {
        try {
          const page = await graph<MetaPage>('/' + id + '?fields=id,name,access_token,instagram_business_account{id,username}', userToken);
          if (page.id === id && page.access_token) pages.set(id, page);
        } catch { /* A granted target may no longer be accessible. */ }
      }
    }
  } catch { /* Keep the pages returned by /me/accounts if token inspection is unavailable. */ }
  return [...pages.values()];
}
export function preserveVerifiedConnection(next: Connection, current?: Connection): Connection {
  if (!current || current.status !== 'connected' || current.agencyId !== next.agencyId || current.channel !== next.channel || current.externalId !== next.externalId || (current.appId || appId()) !== (next.appId || appId())) return next;
  const capabilities = { ...next.capabilities };
  for (const name of ['receive', 'nativeSync'] as const) {
    if (capabilities[name]?.status === 'configuration_required' && current.capabilities?.[name]?.status === 'active') capabilities[name] = current.capabilities[name];
  }
  return { ...next, capabilities, ...(current.lastSyncAt ? { lastSyncAt: current.lastSyncAt } : {}) };
}
async function registerConnection(db: Firestore, row: Connection, token: string, metaUserId?: string, tokenExpiresAt?: number | null) {
  const ownership = db.collection('communicationAccountOwners').doc(stableId(row.channel, row.externalId));
  const connectionRef = agencyCollection(db, row.agencyId, 'channelConnections').doc(row.id);
  await db.runTransaction(async tx => {
    const [existing, current] = await Promise.all([tx.get(ownership), tx.get(connectionRef)]);
    if (existing.exists && existing.data()?.agencyId !== row.agencyId) throw new CommunicationError('Contul este deja conectat la altă agenție.', 409);
    tx.set(ownership, { agencyId: row.agencyId, connectionId: row.id, channel: row.channel, externalId: row.externalId });
    tx.set(connectionRef, preserveVerifiedConnection(row, current.data() as Connection | undefined));
    tx.set(db.collection('communicationSecrets').doc(row.id), { agencyId: row.agencyId, appId: row.appId || appId(), token: seal(token), metaUserId: metaUserId || null, tokenExpiresAt: tokenExpiresAt || null, verifiedAt: nowIso() });
  });
}
export async function selectPage(db: Firestore, actor: Actor, pageId: string) {
  z.string().regex(/^\d+$/).parse(pageId);
  const grant = await db.collection('communicationGrants').doc(stableId(actor.agencyId, 'meta')).get();
  if (!grant.exists) throw new CommunicationError('Conectează mai întâi contul Meta.');
  const userToken = unseal(grant.data()!.token);
  const pages = await listAuthorizedPages(userToken);
  const page = pages.find(p => p.id === pageId);
  if (!page?.access_token) throw new CommunicationError('Pagina nu este administrată de contul conectat.', 403);
  const permissionData = await graph<{ data: Array<{ permission: string; status: string }> }>('/me/permissions', userToken);
  const scopes = new Set(permissionData.data.filter(p => p.status === 'granted').map(p => p.permission));
  let subscribed = false;
  if (scopes.has('pages_manage_metadata')) {
    await graph(`/${page.id}/subscribed_apps`, page.access_token, { subscribed_fields: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads', 'message_echoes'] }); subscribed = true;
  }
  const capabilities = (instagram: boolean): Connection['capabilities'] => ({
    publish: { status: scopes.has(instagram ? 'instagram_content_publish' : 'pages_manage_posts') ? 'active' : 'configuration_required', reason: 'Acces verificat pentru contul selectat; publicarea este inițiată explicit.' },
    receive: { status: subscribed && scopes.has(instagram ? 'instagram_manage_messages' : 'pages_messaging') ? 'configuration_required' : 'unavailable', reason: 'Trimite un mesaj de test către cont; primirea lui activează această funcție.' },
    send: { status: scopes.has(instagram ? 'instagram_manage_messages' : 'pages_messaging') ? 'active' : 'configuration_required', reason: 'Răspunsul necesită o conversație eligibilă și acces valid la trimitere.' },
    nativeSync: { status: 'configuration_required', reason: 'În așteptarea primului răspuns observat din aplicația nativă.' },
    comments: { status: instagram ? (scopes.has('instagram_manage_comments') ? 'active' : 'configuration_required') : (scopes.has('pages_manage_engagement') && scopes.has('pages_read_user_content') ? 'active' : 'configuration_required'), reason: instagram ? 'Necesită instagram_manage_comments.' : 'Necesită pages_manage_engagement și pages_read_user_content; reconectează pagina cu Comentarii selectat.' },
    insights: { status: scopes.has(instagram ? 'instagram_basic' : 'pages_read_engagement') ? 'active' : 'configuration_required', reason: 'Indicatori de interacțiune disponibili pentru postările publicate.' },
  });
  const base: Connection = { id: stableId(actor.agencyId, 'messenger', page.id), agencyId: actor.agencyId, channel: 'messenger', externalId: page.id, name: page.name, status: 'connected', capabilities: capabilities(false), updatedAt: nowIso() };
  await registerConnection(db, base, page.access_token, grant.data()?.metaUserId);
  if (page.instagram_business_account) {
    const ig = page.instagram_business_account;
    await registerConnection(db, { ...base, id: stableId(actor.agencyId, 'instagram', ig.id), channel: 'instagram', externalId: ig.id, parentId: page.id, name: ig.username || ig.id, capabilities: capabilities(true) }, page.access_token, grant.data()?.metaUserId);
  }
  return { connected: true };
}
export async function connectionToken(db: Firestore, actor: Pick<Actor, 'agencyId'>, id: string, capability: Capability | 'media') {
  const [row, secret] = await Promise.all([agencyCollection(db, actor.agencyId, 'channelConnections').doc(id).get(), db.collection('communicationSecrets').doc(id).get()]);
  const connection = row.data() as Connection | undefined;
  if (!connection || connection.status !== 'connected' || secret.data()?.agencyId !== actor.agencyId) throw new CommunicationError('Conexiunea nu mai este activă.', 409);
  if (secret.data()?.tokenExpiresAt && secret.data()!.tokenExpiresAt <= Date.now()) {
    await row.ref.update({ [`capabilities.${capability === 'media' ? 'receive' : capability}`]: { status: 'reconnect_required', reason: 'Autorizarea Meta a expirat. Reconectează contul.' } });
    throw new CommunicationError('Autorizarea Meta a expirat. Reconectează numărul.', 409);
  }
  if (capability !== 'media' && connection.capabilities[capability]?.status !== 'active') throw new CommunicationError(connection.capabilities[capability]?.reason || 'Funcția necesită configurare.', 409);
  return { connection, token: unseal(secret.data()!.token) };
}
export async function refreshPageToken(db: Firestore, actor: Pick<Actor, 'agencyId'>, connection: Connection): Promise<string> {
  if (!['messenger', 'instagram'].includes(connection.channel)) throw new CommunicationError('Conexiunea nu este o pagină Meta.', 400);
  const pageId = connection.channel === 'instagram' ? connection.parentId : connection.externalId;
  if (!pageId) throw new CommunicationError('Pagina asociată contului Instagram lipsește.', 409);
  const grant = await db.collection('communicationGrants').doc(stableId(actor.agencyId, 'meta')).get();
  if (!grant.exists || grant.data()?.agencyId !== actor.agencyId) throw new CommunicationError('Autorizarea Meta lipsește. Reconectează contul.', 409);
  const pages = await listAuthorizedPages(unseal(grant.data()!.token));
  const page = pages.find(candidate => candidate.id === pageId);
  if (!page?.access_token) throw new CommunicationError('Pagina conectată nu mai este disponibilă în autorizarea Meta. Reconectează contul.', 409);
  if (connection.channel === 'instagram' && page.instagram_business_account?.id !== connection.externalId) {
    throw new CommunicationError('Contul Instagram nu mai este asociat paginii conectate. Reconectează contul.', 409);
  }
  await db.collection('communicationSecrets').doc(connection.id).update({ token: seal(page.access_token) });
  return page.access_token;
}
export async function startWhatsAppSignup(db: Firestore, actor: Actor, body: unknown) {
  const { mode } = z.object({ mode: z.enum(['cloud', 'coexistence']) }).parse(body);
  assertWhatsAppAccess(actor);
  const signupState = randomBytes(32).toString('hex');
  await db.collection('communicationWhatsAppSignupStates').doc(stableId(signupState)).create({
    agencyId: actor.agencyId, uid: actor.uid, mode, appId: whatsappAppId(), configId: whatsappConfigId(), expiresAt: Date.now() + 10 * 60 * 1000,
    createdAt: nowIso(), consumed: false,
  });
  return { signupState };
}
export async function finishWhatsApp(db: Firestore, actor: Actor, body: unknown) {
  assertWhatsAppAccess(actor);
  const data = z.object({ code: z.string().min(1), signupState: z.string().regex(/^[a-f0-9]{64}$/), wabaId: z.string().regex(/^\d+$/), phoneNumberId: z.string().regex(/^\d+$/), mode: z.enum(['cloud', 'coexistence']), pin: z.string().regex(/^\d{6}$/).optional() }).parse(body);
  if (data.mode === 'cloud' && !data.pin) throw new CommunicationError('Pentru numărul dedicat setează un PIN din 6 cifre.');
  seal('preflight'); // Fail before consuming state or mutating Meta if encryption is unavailable.
  const stateRef = db.collection('communicationWhatsAppSignupStates').doc(stableId(data.signupState));
  await db.runTransaction(async tx => {
    const state = await tx.get(stateRef); const value = state.data();
    if (!value || value.consumed || value.expiresAt <= Date.now() || value.uid !== actor.uid || value.agencyId !== actor.agencyId || value.mode !== data.mode || value.appId !== whatsappAppId() || value.configId !== whatsappConfigId()) {
      throw new CommunicationError('Sesiunea de conectare WhatsApp a expirat. Reîncearcă.', 409);
    }
    tx.update(stateRef, { consumed: true, consumedAt: nowIso() });
  });
  const exchange = await graph<{ access_token: string }>(`/oauth/access_token?client_id=${encodeURIComponent(whatsappAppId())}&client_secret=${encodeURIComponent(whatsappAppSecret())}&code=${encodeURIComponent(data.code)}`, '');
  const inspection = await graph<{ data: { is_valid?: boolean; app_id?: string; scopes?: string[]; expires_at?: number; granular_scopes?: Array<{ scope: string; target_ids?: string[] }>; user_id?: string } }>(
    `/debug_token?input_token=${encodeURIComponent(exchange.access_token)}`, `${whatsappAppId()}|${whatsappAppSecret()}`);
  if (!inspection.data.is_valid || inspection.data.app_id !== whatsappAppId() || (inspection.data.expires_at && inspection.data.expires_at * 1000 <= Date.now())) throw new CommunicationError('Tokenul WhatsApp nu aparține aplicației IMO Deus.', 403);
  const scopes = new Set(inspection.data.scopes || []);
  if (!scopes.has('whatsapp_business_management') || !scopes.has('whatsapp_business_messaging')) {
    throw new CommunicationError('Autorizarea WhatsApp nu include permisiunile de gestionare și mesagerie.', 403);
  }
  const managedTargets = inspection.data.granular_scopes?.find(scope => scope.scope === 'whatsapp_business_management')?.target_ids;
  if (managedTargets?.length && !managedTargets.includes(data.wabaId)) throw new CommunicationError('WABA nu este inclus în autorizarea acordată.', 403);
  const waba = await graph<{ id: string; currency?: string }>(`/${data.wabaId}?fields=id,currency`, exchange.access_token);
  if (waba.id !== data.wabaId) throw new CommunicationError('Contul WhatsApp nu corespunde autorizării.', 403);
  // Missing billing metadata must not prevent connecting; never infer currency.
  const currency = typeof waba.currency === 'string' && /^[A-Z]{3}$/.test(waba.currency) ? waba.currency : undefined;
  const phone = await findWhatsAppPhone(data.wabaId, data.phoneNumberId, exchange.access_token);
  if (!phone) throw new CommunicationError('Numărul nu aparține contului WhatsApp autorizat.', 403);
  if (phone.platform_type === 'ON_PREMISE') throw new CommunicationError('Numărul necesită o migrare explicită; conectarea automată a fost oprită.', 409);
  if (data.mode === 'coexistence' && phone.is_on_biz_app !== true) throw new CommunicationError('Meta nu a confirmat un număr Business App pentru Coexistence.', 409);
  if (data.mode === 'cloud' && phone.is_on_biz_app) throw new CommunicationError('Numărul folosește Business App. Reia explicit fluxul Coexistence.', 409);
  const ownership = db.collection('communicationAccountOwners').doc(stableId('whatsapp', phone.id));
  // Reserve ownership before external mutations; a partial failure must not transfer the number.
  await db.runTransaction(async tx => {
    const owner = await tx.get(ownership);
    if (owner.exists && owner.data()?.agencyId !== actor.agencyId) throw new CommunicationError('Contul este deja conectat la altă agenție.', 409);
    tx.set(ownership, { agencyId: actor.agencyId, connectionId: stableId(actor.agencyId, 'whatsapp', phone.id), channel: 'whatsapp', externalId: phone.id });
  });
  if (data.mode === 'cloud' && phone.status !== 'CONNECTED') {
    if (!['PENDING', 'UNREGISTERED', 'DISCONNECTED'].includes(phone.status || '')) throw new CommunicationError('Starea numărului nu permite înregistrarea automată. Verifică numărul în Meta.', 409);
    const registered = await graph<{ success: boolean }>('/' + phone.id + '/register', exchange.access_token, { messaging_product: 'whatsapp', pin: data.pin });
    if (registered.success !== true) throw new CommunicationError('Meta nu a confirmat înregistrarea numărului.', 502);
  }
  const subscribed = await graph<{ success: boolean }>('/' + data.wabaId + '/subscribed_apps', exchange.access_token, {});
  if (subscribed.success !== true) throw new CommunicationError('Meta nu a confirmat abonarea WABA.', 502);
  const row: Connection = { id: stableId(actor.agencyId, 'whatsapp', phone.id), agencyId: actor.agencyId, appId: whatsappAppId(), channel: 'whatsapp', externalId: phone.id, parentId: data.wabaId, ...(currency ? { currency } : {}), name: `${phone.verified_name} · ${phone.display_phone_number}`, mode: data.mode, status: 'connected', updatedAt: nowIso(), capabilities: {
    receive: { status: 'configuration_required', reason: 'Trimite un mesaj de test către număr.' },
    send: currency
      ? { status: 'active', reason: 'Verificarea eligibilității și costului se face înainte de fiecare trimitere.' }
      : { status: 'configuration_required', reason: 'Meta nu a furnizat moneda contului WhatsApp. Verifică facturarea în Meta, apoi reconectează numărul pentru reverificare. Trimiterile sunt blocate.' },
    templates: { status: 'active', reason: 'Șabloanele sunt sincronizate din Meta.' },
    nativeSync: { status: data.mode === 'coexistence' ? 'configuration_required' : 'unavailable', reason: data.mode === 'coexistence' ? 'Așteptăm primul răspuns din Business App.' : 'Număr dedicat Cloud API.' },
  } };
  await registerConnection(db, row, exchange.access_token, inspection.data.user_id, inspection.data.expires_at ? inspection.data.expires_at * 1000 : null);

  return { connected: true };
}
type WhatsAppPhone = { id: string; display_phone_number: string; verified_name: string; status?: string; is_on_biz_app?: boolean; platform_type?: string };
export async function findWhatsAppPhone(wabaId: string, phoneId: string, token: string): Promise<WhatsAppPhone | undefined> {
  let after = ''; const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ fields: 'id,display_phone_number,verified_name,status,is_on_biz_app,platform_type', limit: '100' });
    if (after) params.set('after', after);
    const result = await graph<{ data: WhatsAppPhone[]; paging?: { next?: string; cursors?: { after?: string } } }>('/' + wabaId + '/phone_numbers?' + params, token);
    const phone = result.data.find(p => p.id === phoneId); if (phone) return phone;
    const cursor = result.paging?.next && result.paging.cursors?.after;
    if (!cursor || seen.has(cursor)) return undefined;
    seen.add(cursor); after = cursor;
  }
  throw new CommunicationError('Lista numerelor este prea mare pentru verificare completă.', 409);
}
export function onboardingConfig(actor?: Actor) {
  return { appId: appId(), whatsappAppId: whatsappAppId(), version: version(), whatsappConfigId: whatsappConfigId(), ...whatsappAccess(actor), searchReady: Boolean(process.env.TYPESENSE_URL && process.env.TYPESENSE_API_KEY) };
}
