import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../business-revisions', () => ({ bindBusinessRevisions: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { bindBusinessRevisions } from '../business-revisions';
import { prepareProspectingBatch } from '../prospecting-batch';
import type { AssistantAction } from '../contracts';
const ctx = { prospectingRequest: { prompt: 'Contactează proprietarii pe WhatsApp' } } as any;
const action = (id: string): AssistantAction => ({ kind: 'existing_operation', operation: 'message_send', params: {}, query: {}, body: { prospectingListingId: id, template: { name: 'prospectare' } } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bindBusinessRevisions).mockImplementation(async (_ctx, actions) => actions.map(item => item.kind === 'existing_operation' ? { ...item, params: { conversationId: 'recipient-' + item.body.prospectingListingId }, body: { ...item.body, prospectingConsentReceiptId: 'receipt' } } : item));
});
it('preserves eligible messages before and after a blocked owner and deduplicates prepared recipients', async () => {
  vi.mocked(bindBusinessRevisions).mockRejectedValueOnce(new Error('Refuz înregistrat'));
  const result = await prepareProspectingBatch(ctx, [action('blocked'), action('second'), action('third'), action('second')]);
  expect(result.actions).toHaveLength(2);
  expect(result.blockedProspects).toEqual([{ listingId: 'blocked', reason: 'Refuz înregistrat' }]);
  expect(result.preparedListingIds).toEqual(['second', 'third', 'second']);
});
it.each(['mixed', 'dependent', 'not-requested'])('retains all-or-error preparation for %s plans', async variant => {
  const actions: AssistantAction[] = variant === 'mixed' ? [action('first'), { kind: 'create_task', description: 'Task', dueDate: '2030-01-01', duration: 30 }] : [action(variant === 'dependent' ? '@step:1:id' : 'first')];
  vi.mocked(bindBusinessRevisions).mockRejectedValueOnce(new Error('Rejected'));
  await expect(prepareProspectingBatch(variant === 'not-requested' ? {} as any : ctx, actions)).rejects.toThrow('Rejected');
  expect(bindBusinessRevisions).toHaveBeenCalledTimes(1);
  expect(bindBusinessRevisions).toHaveBeenCalledWith(expect.anything(), actions);
});
it('does not manufacture prepared actions when every owner is blocked', async () => {
  vi.mocked(bindBusinessRevisions).mockRejectedValue(new Error('Acces indisponibil'));
  const result = await prepareProspectingBatch(ctx, [action('one'), action('two')]);
  expect(result.actions).toEqual([]); expect(result.preparedListingIds).toEqual([]);
  expect(result.blockedProspects).toHaveLength(2);
});
it('clears a preparation failure when the same listing is successfully prepared later', async () => {
  vi.mocked(bindBusinessRevisions).mockRejectedValueOnce(new Error('Eroare temporară'));
  const result = await prepareProspectingBatch(ctx, [action('same'), action('same')]);
  expect(result.actions).toHaveLength(1); expect(result.blockedProspects).toEqual([]);
});
