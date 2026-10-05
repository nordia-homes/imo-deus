import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({
  agencyCollection: (db: any, agencyId: string, resource: string) => db.collection(`agencies/${agencyId}/${resource}`),
  CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
}));
import { referencesAllowed } from '../access';
import { uniqueReferences, type AccessReference } from '../contracts';

describe('conversation reference access', () => {
  it('checks thousands of legacy duplicates once per resource within a request', async () => {
    const get = vi.fn(async () => ({ exists: true, data: () => ({ agentId: 'u' }) }));
    const ctx: any = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: { collection: () => ({ doc: () => ({ get }) }) } };
    const refs: AccessReference[] = Array.from({ length: 6192 }, (_, i) => ({ resource: 'sales', id: `s${i % 3}` }));
    const cache = new Map<string, Promise<unknown>>();
    expect(uniqueReferences(refs)).toHaveLength(3);
    expect(await Promise.all(Array.from({ length: 20 }, () => referencesAllowed(ctx, refs, cache)))).toEqual(Array(20).fill(true));
    expect(get).toHaveBeenCalledTimes(3);
    // No cross-request caching: later membership/resource changes are rechecked.
    get.mockResolvedValue({ exists: true, data: () => ({ agentId: 'other' }) });
    expect(await referencesAllowed(ctx, refs)).toBe(false);
    expect(get).toHaveBeenCalledTimes(4);
  });
});
