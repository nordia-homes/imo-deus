import { withPropertyOperation } from '@/lib/property-removal/lifecycle';
import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { Property } from '@/lib/types';
import catalogSnapshot from './catalog.snapshot.json';
import type { RomimoCatalog, RomimoSettings, RomimoState } from './types';
import { buildArticle, defaultSettings, digest, externalIdFor, normalize, previewHashFor, refreshSavedSettings, settingsSchema } from './mapping';
import { getLiveCatalog, getToken, readArticleState, RomimoError, romimoRequest, safeListingUrl } from './client';

type Context = { db: Firestore; agencyId: string; uid: string; leaseId?: string };
type Connection = { apiKey?: string; email?: string; connected?: boolean; connectedAt?: string; leaseId?: string; leaseUntil?: number };
type Operation = { externalId?: string; submitted?: boolean; settings?: RomimoSettings; defaultsAtSubmission?: RomimoSettings; propertyTitle?: string; state?: RomimoState; message?: string; lastAction?: string; payloadHash?: string; remoteUrl?: string | null; checkedAt?: string; requestedByUid?: string; attemptedAt?: string };
const canUpdate = () => process.env.ROMIMO_UPSERT_CONFIRMED === 'true';
const privateRef = (ctx: Context) => ctx.db.collection('agencyPrivateIntegrations').doc(`${ctx.agencyId}__romimo`);
const operationRef = (ctx: Context, propertyId: string) => privateRef(ctx).collection('operations').doc(propertyId);
const propertyRef = (ctx: Context, propertyId: string) => ctx.db.collection('agencies').doc(ctx.agencyId).collection('properties').doc(propertyId);

// Serialize account changes and remote operations per agency. A lease is longer
// than the bounded requests in one operation; its owner must match on release.
async function locked<T>(ctx: Context, work: (ctx: Context) => Promise<T>): Promise<T> {
  const ref = privateRef(ctx), leaseId = randomUUID();
  await ctx.db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if ((doc.data()?.leaseUntil || 0) > Date.now()) throw new RomimoError('O operațiune Romimo este în curs. Reîncearcă după finalizare.', 409);
    tx.set(ref, { leaseId, leaseUntil: Date.now() + 240000 }, { merge: true });
  });
  try { return await work({ ...ctx, leaseId }); }
  finally {
    await ctx.db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (doc.data()?.leaseId === leaseId) tx.set(ref, { leaseId: null, leaseUntil: 0 }, { merge: true });
    }).catch(() => { console.warn('Romimo: lease release failed; automatic expiry will release it.'); });
  }
}

function assertLease(ctx: Context, connection: Connection | undefined, reserveMs = 0) {
  if (!ctx.leaseId || connection?.leaseId !== ctx.leaseId || (connection.leaseUntil || 0) <= Date.now() + reserveMs) {
    throw new RomimoError('Operațiunea a expirat. Verifică starea anunțului înainte de a continua.', 409);
  }
}

async function assertBeforeRequest(ctx: Context) {
  assertLease(ctx, (await privateRef(ctx).get()).data() as Connection | undefined, 30000);
}

async function saveConnection(ctx: Context, value: Record<string, unknown>) {
  await ctx.db.runTransaction(async tx => {
    assertLease(ctx, (await tx.get(privateRef(ctx))).data() as Connection | undefined);
    tx.set(privateRef(ctx), value, { merge: true });
  });
}

async function getConnection(ctx: Context, required = true) {
  const connection = (await privateRef(ctx).get()).data() as Connection | undefined;
  if (required && (!connection?.connected || !connection.apiKey || !connection.email)) throw new RomimoError('Conectează contul Romimo din pagina Integrări.', 409);
  return connection || {};
}

export async function connectionStatus(ctx: Context) {
  const connection = await getConnection(ctx, false);
  return { connected: !!(connection.connected && connection.apiKey), email: connection.email || '', connectedAt: connection.connectedAt || null, canUpdate: canUpdate() };
}

export async function connect(ctx: Context, apiKey: string, email: string) {
  return locked(ctx, async ctx => {
    const old = await getConnection(ctx, false);
    if (old.email && old.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
      const existing = await privateRef(ctx).collection('operations').limit(1).get();
      if (!existing.empty) throw new RomimoError('Acest cont are anunțuri asociate. Schimbarea emailului necesită migrarea asocierilor.', 409);
    }
    const token = await getToken(apiKey);
    await romimoRequest('/api/User/Package', { token, query: { Email: email } });
    await saveConnection(ctx, { apiKey, email, connected: true, connectedAt: new Date().toISOString() });
    return connectionStatus(ctx);
  });
}

export async function disconnect(ctx: Context) {
  return locked(ctx, async ctx => {
    // Retain email and authoritative associations so reconnect cannot duplicate ads.
    await saveConnection(ctx, { apiKey: null, connected: false });
    return { connected: false, message: 'Cont deconectat. Anunțurile existente rămân pe portal.' };
  });
}

async function loadProperty(ctx: Context, propertyId: string) {
  const snapshot = await propertyRef(ctx, propertyId).get();
  if (!snapshot.exists) throw new RomimoError('Proprietatea nu există în agenția ta.', 404);
  return { ...snapshot.data(), id: snapshot.id } as Property;
}

async function contactFor(ctx: Context, property: Property) {
  if (!property.agentId || property.agentId.includes('/')) return {};
  const user = (await ctx.db.collection('users').doc(property.agentId).get()).data();
  if (!user || user.agencyId !== ctx.agencyId) return {};
  return { name: typeof user.name === 'string' ? user.name : property.agentName || '', email: typeof user.email === 'string' ? user.email : '', phone: typeof user.phone === 'string' ? user.phone : '' };
}

export async function preview(ctx: Context, propertyId: string, input?: RomimoSettings) {
  const [property, connection, saved] = await Promise.all([loadProperty(ctx, propertyId), getConnection(ctx, false), operationRef(ctx, propertyId).get()]);
  const operation = (saved.data() || {}) as Operation;
  let catalog: RomimoCatalog, offline = false;
  try { catalog = await getLiveCatalog(); } catch { catalog = catalogSnapshot as RomimoCatalog; offline = true; }
  const currentDefaults = defaultSettings(property, catalog, await contactFor(ctx, property));
  const settings = input ? settingsSchema.parse(input) : refreshSavedSettings(currentDefaults, operation.settings, operation.defaultsAtSubmission);
  const built = buildArticle(property, settings, catalog, connection.email || '', externalIdFor(ctx.agencyId, propertyId));
  if (!connection.connected) built.issues.push('Conectează contul Romimo din Integrări.');
  if (offline) built.warnings.push('Catalogul live este indisponibil. Previzualizarea folosește copia din 26.09.2026; publicarea cere verificarea catalogului live.');
  return {
    settings, catalog, issues: built.issues, warnings: built.warnings,
    summary: { title: built.payload.ad.title, description: built.payload.ad.text, price: property.price, photos: built.payload.pictures.map(p => p.url) },
    previewHash: built.issues.length ? null : previewHashFor(property, built.payload), connected: !!connection.connected,
    canUpdate: canUpdate(), hasSubmission: !!operation.submitted,
    submissionState: operation.state, lastMessage: operation.message,
  };
}

async function validateLocation(settings: RomimoSettings, token: string) {
  const match = (data: unknown, value: string) => Array.isArray(data) ? data.find((v): v is string => typeof v === 'string' && normalize(v) === normalize(value)) : undefined;
  const county = await romimoRequest('/api/Resources/County', { token, query: { county: settings.county } });
  const countyName = match(county.data, settings.county);
  if (!countyName) throw new RomimoError('Județul nu corespunde nomenclatorului Romimo.', 422);
  const city = await romimoRequest('/api/Resources/City', { token, query: { County: countyName, City: settings.city } });
  const cityName = match(city.data, settings.city);
  if (!cityName) throw new RomimoError('Localitatea nu corespunde nomenclatorului Romimo. Pentru București, introdu sectorul ca localitate.', 422);
  if (settings.area.trim()) {
    const area = await romimoRequest('/api/Resources/Area', { token, query: { County: countyName, City: cityName, Area: settings.area } });
    const areaName = match(area.data, settings.area);
    if (!areaName) throw new RomimoError('Zona nu corespunde nomenclatorului Romimo. Corectează zona sau lasă câmpul necompletat.', 422);
    return { countyName, cityName, areaName };
  }
  return { countyName, cityName };
}

async function persist(ctx: Context, propertyId: string, operation: Operation, expectedPropertyHash?: string) {
  await ctx.db.runTransaction(async tx => {
    const [connection, property] = await Promise.all([tx.get(privateRef(ctx)), tx.get(propertyRef(ctx, propertyId))]);
    assertLease(ctx, connection.data() as Connection | undefined);
    if (expectedPropertyHash && (!property.exists || digest({ ...property.data(), id: property.id }) !== expectedPropertyHash)) {
      throw new RomimoError('La proprietate s-au schimbat date în timpul validării. Reîncarcă previzualizarea.', 409);
    }
    // Keep the authoritative outcome even if the CRM property was deleted while
    // the external request was running. Never recreate a deleted property.
    tx.set(operationRef(ctx, propertyId), operation, { merge: true });
    if (property.exists) tx.update(propertyRef(ctx, propertyId), {
    'promotions.publi24': { status: operation.state || 'pending', lastSync: new Date().toISOString(), link: operation.remoteUrl || '', errorMessage: operation.state === 'error' ? operation.message || '' : '' },
    'portalProfiles.publi24': { externalId: externalIdFor(ctx.agencyId, propertyId), remoteUrl: operation.remoteUrl || null, lastCheckedAt: operation.checkedAt || null, message: operation.message || '' },
    });
  });
}

async function publishInternal(ctx: Context, propertyId: string, settings: RomimoSettings, previewHash: string) {
  return locked(ctx, async ctx => {
    const [property, connection, saved, catalog] = await Promise.all([loadProperty(ctx, propertyId), getConnection(ctx), operationRef(ctx, propertyId).get(), getLiveCatalog()]);
    const prior = (saved.data() || {}) as Operation;
    if (prior.submitted && (prior.state === 'pending' || prior.lastAction === 'sending')) throw new RomimoError('Rezultatul trimiterii anterioare este neconfirmat. Folosește Verifică înainte de o nouă trimitere.', 409);
    if (prior.submitted && !canUpdate()) throw new RomimoError('Actualizarea aceluiași anunț va fi disponibilă după validarea comportamentului API cu contul de test.', 409);
    const externalId = externalIdFor(ctx.agencyId, propertyId);
    const built = buildArticle(property, settingsSchema.parse(settings), catalog, connection.email!, externalId);
    if (built.issues.length) throw new RomimoError(built.issues.join(' '), 422);
    if (previewHashFor(property, built.payload) !== previewHash) throw new RomimoError('Datele proprietății s-au schimbat. Verifică din nou previzualizarea.', 409);
    const defaultsAtSubmission = defaultSettings(property, catalog, await contactFor(ctx, property));
    const token = await getToken(connection.apiKey!);
    built.payload.location = await validateLocation(settings, token);
    await assertBeforeRequest(ctx);
    const operation: Operation = { ...prior, externalId, settings, defaultsAtSubmission, propertyTitle: property.title, submitted: true, state: 'pending', lastAction: 'sending', message: 'Trimitere în curs; rezultatul trebuie verificat.', payloadHash: digest(built.payload), requestedByUid: ctx.uid, attemptedAt: new Date().toISOString() };
    // Record intent before the external side effect. A timeout must not permit a
    // blind retry, even across processes or server restarts.
    await persist(ctx, propertyId, operation, digest(property));
    try {
      await assertBeforeRequest(ctx);
      await romimoRequest('/api/Article', { method: 'POST', token, body: built.payload });
      operation.lastAction = 'sent';
      operation.message = 'Anunț trimis. Folosește Verifică pentru confirmarea stării pe portal.';
    } catch (error) {
      const rejected = error instanceof RomimoError && [400, 401, 403, 415, 422, 429].includes(error.remoteStatus || 0);
      operation.state = rejected ? 'error' : 'pending';
      operation.submitted = rejected ? !!prior.submitted : true;
      operation.lastAction = rejected ? 'rejected' : 'uncertain';
      operation.message = error instanceof RomimoError ? error.message : 'Rezultat neconfirmat. Verifică anunțul înainte de retrimitere.';
      await persist(ctx, propertyId, operation);
      throw error;
    }
    await persist(ctx, propertyId, operation);
    return { state: operation.state, message: operation.message };
  });
}

export async function checkOrUnpublish(ctx: Context, propertyId: string, remove: boolean) {
  return locked(ctx, async ctx => {
    const connection = await getConnection(ctx);
    const saved = (await operationRef(ctx, propertyId).get()).data() as Operation | undefined;
    if (!saved?.submitted) throw new RomimoError('Nu există un anunț trimis din această integrare.', 409);
    const externalId = externalIdFor(ctx.agencyId, propertyId);
    const token = await getToken(connection.apiKey!);
    const operation: Operation = { ...saved, externalId, requestedByUid: ctx.uid, attemptedAt: new Date().toISOString() };
    await assertBeforeRequest(ctx);
    if (remove) {
      operation.lastAction = 'deleting'; operation.state = 'pending'; operation.message = 'Retragere în curs; rezultatul trebuie verificat.';
      await persist(ctx, propertyId, operation);
    }
    try {
      await assertBeforeRequest(ctx);
      const result = await romimoRequest('/api/Article', { method: remove ? 'DELETE' : 'GET', token, query: { Email: connection.email!, ExternalId: externalId } });
      if (remove && result.status === 204) {
        Object.assign(operation, { state: 'unpublished', remoteUrl: null, message: 'Romimo a confirmat ștergerea anunțului.', lastAction: 'deleted' });
      } else if (remove) {
        Object.assign(operation, { state: 'pending', message: 'Retragerea nu este confirmată. Folosește Verifică.', lastAction: 'delete-unconfirmed' });
      } else {
        Object.assign(operation, readArticleState(result.data, externalId), { lastAction: 'checked' });
      }
    } catch (error) {
      if (!remove && error instanceof RomimoError && error.remoteStatus === 404) {
        // A missing article after an uncertain write can be eventual consistency;
        // retain submitted=true and block unvalidated upsert, even after a 404.
        if (saved.lastAction === 'deleted' && saved.state === 'unpublished') {
          Object.assign(operation, { state: 'unpublished', remoteUrl: null, message: 'Anunțul șters nu mai este găsit pe portal.', lastAction: 'deleted' });
        } else {
          Object.assign(operation, { state: 'pending', remoteUrl: null, message: 'Anunțul nu a fost găsit. Verifică din nou sau confirmă situația cu Romimo.', lastAction: 'not-found' });
        }
      } else {
        if (remove) await persist(ctx, propertyId, { ...operation, message: 'Retragerea nu este confirmată. Folosește Verifică.', lastAction: 'delete-uncertain' });
        throw error;
      }
    }
    operation.checkedAt = new Date().toISOString();
    await persist(ctx, propertyId, operation);
    return { state: operation.state, message: operation.message, remoteUrl: operation.remoteUrl || null };
  });
}

export async function listManagedArticles(ctx: Context, cursor?: string) {
  let query = privateRef(ctx).collection('operations').orderBy('__name__').limit(51);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  const documents = page.docs.slice(0, 50);
  return {
    items: documents.flatMap(doc => {
      const data = doc.data() as Operation;
      if (!data.submitted) return [];
      return [{ propertyId: doc.id, title: data.propertyTitle || doc.id, state: data.state || 'pending', message: data.message || '', remoteUrl: safeListingUrl(data.remoteUrl) }];
    }),
    nextCursor: page.docs.length > 50 ? documents.at(-1)!.id : null,
  };
}

export async function publish(ctx: Context, propertyId: string, settings: RomimoSettings, previewHash: string) {
  return withPropertyOperation({ ...ctx, propertyId }, 'publish', () => publishInternal(ctx, propertyId, settings, previewHash));
}
