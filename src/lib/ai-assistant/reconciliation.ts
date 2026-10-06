import { createHash } from 'node:crypto';
import { z } from 'zod';
import { collectionFor, canReadResource, type AssistantContext } from './access';
import { CommunicationError } from '@/lib/communications/server';
const resources = ['contacts', 'properties', 'tasks', 'viewings', 'sales', 'ownerListingFavorites', 'conversations', 'aiOutreachCalls', 'metaCampaignDrafts', 'tiktokPostDrafts', 'tiktokStudioProjects', 'tiktokStudioAssets', 'generatedContracts'] as const;
export const reconciliationSchema = z.object({ resource: z.enum(resources), cursor: z.string().max(2000).optional(), limit: z.number().int().min(1).max(50).default(20) }).strict();
const entityFields: Record<string, string> = { contacts: 'contactId', properties: 'propertyId', tasks: 'taskId', viewings: 'viewingId', sales: 'saleId', ownerListingFavorites: 'listingId', conversations: 'conversationId', aiOutreachCalls: 'callId', metaCampaignDrafts: 'campaignId', tiktokPostDrafts: 'draftId', tiktokStudioProjects: 'projectId', tiktokStudioAssets: 'assetId', generatedContracts: 'contractId' };
export async function reconcileCrmHistory(ctx: AssistantContext, input: z.infer<typeof reconciliationSchema>) {
  const fingerprint = createHash('sha256').update(JSON.stringify([ctx.uid, ctx.role, ctx.agencyId, input.resource])).digest('hex');
  const cursor = input.cursor ? z.object({ fingerprint: z.literal(fingerprint), id: z.string().min(1).max(180) }).strict().parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString())) : null;
  let query = collectionFor(ctx, input.resource).orderBy('__name__').limit(input.limit + 1);
  if (cursor) query = query.startAfter(cursor.id);
  const page = await query.get(), docs = page.docs.slice(0, input.limit);
  let reconciled = 0, current = 0, inaccessible = 0;
  for (const doc of docs) {
    const checkpoint = collectionFor(ctx, 'crmProjectionCheckpoints').doc(`${input.resource}-${doc.id}`);
    const result = await ctx.adminDb.runTransaction(async tx => {
      const [member, fresh, previous] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(doc.ref), tx.get(checkpoint)]);
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
      if (!fresh.exists || !canReadResource(ctx, input.resource, fresh.data()!)) return 'inaccessible';
      const sourceUpdatedAt = fresh.updateTime!.toDate().toISOString(), sourceVersion = `${String(fresh.updateTime!.seconds).padStart(12, '0')}:${String(fresh.updateTime!.nanoseconds).padStart(9, '0')}`;
      if (previous.data()?.sourceVersion === sourceVersion) return 'current';
      const key = 'snapshot-' + createHash('sha256').update(JSON.stringify([input.resource, doc.id, sourceUpdatedAt])).digest('hex');
      const event = collectionFor(ctx, 'crmEvents').doc(key), existing = await tx.get(event), now = new Date().toISOString(), row = fresh.data()!;
      const state = Object.fromEntries(['status', 'stage', 'agentId', 'price', 'budget', 'viewingDate', 'collaborationStatus', 'contactOutcome'].filter(field => ['string', 'number', 'boolean'].includes(typeof row[field]) || row[field] === null).map(field => [field, row[field]]));
      if (!existing.exists) tx.create(event, { id: key, agencyId: ctx.agencyId, actorId: ctx.uid, actorEvidence: 'reconciler_not_original_actor', source: 'reconciled_snapshot', capability: `${input.resource}.snapshot`, occurredAt: now, recordedAt: now, sourceUpdatedAt, entities: { [entityFields[input.resource]]: doc.id }, state, note: 'Snapshot observat acum. Nu reconstruiește acțiuni, actori sau ștergeri istorice care nu au fost înregistrate.', visibility: { resource: input.resource, agencyId: ctx.agencyId, agentId: row.agentId || null, collaboratorIds: row.collaboratorIds || [] } });
      tx.set(checkpoint, { resource: input.resource, recordId: doc.id, sourceUpdatedAt, sourceVersion, source: 'reconciled_snapshot', checkedAt: now, eventId: key });
      return 'reconciled';
    });
    if (result === 'reconciled') reconciled++; else if (result === 'current') current++; else inaccessible++;
  }
  const complete = page.size <= input.limit;
  return { resource: input.resource, scanned: docs.length, reconciled, current, inaccessible, complete, nextCursor: complete ? null : Buffer.from(JSON.stringify({ fingerprint, id: docs.at(-1)!.id })).toString('base64url'), checkedAt: new Date().toISOString(), note: 'Reconciliere a stării actuale autorizate. Istoricul păstrat în entități și audituri se citește prin timeline; acțiunile vechi neînregistrate nu pot fi reconstruite.' };
}
