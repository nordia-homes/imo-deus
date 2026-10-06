import { getAuth } from 'firebase-admin/auth';
import { createHash, randomUUID } from 'node:crypto';
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
  const checkpoint = db.collection('agencies').doc(agencyId).collection('crmProjectionCheckpoints').doc(`${resource}-${recordId}`);
  const timestamp = after ? event.data.after.updateTime : undefined;
  const sourceUpdatedAt = timestamp?.toDate().toISOString() || event.time;
  const sourceVersion = timestamp ? `${String(timestamp.seconds).padStart(12, '0')}:${String(timestamp.nanoseconds).padStart(9, '0')}` : `${String(Math.floor(Date.parse(event.time) / 1000)).padStart(12, '0')}:${(event.time.match(/\.(\d+)Z$/)?.[1] || '0').padEnd(9, '0').slice(0, 9)}`;
  const ruleState = (value: Record<string, unknown> | undefined) => Object.fromEntries(['status', 'stage', 'agentId', 'collaborationStatus', 'contactOutcome', 'viewingDate', 'price', 'budget', 'financingType'].filter(field => typeof value?.[field] === 'string' || typeof value?.[field] === 'number' || value?.[field] === null).map(field => [field, value?.[field]]));
  await db.runTransaction(async tx => {
    const [priorEvent, priorCheckpoint] = await Promise.all([tx.get(ref), tx.get(checkpoint)]);
    if (priorEvent.exists) return;
    if (!priorCheckpoint.exists || String(priorCheckpoint.data()?.sourceVersion || '') <= sourceVersion) tx.set(checkpoint, { resource, recordId, sourceUpdatedAt, sourceVersion, source: 'firestore_change', checkedAt: new Date().toISOString(), eventId: id, deleted: !after });
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
  // Prepared media can be reused across modules (e.g. a property video in TikTok).
  // Cache an agency-wide reference scan; an incomplete scan never authorizes deletion.
  const mediaReferences = new Map<string, Promise<Set<string> | null>>();
  const referencedMedia = (agencyId: string) => {
    if (!mediaReferences.has(agencyId)) mediaReferences.set(agencyId, (async () => {
      const urls = new Set<string>();
      const collect = (value: unknown, depth = 0) => {
        if (depth > 12) return;
        if (typeof value === 'string' && value.startsWith('https://firebasestorage.googleapis.com/')) urls.add(value);
        else if (Array.isArray(value)) value.forEach(item => collect(item, depth + 1));
        else if (value && typeof value === 'object') Object.values(value).forEach(item => collect(item, depth + 1));
      };
      for (const resource of ['properties', 'metaCampaignDrafts', 'tiktokStudioAssets', 'tiktokStudioProjects', 'tiktokPostDrafts']) {
        const collection = db.collection('agencies').doc(agencyId).collection(resource);
        let cursor: string | undefined, inspected = 0;
        while (true) {
          let query = collection.orderBy('__name__').limit(1000);
          if (cursor) query = query.startAfter(cursor);
          const page = await query.get(); inspected += page.size;
          for (const row of page.docs) collect(row.data());
          if (page.size < 1000) break;
          if (inspected >= 10000) return null;
          cursor = page.docs.at(-1)!.id;
        }
      }
      return urls;
    })());
    return mediaReferences.get(agencyId)!;
  };
  const expired = await db.collectionGroup('assistantUploads').where('expiresAt', '<=', Date.now()).limit(200).get();
  for (const doc of expired.docs) {
    const row = doc.data(), agencyId = doc.ref.parent.parent?.id;
    if (!agencyId || typeof row.ownerId !== 'string' || row.storagePath !== `agencies/${agencyId}/privateCommunications/assistant-uploads/${row.ownerId}/${doc.id}`) continue;
    for (const [key, target] of Object.entries(row.assetTargets || {}) as [string, { storagePath?: string; executionKey?: string; kind?: string; purpose?: string; targetId?: string; url?: string }][]) {
      if (!/^asset-[a-f0-9]{64}$/.test(key) || target.executionKey !== key || typeof target.storagePath !== 'string') continue;
      const prefix = `agencies/${agencyId}/properties/`;
      const brandingPrefix = `agencies/${agencyId}/branding/${row.ownerId}/`;
      const propertyAsset = target.storagePath.startsWith(prefix) && /^[^/]+\/(property_image|property_rlv)\/asset-[a-f0-9]{64}\.(webp|pdf)$/.test(target.storagePath.slice(prefix.length));
      const brandAsset = target.storagePath.startsWith(brandingPrefix) && /^(profile_photo|agency_logo|agency_share_image)\/asset-[a-f0-9]{64}\.webp$/.test(target.storagePath.slice(brandingPrefix.length));
      const preparedPrefix = `agencies/${agencyId}/preparedMedia/${row.ownerId}/`;
      const prepared = target.kind === 'prepared_media' && target.storagePath.startsWith(preparedPrefix)
        && new RegExp(`^${key}\\.(webp|mp4|webm|mov)$`).test(target.storagePath.slice(preparedPrefix.length));
      if (prepared) {
        // Keep adopted assets. Do not delete on a failed verification read.
        const url = target.url;
        if (typeof url !== 'string' || !url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${getStorage().bucket().name}/o/${encodeURIComponent(target.storagePath)}?alt=media&token=`)) continue;
        let adopted = false;
        const agency = db.collection('agencies').doc(agencyId);
        if (target.targetId && !target.targetId.includes('/') && ['property_media', 'video_tour'].includes(target.purpose || '')) {
          const property = (await agency.collection('properties').doc(target.targetId).get()).data();
          adopted = !!property && (property.images?.some((image: { url?: string }) => image.url === url) || property.uploadedVideo?.url === url || property.videoTour?.url === url || property.videoTour?.thumbnailUrl === url);
        } else if (target.targetId && !target.targetId.includes('/') && target.purpose === 'meta_media') {
          const campaign = (await agency.collection('metaCampaignDrafts').doc(target.targetId).get()).data();
          adopted = !!campaign && (campaign.imageUrl === url || campaign.videoUrl === url || campaign.mediaItems?.some((item: { url?: string; thumbnailUrl?: string }) => item.url === url || item.thumbnailUrl === url));
        } else if (target.purpose === 'tiktok_media') {
          const assets = await agency.collection('tiktokStudioAssets').where('url', '==', url).limit(1).get();
          adopted = !assets.empty;
        }
        if (!adopted) {
          const references = await referencedMedia(agencyId);
          if (references && !references.has(url)) await getStorage().bucket().file(target.storagePath).delete({ ignoreNotFound: true });
        }
        continue;
      }
      if (!propertyAsset && !brandAsset) continue;
      const ledger = await db.collection('agencies').doc(agencyId).collection('assistantExecutions').doc(key).get();
      if (ledger.data()?.status !== 'completed') await getStorage().bucket().file(target.storagePath).delete({ ignoreNotFound: true });
    }
    await getStorage().bucket().file(row.storagePath).delete({ ignoreNotFound: true });
    await doc.ref.delete();
  }
});

// Retries Auth displayName separately from the committed CRM profile.
export const jarvisAuthProfileSync = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Europe/Bucharest', region: 'us-central1', timeoutSeconds: 300 }, async () => {
  const jobs = await db.collection('authProfileSync').where('status', 'in', ['pending', 'running']).limit(100).get();
  for (const job of jobs.docs) {
    const claimId = randomUUID();
    const claim = await db.runTransaction(async tx => {
      const [fresh, user] = await Promise.all([tx.get(job.ref), tx.get(db.collection('users').doc(job.id))]);
      const row = fresh.data();
      if (!row || row.status === 'completed' || row.status === 'running' && row.leaseUntil > Date.now()) return null;
      if (user.data()?.agencyId !== row.agencyId || !['agent', 'admin'].includes(user.data()?.role)) {
        tx.update(job.ref, { status: 'blocked', errorCategory: 'profile_removed_or_access_changed' }); return null;
      }
      tx.update(job.ref, { status: 'running', claimId, leaseUntil: Date.now() + 300000 });
      return { revision: row.revision, name: String(user.data()?.name || '') };
    });
    if (!claim) continue;
    let status = 'completed', errorCategory: string | null = null;
    try { await getAuth().updateUser(job.id, { displayName: claim.name }); }
    catch { status = 'pending'; errorCategory = 'auth_profile_update_failed'; }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(job.ref);
      if (fresh.data()?.claimId === claimId) tx.update(job.ref, { status: fresh.data()?.revision === claim.revision ? status : 'pending', errorCategory, leaseUntil: 0, attemptedAt: new Date().toISOString() });
    });
  }
  const deletions = await db.collection('authAccountDeletions').where('status', 'in', ['pending', 'running']).limit(50).get();
  for (const job of deletions.docs) {
    const claimId = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const [fresh, user] = await Promise.all([tx.get(job.ref), tx.get(db.collection('users').doc(job.id))]);
      if (!fresh.exists || fresh.data()?.status === 'completed' || fresh.data()?.status === 'running' && fresh.data()?.leaseUntil > Date.now()) return false;
      if (user.exists) { tx.update(job.ref, { status: 'blocked', errorCategory: 'profile_restored' }); return false; }
      tx.update(job.ref, { status: 'running', claimId, leaseUntil: Date.now() + 300000 }); return true;
    });
    if (!claimed) continue;
    let status = 'completed';
    try { await getAuth().deleteUser(job.id); }
    catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') status = 'pending'; }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(job.ref);
      if (fresh.data()?.claimId === claimId) tx.update(job.ref, { status, leaseUntil: 0, attemptedAt: new Date().toISOString(), errorCategory: status === 'pending' ? 'auth_account_delete_failed' : null });
    });
  }

});
