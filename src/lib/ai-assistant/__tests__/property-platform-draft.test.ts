import { expect, it } from 'vitest';
import { platformPropertyPostDraft, propertyPostRequest } from '../property-post-draft';
const property = { title: 'Apartament Cișmigiu', location: 'București', status: 'Activ', transactionType: 'Vanzare', price: 130000, rooms: 2, squareFootage: 54, amenities: ['Balcon'], description: 'SECRET piscină', ownerPhone: 'SECRET' };
it.each([['Pregătește o versiune scurtă pentru Facebook.', 'facebook_short'], ['Pregătește o versiune adaptată pentru Instagram.', 'instagram']])('recognizes %s', (prompt, mode) => expect(propertyPostRequest(prompt)).toBe(mode));
it('keeps short Facebook copy factual and excludes optional amenities without changing the source', () => {
  const result = platformPropertyPostDraft(property, 'facebook_short')!;
  expect(result.text.length).toBeLessThanOrEqual(500); expect(result.text).toContain('130.000 EUR');
  expect(result.text).not.toMatch(/SECRET|piscină|Balcon/); expect(result.usedFields).not.toContain('amenities');
  expect(result.omittedFields).toContain('amenities'); expect(property.amenities).toEqual(['Balcon']);
});
it('adapts Instagram within the integration limit and retains verified amenities', () => {
  const result = platformPropertyPostDraft(property, 'instagram')!;
  expect(result.text.length).toBeLessThanOrEqual(2200); expect(result.text).toContain('Balcon');
  expect(result.platform).toBe('instagram'); expect(result.publicationConfirmed).toBe(false);
});
it.each(['facebook_short', 'instagram'] as const)('omits complete oversized lines for %s without cutting a fact', platform => {
  const result = platformPropertyPostDraft({ ...property, title: 'T'.repeat(250), location: 'L'.repeat(250), price: 1e300, amenities: Array.from({ length: 12 }, (_, i) => 'dotare ' + i + 'x'.repeat(100)) }, platform)!;
  expect(result.text.length).toBeLessThanOrEqual(platform === 'instagram' ? 2200 : 500);
  expect(result.text).not.toContain('...');
  expect(result.usedFields.includes('price')).toBe(result.text.includes('Preț: '));
});
it('does not turn rental into sale or draft an inactive property', () => {
  expect(platformPropertyPostDraft({ ...property, transactionType: 'Inchiriere' }, 'instagram')?.text).toContain('De închiriat');
  expect(platformPropertyPostDraft({ ...property, status: 'Vândut' }, 'facebook_short')).toBeNull();
});