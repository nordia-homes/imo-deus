import type { AssistantContext } from './access';
import type { AssistantAction } from './contracts';
import { bindBusinessRevisions } from './business-revisions';
import { requestsWhatsappProspecting } from './prospecting-consent';
import { uniqueProspectingProposals } from './prospecting-plan';

export async function prepareProspectingBatch(ctx: AssistantContext, proposed: AssistantAction[]) {
  const independent = requestsWhatsappProspecting(ctx.prospectingRequest?.prompt || '') && proposed.length > 0
    && proposed.every(action => action.kind === 'existing_operation' && action.operation === 'message_send'
      && typeof action.body.prospectingListingId === 'string' && Boolean(action.body.template))
    && !JSON.stringify(proposed).includes('@step:');
  if (!independent) return { actions: await bindBusinessRevisions(ctx, proposed), blockedProspects: [], preparedListingIds: [] };
  const actions: AssistantAction[] = [], blocked = new Map<string, string>(), preparedListingIds: string[] = [];
  for (const action of proposed) {
    if (action.kind !== 'existing_operation') continue;
    const listingId = String(action.body.prospectingListingId);
    try {
      const prepared = await bindBusinessRevisions(ctx, [action]);
      actions.push(...uniqueProspectingProposals(actions, prepared).actions);
      preparedListingIds.push(listingId);
      blocked.delete(listingId);
    } catch (error) {
      blocked.set(listingId, error instanceof Error ? error.message : 'Mesajul nu a putut fi pregătit.');
    }
  }
  return { actions, blockedProspects: [...blocked].map(([listingId, reason]) => ({ listingId, reason })), preparedListingIds };
}
