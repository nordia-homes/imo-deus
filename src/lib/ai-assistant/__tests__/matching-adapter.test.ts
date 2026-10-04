import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, invokeOperation: vi.fn(), isReadOperation: vi.fn() }));
import { collectionFor, getResource, type AssistantContext } from '../access';
import { matchContact, matchProperty } from '../actions';
import { getDeterministicMatchedProperties, getDeterministicMatchedBuyers } from '@/lib/matching-engine';
import { filterMatches } from '../context';
import type { Contact, Property } from '@/lib/types';
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
const buyer = { id: 'c1', name: 'Client', contactType: 'Cumparator', status: 'Nou', budget: 150000, city: 'Bucuresti', zones: ['Titan'], preferences: { desiredPriceRangeMin: 80000, desiredPriceRangeMax: 150000, desiredRooms: 2, desiredSquareFootageMin: 40, desiredSquareFootageMax: 80, locationPreferences: 'Titan' } } as unknown as Contact;
const properties = [120000, 130000, 90000].map((price, index) => ({ id: `p${index}`, title: 'Apartament Titan', status: 'Activ', propertyType: 'Apartament', transactionType: 'Vanzare', price, rooms: 2, bathrooms: 1, squareFootage: 60, city: 'Bucuresti', zone: 'Titan', location: 'Titan', address: 'Titan' })) as Property[];
function query(rows: any[]) { return { where: vi.fn().mockReturnThis(), get: async () => ({ docs: rows.map(row => ({ id: row.id, data: () => row })) }) }; }
afterEach(() => vi.clearAllMocks());
describe('existing ImoDeus matching contract', () => {
  it('returns the exact existing order, scores and reasons for a buyer', async () => {
    vi.mocked(getResource).mockResolvedValue(buyer); vi.mocked(collectionFor).mockReturnValue(query(properties) as any);
    const existing = getDeterministicMatchedProperties(buyer, properties, 10);
    expect(existing.length).toBeGreaterThan(0);
    const actual = await matchContact(ctx, buyer.id, 10);
    expect(actual.map(row => [row.id, row.matchScore, row.reasoning])).toEqual(existing.map(row => [row.id, row.matchScore, row.reasoning]));
    expect(collectionFor).toHaveBeenCalledWith(ctx, 'properties');
  });
  it('returns the exact existing buyer matching results, rejecting inactive buyers', async () => {
    const contacts = [buyer, { ...buyer, id: 'won', status: 'Câștigat' }] as Contact[];
    vi.mocked(getResource).mockResolvedValue(properties[0]); vi.mocked(collectionFor).mockReturnValue(query(contacts) as any);
    const existing = getDeterministicMatchedBuyers(properties[0], contacts, 10);
    expect(existing.length).toBeGreaterThan(0);
    const actual = await matchProperty(ctx, properties[0].id, 10);
    expect(actual.map(row => [row.id, row.matchScore, row.reasoning])).toEqual(existing.map(row => [row.id, row.matchScore, row.reasoning]));
    expect(actual.some(row => row.id === 'won')).toBe(false);
  });
  it('contextual budget filtering preserves the original row object and score', () => {
    const rows = getDeterministicMatchedProperties(buyer, properties, 10);
    const original = structuredClone(rows);
    const filtered = filterMatches(rows, { priceMax: 120000, zone: 'Titan', limit: 2 });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(row => rows.includes(row as typeof rows[number]))).toBe(true);
    expect(rows).toEqual(original);
  });
  it('fails before matching when the authorized client is unavailable', async () => {
    vi.mocked(getResource).mockRejectedValueOnce(new Error('Access revoked'));
    await expect(matchContact(ctx, 'other-tenant-contact', 5)).rejects.toThrow('Access revoked');
    expect(collectionFor).not.toHaveBeenCalled();
  });
});
