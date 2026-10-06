import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn(), readRelated: vi.fn(), readField: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('../actions', () => ({ matchContact: vi.fn(), matchProperty: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn(), operationCatalog: () => [], operationContract: vi.fn(), operations: {}, isReadOperation: vi.fn() }));
vi.mock('../registry', () => ({ requireTool: vi.fn(), discoverTools: vi.fn(), inputContract: vi.fn() }));
vi.mock('../operation-cards', () => ({ operationCards: () => [] }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { dispatchTool } from '../tool-dispatch';
import { invokeOperation } from '../operations';
import { requireTool } from '../registry';
const ctx: any = { uid: 'u', agencyId: 'a', role: 'agent' };
afterEach(() => vi.resetAllMocks());
it.each([['facebook_groups', 'facebook_connections'], ['meta_ads', 'meta_status'], ['tiktok_ads', 'tiktok_status'], ['tiktok_organic', 'tiktok_organic_status']])('keeps %s status on its own authorized read handler', async (provider, operation) => {
  vi.mocked(invokeOperation).mockResolvedValue({ status: 'connected' });
  await dispatchTool('integration_status', ctx, { provider }, '', {});
  expect(requireTool).toHaveBeenCalledWith(operation, 'agent');
  expect(invokeOperation).toHaveBeenCalledExactlyOnceWith(ctx, { operation, params: {}, query: {}, body: {} }, true);
});
it('does not call a status handler when its operation is disabled', async () => {
  vi.mocked(requireTool).mockImplementation(() => { throw new Error('disabled'); });
  await expect(dispatchTool('integration_status', ctx, { provider: 'meta_ads' }, '', {})).rejects.toThrow('disabled');
  expect(invokeOperation).not.toHaveBeenCalled();
});
it('marks capped global search results incomplete and passes the actual query', async () => {
  vi.mocked(invokeOperation).mockResolvedValue({ contacts: Array.from({ length: 5 }, (_, i) => ({ id: String(i) })), properties: [], tasks: [] });
  const result = await dispatchTool('search_global', ctx, { query: 'Andrei' }, '', {});
  expect(requireTool).toHaveBeenCalledWith('global_search', 'agent');
  expect(invokeOperation).toHaveBeenCalledWith(ctx, { operation: 'global_search', params: {}, query: { q: 'Andrei' }, body: {} }, true);
  expect(result.data.complete).toBe(false);
  expect(result.cards[0].complete).toBe(false);
});
