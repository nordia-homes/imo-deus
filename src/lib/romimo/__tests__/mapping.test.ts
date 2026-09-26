import { describe, expect, it } from 'vitest';
import type { Property } from '@/lib/types';
import catalog from '../catalog.snapshot.json';
import { buildArticle, defaultSettings, externalIdFor, suggestCategory } from '../mapping';

export const property = {
  id: 'property-1', title: 'Apartament luminos cu două camere', description: 'Apartament cu două camere, aproape de parc și transport.',
  address: '', location: '', city: 'sector 1', price: 100000, rooms: 2, bathrooms: 1, squareFootage: 55,
  images: [{ url: 'https://storage.googleapis.com/example/photo.jpg', alt: '' }], propertyType: 'Apartament', transactionType: 'Vânzare', status: 'Activ',
  constructionYear: 2005, floor: '2', partitioning: 'Decomandat', heatingSystem: 'Centrala proprie',
} as Property;
const now = new Date('2026-09-26T12:00:00Z');
export function validSettings() {
  return { ...defaultSettings(property, catalog, { name: 'Agent Test', email: 'agent@example.com', phone: '0712345678' }, now), county: 'bucuresti' };
}
describe('Romimo mapping', () => {
  it('uses live-observed taxonomy and a stable agency-scoped reference within 30 chars', () => {
    expect(suggestCategory(property, catalog)).toBe(338);
    expect(suggestCategory({ ...property, transactionType: 'Închiriere' }, catalog)).toBe(313);
    expect(suggestCategory({ ...property, propertyType: 'Teren' }, catalog)).toBe(0);
    expect(suggestCategory({ ...property, rooms: 7 }, catalog)).toBe(0);
    expect(externalIdFor('a', 'x')).toHaveLength(30);
    expect(externalIdFor('a', 'x')).toBe(externalIdFor('a', 'x'));
    expect(externalIdFor('a', 'x')).not.toBe(externalIdFor('b', 'x'));
  });
  it('builds the documented DTO without paid promotion or owner contact leakage', () => {
    const result = buildArticle({ ...property, ownerName: 'Private owner', ownerPhone: '0799999999' }, validSettings(), catalog, 'account@example.com', 'reference', now);
    expect(result.issues).toEqual([]);
    expect(result.payload.ad).toMatchObject({ category: 338, promoted: false, active: true, currency: 'EUR' });
    expect(result.payload.contact).toMatchObject({ contactName: 'Agent Test', contactPhone: '0712345678', allowWhatsApp: false });
    expect(JSON.stringify(result.payload)).not.toContain('Private owner');
    expect(result.payload.properties).toContainEqual({ key: 'storey', value: 'Etaj 2' });
    expect(result.payload.pictures[0].rank).toBe(1);
  });
  it('validates category-specific required fields instead of guessing defaults', () => {
    const settings = validSettings();
    settings.fields = {};
    const result = buildArticle(property, settings, catalog, 'account@example.com', 'reference', now);
    expect(result.issues.join(' ')).toMatch(/Etaj/);
    expect(result.issues.join(' ')).toMatch(/Anul constructiei/);
    settings.category = 354;
    const land = buildArticle(property, settings, catalog, 'account@example.com', 'reference', now);
    expect(land.issues.join(' ')).toMatch(/Suprafata terenului/);
    expect(land.issues.join(' ')).not.toMatch(/Etaj/);
  });
  it('rejects invalid values, inactive properties, bad dates and excessive text', () => {
    const settings = validSettings();
    settings.fields.storey = 'Etaj 99'; settings.validTo = '2020-01-01'; settings.currency = 'USD';
    const result = buildArticle({ ...property, title: 'x'.repeat(101), status: 'Vândut', price: 0 }, settings, catalog, 'bad', 'id', now);
    expect(result.issues.length).toBeGreaterThanOrEqual(6);
  });
  it('caps pictures with a warning and rejects non-public schemes', () => {
    const many = { ...property, images: Array.from({ length: 22 }, () => ({ url: 'file:///secret.jpg', alt: '' })) };
    const result = buildArticle(many, validSettings(), catalog, 'account@example.com', 'id', now);
    expect(result.payload.pictures).toHaveLength(20);
    expect(result.payload.pictures[19].rank).toBe(20);
    expect(result.warnings).toHaveLength(1);
    expect(result.issues).toHaveLength(20);
  });
  it('rejects selling an apartment in a rental category and calendar rollover dates', () => {
    const settings = { ...validSettings(), category: 313, validTo: '2027-02-30' };
    const result = buildArticle(property, settings, catalog, 'a@example.com', 'ref', now);
    expect(result.issues.join(' ')).toMatch(/tranzacției/);
    expect(result.issues.join(' ')).toMatch(/valabilitate/);
  });
  it('keeps preview available for legacy properties without an images array', () => {
    const result = buildArticle({ ...property, images: undefined } as unknown as Property, validSettings(), catalog, 'a@example.com', 'ref', now);
    expect(result.payload.pictures).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/nu are fotografii/);
  });
});
