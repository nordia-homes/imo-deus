import { getResource, type AssistantContext } from './access';
import type { AssistantAction } from './contracts';
import { recipientRevision, assertRecipientRevision } from '@/lib/communications/recipient-revision';
import { prepareMessage } from './message-preparation';
import { tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';

export async function bindBusinessRevisions(ctx: AssistantContext, actions: AssistantAction[]): Promise<AssistantAction[]> {
  const snapshots = new Map<string, Promise<Record<string, any>>>();
  return Promise.all(actions.map(async action => {
    if (action.kind === 'existing_operation' && action.operation === 'tiktok_studio_render') {
      const id = action.params.projectId;
      // A project created by a prior approved step binds its version from that receipt.
      if (id?.startsWith('@step:')) return action;
      if (!id) throw new Error('Randarea necesită un proiect Studio.');
      const key = `tiktokStudioProjects/${id}`;
      if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, 'tiktokStudioProjects', id));
      const project = await snapshots.get(key)!;
      const version = project.version || 1;
      if (project.agencyId !== ctx.agencyId || project.ownerUid !== ctx.uid || !Number.isSafeInteger(version) || version < 1) throw new Error('Proiectul Studio nu este accesibil pentru randare.');
      if (action.body.expectedVersion !== undefined && action.body.expectedVersion !== version) throw new Error('Proiectul Studio s-a schimbat. Pregătește un plan nou pentru aprobare.');
      return { ...action, body: { ...action.body, expectedVersion: version } };
    }
    if (action.kind === 'existing_operation' && action.operation === 'tiktok_post_schedule') {
      const id = action.params.draftId;
      if (!id || id.startsWith('@step:')) throw new Error('Programarea TikTok necesită un draft existent. Creează draftul, apoi pregătește programarea pentru aprobare.');
      const key = `tiktokPostDrafts/${id}`;
      if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, 'tiktokPostDrafts', id));
      const draft = await snapshots.get(key)!;
      if (draft.agencyId !== ctx.agencyId || draft.createdByUid !== ctx.uid || draft.status !== 'draft' || !draft.consentedAt || !draft.description?.trim() || !draft.videoTourUrl) throw new Error('Draftul TikTok nu este pregătit sau nu aparține autorului. Verifică materialul și acordul de publicare.');
      const revision = tikTokScheduleRevision(draft);
      if (action.body.expectedDraftRevision !== undefined && action.body.expectedDraftRevision !== revision) throw new Error('Draftul TikTok s-a schimbat. Pregătește un plan nou pentru aprobare.');
      return { ...action, body: { ...action.body, expectedDraftRevision: revision, draftPreview: { description: draft.description, videoTourUrl: draft.videoTourUrl, privacyLevel: draft.privacyLevel || null, hashtags: draft.hashtags || [] } } };
    }
    if (action.kind === 'existing_operation' && action.operation === 'message_send') {
      const id = action.params.conversationId;
      if (!id || id.startsWith('@step:')) throw new Error('Mesajul necesită o conversație existentă și un destinatar concret înainte de aprobare. Creează conversația, apoi pregătește trimiterea.');
      const key = `conversations/${id}`;
      if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, 'conversations', id));
      const record = await snapshots.get(key)!;
      if (action.body.expectedRecipientRevision !== undefined) assertRecipientRevision(record, action.body.expectedRecipientRevision);
      return { ...action, body: await prepareMessage(ctx, id, { ...action.body, expectedRecipientRevision: recipientRevision(record) }) };
    }
    if (action.kind === 'existing_operation' && action.operation === 'file_apply' && action.body.destination === 'property_rlv') {
      const id = action.body.propertyId;
      if (typeof id !== 'string' || id.startsWith('@step:') || action.body.expectedUpdatedAt !== undefined) return action;
      const key = `properties/${id}`;
      if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, 'properties', id));
      const record = await snapshots.get(key)!;
      return { ...action, body: { ...action.body, expectedUpdatedAt: record.updatedAt || null } };
    }
    let resource: string, id: string;
    switch (action.kind) {
      case 'update_contact': case 'update_preferences': case 'update_offer': case 'delete_offer': case 'archive_contact': case 'portal_action': resource = 'contacts'; id = action.contactId; break;
      case 'update_property': case 'update_property_status': case 'activate_property': resource = 'properties'; id = action.propertyId; break;
      case 'assign_record': resource = action.resource; id = action.id; break;
      case 'update_prospect': resource = 'ownerListingFavorites'; id = action.listingId; break;
      case 'contract_template_action': if (action.action === 'create' || !action.templateId) return action; resource = 'contractTemplates'; id = action.templateId; break;
      default: return action;
    }
    if (action.expectedUpdatedAt !== undefined || id.startsWith('@step:')) return action;
    const key = `${resource}/${id}`;
    if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, resource, id).catch(error => { if (action.kind === 'update_prospect' && error?.status === 404) return {}; throw error; }));
    const record = await snapshots.get(key)!;
    return { ...action, expectedUpdatedAt: record.updatedAt || null };
  }));
}
