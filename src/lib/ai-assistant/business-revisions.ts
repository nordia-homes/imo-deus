import { getResource, type AssistantContext } from './access';
import type { AssistantAction } from './contracts';
import { recipientRevision, assertRecipientRevision } from '@/lib/communications/recipient-revision';
import { prepareMessage } from './message-preparation';

export async function bindBusinessRevisions(ctx: AssistantContext, actions: AssistantAction[]): Promise<AssistantAction[]> {
  const snapshots = new Map<string, Promise<Record<string, any>>>();
  return Promise.all(actions.map(async action => {
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
