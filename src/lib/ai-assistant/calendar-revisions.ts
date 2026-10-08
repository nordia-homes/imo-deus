import { getResource, type AssistantContext } from './access';
import type { AssistantAction } from './contracts';

// Bind the approved payload to the record seen at preparation, rather than
// silently substituting the latest revision when execution eventually starts.
export async function bindCalendarRevisions(ctx: AssistantContext, actions: AssistantAction[]): Promise<AssistantAction[]> {
  const snapshots = new Map<string, Promise<Record<string, any>>>();
  return Promise.all(actions.map(async action => {
    if (!['update_task', 'delete_task', 'update_viewing', 'delete_viewing'].includes(action.kind)) return action;
    const guarded = action as Extract<AssistantAction, { kind: 'update_task' | 'delete_task' | 'update_viewing' | 'delete_viewing' }>;
    const resource = 'taskId' in guarded ? 'tasks' : 'viewings';
    const id = 'taskId' in guarded ? guarded.taskId : guarded.viewingId;
    // Step references denote records produced within this plan, not existing
    // rows that can be read now. Execution still checks current permissions.
    if (guarded.expectedUpdatedAt === null || id.startsWith('@step:')) return action;
    const key = `${resource}/${id}`;
    if (!snapshots.has(key)) snapshots.set(key, getResource(ctx, resource, id));
    const record = await snapshots.get(key)!;
    if (guarded.expectedUpdatedAt !== undefined) {
      // Equal instants can have different ISO spellings (.000Z / Z / offset).
      // Preserve genuinely stale revisions and explicit null for the executor.
      if (typeof guarded.expectedUpdatedAt !== 'string' || typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) || Date.parse(guarded.expectedUpdatedAt) !== Date.parse(record.updatedAt)) return action;
    }
    return { ...guarded, expectedUpdatedAt: record.updatedAt || null };
  }));
}
