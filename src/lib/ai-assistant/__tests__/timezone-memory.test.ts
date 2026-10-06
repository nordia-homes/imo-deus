import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collection: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: mocks.collection, getResource: vi.fn(), referencesAllowed: vi.fn() }));
import { preferredTimezone, rememberPreference, forgetPreference, relevantMemory } from '../context';
import { buildInstructions } from '../policy';

it('uses exactly the timezone key saved by text/voice memory, and forgets it consistently', async () => {
  const rows = new Map<string, any>();
  const doc = (id: string) => ({ id, get: async () => ({ data: () => rows.get(id) }), delete: async () => { rows.delete(id); } });
  mocks.collection.mockReturnValue({ doc });
  const ctx: any = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: { runTransaction: async (work: any) => work({ get: (ref: any) => ref.get(), set: (ref: any, value: any) => rows.set(ref.id, value) }) } };
  expect(await preferredTimezone(ctx)).toBe('Europe/Bucharest');
  await rememberPreference(ctx, 'preferred_timezone', 'America/New_York');
  expect(await preferredTimezone(ctx)).toBe('America/New_York');
  const memory = await relevantMemory(ctx);
  const instructions = buildInstructions(ctx, { readiness: {}, memory });
  const dynamic = JSON.parse(instructions.split('\n').at(-1)!);
  expect(dynamic.timezone).toBe('America/New_York');
  await forgetPreference(ctx, 'preferred_timezone');
  expect(await preferredTimezone(ctx)).toBe('Europe/Bucharest');
});
