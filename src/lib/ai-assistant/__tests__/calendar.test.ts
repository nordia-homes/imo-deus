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
  it.each([1, 2, 3])('aborts the whole transaction after a closed calendar read %s without retrying that read', async position => {
    const tx = transaction(), original = tx.get;
    const failure = Object.assign(new Error('3 INVALID_ARGUMENT: Transaction is invalid or closed.'), { code: 3 });
    let reads = 0;
    tx.get = vi.fn(async (ref: any) => { if (++reads === position) throw failure; return original(ref); });
    await expect(assertCalendarSlot(ctx, tx, 'tasks', 'new', { dueDate: '2027-01-12', startTime: '12:00', agentId: 'a' })).rejects.toMatchObject({ code: 10, cause: failure });
    expect(tx.get).toHaveBeenCalledTimes(position);
    expect(tx.set).not.toHaveBeenCalled();
  });
  it.each([
    { code: 3, message: 'Invalid query argument' },
    { code: 7, message: 'Transaction is invalid or closed.' },
    { code: 4, message: 'Deadline exceeded' },
    { code: 3, message: 'Transaction is invalid or closed. Additional error' },
    { message: 'Transaction is invalid or closed.' },
  ])('preserves unrelated read failures: $message ($code)', async fields => {
    const tx = transaction(), failure = Object.assign(new Error(fields.message), fields);
    tx.get = vi.fn().mockRejectedValue(failure);
    await expect(assertCalendarSlot(ctx, tx, 'tasks', 'new', { dueDate: '2027-01-12', startTime: '12:00', agentId: 'a' })).rejects.toBe(failure);
    expect(tx.get).toHaveBeenCalledOnce();
    expect(tx.set).not.toHaveBeenCalled();
  });
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
