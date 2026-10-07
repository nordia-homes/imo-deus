import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
vi.mock('../owner-selection', () => ({ readSelectedOwner: vi.fn() }));
vi.mock('../context', () => ({ readMatchingResultSet: vi.fn() }));
import { getResource } from '../access';
import { selectContext } from '../context-selection';
import { readSelectedOwner } from '../owner-selection';
import { readMatchingResultSet } from '../context';
import { matchingRevision } from '../matching-revision';
const summary = { selections: [{ messageId: 'm', source: 'crm', resultSetId: 'r', orderedIds: ['p3', 'p1', 'p2'] }] };
beforeEach(() => { vi.mocked(getResource).mockReset(); vi.mocked(readMatchingResultSet).mockReset(); vi.mocked(readMatchingResultSet).mockResolvedValue({ rows: ['p3','p1','p2'].map(id => ({ id, matchScore: 80 })), contactId: null } as any); });
it('resolves ordinals from saved order while refreshing data', async () => {
  vi.mocked(getResource).mockImplementation(async (_ctx, _resource, id) => ({ id, price: 123, status: 'Activ' }));
  const result = await selectContext({} as any, summary, { positions: [3, 1], resultSetId: 'r' });
  expect(result.rows.map(row => row.id)).toEqual(['p2', 'p3']);
  expect(result.orderSource).toBe('saved_display_order'); expect(result.rows[0]).toMatchObject({ price: 123, selectedPosition: 3 });
});
it('keeps saved scores and client provenance while marking changed matching inputs', async () => {
  const contact = { id: 'c', budget: 120000 }, property = { id: 'p1', status: 'Activ', price: 100000 };
  vi.mocked(readMatchingResultSet).mockResolvedValue({ contactId: 'c', contactRevision: matchingRevision(contact), rows: ['p3','p1','p2'].map(id => ({ id, matchScore: 91, reasoning: 'Original reason', matchingRevision: matchingRevision(property) })) } as any);
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'contacts' ? contact : property);
  expect(await selectContext({} as any, summary, { positions: [2] })).toMatchObject({ contactId: 'c', scoreMayBeStale: false, rows: [{ id: 'p1', matchScore: 91, reasoning: 'Original reason' }] });
  property.price = 110000;
  expect(await selectContext({} as any, summary, { positions: [2] })).toMatchObject({ scoreMayBeStale: true, rows: [{ id: 'p1', price: 110000, matchScore: 91 }] });
});
it('refuses expired sets, inactive selections and IDs outside the saved matching set without substitution', async () => {
  vi.mocked(readMatchingResultSet).mockRejectedValueOnce(new Error('expired'));
  await expect(selectContext({} as any, summary, { positions: [2] })).rejects.toThrow('expired');
  vi.mocked(getResource).mockResolvedValue({ status: 'Vândut' });
  await expect(selectContext({} as any, summary, { positions: [2] })).rejects.toThrow('nu mai este activă');
  vi.mocked(readMatchingResultSet).mockResolvedValue({ rows: [{ id: 'other' }] } as any);
  await expect(selectContext({} as any, summary, { positions: [2] })).rejects.toThrow('nu corespunde');
});
it('never guesses an ambiguous or out-of-range reference', async () => {
  await expect(selectContext({} as any, { selections: [...summary.selections, { ...summary.selections[0], messageId: 'other' }] }, { positions: [1] })).rejects.toThrow('ambiguă');
  await expect(selectContext({} as any, summary, { positions: [4] })).rejects.toThrow('Poziția');
  expect(getResource).not.toHaveBeenCalled();
});
it('does not return a historical copy when access has been revoked', async () => {
  vi.mocked(getResource).mockRejectedValue(Object.assign(new Error('revoked'), { status: 403 }));
  await expect(selectContext({} as any, summary, { positions: [1] })).rejects.toMatchObject({ status: 403 });
});
it('resolves the saved owner-listing order through its dedicated reader and retains scope', async () => {
  vi.mocked(readSelectedOwner).mockResolvedValue({ id: 'l2', title: 'Current owner listing' } as any);
  const selection = { selections: [{ source: 'owners', messageId: 'm', orderedIds: ['l3','l2'], search: { source: 'owners', scopeKey: 'bucuresti-ilfov' } }] };
  const result = await selectContext({} as any, selection, { source: 'owners', positions: [2] });
  expect(result.rows).toMatchObject([{ id: 'l2', selectedPosition: 2 }]);
  expect(readSelectedOwner).toHaveBeenCalledWith({}, 'l2', expect.objectContaining({ scopeKey: 'bucuresti-ilfov' }));
  expect(getResource).not.toHaveBeenCalled();
});
