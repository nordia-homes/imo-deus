import { expect, it } from 'vitest';
import { messageOutcome } from '../message-outcome';
import { recipientRevision } from '@/lib/communications/recipient-revision';
const actor = { uid: 'u', agencyId: 'a' }, conversation = { connectionId: 'connection' }, body = { text: 'Oferta aprobată' };
const job = { ...actor, conversationId: 'c', connectionId: 'connection', input: { text: body.text } };
const message = { agencyId: 'a', authorId: 'u', conversationId: 'c', direction: 'sent', origin: 'imodeus', status: 'delivered', externalId: 'provider-id' };
it('requires the approved recipient revision in the job and current conversation', () => {
  const current = { ...conversation, id: 'c', agencyId: 'a', channel: 'messenger', externalParticipantId: 'participant', contactId: 'contact' };
  const revision = recipientRevision(current), approved = { ...body, expectedRecipientRevision: revision };
  const pinned = { ...job, input: approved, recipientRevision: revision };
  expect(messageOutcome(actor, 'c', approved, current, pinned, message).completionSatisfied).toBe(true);
  expect(messageOutcome(actor, 'c', approved, { ...current, contactId: 'other' }, pinned, message).completionSatisfied).toBe(false);
  expect(messageOutcome(actor, 'c', approved, current, { ...pinned, recipientRevision: undefined }, message).completionSatisfied).toBe(false);
  expect(messageOutcome(actor, 'c', approved, current, { ...pinned, input: body }, message).completionSatisfied).toBe(false);
  const quoted = { ...approved, sendApproval: { amountMicros: 12000, currency: 'EUR', renderedText: body.text, expiresAt: 2000 } };
  expect(messageOutcome(actor, 'c', quoted, current, { ...pinned, input: quoted }, message).completionSatisfied).toBe(true);
  expect(messageOutcome(actor, 'c', quoted, current, { ...pinned, input: { ...quoted, sendApproval: { ...quoted.sendApproval, amountMicros: 90000 } } }, message).completionSatisfied).toBe(false);
});
it.each(['queued', 'sending', 'accepted', 'unknown'])('does not equate %s with delivery', status => {
  expect(messageOutcome(actor, 'c', body, conversation, job, { ...message, status })).toMatchObject({ completionSatisfied: false, watchable: true, businessStatus: status });
});
it.each(['delivered', 'read'])('confirms the exact %s receipt without upgrading it', status => {
  expect(messageOutcome(actor, 'c', body, conversation, job, { ...message, status })).toMatchObject({ executionState: 'succeeded', completionSatisfied: true, businessStatus: status });
});
it.each([{ agencyId: 'other' }, { uid: 'other' }, { conversationId: 'other' }, { connectionId: 'other' }, { input: { text: 'Different content' } }])('rejects an unrelated outbound job %j', patch => {
  expect(messageOutcome(actor, 'c', body, conversation, { ...job, ...patch }, message)).toMatchObject({ completionSatisfied: false, watchable: false });
});
it.each([{ agencyId: 'other' }, { authorId: 'other' }, { conversationId: 'other' }, { direction: 'received' }, { origin: 'native' }, { externalId: null }])('does not trust a delivered status with mismatched evidence %j', patch => {
  expect(messageOutcome(actor, 'c', body, conversation, job, { ...message, ...patch }).completionSatisfied).toBe(false);
});
it('binds templates and attachments to approved inputs without exposing message contents', () => {
  const input = { text: '', template: { name: 'offer', language: 'ro', parameters: ['secret-token'] } };
  expect(messageOutcome(actor, 'c', input, conversation, { ...job, input }, message).completionSatisfied).toBe(true);
  expect(messageOutcome(actor, 'c', { ...input, template: { ...input.template, parameters: ['other'] } }, conversation, { ...job, input }, message).completionSatisfied).toBe(false);
  const attached = { text: '', attachmentId: 'asset' };
  expect(messageOutcome(actor, 'c', attached, conversation, { ...job, input: attached }, message).completionSatisfied).toBe(true);
  expect(messageOutcome(actor, 'c', { ...attached, attachmentId: 'other' }, conversation, { ...job, input: attached }, message).completionSatisfied).toBe(false);
  expect(JSON.stringify(messageOutcome(actor, 'c', input, conversation, { ...job, input }, message))).not.toContain('secret-token');
});
it('fails closed for missing jobs and marks explicit failure terminal', () => {
  expect(messageOutcome(actor, 'c', body, conversation, undefined, message).completionSatisfied).toBe(false);
  expect(messageOutcome(actor, 'c', body, conversation, job, { ...message, status: 'failed' })).toMatchObject({ executionState: 'failed', watchable: false });
});
