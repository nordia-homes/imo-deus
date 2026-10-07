import { expect, it } from 'vitest';
import { outreachOutcome } from '../outreach-outcome';
const actor = { uid: 'u', agencyId: 'a' }, now = Date.parse('2026-10-08T09:00:00Z');
const body = { ownerListing: { id: 'l' } };
const call = { id: 'c', agencyId: 'a', agentId: 'u', createdBy: 'u', ownerListingId: 'l', ownerPhone: '0722334455', scheduledAt: null, vapiCallId: 'remote', status: 'calling' };
const ended = { ...call, status: 'completed', endedAt: '2026-10-08T08:59:00Z', lastWebhookType: 'end-of-call-report', outcome: 'no_answer' };
const verify = (current: Record<string, any> = ended, request: Record<string, any> = body, original: Record<string, any> = { call }) => outreachOutcome(actor, 'c', request, current, original, now);

it('confirms call completion without claiming owner agreement or exposing phone/transcript', () => {
  const result = verify();
  expect(result).toMatchObject({ executionState: 'succeeded', completionSatisfied: true, watchable: false });
  expect(result.note).toContain('nu confirmă acordul');
  expect(JSON.stringify(result)).not.toContain(call.ownerPhone);
});
it.each([{ id: 'other' }, { agencyId: 'other' }, { agentId: 'other' }, { createdBy: 'other' }, { ownerListingId: 'other' }, { ownerPhone: '0733445566' }, { vapiCallId: 'other' }])('refuses identity drift %j', patch => {
  expect(verify({ ...ended, ...patch })).toMatchObject({ executionState: 'unknown', completionSatisfied: false, watchable: false });
});
it('normalizes equivalent Romanian phone formats without accepting a changed requested listing', () => {
  expect(verify({ ...ended, ownerPhone: '+40722334455' }).completionSatisfied).toBe(true);
  expect(verify(ended, { ownerListing: { id: 'different' } }).completionSatisfied).toBe(false);
});
it.each([{ endedAt: undefined }, { endedAt: 'invalid' }, { endedAt: '2026-10-08T10:00:00Z' }, { lastWebhookType: undefined }, { vapiCallId: '' }])('does not treat completed alone as evidence: %j', patch => {
  expect(verify({ ...ended, ...patch })).toMatchObject({ completionSatisfied: false, watchable: false });
});
it('keeps ambiguous dispatch watchable and allows a later end webhook to settle it', () => {
  const snapshot = { ...call, vapiCallId: null, providerErrorCode: 'vapi_create_unknown' };
  expect(verify(snapshot as any, body, { call: snapshot })).toMatchObject({ executionState: 'unknown', completionSatisfied: false, watchable: true });
  expect(verify({ ...ended, providerErrorCode: 'vapi_create_unknown' } as any, body, { call: snapshot }).completionSatisfied).toBe(true);
});
it.each(['failed', 'canceled'])('retains terminal failure %s without retry', status => {
  expect(verify({ ...ended, status })).toMatchObject({ executionState: status === 'failed' ? 'failed' : 'cancelled', completionSatisfied: false, watchable: false });
});
it('confirms a future schedule at the same instant with an explicit separation from call completion', () => {
  const scheduled = { ...call, scheduledAt: '2026-10-09T07:00:00Z', status: 'scheduled', vapiCallId: null };
  const result = verify(scheduled as any, { ...body, scheduledAt: '2026-10-09T10:00:00+03:00' }, { call: scheduled });
  expect(result).toMatchObject({ completionSatisfied: true, watchable: false }); expect(result.note).toContain('nu este încă efectuat');
  expect(verify({ ...scheduled, scheduledAt: '2026-10-09T08:00:00Z' } as any, { ...body, scheduledAt: scheduled.scheduledAt }, { call: scheduled }).completionSatisfied).toBe(false);
});
it('does not confirm a past-due schedule or an unexpected scheduled call for an immediate request', () => {
  const scheduled = { ...call, scheduledAt: '2026-10-08T08:00:00Z', status: 'scheduled' };
  expect(verify(scheduled as any, { ...body, scheduledAt: scheduled.scheduledAt }, { call: scheduled })).toMatchObject({ completionSatisfied: false, watchable: true });
  expect(verify(scheduled as any, body, { call: scheduled })).toMatchObject({ completionSatisfied: false, watchable: false });
});
it('refuses missing legacy receipts and missing current records', () => {
  expect(verify(ended, body, {}).completionSatisfied).toBe(false);
  expect(outreachOutcome(actor, 'c', body, undefined, { call }, now).completionSatisfied).toBe(false);
  expect(outreachOutcome(actor, undefined, body, ended, { call }, now).completionSatisfied).toBe(false);
});
it('does not certify a scheduled call that started or ended before the requested instant', () => {
  const scheduledAt = '2026-10-08T08:30:00Z';
  const scheduled = { ...call, scheduledAt };
  const request = { ...body, scheduledAt };
  expect(verify({ ...ended, scheduledAt, startedAt: '2026-10-08T08:00:00Z' }, request, { call: scheduled }).completionSatisfied).toBe(false);
  expect(verify({ ...ended, scheduledAt, endedAt: '2026-10-08T08:15:00Z' }, request, { call: scheduled }).completionSatisfied).toBe(false);
});
