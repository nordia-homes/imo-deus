import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), readResource: vi.fn() }));
import { ownersToCallToday, bucharestDay, readOwnersToCallToday } from '../owners-to-call-today';
import { collectionFor, readResource, type AssistantContext } from '../access';
const at = Date.parse('2026-10-15T22:30:00Z');
const base = { isFavoriteActive: true, ownerPhone: '0722123456' };
const task = { ownerListingId: 'a', status: 'open', agentId: 'me', description: 'Sună proprietarul', dueDate: '2026-10-16' };
const run = (rows: any[], tasks: any[] = [], calls: any[] = [], statuses: any[] = []) => ownersToCallToday(rows.map(row => ({ ...base, ...row })), tasks, calls, statuses, 'me', at);
it('uses Bucharest days on both sides of the DST transition', () => {
  expect(bucharestDay(at)).toBe('2026-10-16');
  expect(bucharestDay(Date.parse('2026-10-25T22:30:00Z'))).toBe('2026-10-26');
});
it('orders overdue and due tasks ahead of undated follow-up and deduplicates phones', () => {
  const rows = run([{ id: 'd' }, { id: 'a' }, { id: 'b', ownerPhone: '0722123457', contactOutcome: 'follow_up' }, { id: 'c', ownerPhone: '0722123458' }], [task, { ...task, ownerListingId: 'c', dueDate: '2026-10-15' }]);
  expect(rows.map(row => row.id)).toEqual(['c', 'a', 'b']);
  expect(rows[0].reason).toContain('restant'); expect(rows[1].reason).toContain('astăzi');
});
it.each(['2026-10-17', 'invalid', '2026-02-30'])('does not invent today from future or malformed deadline %s', dueDate => {
  expect(run([{ id: 'a', contactOutcome: 'follow_up' }], [{ ...task, dueDate }])).toEqual([]);
});
it('excludes other agents, inactive prospects, invalid phones and live reservations', () => {
  expect(run([{ id: 'a', takenByAgentId: 'other' }, { id: 'b', reservedByAgentId: 'other' }, { id: 'c', isFavoriteActive: false }, { id: 'd', ownerPhone: '123' }])).toEqual([]);
  expect(run([{ id: 'a', reservedByAgentId: 'other', reservedAt: '2020-01-01' }])).toHaveLength(1);
});
it('propagates refusal and pending calls across equivalent phone formats without exposing their records', () => {
  expect(run([{ id: 'a' }, { id: 'b', contactOutcome: 'negative', ownerPhone: '+40 722 123 456', takenByAgentId: 'other' }])).toEqual([]);
  expect(run([{ id: 'a' }], [], [{ ownerListingId: 'other', ownerPhone: '+40722123456', status: 'calling' }])).toEqual([]);
  expect(run([{ id: 'a' }], [], [], [{ id: 'a', aiDoNotCall: true }])).toEqual([]);
  expect(run([{ id: 'a' }], [], [{ ownerPhone: '0722123456', result: { doNotCall: true } }])).toEqual([]);
  expect(run([{ id: 'a' }], [], [{ ownerPhone: '0722123456', outcome: 'do_not_call', status: 'completed' }])).toEqual([]);
});
it('ignores completed tasks and does not disclose other agents task descriptions', () => {
  const rows = run([{ id: 'a' }], [{ ...task, status: 'completed' }, { ...task, agentId: 'other', description: 'Sună SECRET' }]);
  expect(rows[0].dueDate).toBeNull(); expect(JSON.stringify(rows)).not.toContain('SECRET');
});
it('reads through an empty intermediate page and fails closed on a broken cursor', async () => {
  vi.mocked(readResource).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'page2' } as any).mockResolvedValueOnce({ rows: [{ ...base, id: 'a' }], complete: true, nextCursor: null } as any);
  vi.mocked(collectionFor).mockReturnValue({ get: async () => ({ docs: [] }) } as any);
  expect((await readOwnersToCallToday({ uid: 'me' } as AssistantContext, at)).rows).toHaveLength(1);
  expect(vi.mocked(readResource).mock.calls[1][1]).toMatchObject({ cursor: 'page2' });
  vi.mocked(readResource).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: null } as any);
  await expect(readOwnersToCallToday({ uid: 'me' } as AssistantContext, at)).rejects.toThrow('incompletă');
});
it('honors a future call promise across duplicate listings for the same phone', () => {
  expect(run([{ id: 'a' }, { id: 'duplicate' }], [{ ...task, dueDate: '2026-10-20' }])).toEqual([]);
});
