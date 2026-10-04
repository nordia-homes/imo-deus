import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: any, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
import { ownerSearchFields } from '@/lib/owner-listings/search-index';
import { searchProperties, searchMatches } from '../search';
import { canReadResource, readResource, readRelated, readField, referencesAllowed, type AssistantContext } from '../access';
import { searchSchema, relatedSchema, fieldSchema } from '../contracts';

// In-memory query implementation checks the public pagination contract; no live database.
function database(rows: Record<string, any>[], unavailableIndex = false) {
  function query(filters: [string, string, any][] = [], after?: string, cap = Infinity): any {
    return { where: (field: string, op: string, val: unknown) => query([...filters, [field, op, val]], after, cap), orderBy: () => query(filters, after, cap), limit: (n: number) => query(filters, after, n), startAfter: (id: string) => query(filters, id, cap), count: () => ({ get: async () => ({ data: () => ({ count: rows.filter(r => filters.every(([f, op, v]) => op === '==' ? r[f] === v : op === 'array-contains' ? r[f]?.includes(v) : op === '>=' ? r[f]>=v : op === '<=' ? r[f]<=v : true)).length }) }) }), get: async () => {
      if (unavailableIndex && filters.some(([field]) => field === 'searchVersion')) throw Object.assign(new Error('Index is not READY'), { code: 9 });
      const matches = rows.filter(r => (!after || r.id > after) && filters.every(([f, op, v]) => op === '==' ? r[f] === v : op === 'array-contains' ? r[f]?.includes(v) : op === '>=' ? r[f]>=v : op === '<=' ? r[f]<=v : true)).slice(0, cap);
      return { empty: matches.length === 0, size: matches.length, docs: matches.map(r => ({ id: r.id, data: () => r })) };
    }, doc: (id: string) => ({ get: async () => ({ exists: rows.some(r => r.id === id), id, data: () => rows.find(r => r.id === id) }), collection: () => query() }) };
  }
  return { collection: (name: string) => name === 'agencies' ? { doc: () => ({ get: async () => ({ data: () => ({ city: 'Bucuresti' }) }), collection: () => query() }) } : query() };
}
const context = (rows: Record<string, any>[]) => ({ agencyId: 'a', uid: 'agent', role: 'agent', adminDb: database(rows) }) as unknown as AssistantContext;
const listing = { publicationStatus: 'ready', isCanonical: true, scopeKey: 'bucuresti-ilfov', price: '120.000 €', priceValue: 120000, roomsValue: 2, propertyType: 'apartment', transactionType: 'sale', location: 'București Titan', title: 'Apartament', ownerPhone: 'PRIVATE' };

describe('authorized complete pagination', () => {
  it('pushes zone, rooms and property type into the index before the scan budget', async()=>{
    const rows=Array.from({length:6003},(_,i)=>{const source={...listing,location:i<6000?'Militari':'Titan'};return {...source,...ownerSearchFields(source),id:String(i).padStart(5,'0')};});
    const result=await searchProperties(context(rows),searchSchema.parse({zone:'Titan',rooms:2,propertyType:'apartment',priceMax:130000,limit:3}));
    expect(result.searchMode).toBe('native_index');expect(result.rows).toHaveLength(3);expect(result.scanned).toBe(3);
  });
  it('does not omit a newly ingested listing without an indexed projection', async () => {
    const rows: Record<string, any>[] = [{ ...listing, id: '0001', ...ownerSearchFields(listing) }];
    const ctx = context(rows), query = searchSchema.parse({ zone: 'Titan', priceMax: 130000 });
    expect((await searchProperties(ctx, query)).searchMode).toBe('native_index');
    rows.push({ ...listing, id: '0002' });
    const result = await searchProperties(ctx, query);
    expect(result.searchMode).toBe('live_scan');
    expect(result.rows.map(row => row.id)).toEqual(['0001', '0002']);
  });
  it('falls back to fresh data when the native index is not READY', async () => {
    const rows = [{ ...listing, id: '0001', ...ownerSearchFields(listing) }];
    const ctx = { ...context(rows), adminDb: database(rows, true) } as unknown as AssistantContext;
    const result = await searchProperties(ctx, searchSchema.parse({ zone: 'Titan', priceMax: 130000 }));
    expect(result.searchMode).toBe('live_scan');
    expect(result.rows.map(row => row.id)).toEqual(['0001']);
  });
  it('reads sale documents and historical versions from the actual embedded checklist', async () => {
    const ctx = context([{ id: 'sale', agentId: 'agent', checklist: [{ id: 'doc', label: 'Act', versions: [{ version: 1, extractedText: 'Text verificat' }] }] }]);
    const documents = await readRelated(ctx, relatedSchema.parse({ resource: 'sales', id: 'sale', collection: 'documents' }));
    expect(documents.rows[0].id).toBe('doc');
    const version = await readField(ctx, fieldSchema.parse({ resource: 'sales', id: 'sale', collection: 'documents', documentId: 'doc', versionId: '1', field: ['extractedText'] }));
    expect(version.value).toBe('Text verificat');
    await expect(readRelated(ctx, relatedSchema.parse({ resource: 'sales', id: 'sale', collection: 'messages' }))).rejects.toThrow('indisponibilă');
  });
  it('finds an owner listing beyond the first 100 displayed records', async () => {
    const rows = Array.from({ length: 301 }, (_, i) => ({ ...listing, id: String(i).padStart(4, '0'), scopeKey: 'bucuresti-ilfov', location: i === 300 ? 'Titan' : 'Militari' }));
    const result = await searchProperties(context(rows), searchSchema.parse({ scopeKey: 'bucuresti-ilfov', zone: 'Titan', priceMax: 130000 }));
    expect(result.rows.map(r => r.id)).toEqual(['0300']);
    expect(result.rows[0]).not.toHaveProperty('ownerPhone');
    expect(result.scanned).toBe(301);
  });
  it('continues from the last processed result without skipping unread records', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...listing, id: String(i).padStart(4, '0'), scopeKey: 'bucuresti-ilfov' }));
    const ctx = context(rows), input = searchSchema.parse({ scopeKey: 'bucuresti-ilfov', zone: 'Titan', limit: 5 });
    const first = await searchProperties(ctx, input);
    const second = await searchProperties(ctx, { ...input, cursor: first.nextCursor! });
    expect(first.rows.map(r => r.id)).toEqual(['0000', '0001', '0002', '0003', '0004']);
    expect(second.rows.map(r => r.id)).toEqual(['0005', '0006', '0007', '0008', '0009']);
    expect(first.searchMode).toBe('live_scan');
  });
  it('does not treat description mentions, RON or unknown prices as EUR matches', () => {
    const input = searchSchema.parse({ zone: 'Titan', priceMax: 130000 });
    expect(searchMatches({ ...listing, location: 'Militari', description: 'Similar cu Titan' }, input)).toBe(false);
    expect(searchMatches({ ...listing, price: '120000 RON' }, input)).toBe(false);
    expect(searchMatches({ ...listing, price: '120000' }, input)).toBe(false);
    expect(searchMatches(listing, input)).toBe(true);
  });
  it('never fills owner results with internal portfolio properties', () => {
    expect(searchMatches({ ...listing, publicationStatus: undefined, status: 'Activ' }, searchSchema.parse({}))).toBe(false);
  });
  it('filters restricted resources and advances over inaccessible records', async () => {
    const rows = [{ id: '1', agentId: 'other', title: 'Private' }, { id: '2', agentId: 'agent', title: 'Own' }, { id: '3', collaboratorIds: ['agent'], title: 'Shared' }];
    const result = await readResource(context(rows), { resource: 'sales', limit: 1 });
    expect(result.rows.map(r => r.id)).toEqual(['2']);
    expect(result.nextCursor).toBe('2');
    expect(canReadResource(context(rows), 'sales', rows[0])).toBe(false);
  });
  it('rechecks access to cached historical responses after assignment changes', async () => {
    expect(await referencesAllowed(context([{ id: 'sale', agentId: 'other' }]), [{ resource: 'sales', id: 'sale' }])).toBe(false);
  });
});
