import { describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (_ctx: unknown, resource: string) => ({ resource, doc: (id: string) => ({ resource, id }), where() { return this; } }) }));
import { assertCalendarSlot, taskInterval } from '@/lib/crm/calendar';
import type { AssistantContext } from '../access';

const ctx = {} as AssistantContext;
function transaction(tasks: Record<string, any>[] = [], viewings: Record<string, any>[] = []) {
  const set = vi.fn();
  return { set, get: async (ref: any) => {
    if (set.mock.calls.length) throw new Error('Read after write');
    if (ref.resource === 'assistantLocks') return { data: () => ({ version: 4 }) };
    return { docs: (ref.resource === 'tasks' ? tasks : viewings).map((row, index) => ({ id: row.id || String(index), data: () => row })) };
  } } as any;
}
describe('shared task and viewing calendar', () => {
  it('converts task times in Bucharest and ignores untimed/completed tasks', () => {
    expect(taskInterval({ dueDate: '2027-01-12', startTime: '12:00' })).toEqual({ start: '2027-01-12T10:00:00.000Z', duration: 30 });
    expect(taskInterval({ dueDate: '2027-01-12' })).toBeNull();
    expect(taskInterval({ dueDate: '2027-01-12', startTime: '12:00', status: 'completed' })).toBeNull();
  });
  it('rejects cross-module conflicts while allowing another agent unrelated to the entities', async () => {
    const tx = transaction([{ dueDate: '2027-01-12', startTime: '12:00', agentId: 'a' }]);
    await expect(assertCalendarSlot(ctx, tx, 'viewings', 'new', { status: 'scheduled', viewingDate: '2027-01-12T10:15:00.000Z', duration: 60, agentId: 'a' })).rejects.toThrow('sarcină');
    expect(tx.set).not.toHaveBeenCalled();
    const free = transaction([], [{ viewingDate: '2027-01-12T10:15:00.000Z', duration: 60, status: 'scheduled', agentId: 'other' }]);
    await assertCalendarSlot(ctx, free, 'tasks', 'new', { dueDate: '2027-01-12', startTime: '12:00', duration: 30, agentId: 'a' });
    expect(free.set).toHaveBeenCalledWith(expect.anything(), { version: 5 });
  });
  it('excludes the edited entity and cancelled viewings', async () => {
    const tx = transaction([], [{ id: 'edit', viewingDate: '2027-01-12T10:00:00.000Z', status: 'scheduled', agentId: 'a' }, { viewingDate: '2027-01-12T10:00:00.000Z', status: 'cancelled', agentId: 'a' }]);
    await assertCalendarSlot(ctx, tx, 'viewings', 'edit', { viewingDate: '2027-01-12T10:00:00.000Z', status: 'scheduled', agentId: 'a' });
    expect(tx.set).toHaveBeenCalledOnce();
  });
});
