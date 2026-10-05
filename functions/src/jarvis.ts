import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
if (!getApps().length) initializeApp();
const db = getFirestore();
const idFields: Record<string, string> = { contacts: 'contactId', properties: 'propertyId', tasks: 'taskId', viewings: 'viewingId', sales: 'saleId', conversations: 'conversationId', aiOutreachCalls: 'callId', ownerListingFavorites: 'listingId', storiaInboxLeads: 'leadId', metaCampaignDrafts: 'campaignId', tiktokPostDrafts: 'draftId', tiktokStudioProjects: 'projectId', tiktokStudioAssets: 'assetId', generatedContracts: 'contractId' };

// Records change metadata, never credentials, documents, transcripts or whole rows.
// Eventarc can deliver twice or out of order: the original event ID/time is retained.
export const jarvisCrmChangeProjection = onDocumentWritten({ document: 'agencies/{agencyId}/{resource}/{recordId}', region: 'us-central1', retry: true }, async event => {
  const { agencyId, resource, recordId } = event.params;
  if (!idFields[resource] || !event.data) return;
  const before = event.data.before.data(), after = event.data.after.data(), row = after || before || {};
  const id = 'change-' + createHash('sha256').update(event.id).digest('hex');
  const changedFields = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(field => !/secret|token|password|credential|private|api.?key/i.test(field) && JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
  const entities: Record<string, string> = { [idFields[resource]]: recordId };
  for (const field of ['contactId', 'propertyId', 'conversationId', 'saleId']) if (typeof row[field] === 'string' && row[field]) entities[field] = row[field];
  const ref = db.collection('agencies').doc(agencyId).collection('crmEvents').doc(id);
  const ruleState = (value: Record<string, unknown> | undefined) => Object.fromEntries(['status', 'stage', 'agentId', 'collaborationStatus', 'contactOutcome', 'viewingDate', 'price', 'budget', 'financingType'].filter(field => typeof value?.[field] === 'string' || typeof value?.[field] === 'number' || value?.[field] === null).map(field => [field, value?.[field]]));
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { id, agencyId, source: 'firestore_change', capability: resource + '.' + (!before ? 'created' : !after ? 'deleted' : 'updated'),
      occurredAt: event.time, recordedAt: new Date().toISOString(), providerEventId: event.id, entities, changedFields: changedFields.slice(0, 120),
      ruleState: { before: ruleState(before), after: ruleState(after) },
      actorId: null, actorEvidence: 'not_recorded_by_source',
      visibility: { resource, agencyId, agentId: row.agentId || null, assigneeId: row.assigneeId || null, collaboratorIds: Array.isArray(row.collaboratorIds) ? row.collaboratorIds : [] } });
  });
});

export const jarvisAgencyChangeProjection = onDocumentWritten({ document: 'agencies/{agencyId}', region: 'us-central1', retry: true }, async event => {
  if (!event.data) return;
  const before = event.data.before.data(), after = event.data.after.data();
  const changedFields = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter(field => !/secret|token|password|credential|private|api.?key/i.test(field) && JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
  const id = 'change-' + createHash('sha256').update(event.id).digest('hex');
  const ref = db.collection('agencies').doc(event.params.agencyId).collection('crmEvents').doc(id);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { id, agencyId: event.params.agencyId, source: 'firestore_change', capability: 'agency.updated', occurredAt: event.time, recordedAt: new Date().toISOString(), providerEventId: event.id, changedFields: changedFields.slice(0, 120), entities: {}, actorId: null, actorEvidence: 'not_recorded_by_source', visibility: { resource: 'agency', agencyId: event.params.agencyId } });
  });
});

export const jarvisUserChangeProjection = onDocumentWritten({ document: 'users/{userId}/{resource}/{recordId}', region: 'us-central1', retry: true }, async event => {
  if (!event.data || !['notificationPreferences', 'notifications', 'messagingRegistrations'].includes(event.params.resource)) return;
  const profile = (await db.collection('users').doc(event.params.userId).get()).data();
  if (!profile?.agencyId || !['agent', 'admin'].includes(profile.role)) return;
  const id = 'change-' + createHash('sha256').update(event.id).digest('hex');
  const ref = db.collection('agencies').doc(profile.agencyId).collection('crmEvents').doc(id);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { id, agencyId: profile.agencyId, source: 'firestore_change', capability: event.params.resource + '.changed', occurredAt: event.time, recordedAt: new Date().toISOString(), providerEventId: event.id, entities: { userId: event.params.userId }, actorId: null, actorEvidence: 'not_recorded_by_source', visibility: { resource: event.params.resource, ownerId: event.params.userId, agencyId: profile.agencyId } });
  });
});

export const jarvisUploadRetention = onSchedule({ schedule: 'every 24 hours', timeZone: 'Europe/Bucharest', region: 'us-central1', timeoutSeconds: 300 }, async () => {
  const expired = await db.collectionGroup('assistantUploads').where('expiresAt', '<=', Date.now()).limit(200).get();
  for (const doc of expired.docs) {
    const row = doc.data(), agencyId = doc.ref.parent.parent?.id;
    if (!agencyId || typeof row.ownerId !== 'string' || row.storagePath !== `agencies/${agencyId}/privateCommunications/assistant-uploads/${row.ownerId}/${doc.id}`) continue;
    for (const [key, target] of Object.entries(row.assetTargets || {}) as [string, { storagePath?: string; executionKey?: string }][]) {
      if (!/^asset-[a-f0-9]{64}$/.test(key) || target.executionKey !== key || typeof target.storagePath !== 'string') continue;
      const prefix = `agencies/${agencyId}/properties/`;
      const brandingPrefix = `agencies/${agencyId}/branding/${row.ownerId}/`;
      const propertyAsset = target.storagePath.startsWith(prefix) && /^[^/]+\/(property_image|property_rlv)\/asset-[a-f0-9]{64}\.(webp|pdf)$/.test(target.storagePath.slice(prefix.length));
      const brandAsset = target.storagePath.startsWith(brandingPrefix) && /^(profile_photo|agency_logo)\/asset-[a-f0-9]{64}\.webp$/.test(target.storagePath.slice(brandingPrefix.length));
      if (!propertyAsset && !brandAsset) continue;
      const ledger = await db.collection('agencies').doc(agencyId).collection('assistantExecutions').doc(key).get();
      if (ledger.data()?.status !== 'completed') await getStorage().bucket().file(target.storagePath).delete({ ignoreNotFound: true });
    }
    await getStorage().bucket().file(row.storagePath).delete({ ignoreNotFound: true });
    await doc.ref.delete();
  }
});
