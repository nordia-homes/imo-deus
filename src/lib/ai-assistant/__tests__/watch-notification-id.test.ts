import { expect, it } from 'vitest';
import { watchNotificationId } from '../watch-notification-id';
import { automationSchema } from '../contracts';

it.each(['owner_watch', 'matching_watch'])('%s repetition requires explicit opt-in', type => {
  const input = { type, nextRunAt: '2026-10-08T12:00:00Z', ...(type === 'owner_watch' ? { search: {} } : { contactId: 'c' }) };
  expect(automationSchema.parse(input)).toMatchObject({ repeatAlerts: false });
  expect(automationSchema.parse({ ...input, repeatAlerts: true })).toMatchObject({ repeatAlerts: true });
  expect(() => automationSchema.parse({ ...input, repeatAlerts: 'true' })).toThrow();
});
it('preserves legacy identities and deduplicates within an execution', () => {
  expect(watchNotificationId('a', 'p', 1, false)).toBe('a-p');
  expect(watchNotificationId('a', 'p', 2, false)).toBe('a-p');
  const id = watchNotificationId('a', 'p', 1, true);
  expect(watchNotificationId('a', 'p', 1, true)).toBe(id);
  expect(watchNotificationId('a', 'p', 2, true)).not.toBe(id);
  expect(watchNotificationId('b', 'p', 1, true)).not.toBe(id);
  expect(watchNotificationId('a', 'q', 1, true)).not.toBe(id);
  for (const run of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => watchNotificationId('a', 'p', run, true)).toThrow();
});
