import type { AssistantAction } from './contracts';
import type { GoalCoverage } from './goal-coverage';
import { requestsWhatsappProspecting } from './prospecting-consent';

export function canExecutePreparedProspecting(prompt: string, status: string, actions: AssistantAction[], coverage?: GoalCoverage) {
  if (!requestsWhatsappProspecting(prompt) || !['success', 'clarification'].includes(status) || !actions.length || !coverage) return false;
  const covered = new Set(coverage.requirements.filter(row => row.resolution === 'planned').flatMap(row => row.steps));
  return actions.every((action, index) => covered.has(index + 1) && action.kind === 'existing_operation' && action.operation === 'message_send'
    && Boolean(action.params.conversationId) && Boolean(action.body.prospectingConsentReceiptId) && Boolean(action.body.sendApproval) && Boolean(action.body.template));
}

// Only new, independent prospecting messages can be removed without shifting dependencies.
export function uniqueProspectingProposals(existing: AssistantAction[], incoming: AssistantAction[]) {
  if (!incoming.length || !incoming.every(action => action.kind === 'existing_operation' && action.operation === 'message_send' && action.body.prospectingConsentReceiptId)) return { actions: incoming, reusedSteps: [] as number[] };
  const recipients = new Map<string, number>();
  existing.forEach((action, index) => { if (action.kind === 'existing_operation' && action.operation === 'message_send' && action.body.prospectingConsentReceiptId) recipients.set(action.params.conversationId, index + 1); });
  const actions: AssistantAction[] = [], reusedSteps: number[] = [];
  for (const action of incoming) {
    if (action.kind !== 'existing_operation') continue;
    const previous = recipients.get(action.params.conversationId);
    if (previous !== undefined) { reusedSteps.push(previous); continue; }
    actions.push(action);
    recipients.set(action.params.conversationId, existing.length + actions.length);
  }
  return { actions, reusedSteps: [...new Set(reusedSteps)] };
}
