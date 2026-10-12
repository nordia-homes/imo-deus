import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { canExecutePreparedProspecting, uniqueProspectingProposals } from '../prospecting-plan';
import type { AssistantAction } from '../contracts';
import type { GoalCoverage } from '../goal-coverage';
const prompt = 'Găsește 3 apartamente și contactează proprietarii pe WhatsApp';
const message = (id: string): AssistantAction => ({ kind: 'existing_operation', operation: 'message_send', params: { conversationId: id }, query: {}, body: { template: { name: 'colaborare' }, sendApproval: { amountMicros: 500000 }, prospectingConsentReceiptId: 'server-receipt' } });
const coverage: GoalCoverage = { requirements: [
  { id: 'send', sourceQuote: 'contactează proprietarii', description: 'Trimite proprietarilor eligibili', resolution: 'planned', steps: [1, 2], evidenceCallIds: [] },
  { id: 'missing', sourceQuote: 'contactează proprietarii', description: 'Lipsește telefonul celui de-al treilea proprietar', resolution: 'needs_clarification', steps: [], evidenceCallIds: [] },
] };
it('allows independently prepared messages when another recipient needs clarification', () => {
  expect(canExecutePreparedProspecting(prompt, 'clarification', [message('a'), message('b')], coverage)).toBe(true);
});
it.each(['partial', 'failed', 'refused', 'pending'])('does not execute after %s planning', status => {
  expect(canExecutePreparedProspecting(prompt, status, [message('a'), message('b')], coverage)).toBe(false);
});
it('requires the user request, verified preparation and coverage of every message', () => {
  expect(canExecutePreparedProspecting('Nu contacta proprietarii pe WhatsApp', 'clarification', [message('a')], coverage)).toBe(false);
  expect(canExecutePreparedProspecting(prompt, 'clarification', [message('a')])).toBe(false);
  expect(canExecutePreparedProspecting(prompt, 'clarification', [message('a'), message('b'), message('c')], coverage)).toBe(false);
  expect(canExecutePreparedProspecting(prompt, 'clarification', [{ ...message('a'), body: {} } as AssistantAction], coverage)).toBe(false);
  expect(canExecutePreparedProspecting(prompt, 'clarification', [{ kind: 'create_task', description: 'Sună', dueDate: '2030-01-01', duration: 30 }], coverage)).toBe(false);
});
it('reuses prior recipient steps and adds only previously unprepared recipients', () => {
  const result = uniqueProspectingProposals([message('a'), message('b')], [message('b'), message('c'), message('a'), message('c')]);
  expect(result.actions).toEqual([message('c')]);
  expect(result.reusedSteps).toEqual([2, 1, 3]);
  expect(uniqueProspectingProposals([message('a')], [message('a')])).toEqual({ actions: [], reusedSteps: [1] });
});
it('leaves mixed plans intact so positional dependencies keep their meaning', () => {
  const actions: AssistantAction[] = [message('a'), { kind: 'create_task', description: 'Sună', dueDate: '2030-01-01', duration: 30 }];
  expect(uniqueProspectingProposals([message('a')], actions)).toEqual({ actions, reusedSteps: [] });
});
