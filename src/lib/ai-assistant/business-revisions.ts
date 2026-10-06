import { getResource, type AssistantContext } from './access';
import type { AssistantAction } from './contracts';

export async function bindBusinessRevisions(ctx: AssistantContext, actions: AssistantAction[]): Promise<AssistantAction[]> {
  const snapshots = new Map<string, Promise<Record<string, any>>>();
  return Promise.all(actions.map(async action => {
    if (action.kind !== 'update_contact' && action.kind !== 'update_preferences' && action.kind !== 'update_property') return action;
    const resource = action.kind === 'update_property' ? 'properties' : 'contacts';
    const id = action.kind === 'update_property' ? action.propertyId : action.contactId;
    if (action.expectedUpdatedAt !== undefined || id.startsWith('@step:')) return action;
    const key = `${resource}/${id}`;
    if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, resource, id));
    const record = await snapshots.get(key)!;
    return { ...action, expectedUpdatedAt: record.updatedAt || null };
  }));
}
