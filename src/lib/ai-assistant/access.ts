import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { CommunicationError, agencyCollection } from '@/lib/communications/server';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { fieldSchema, type AssistantRead, type AccessReference, type AssistantAction, type AssistantRelated } from './contracts';
import type { z } from 'zod';
import { safeData, uniqueReferences } from './contracts';
import { matchesCrmSearch } from '@/lib/crm/search-text';
import { isStepReference } from './dependencies';
import { FieldPath } from 'firebase-admin/firestore';

export type AssistantContext = Awaited<ReturnType<typeof requireAgencyUserFromBearerToken>> & { authorization: string; agentJobFence?: import('@/lib/crm/automation-fence').AutomationFence; automationFence?: import('@/lib/crm/automation-fence').AutomationFence; appOrigin?: string; agentBudget?: import('./budget').AgentBudget };
export async function assistantContext(request: Request): Promise<AssistantContext> {
  const authorization = request.headers.get('authorization') || '';
  const context = await requireAgencyUserFromBearerToken(authorization);
  if (!['admin', 'agent'].includes(context.role || '')) throw new CommunicationError('Acces CRM necesar.', 403);
  return { ...context, authorization, appOrigin: new URL(request.url).origin };
}
export function collectionFor(ctx: AssistantContext, resource: string) { return agencyCollection(ctx.adminDb, ctx.agencyId, resource); }
export function canReadResource(ctx: Pick<AssistantContext, 'uid' | 'role' | 'agencyId'>, resource: string, row: Record<string, any>) {
  if (resource === 'salesTemplateAudit') return ctx.role === 'admin';
  if (resource === 'assistantAutomations') return row.actorId === ctx.uid;
  if (resource === 'sales') return ctx.role === 'admin' || row.agentId === ctx.uid || (Array.isArray(row.collaboratorIds) && row.collaboratorIds.includes(ctx.uid));
  if (resource === 'conversations') return canReadConversation(ctx, { ...row, collaboratorIds: Array.isArray(row.collaboratorIds) ? row.collaboratorIds : [] } as Conversation);
  if (resource === 'socialPosts') return ctx.role === 'admin';
  if (resource === 'crmEvents') {
    if (ctx.role === 'admin' || row.actorId === ctx.uid) return true;
    const visibility = row.visibility;
    const publicMetadata = ['contacts', 'properties', 'tasks', 'viewings', 'ownerListingFavorites', 'storiaInboxLeads', 'metaCampaignDrafts', 'tiktokPostDrafts', 'tiktokStudioProjects', 'tiktokStudioAssets', 'generatedContracts'];
    if (!visibility || visibility.agencyId !== ctx.agencyId) return false;
    if (['notificationPreferences', 'notifications', 'messagingRegistrations'].includes(visibility.resource)) return visibility.ownerId === ctx.uid;
    if (publicMetadata.includes(visibility.resource)) return true;
    if (['sales', 'conversations'].includes(visibility.resource)) return canReadResource(ctx, visibility.resource, visibility);
    return false;
  }
  if (resource === 'assistantUploads') return row.ownerId === ctx.uid && Number(row.expiresAt) > Date.now();
  return true;
}
export async function getResource(ctx: AssistantContext, resource: string, id: string): Promise<Record<string, any>> {
  if (resource === 'profile' || resource === 'notificationPreferences') {
    if (id !== ctx.uid && !(resource === 'notificationPreferences' && id === 'default')) throw new CommunicationError('Acces permis numai la preferințele și profilul propriu.', 403);
    const ref = ctx.adminDb.collection('users').doc(ctx.uid);
    const doc = await (resource === 'profile' ? ref : ref.collection('notificationPreferences').doc('default')).get();
    if (!doc.exists) return { id: resource === 'profile' ? ctx.uid : 'default' };
    return safeData({ ...doc.data(), id: doc.id });
  }
  const ref = resource === 'portals' ? ctx.adminDb.collection('portals').doc(id) : collectionFor(ctx, resource).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new CommunicationError('Înregistrarea nu există.', 404);
  const row: Record<string, any> = { ...doc.data(), id: doc.id };
  if (resource === 'portals' && row.agencyId !== ctx.agencyId) throw new CommunicationError('Portal inaccesibil.', 403);
  if (!canReadResource(ctx, resource, row)) throw new CommunicationError('Nu ai acces la această înregistrare.', 403);
  if (resource === 'crmEvents' && !(await eventReferencesAllowed(ctx, row))) throw new CommunicationError('Acces revocat la entitatea din istoric.', 403);
  if (resource === 'assistantAutomations' && (row as Record<string, any>).automation?.type === 'whatsapp_template') await getResource(ctx, 'conversations', (row as Record<string, any>).automation.conversationId);
  return row as Record<string, any>;
}
export async function readResource(ctx: AssistantContext, input: AssistantRead) {
  if (input.resource === 'profile' || input.resource === 'notificationPreferences') return { rows: [await getResource(ctx, input.resource, input.id || ctx.uid)], complete: true, nextCursor: null };
  if (input.resource === 'agency') {
    const doc = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).get();
    return { rows: doc.exists ? [safeData({ ...doc.data(), id: ctx.agencyId })] : [], nextCursor: null, complete: true };
  }
  if (['agents', 'notifications', 'portals'].includes(input.resource)) {
    const base = input.resource === 'agents' ? ctx.adminDb.collection('users').where('agencyId', '==', ctx.agencyId) : input.resource === 'portals' ? ctx.adminDb.collection('portals').where('agencyId', '==', ctx.agencyId) : ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications');
    let query = base.orderBy('__name__').limit(input.limit + 1);
    if (input.id) query = base.where(FieldPath.documentId(), '==', input.id).orderBy('__name__').limit(1);
    if (input.cursor) query = query.startAfter(input.cursor);
    // A where clause bound to the authenticated agency/uid protects global collections.
    const docs = await query.get();
    const rows = docs.docs.slice(0, input.limit).map(d => safeData({ ...d.data(), id: d.id }));
    return { rows: rows.filter(r => (!input.id || r.id === input.id) && (!input.search || matchesCrmSearch(r, input.search))), nextCursor: docs.size > input.limit ? docs.docs[input.limit - 1].id : null, complete: docs.size <= input.limit };
  }
  if (input.id) return { rows: [safeData(await getResource(ctx, input.resource, input.id))], nextCursor: null, complete: true };
  // Paginate by document id; the cursor advances over inaccessible/nonmatching rows too.
  // Scanning budget is explicit; never label a partial scan as the complete dataset.
  let cursor = input.cursor, complete = false, scanned = 0;
  const rows: Record<string, unknown>[] = [];
  while (rows.length < input.limit && scanned < 2000) {
    const batchSize = 200;
    let query = collectionFor(ctx, input.resource).orderBy('__name__').limit(batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) { complete = true; break; }
    for (const doc of snapshot.docs) {
      cursor = doc.id; scanned++;
      const row = { ...doc.data(), id: doc.id };
      if (!canReadResource(ctx, input.resource, row)) continue;
      if (input.resource === 'crmEvents' && !(await eventReferencesAllowed(ctx, row))) continue;
      if (input.resource === 'assistantAutomations' && (row as Record<string, any>).automation?.type === 'whatsapp_template' && !(await referencesAllowed(ctx, [{ resource: 'conversations', id: (row as Record<string, any>).automation.conversationId }]))) continue;
      const safe = safeData(row);
      if (input.search && !matchesCrmSearch(safe, input.search)) continue;
      rows.push(safe);
      if (rows.length === input.limit) break;
    }
    if (snapshot.size < batchSize && cursor === snapshot.docs.at(-1)?.id) { complete = true; break; }
  }
  return { rows, nextCursor: complete ? null : cursor || null, complete, scanned };
}
export async function readRelated(ctx: AssistantContext, input: AssistantRelated) {
  const parent = await getResource(ctx, input.resource, input.id);
  const allowed = relatedCollections(input.resource);
  if (!allowed.includes(input.collection)) throw new CommunicationError('Colecție asociată indisponibilă.');
  if (input.resource === 'sales' && input.collection === 'documents') {
    const documents = (Array.isArray(parent.checklist) ? parent.checklist : []).filter((row: any) => typeof row.id === 'string' && (!input.cursor || row.id > input.cursor)).sort((a: any, b: any) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return { rows: documents.slice(0, input.limit).map(row => safeData(row)), nextCursor: documents.length > input.limit ? documents[input.limit - 1].id : null, complete: documents.length <= input.limit };
  }
  const root = input.resource === 'portals' ? ctx.adminDb.collection('portals') : collectionFor(ctx, input.resource);
  let query = root.doc(input.id).collection(input.collection).orderBy('__name__').limit(input.limit + 1);
  if (input.cursor) query = query.startAfter(input.cursor);
  const snapshot = await query.get();
  return { rows: snapshot.docs.slice(0, input.limit).map(d => safeData({ ...d.data(), id: d.id })), nextCursor: snapshot.size > input.limit ? snapshot.docs[input.limit - 1].id : null, complete: snapshot.size <= input.limit };
}
function relatedCollections(resource: string) {
  return resource === 'assistantAutomations' ? ['audit', 'events'] : resource === 'sales' ? ['documents', 'emailMessages', 'audit'] : resource === 'portals' ? ['recommendations'] : resource === 'aiOutreachCalls' ? ['audit', 'messages'] : ['messages', 'notes'];
}
export async function readField(ctx: AssistantContext, input: z.infer<typeof fieldSchema>) {
  if (['agency', 'agents', 'notifications', 'portals'].includes(input.resource)) throw new CommunicationError('Folosește read pentru această resursă.');
  let value: any = safeData(await getResource(ctx, input.resource, input.id));
  if (input.collection || input.documentId || input.versionId) {
    if (!input.collection || !input.documentId || !['sales', 'conversations', 'aiOutreachCalls'].includes(input.resource)) throw new CommunicationError('Resursă asociată invalidă.');
    const allowed = relatedCollections(input.resource);
    if (!allowed.includes(input.collection)) throw new CommunicationError('Colecție asociată invalidă.');
    if (input.resource === 'sales' && input.collection === 'documents') {
      value = (Array.isArray(value.checklist) ? value.checklist : []).find((row: any) => row.id === input.documentId);
      if (input.versionId) value = (value?.versions || []).find((row: any) => row.id === input.versionId || String(row.version) === input.versionId);
      if (!value) throw new CommunicationError('Documentul sau versiunea nu există.', 404);
    } else {
      if (input.versionId) throw new CommunicationError('Versiunea nu este disponibilă aici.');
      const document = await collectionFor(ctx, input.resource).doc(input.id).collection(input.collection).doc(input.documentId).get();
      if (!document.exists) throw new CommunicationError('Documentul asociat nu există.', 404);
      value = safeData(document.data());
    }
  }
  for (const field of input.field) {
    if (!value || !Object.hasOwn(value, field)) throw new CommunicationError('Câmpul nu există sau nu este disponibil.', 404);
    value = value[field];
  }
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value : value && typeof value === 'object' ? Object.entries(value).map(([key, data]) => ({ key, value: data })) : [value];
  const limit = typeof entries === 'string' ? input.limit : Math.min(input.limit, 100);
  const slice = entries.slice(input.offset, input.offset + limit);
  return { value: slice, offset: input.offset, nextOffset: input.offset + limit < entries.length ? input.offset + limit : null, total: entries.length, complete: input.offset + limit >= entries.length };
}
export function actionReferences(actions: AssistantAction[]): AccessReference[] {
  return actions.flatMap(action => {
    if (action.kind === 'prepare_sale_email') return [{ resource: 'sales' as const, id: action.saleId }];
    if (action.kind === 'existing_operation') {
      const refs: AccessReference[] = [];
      for (const source of [action.params, action.body]) {
        for (const [field, resource] of [['saleId', 'sales'], ['conversationId', 'conversations']] as const) {
          if (typeof source[field] === 'string') refs.push({ resource, id: source[field] });
        }
      }
      return refs;
    }
    if ((action.kind === 'create_automation' || action.kind === 'update_automation') && action.automation) {
      if (action.automation.type === 'whatsapp_template') return [{ resource: 'conversations' as const, id: action.automation.conversationId }];
      if (action.automation.type === 'event_rule' && action.automation.trigger.resource === 'sales' && action.automation.trigger.recordId) return [{ resource: 'sales' as const, id: action.automation.trigger.recordId }];
    }
    return [];
  });
}
export async function referencesAllowed(ctx: AssistantContext, references: AccessReference[] = [], cache = new Map<string, Promise<unknown>>()) {
  for (const ref of uniqueReferences(references)) {
    if (isStepReference(ref.id)) continue; // Resolved and reauthorized by the executor.
    try {
      const key = JSON.stringify([ref.resource, ref.id]);
      if (!cache.has(key)) cache.set(key, getResource(ctx, ref.resource, ref.id));
      await cache.get(key);
    }
    catch (error) { if (error instanceof CommunicationError && [403, 404].includes(error.status)) return false; throw error; }
  }
  return true;
}
async function eventReferencesAllowed(ctx: AssistantContext, row: Record<string, any>) {
  if (ctx.role === 'admin') return true;
  const map: Record<string, string> = { saleId: 'sales', conversationId: 'conversations' };
  for (const [field, resource] of Object.entries(map)) {
    const id = row.entities?.[field];
    if (typeof id === 'string') {
      try { await getResource(ctx, resource, id); }
      catch (error) { if (error instanceof CommunicationError && [403, 404].includes(error.status)) return false; throw error; }
    }
  }
  return true;
}
