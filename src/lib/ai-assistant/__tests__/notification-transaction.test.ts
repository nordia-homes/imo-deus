import { describe, expect, it } from 'vitest';
import { notificationTransactionReads } from '../notification-transaction';
describe('notification transaction read retry boundary', () => {
  it.each(['Transaction is invalid or closed.', '3 INVALID_ARGUMENT: Transaction is invalid or closed.'])('normalizes only an exact invalidated get: %s', async message => {
    const failure = Object.assign(new Error(message), { code: 3 });
    const tx = notificationTransactionReads({ get: async () => { throw failure; } } as any);
    await expect(tx.get({} as any)).rejects.toMatchObject({ code: 10, cause: failure });
  });
  it.each([[3, 'Invalid query'], [7, 'Transaction is invalid or closed.'], [14, 'Unavailable']])('preserves unrelated read failure %s %s', async (code, message) => {
    const failure = Object.assign(new Error(String(message)), { code });
    const tx = notificationTransactionReads({ get: async () => { throw failure; } } as any);
    await expect(tx.get({} as any)).rejects.toBe(failure);
  });
  it('binds native methods and does not normalize write failures', async () => {
    const failure = Object.assign(new Error('Transaction is invalid or closed.'), { code: 3 });
    const raw = { value: 42, get() { return Promise.resolve(this.value); }, create() { throw failure; } };
    const tx = notificationTransactionReads(raw as any);
    expect(await tx.get({} as any)).toBe(42);
    expect(() => tx.create({} as any, {})).toThrow(failure); expect(failure.code).toBe(3);
  });
});
