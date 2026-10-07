import { expect, it } from 'vitest';
import { recipientRevision, assertRecipientRevision } from '@/lib/communications/recipient-revision';
import { approvalEnvelope, validateApproval } from '../approval';
import type { AssistantAction } from '../contracts';
const recipient = { id: 'conversation', agencyId: 'agency', channel: 'messenger', connectionId: 'connection', externalParticipantId: 'participant', contactId: 'contact' };
it('rejects old unpinned send approvals and detects changing the approved revision', () => {
  const action: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conversation' }, query: {}, body: { text: 'Ofertă concretă' } };
  const envelope = approvalEnvelope('u', 'a', 'p', [action], Date.now() + 60000);
  expect(() => validateApproval(envelope, 'u', 'a', 'p', [action])).toThrow('nu fixează destinatarul');
  const bound = { ...action, body: { ...action.body, expectedRecipientRevision: recipientRevision(recipient) } };
  const approval = approvalEnvelope('u', 'a', 'p', [bound], Date.now() + 60000);
  expect(() => validateApproval(approval, 'u', 'a', 'p', [bound])).not.toThrow();
  expect(() => validateApproval(approval, 'u', 'a', 'p', [{ ...bound, body: { ...bound.body, expectedRecipientRevision: recipientRevision({ ...recipient, contactId: 'other' }) } }])).toThrow('nu corespunde');
});
it('keeps approval valid across unrelated inbox changes without exposing identity fields', () => {
  const revision = recipientRevision(recipient);
  expect(revision).toMatch(/^[a-f0-9]{64}$/);
  expect(recipientRevision({ ...recipient, name: 'New name', status: 'waiting', version: 10, lastInboundAt: '2026-10-07' })).toBe(revision);
  expect(() => assertRecipientRevision(recipient, revision)).not.toThrow();
});
it.each(Object.keys(recipient))('invalidates approval when %s changes', key => {
  expect(() => assertRecipientRevision({ ...recipient, [key]: 'changed' }, recipientRevision(recipient))).toThrow('s-a schimbat');
});
it.each(['id', 'agencyId', 'channel', 'connectionId', 'externalParticipantId'])('rejects missing %s', key => {
  expect(() => recipientRevision({ ...recipient, [key]: undefined })).toThrow('incompletă');
});
it.each([undefined, null, '', 'not-a-revision'])('rejects an unverifiable saved revision %j', revision => {
  expect(() => assertRecipientRevision(recipient, revision)).toThrow('s-a schimbat');
});
