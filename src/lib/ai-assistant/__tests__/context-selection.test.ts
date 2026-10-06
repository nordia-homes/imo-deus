import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
vi.mock('../owner-selection', () => ({ readSelectedOwner: vi.fn() }));
import { getResource } from '../access';
import { selectContext } from '../context-selection';
import { readSelectedOwner } from '../owner-selection';
const summary = { selections: [{ messageId: 'm', source: 'crm', resultSetId: 'r', orderedIds: ['p3', 'p1', 'p2'] }] };
beforeEach(() => { vi.mocked(getResource).mockReset(); });
it('resolves ordinals from saved order while refreshing data', async () => {
  vi.mocked(getResource).mockImplementation(async (_ctx, _resource, id) => ({ id, price: 123 }));
  const result = await selectContext({} as any, summary, { positions: [3, 1], resultSetId: 'r' });
  expect(result.rows.map(row => row.id)).toEqual(['p2', 'p3']);
  expect(result.orderSource).toBe('saved_display_order'); expect(result.rows[0]).toMatchObject({ price: 123, selectedPosition: 3 });
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
