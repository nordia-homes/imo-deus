import type { AssistantAction } from './contracts';

// Only mutations whose transaction checks and advances updatedAt participate.
export function revisionTarget(action: AssistantAction): { resource: string; id: string } | undefined {
  switch (action.kind) {
    case 'existing_operation':
      if (action.operation === 'file_apply' && action.body.destination === 'property_rlv' && typeof action.body.propertyId === 'string') return { resource: 'properties', id: action.body.propertyId };
      return;
    case 'update_contact': case 'update_preferences': case 'update_offer': case 'delete_offer': case 'archive_contact': case 'portal_action':
      return { resource: 'contacts', id: action.contactId };
    case 'update_property': case 'update_property_status': case 'activate_property':
      return { resource: 'properties', id: action.propertyId };
    case 'update_task': case 'delete_task': return { resource: 'tasks', id: action.taskId };
    case 'update_viewing': case 'delete_viewing': return { resource: 'viewings', id: action.viewingId };
    case 'assign_record': return { resource: action.resource, id: action.id };
    case 'update_prospect': return { resource: 'ownerListingFavorites', id: action.listingId };
    case 'contract_template_action':
      if (action.action !== 'create' && action.templateId) return { resource: 'contractTemplates', id: action.templateId };
  }
}

// Derive a precondition from committed receipts within this plan, never from a
// fresh read that could silently approve somebody else's intervening changes.
export function continuePlanRevision(action: AssistantAction, previous: Record<string, unknown>[]): AssistantAction {
  const target = revisionTarget(action);
  const expected = action.kind === 'existing_operation' ? action.body.expectedUpdatedAt : 'expectedUpdatedAt' in action ? action.expectedUpdatedAt : undefined;
  if (!target || expected === undefined) return action;
  const revisions = previous.flatMap(step => {
    const receipt = (step.result as Record<string, any> | undefined)?.mutationRevision;
    return receipt?.resource === target.resource && receipt?.id === target.id &&
      (receipt.before === null || typeof receipt.before === 'string') && typeof receipt.after === 'string' ? [receipt] : [];
  });
  const latest = revisions.at(-1);
  if (!latest) return action;
  let before = latest.after;
  for (const receipt of revisions.reverse()) {
    if (receipt.after !== before) return action;
    if (receipt.before === expected) return action.kind === 'existing_operation' ? { ...action, body: { ...action.body, expectedUpdatedAt: latest.after } } : { ...action, expectedUpdatedAt: latest.after } as AssistantAction;
    before = receipt.before;
  }
  return action;
}
