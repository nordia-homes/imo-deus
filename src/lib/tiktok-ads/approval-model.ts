import { z } from 'zod';
import { buildAdInputs, schemaMissing, type AdDraft } from './workspace-model';
import type { JsonSchema, TikTokCapability } from './types';

export const draftId = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const optionalId = z.union([draftId, z.literal('')]);
export const adDraftSchema = z.object({ name: z.string().max(512), propertyId: optionalId, assetId: optionalId, identityId: optionalId, objective: z.enum(['TRAFFIC', 'LEAD_GENERATION', 'VIDEO_VIEWS']), text: z.string().max(2200), url: z.string().max(2048), formId: optionalId, locationIds: z.array(draftId).max(100), budget: z.string().max(30), start: z.string().max(30), end: z.string().max(30), cta: z.string().max(50), mode: z.enum(['video', 'post']), postId: optionalId, adgroupId: optionalId }).strict();
export type ApprovalStatus = 'draft' | 'submitted' | 'changes_requested' | 'rejected' | 'publishing' | 'publication_failed' | 'published' | 'deleted';
export type DraftEvent = { at: string; actorUid: string; action: string; note?: string; version: number };
export type ApprovalDraft = {
  id: string; advertiserId: string; ownerUid: string; ownerName?: string; version: number; data: AdDraft;
  status?: ApprovalStatus; updatedAt?: string; history?: DraftEvent[]; feedback?: string;
  publishRevision?: number; publisherUid?: string; publicationError?: string;
  createdResources?: Array<{ resourceType: string; resourceId: string }>;
};
export const approvalLabels: Record<ApprovalStatus, string> = { draft: 'Draft', submitted: 'În așteptarea aprobării', changes_requested: 'Modificări cerute', rejected: 'Respins', publishing: 'În curs de publicare', publication_failed: 'Publicare de verificat', published: 'Publicat · livrarea depinde de TikTok', deleted: 'Șters' };
export const isApprovalAdmin = (role?: string) => role === 'admin' || role === 'platform_admin';
export const canEditApproval = (draft: Pick<ApprovalDraft, 'status' | 'publishRevision'>) => draft.publishRevision == null && ['draft', 'changes_requested', 'rejected'].includes(draft.status || 'draft');

export function assertDraftAction(draft: ApprovalDraft, uid: string, role: string | undefined, action: string, note = '') {
  if (role !== 'agent' && !isApprovalAdmin(role)) throw new Error('Rolul nu permite gestionarea drafturilor.');
  if (!['submit', 'withdraw', 'request_changes', 'reject', 'delete'].includes(action)) throw new Error('Acțiune necunoscută.');
  if (!isApprovalAdmin(role) && draft.ownerUid !== uid) throw new Error('Draftul nu îți aparține.');
  if (action === 'submit' && !canEditApproval(draft)) throw new Error('Această versiune nu poate fi trimisă.');
  if (action === 'withdraw' && draft.status !== 'submitted') throw new Error('Doar o cerere trimisă poate fi retrasă.');
  if (['request_changes', 'reject'].includes(action)) {
    if (!isApprovalAdmin(role) || draft.status !== 'submitted') throw new Error('Decizia necesită un administrator și o cerere trimisă.');
    if (!note.trim()) throw new Error('Completează motivul deciziei.');
  }
  if (action === 'delete' && !canEditApproval(draft)) throw new Error('Retrage cererea înainte de ștergere. Publicările începute nu pot fi șterse ca drafturi.');
}

export function validateApprovalDraft(value: AdDraft) {
  adDraftSchema.parse(value);
  if (!value.name.trim() || !value.propertyId || !value.identityId || !value.text.trim()) throw new Error('Completează proprietatea, profilul, numele și textul reclamei.');
  if (value.mode === 'video' && !value.assetId) throw new Error('Selectează videoclipul.');
  if (value.mode === 'post' && (!value.postId || !value.adgroupId)) throw new Error('Selectează postarea și grupul.');
  if (value.objective === 'TRAFFIC' && !/^https:\/\//.test(value.url)) throw new Error('Destinația trebuie să fie HTTPS.');
  if (value.objective === 'LEAD_GENERATION' && !value.formId) throw new Error('Selectează formularul.');
  if (!value.adgroupId) {
    if (!/^\d+(\.\d{1,4})?$/.test(value.budget) || Number(value.budget) <= 0 || !value.locationIds.length || !value.start) throw new Error('Completează bugetul, locațiile și programul.');
    if (value.end && value.end <= value.start) throw new Error('Programul nu este valid.');
  }
}

export function approvalCreateIntent(draft: AdDraft, schemas: Partial<Record<TikTokCapability, JsonSchema>>, timezone: string) {
  validateApprovalDraft(draft);
  const input = buildAdInputs(draft, schemas, timezone);
  const caps: TikTokCapability[] = ['AD_CREATE', ...(draft.mode === 'video' ? ['CREATIVE_UPLOAD', ...(!draft.adgroupId ? ['CAMPAIGN_CREATE', 'ADGROUP_CREATE'] : [])] as TikTokCapability[] : [])];
  const values = { AD_CREATE: input.ad, CREATIVE_UPLOAD: input.video, CAMPAIGN_CREATE: input.campaign, ADGROUP_CREATE: input.adGroup };
  const missing = caps.flatMap(cap => schemaMissing(schemas[cap], values[cap as keyof typeof values], ['advertiser_id', 'advertiser_ids', 'campaign_id', 'adgroup_id', 'video_id', 'identity_id', 'identity_type', 'identity_authorized_bc_id', 'video_url', 'operation_status', 'dark_post_status']));
  if (missing.length) throw new Error(`Configurația TikTok cere câmpuri suplimentare: ${missing.join(', ')}.`);
  return {
    capability: (draft.mode === 'video' ? 'SPARK_NEW_VIDEO_AD_ONLY' : 'SPARK_EXISTING_POST') as TikTokCapability,
    payload: draft.mode === 'video'
      ? { adsOnly: true, tiktokAccountId: draft.identityId, permissionToolInput: {}, ...(!draft.adgroupId ? { campaign: input.campaign, adGroup: input.adGroup } : {}), video: { mediaAssetId: draft.assetId, toolInput: input.video }, ad: input.ad }
      : { tiktokAccountId: draft.identityId, permissionToolInput: {}, ad: input.ad },
  };
}
