import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource, type AssistantContext } from '../access';
import { currentRecordMessage } from '../current-record';
import { currentRecordFromPath, currentRecordSchema } from '../current-record-contract';
const ctx = { uid: 'u', agencyId: 'agency', role: 'agent' } as AssistantContext;
afterEach(() => vi.resetAllMocks());

it.each([['/leads/andrei', 'contacts', 'andrei'], ['/properties/ap-1/', 'properties', 'ap-1'], ['/leads/Matei%20Alin', 'contacts', 'Matei Alin']])('extracts only the open detail reference: %s', (path, resource, id) => {
  expect(currentRecordFromPath(path)).toEqual({ resource, id });
});
it.each(['/leads', '/properties', '/ai-assistant', '/properties/p/analiza-pret', '/leads/a%2Fb', '/leads/%xx', '/leads/%00'])('does not guess a selection from %s', path => {
  expect(currentRecordFromPath(path)).toBeUndefined();
});
it('fetches the current tenant record and keeps only context fields with access provenance', async () => {
  vi.mocked(getResource).mockResolvedValue({ id: 'c', name: 'Andrei', status: 'Nou', phone: '0700000001', apiKey: 'not-context', description: 'Untrusted prose' });
  const message = await currentRecordMessage(ctx, { resource: 'contacts', id: 'c' });
  expect(getResource).toHaveBeenCalledWith(ctx, 'contacts', 'c');
  expect(message.cards?.[0].rows).toEqual([{ id: 'c', name: 'Andrei', status: 'Nou' }]);
  expect(message.accessRefs).toEqual([{ resource: 'contacts', id: 'c' }]);
});
it('rejects browser-supplied names, tenant IDs and unavailable records', async () => {
  expect(() => currentRecordSchema.parse({ resource: 'contacts', id: 'c', agencyId: 'foreign', name: 'Inventat' })).toThrow();
  vi.mocked(getResource).mockRejectedValue(new Error('Înregistrarea nu există.'));
  await expect(currentRecordMessage(ctx, { resource: 'properties', id: 'foreign' })).rejects.toThrow('nu există');
});
it('explicitly clears the current page rather than substituting historical selections', async () => {
  const message = await currentRecordMessage(ctx, null);
  expect(message.text).toContain('nu are un client');
  expect(message.cards).toEqual([]); expect(getResource).not.toHaveBeenCalled();
});
