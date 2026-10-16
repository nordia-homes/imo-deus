import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { connectionState, conversationAttention, inboxTriageRequest, readInboxTriage } from '../inbox-triage';
import { collectionFor, getResource } from '../access';
const at = Date.parse('2026-10-16T09:00:00Z');
const conversation = { id: 'a', name: 'Andrei', status: 'open', channel: 'whatsapp' };
const message = (id: string, hours: number, direction = 'received', status = 'received') => ({ id, createdAt: new Date(at - hours * 3600000).toISOString(), direction, status });
it('recognizes the four original requests without authorizing combined sends', () => {
  expect(['Arată-mi starea conexiunilor de comunicare.', 'Care conversații nu au răspuns de peste 24 de ore?', 'Arată-mi conversațiile care necesită intervenția mea.', 'Spune-mi cele trei conversații unde trebuie să intervin acum.'].map(inboxTriageRequest)).toEqual(['connections', 'overdue', 'attention', 'top']);
  expect(inboxTriageRequest('Arată-mi starea conexiunilor de comunicare și trimite mesaje')).toBeNull();
});
it('preserves the first unanswered time across reminders and queued/failed sends', () => {
  const result = conversationAttention(conversation, [message('first', 30), message('reminder', 1), message('queued', 0.5, 'sent', 'queued'), message('failed', 0.25, 'sent', 'failed')], at)!;
  expect(result.overdue).toBe(true); expect(result.waitingSince).toBe(message('first', 30).createdAt); expect(result.evidenceMessageIds).toEqual(['first', 'reminder', 'failed']);
});
it.each(['accepted', 'delivered', 'read'])('only actual %s sends reset waiting', status => {
  expect(conversationAttention(conversation, [message('first', 30), message('answer', 2, 'sent', status)], at)).toBeNull();
  expect(conversationAttention(conversation, [message('first', 30), message('answer', 2, 'sent', status), message('new', 1)], at)?.overdue).toBe(false);
});
it('uses strict 24h duration, not the Bucharest calendar boundary', () => {
  expect(conversationAttention(conversation, [message('exact', 24)], at)?.overdue).toBe(false);
  expect(conversationAttention(conversation, [message('after', 24.0001)], at)?.overdue).toBe(true);
});
it('does not invent dates for invalid/future messages or CRM-only needsReply', () => {
  expect(conversationAttention(conversation, [message('future', -1), { ...message('bad', 30), createdAt: 'invalid' }], at)).toBeNull();
  expect(conversationAttention({ ...conversation, needsReply: true }, [], at)).toMatchObject({ overdue: false, waitingSince: null });
});
it.each(['resolved', 'spam', 'snoozed'])('excludes %s conversations from active intervention', status => {
  expect(conversationAttention({ ...conversation, status }, [message('first', 30)], at)).toBeNull();
});
it('requires reconciliation for unknown delivery without automatically retrying', () => {
  expect(conversationAttention(conversation, [message('unknown', 1, 'sent', 'unknown')], at)).toMatchObject({ priority: 1, overdue: false, evidenceMessageIds: ['unknown'] });
});
it('projects capability states without credentials and without inferring send capability from connected', () => {
  const result = connectionState({ id: 'wa', name: 'WhatsApp', channel: 'whatsapp', status: 'connected', token: 'SECRET', capabilities: { send: { status: 'reconnect_required', reason: 'SECRET' } } });
  expect(result.capabilities.send).toBe('reconnect_required'); expect(result.capabilities.receive).toBe('unknown'); expect(JSON.stringify(result)).not.toContain('SECRET');
});
it('fails closed when ownership changes during the message read', async () => {
  vi.mocked(collectionFor).mockReturnValue({ get: async () => ({ docs: [{ id: 'a', data: () => ({ ...conversation, agencyId: 'agency', assigneeId: 'me' }), ref: { collection: () => ({ get: async () => ({ docs: [{ id: 'first', data: () => message('first', 30) }] }) }) } }] }) } as any);
  vi.mocked(getResource).mockRejectedValueOnce(new Error('Access revoked'));
  await expect(readInboxTriage({ uid: 'me', agencyId: 'agency', role: 'agent' } as any, 'attention', at)).rejects.toThrow('Access revoked');
});