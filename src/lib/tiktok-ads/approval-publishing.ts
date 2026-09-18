import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { authorizeTikTokSpend, discoverTikTokAdsCapabilities, executeTikTokAdsOperation } from '@/lib/tiktok-ads';
import { getAdvertiser, getOwnedStudioVideoAsset, loadToolCache } from './store';
import { assertActorPolicy, assertAdvertiserWriteEligibility, assertKillSwitches } from './policy';
import { approvalCreateIntent, isApprovalAdmin, type ApprovalDraft } from './approval-model';
import { records, rowsFor, schemaInput, type TikTokRow } from './workspace-model';
import type { JsonSchema, TikTokActor, TikTokCapability } from './types';

export type PublishPreview = {
  token: string; name: string; currency: string; timezone: string; budget: string; start: string; end: string;
  group?: TikTokRow; campaign?: TikTokRow; affectedAds: Array<{ id: string; name: string }>;
  createsHierarchy: boolean; retry: boolean;
};
const draftRef = (agencyId: string, id: string) => adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').doc(id);
const enabled = (row?: TikTokRow) => !!row && /^(STATUS_)?ENABLE$/.test(row.status);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function context(agencyId: string, uid: string, role: TikTokActor['role'], draft: ApprovalDraft) {
  const actor: TikTokActor = { uid, role, type: 'human' };
  assertActorPolicy(actor, 'AD_RESUME');
  assertKillSwitches('AD_RESUME');
  // Refresh eligibility before asking for consent, not only from the workspace cache.
  for (const capability of ['ADVERTISER_STATUS', 'BILLING_READINESS'] as const) {
    const result = await executeTikTokAdsOperation({ organizationId: agencyId, actor, advertiserId: draft.advertiserId, capability, payload: {}, correlationId: randomUUID() });
    if (result.status !== 'succeeded') throw new Error('Starea contului și facturarea nu au putut fi reverificate.');
  }
  const advertiser = await getAdvertiser(agencyId, draft.advertiserId);
  assertAdvertiserWriteEligibility(advertiser);
  if (advertiser.billingReadiness !== 'ready') throw new Error('Facturarea contului trebuie verificată înainte de publicare.');
  if (!advertiser.timezone || !advertiser.currency) throw new Error('Sincronizează moneda și fusul orar.');
  const resolutions = await discoverTikTokAdsCapabilities(agencyId);
  const tools = await loadToolCache(agencyId);
  const schemas = Object.fromEntries(resolutions.flatMap(item => {
    const tool = tools.find(tool => tool.name === item.toolName);
    return tool ? [[item.capability, tool.inputSchema]] : [];
  })) as Partial<Record<TikTokCapability, JsonSchema>>;
  const invoke = (capability: TikTokCapability, payload: Record<string, unknown>, extras = {}) => executeTikTokAdsOperation({ organizationId: agencyId, actor, advertiserId: draft.advertiserId, propertyId: draft.data.propertyId, capability, payload, correlationId: randomUUID(), ...extras });
  const read = async (kind: 'campaign' | 'adgroup' | 'ad') => {
    const cap = `${kind.toUpperCase()}_READ` as TikTokCapability;
    const all = new Map<string, TikTokRow>();
    for (let page = 1; page <= 100; page++) {
      const payload = schemaInput(schemas[cap], { page_size: 100, page });
      if (page > 1 && !records(payload).some(item => item.page === page)) throw new Error('Lista TikTok este incompletă; impactul activării nu poate fi confirmat.');
      const result = await invoke(cap, payload);
      if (result.status !== 'succeeded') throw new Error('Citirea ierarhiei TikTok a eșuat.');
      const rows = rowsFor(result.remoteResult, kind);
      const previousSize = all.size;
      rows.forEach(row => all.set(row.id, row));
      const metadata = records(result.remoteResult).find(item => item.total_page != null || item.total_pages != null);
      const totalPages = Number(metadata?.total_page ?? metadata?.total_pages);
      if (Number.isFinite(totalPages) ? page >= totalPages : rows.length < 100) return [...all.values()].sort((a, b) => a.id.localeCompare(b.id));
      if (all.size === previousSize) throw new Error('Paginarea TikTok nu a avansat; publicarea este blocată preventiv.');
    }
    throw new Error('Ierarhia depășește limita de verificare. Publicarea nu a fost începută.');
  };
  return { actor, advertiser, schemas, invoke, read, resolutions };
}

async function impact(agencyId: string, uid: string, role: TikTokActor['role'], draft: ApprovalDraft) {
  const ctx = await context(agencyId, uid, role, draft);
  const property = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(draft.data.propertyId).get();
  if (!property.exists) throw new Error('Proprietatea nu mai este disponibilă în agenție.');
  let media: unknown = null;
  if (draft.data.mode === 'video') {
    const asset = await getOwnedStudioVideoAsset(agencyId, draft.data.assetId);
    if (asset.propertyId !== draft.data.propertyId) throw new Error('Videoclipul nu aparține proprietății.');
    media = asset;
  }
  const intent = approvalCreateIntent(draft.data, ctx.schemas, ctx.advertiser.timezone!);
  for (const cap of [intent.capability, 'AD_RESUME', 'ADGROUP_RESUME', 'CAMPAIGN_RESUME'] as TikTokCapability[]) {
    if (!ctx.resolutions.some(item => item.capability === cap && item.executionAllowed)) throw new Error(`Contul nu permite operația ${cap}. Verifică secțiunea Conturi.`);
  }
  let group: TikTokRow | undefined, campaign: TikTokRow | undefined;
  let affectedAds: TikTokRow[] = [];
  // On recovery, inspect the created hierarchy too, not just the original choice.
  const groupId = draft.data.adgroupId || draft.createdResources?.find(item => item.resourceType === 'adgroup')?.resourceId;
  if (groupId) {
    const [groups, campaigns, ads] = await Promise.all([ctx.read('adgroup'), ctx.read('campaign'), ctx.read('ad')]);
    group = groups.find(row => row.id === groupId);
    if (!group?.campaignId) throw new Error('Grupul și campania sa nu au fost confirmate în contul curent.');
    campaign = campaigns.find(row => row.id === group!.campaignId);
    if (!campaign) throw new Error('Campania grupului nu a fost găsită în cont.');
    if (!group.budget || group.status === 'UNKNOWN' || campaign.status === 'UNKNOWN' || ads.some(row => row.status === 'UNKNOWN' || !row.adgroupId) || groups.some(row => !row.campaignId)) throw new Error('TikTok nu a confirmat bugetul sau întreaga ierarhie. Publicarea este blocată preventiv.');
    const newlyCreated = new Set(draft.createdResources?.filter(item => item.resourceType === 'ad').map(item => item.resourceId));
    affectedAds = ads.filter(ad => {
      if (newlyCreated.has(ad.id) || !enabled(ad)) return false;
      const parent = groups.find(row => row.id === ad.adgroupId);
      return ad.adgroupId === groupId && !enabled(group) || !enabled(campaign) && parent?.campaignId === campaign!.id && enabled(parent);
    });
  }
  const snapshot = { currency: ctx.advertiser.currency, timezone: ctx.advertiser.timezone, media, intent, group: group || null, campaign: campaign || null, affectedAds };
  return { ...ctx, intent, snapshot, group, campaign, affectedAds, hash: digest(snapshot) };
}

export async function previewPublication(agencyId: string, uid: string, role: TikTokActor['role'], id: string, version: number): Promise<PublishPreview> {
  if (!isApprovalAdmin(role)) throw new Error('Doar administratorul poate publica.');
  const ref = draftRef(agencyId, id);
  const doc = await ref.get();
  const draft = { ...doc.data(), id } as ApprovalDraft;
  if (!doc.exists || draft.version !== version || !['draft', 'submitted', 'publication_failed', 'publishing'].includes(draft.status || 'draft')) throw new Error('Draftul s-a modificat sau nu poate fi publicat.');
  if (draft.publishRevision != null && draft.publisherUid !== uid) throw new Error('Reluarea trebuie confirmată de administratorul care a început publicarea.');
  if (Number(doc.data()?.leaseUntil || 0) > Date.now()) throw new Error('Publicarea este deja în curs.');
  if (draft.publishRevision == null) {
    const legacy = await adminDb.collection('agencies').doc(agencyId).collection('tiktokOperationLedger').where('idempotencyKey', '==', `draft-${id}`).limit(1).get();
    if (!legacy.empty) throw new Error('Acest draft a fost folosit în fluxul anterior de creare. Verifică reclama existentă în TikTok; nu o recrea.');
  }
  const state = await impact(agencyId, uid, role, draft);
  const token = randomUUID();
  await adminDb.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.version !== version || Number(fresh.data()?.leaseUntil || 0) > Date.now()) throw new Error('Draftul s-a modificat. Reîncarcă verificarea.');
    tx.update(ref, { confirmation: { token, uid, hash: state.hash, version, expiresAt: Date.now() + 10 * 60000 } });
  });
  return { token, name: draft.data.name, currency: state.advertiser.currency!, timezone: state.advertiser.timezone!, budget: state.group?.budget || draft.data.budget, start: state.group ? 'Programul grupului existent' : draft.data.start, end: state.group?.scheduleEnd || draft.data.end || 'Fără dată de încheiere', group: state.group, campaign: state.campaign, affectedAds: state.affectedAds.map(({ id, name }) => ({ id, name })), createsHierarchy: !draft.data.adgroupId && !draft.publishRevision, retry: draft.publishRevision != null };
}

export async function publishApprovedDraft(agencyId: string, uid: string, role: TikTokActor['role'], id: string, version: number, token: string) {
  if (!isApprovalAdmin(role)) throw new Error('Doar administratorul poate publica.');
  const ref = draftRef(agencyId, id);
  const loaded = await ref.get();
  const draft = { ...loaded.data(), id } as ApprovalDraft;
  const confirmation = loaded.data()?.confirmation;
  if (!loaded.exists || draft.version !== version || confirmation?.token !== token || confirmation?.uid !== uid || confirmation?.version !== version || confirmation?.expiresAt < Date.now()) throw new Error('Confirmarea a expirat. Verifică din nou bugetul și impactul.');
  if (draft.publishRevision != null && draft.publisherUid !== uid) throw new Error('Publicarea aparține altui administrator.');
  const state = await impact(agencyId, uid, role, draft);
  if (confirmation.hash !== state.hash) throw new Error('Starea sau bugetul din TikTok s-a modificat. Verifică din nou înainte de aprobare.');
  const lease = randomUUID();
  const revision = draft.publishRevision ?? draft.version;
  await adminDb.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || current.version !== version || current.confirmation?.token !== token || Number(current.leaseUntil || 0) > Date.now()) throw new Error('Cererea este deja procesată sau a fost modificată.');
    tx.update(ref, { status: 'publishing', version: version + 1, publishRevision: revision, publisherUid: uid, lease, leaseUntil: Date.now() + 6 * 60000, confirmation: null, publicationError: null, updatedAt: new Date().toISOString(), history: FieldValue.arrayUnion({ at: new Date().toISOString(), actorUid: uid, action: 'approve_publish', version }) });
  });
  const persist = async (patch: Record<string, unknown>) => adminDb.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.lease !== lease) throw new Error('Publicarea este gestionată de altă cerere.');
    tx.update(ref, patch);
    if (patch.status === 'published' || patch.status === 'publication_failed') {
      const eventId = `tiktok-${id}-${version + 1}-${patch.status}`;
      tx.set(adminDb.collection('users').doc(draft.ownerUid).collection('notifications').doc(eventId), { id: eventId, eventId, recipientId: draft.ownerUid, agencyId, type: 'tiktok_publication', category: 'taskUpdates', priority: patch.status === 'published' ? 'info' : 'action_required', title: patch.status === 'published' ? 'Reclama TikTok a fost publicată' : 'Publicarea TikTok necesită verificare', body: `${draft.data.name}: ${patch.status === 'published' ? 'Administratorul a aprobat și activat reclama. Livrarea depinde de TikTok.' : String(patch.publicationError)}`, actionUrl: '/marketing/tiktok-ads?tab=approvals', entityType: 'tiktokDraft', entityId: id, createdAt: FieldValue.serverTimestamp(), isRead: false });
    }
  });
  try {
    // The provider creates disabled resources internally; the same confirmed flow activates them.
    // No user-facing "publish stopped" step and no change to provider safety defaults.
    const created = await state.invoke(state.intent.capability, state.intent.payload, { idempotencyKey: `approval-${id}-${revision}` });
    await persist({ createdResources: created.createdResourceIds, operationId: created.operationId });
    if (created.status !== 'succeeded') throw new Error('Crearea necesită reconciliere în istoricul TikTok. Nu crea un draft nou pentru aceeași reclamă.');
    const adId = created.createdResourceIds.find(item => item.resourceType === 'ad')?.resourceId;
    const groupId = draft.data.adgroupId || created.createdResourceIds.find(item => item.resourceType === 'adgroup')?.resourceId;
    const campaignId = state.campaign?.id || created.createdResourceIds.find(item => item.resourceType === 'campaign')?.resourceId;
    if (!adId || !groupId || !campaignId) throw new Error('TikTok nu a confirmat toate ID-urile necesare. Verifică operația înainte de reluare.');
    // Recheck shared parents immediately before activating; a changed shared hierarchy requires fresh consent.
    if (draft.data.adgroupId) {
      const latest = await impact(agencyId, uid, role, { ...draft, createdResources: created.createdResourceIds });
      if (latest.hash !== state.hash) throw new Error('Ierarhia existentă s-a modificat în timpul creării. Confirmă din nou activarea.');
    }
    for (const [kind, resourceId] of [['ad', adId], ['adgroup', groupId], ['campaign', campaignId]] as const) {
      const current = (await state.read(kind)).find(row => row.id === resourceId);
      if (!current) throw new Error('Resursa creată nu este încă vizibilă în TikTok. Reia verificarea, fără a recrea reclama.');
      if (enabled(current)) continue;
      const capability = `${kind.toUpperCase()}_RESUME` as TikTokCapability;
      const payload = schemaInput(state.schemas[capability], { [`${kind}_id`]: resourceId, [`${kind}_ids`]: [resourceId] });
      const idempotencyKey = `approval-${id}-${revision}-${kind}`;
      const authorization = await authorizeTikTokSpend({ agencyId, actor: state.actor, advertiserId: draft.advertiserId, propertyId: draft.data.propertyId, capability, payload, idempotencyKey });
      const result = await state.invoke(capability, payload, { idempotencyKey, authorizationToken: authorization.token });
      if (result.status !== 'succeeded' || !enabled((await state.read(kind)).find(row => row.id === resourceId))) throw new Error('Activarea nu este încă confirmată de TikTok. Verifică publicarea înainte de reluare.');
    }
    await persist({ status: 'published', leaseUntil: 0, updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), history: FieldValue.arrayUnion({ at: new Date().toISOString(), actorUid: uid, action: 'published', version: version + 1 }) });
    return { status: 'published', version: version + 1, message: 'Reclama și nivelurile necesare sunt activate. Verificarea și livrarea efectivă sunt stabilite de TikTok.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publicarea nu a fost confirmată.';
    await persist({ status: 'publication_failed', leaseUntil: 0, publicationError: message, updatedAt: new Date().toISOString(), history: FieldValue.arrayUnion({ at: new Date().toISOString(), actorUid: uid, action: 'publication_failed', note: message, version: version + 1 }) });
    return { status: 'publication_failed', version: version + 1, message };
  }
}
