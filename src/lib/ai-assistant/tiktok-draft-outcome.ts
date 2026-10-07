import { getResource, type AssistantContext } from './access';
import { CommunicationError } from '@/lib/communications/server';
import { tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';

export async function tikTokDraftOutcome(ctx: AssistantContext, draftId: string, body: Record<string, unknown>, original: Record<string, any>) {
  const draft = await getResource(ctx, 'tiktokPostDrafts', draftId);
  if (draft.agencyId !== ctx.agencyId || draft.createdByUid !== ctx.uid) throw new CommunicationError('Draft inaccesibil.', 403);
  const evidence = (confirmed: boolean, note: string) => ({ executionState: confirmed ? 'succeeded' : 'unknown', completionSatisfied: confirmed, businessStatus: String(draft.status || 'unknown'), evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(), watchable: false, publicationConfirmed: false, note });
  const mismatch = () => evidence(false, 'Draftul curent nu corespunde sursei sau conținutului cerut. Pregătirea nu este confirmată; publicarea nu a fost pornită.');
  const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
  let sourceMatches = false;
  if (identifier(body.assetId)) {
    const asset = await getResource(ctx, 'tiktokStudioAssets', body.assetId);
    if (asset.agencyId !== ctx.agencyId) throw new CommunicationError('Material inaccesibil.', 403);
    sourceMatches = draft.studioAssetId === body.assetId && asset.type === 'video' && asset.status === 'ready' && draft.videoTourUrl === asset.url && typeof asset.ownerUid === 'string' && asset.ownerUid.length > 0 && draft.videoOwnerUid === asset.ownerUid && (draft.propertyId || null) === (asset.propertyId || null) && (body.propertyId === undefined || draft.propertyId === body.propertyId);
  } else if ((body.assetId == null || body.assetId === '') && identifier(body.propertyId)) {
    const property = await getResource(ctx, 'properties', body.propertyId);
    sourceMatches = !draft.studioAssetId && draft.propertyId === body.propertyId && property.videoTour?.status === 'ready' && draft.videoTourUrl === property.videoTour?.url;
  }
  let validUrl = false;
  try { const url = new URL(draft.videoTourUrl); validUrl = url.protocol === 'https:' && !url.username && !url.password; } catch { /* A draft without valid media is incomplete. */ }
  if (!sourceMatches || !validUrl || !['draft', 'ready', 'ready_to_publish'].includes(draft.status) || typeof draft.description !== 'string' || !draft.description.trim() || typeof draft.targetOpenId !== 'string' || !draft.targetOpenId.trim()) return mismatch();
  if (typeof body.description === 'string' && body.description && draft.description !== body.description.trim()) return mismatch();
  if (typeof body.privacyLevel === 'string' && body.privacyLevel && draft.privacyLevel !== body.privacyLevel) return mismatch();
  for (const field of ['disableComment', 'disableDuet', 'disableStitch', 'aiGeneratedContent', 'brandOrganic', 'brandContent']) {
    if (typeof body[field] === 'boolean' && draft[field] !== body[field]) return mismatch();
  }
  if (body.userConsent === true && (typeof draft.consentedAt !== 'string' || !Number.isFinite(Date.parse(draft.consentedAt)))) return mismatch();
  // The actual handler returns a draft snapshot. Legacy receipts without it are
  // checked against the requested fields and live source, without inventing a snapshot.
  if (original.draft && (original.draft.id !== draftId || tikTokScheduleRevision(original.draft) !== tikTokScheduleRevision(draft))) return mismatch();
  return evidence(true, 'Draftul este pregătit pentru sursa verificată. Aceasta nu confirmă programarea sau publicarea; conținutul final necesită aprobarea fluxului dedicat.');
}
