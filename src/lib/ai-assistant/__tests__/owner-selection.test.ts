import { expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { readSelectedOwner } from '../owner-selection';
const listing = { scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, price: '120000 EUR', constructionYear: 'after_1977', ownerPhone: 'PRIVATE', privateNotes: 'PRIVATE' };
function context(row: any, city = 'Bucuresti') {
  return { agencyId: 'agency', adminDb: { collection: (name: string) => ({ doc: (id: string) => ({ get: async () => {
    if (name === 'agencies') { expect(id).toBe('agency'); return { data: () => ({ city }) }; }
    expect(name).toBe('ownerListings'); expect(id).toBe('selected'); return { data: () => row };
  } }) }) } } as any;
}
it('rereads the selected owner listing with bounded year evidence and no private fields', async () => {
  const result = await readSelectedOwner(context(listing), 'selected', { source: 'owners', transactionType: 'sale', limit: 5, yearMin: 1978 });
  expect(result).toMatchObject({ id: 'selected', constructionYear: null, constructionYearLowerBound: 1978, yearFilterSatisfied: true });
  expect(result).not.toHaveProperty('ownerPhone'); expect(result).not.toHaveProperty('privateNotes');
});
it.each([undefined, { ...listing, scopeKey: 'other' }, { ...listing, publicationStatus: 'pending' }, { ...listing, isCanonical: false }])('refuses unavailable or changed source eligibility without substituting another row', async row => {
  await expect(readSelectedOwner(context(row), 'selected')).rejects.toThrow('nu mai este disponibil');
});
it('uses a valid explicitly saved scope and rejects an unknown one', async () => {
  await expect(readSelectedOwner(context(listing, 'Unknown city'), 'selected', { source: 'owners', scopeKey: 'bucuresti-ilfov', transactionType: 'sale', limit: 5 })).resolves.toMatchObject({ id: 'selected' });
  await expect(readSelectedOwner(context(listing), 'selected', { source: 'owners', scopeKey: 'invalid', transactionType: 'sale', limit: 5 })).rejects.toThrow('Orașul');
});
