import type { Firestore } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import type { Actor, Capability, Connection } from './model';
import { agencyCollection, CommunicationError, nowIso } from './server';
import { seal, stableId, unseal } from './crypto';

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
  if (!response.ok || result.error) throw new CommunicationError(result.error?.message || 'Meta nu a acceptat solicitarea.', response.status === 401 ? 401 : 502);
  return result as T;
}
const scopeGroups = {
  publish: ['pages_manage_posts', 'instagram_basic', 'instagram_content_publish'],
  messaging: ['pages_messaging', 'pages_manage_metadata', 'instagram_basic', 'instagram_manage_messages'],
  comments: ['pages_manage_engagement', 'instagram_basic', 'instagram_manage_comments'],
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
    const debug = await graph<{ data: { app_id?: string; is_valid?: boolean; granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } }>('/debug_token?input_token=' + encodeURIComponent(userToken), userToken);
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
async function registerConnection(db: Firestore, row: Connection, token: string, metaUserId?: string) {
  const ownership = db.collection('communicationAccountOwners').doc(stableId(row.channel, row.externalId));
  await db.runTransaction(async tx => {
    const existing = await tx.get(ownership);
    if (existing.exists && existing.data()?.agencyId !== row.agencyId) throw new CommunicationError('Contul este deja conectat la altă agenție.', 409);
    tx.set(ownership, { agencyId: row.agencyId, connectionId: row.id, channel: row.channel, externalId: row.externalId });
    tx.set(agencyCollection(db, row.agencyId, 'channelConnections').doc(row.id), row);
    tx.set(db.collection('communicationSecrets').doc(row.id), { agencyId: row.agencyId, token: seal(token), metaUserId: metaUserId || null });
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
    comments: { status: scopes.has(instagram ? 'instagram_manage_comments' : 'pages_manage_engagement') ? 'active' : 'configuration_required', reason: 'Necesită accesul la comentariile contului.' },
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
export async function connectionToken(db: Firestore, actor: Pick<Actor, 'agencyId'>, id: string, capability: Capability) {
  const [row, secret] = await Promise.all([agencyCollection(db, actor.agencyId, 'channelConnections').doc(id).get(), db.collection('communicationSecrets').doc(id).get()]);
  const connection = row.data() as Connection | undefined;
  if (!connection || connection.status !== 'connected' || secret.data()?.agencyId !== actor.agencyId) throw new CommunicationError('Conexiunea nu mai este activă.', 409);
  if (connection.capabilities[capability]?.status !== 'active') throw new CommunicationError(connection.capabilities[capability]?.reason || 'Funcția necesită configurare.', 409);
  return { connection, token: unseal(secret.data()!.token) };
}
export async function finishWhatsApp(db: Firestore, actor: Actor, body: unknown) {
  const data = z.object({ code: z.string().min(1), wabaId: z.string().regex(/^\d+$/), phoneNumberId: z.string().regex(/^\d+$/), mode: z.enum(['cloud', 'coexistence']), pin: z.string().regex(/^\d{6}$/).optional() }).parse(body);
  if (data.mode === 'cloud' && !data.pin) throw new CommunicationError('Pentru numărul dedicat setează un PIN din 6 cifre.');
  const exchange = await graph<{ access_token: string }>(`/oauth/access_token?client_id=${encodeURIComponent(appId())}&client_secret=${encodeURIComponent(appSecret())}&code=${encodeURIComponent(data.code)}`, '');
  const phones = await graph<{ data: Array<{ id: string; display_phone_number: string; verified_name: string }> }>(`/${data.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, exchange.access_token);
  const phone = phones.data.find(p => p.id === data.phoneNumberId);
  if (!phone) throw new CommunicationError('Numărul nu aparține contului WhatsApp autorizat.', 403);
  if (data.mode === 'cloud') await graph(`/${phone.id}/register`, exchange.access_token, { messaging_product: 'whatsapp', pin: data.pin });
  await graph(`/${data.wabaId}/subscribed_apps`, exchange.access_token, {});
  const row: Connection = { id: stableId(actor.agencyId, 'whatsapp', phone.id), agencyId: actor.agencyId, channel: 'whatsapp', externalId: phone.id, parentId: data.wabaId, name: `${phone.verified_name} · ${phone.display_phone_number}`, mode: data.mode, status: 'connected', updatedAt: nowIso(), capabilities: {
    receive: { status: 'configuration_required', reason: 'Trimite un mesaj de test către număr.' },
    send: { status: 'active', reason: 'Verificarea eligibilității și costului se face înainte de fiecare trimitere.' },
    templates: { status: 'active', reason: 'Șabloanele sunt sincronizate din Meta.' },
    nativeSync: { status: data.mode === 'coexistence' ? 'configuration_required' : 'unavailable', reason: data.mode === 'coexistence' ? 'Așteptăm primul răspuns din Business App.' : 'Număr dedicat Cloud API.' },
  } };
  await registerConnection(db, row, exchange.access_token);
  return { connected: true };
}
export function onboardingConfig() {
  return { appId: appId(), version: version(), whatsappConfigId: process.env.META_WHATSAPP_CONFIG_ID || '', whatsappReady: Boolean(process.env.META_WHATSAPP_CONFIG_ID && process.env.WHATSAPP_DIRECT_BILLING_READY === 'true'), searchReady: Boolean(process.env.TYPESENSE_URL && process.env.TYPESENSE_API_KEY) };
}
