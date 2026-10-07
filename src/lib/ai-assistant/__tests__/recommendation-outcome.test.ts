import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { recommendationOutcome } from '../recommendation-outcome';
const ctx: any = { uid: 'u', agencyId: 'a', adminDb: { collection: () => ({ doc: () => ({ collection: () => ({ doc: (id: string) => ({ get: async () => ({ exists: true, data: () => ({ propertyId: id }) }) }) }) }) }) } };
const receipt = { portalId: 'portal', propertyIds: ['p'] };
beforeEach(() => {
  vi.mocked(getResource).mockReset();
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'contacts' ? { portalId: 'portal' } : resource === 'portals' ? { contactId: 'c', agencyId: 'a' } : { status: 'Activ' });
});
it('confirms only the exact portal membership and never a sent message', async () => {
  const result = await recommendationOutcome(ctx, 'c', ['p'], receipt);
  expect(result).toMatchObject({ executionState: 'succeeded', businessStatus: 'portal_recommended' });
  expect(result.note).toContain('nu confirmă trimiterea');
});
it.each([{}, { ...receipt, propertyIds: ['other'] }, { ...receipt, portalId: '../wrong' }])('does not infer success without the correct execution receipt %j', async value => {
  expect((await recommendationOutcome(ctx, 'c', ['p'], value)).completionSatisfied).toBe(false);
  expect(getResource).not.toHaveBeenCalled();
});
it('rejects reassignment and inactive properties without replacing the recommendation', async () => {
  vi.mocked(getResource).mockResolvedValueOnce({ portalId: 'replacement' });
  expect((await recommendationOutcome(ctx, 'c', ['p'], receipt)).completionSatisfied).toBe(false);
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'contacts' ? { portalId: 'portal' } : resource === 'portals' ? { contactId: 'c' } : { status: 'Vândut' });
  expect((await recommendationOutcome(ctx, 'c', ['p'], receipt)).completionSatisfied).toBe(false);
});
it('propagates revoked access instead of returning an old success', async () => {
  vi.mocked(getResource).mockRejectedValue(Object.assign(new Error('revoked'), { status: 403 }));
  await expect(recommendationOutcome(ctx, 'c', ['p'], receipt)).rejects.toMatchObject({ status: 403 });
});
