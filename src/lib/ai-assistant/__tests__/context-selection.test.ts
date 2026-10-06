import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { selectContext } from '../context-selection';
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
