import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn(), readRelated: vi.fn(), readField: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('../viewing-confirmation-draft', () => ({ viewingConfirmationDraft: vi.fn() }));
vi.mock('../viewing-risk', () => ({ viewingRisk: vi.fn() }));
vi.mock('../actions', () => ({ matchContact: vi.fn(), matchProperty: vi.fn() }));
vi.mock('../watch-feedback', () => ({ annotateWatchFeedback: vi.fn() }));
vi.mock('../context', () => ({ saveResultSet: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn(), operationCatalog: () => [], operationContract: vi.fn(), operations: {}, isReadOperation: vi.fn() }));
vi.mock('../registry', () => ({ requireTool: vi.fn(), discoverTools: vi.fn(), inputContract: vi.fn() }));
vi.mock('../operation-cards', () => ({ operationCards: () => [] }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { dispatchTool } from '../tool-dispatch';
import { viewingConfirmationDraft } from '../viewing-confirmation-draft';
import { viewingRisk } from '../viewing-risk';
import { invokeOperation } from '../operations';
import { requireTool } from '../registry';
import { annotateWatchFeedback } from '../watch-feedback';
import { searchProperties } from '../search';
import { matchContact, matchProperty } from '../actions';
import { saveResultSet } from '../context';
const ctx: any = { uid: 'u', agencyId: 'a', role: 'agent' };
afterEach(() => vi.resetAllMocks());
it('risk comparison uses only server-bound previous IDs, never tool payload IDs', async () => {
  vi.mocked(viewingRisk).mockResolvedValue({ rows: [], excluded: [], complete: true, status: 'resolved', definition: '', note: '' });
  await dispatchTool('viewing_risk', ctx, { ids: ['guessed'] }, '', { selectedViewingIds: ['a', 'b'] });
  expect(viewingRisk).toHaveBeenCalledExactlyOnceWith(ctx, ['a', 'b']);
});
it('does not prepare a confirmation for a viewing guessed by the model', async () => {
  const result = await dispatchTool('viewing_confirmation_draft', ctx, { viewingId: 'guessed', recipient: 'owner' }, 'Pregătește confirmarea pentru proprietar.', {});
  expect(result.data).toMatchObject({ status: 'needs_clarification', complete: false, rows: [], sent: false });
  expect(viewingConfirmationDraft).not.toHaveBeenCalled();
  expect(result.actions).toEqual([]);
});
it('prepares the selected viewing through the fresh-data reader', async () => {
  vi.mocked(viewingConfirmationDraft).mockResolvedValue({ status: 'prepared', complete: true, sent: false, rows: [] } as any);
  await dispatchTool('viewing_confirmation_draft', ctx, { viewingId: 'selected', recipient: 'client' }, 'Pregătește confirmarea.', { selectedViewingId: 'selected' });
  expect(viewingConfirmationDraft).toHaveBeenCalledExactlyOnceWith(ctx, { viewingId: 'selected', recipient: 'client' });
});
it('annotates owner pages without changing pagination evidence', async () => {
  const rows = [{ id: 'p' }], annotated = [{ id: 'p', feedbackNote: 'Historical alert' }];
  vi.mocked(searchProperties).mockResolvedValue({ rows, nextCursor: 'cursor', complete: false, scanned: 10 } as any);
  vi.mocked(annotateWatchFeedback).mockResolvedValue(annotated);
  const result = await dispatchTool('search_properties', ctx, { source: 'owners' }, '', {});
  expect(annotateWatchFeedback).toHaveBeenCalledExactlyOnceWith(ctx, rows);
  expect(result.data).toMatchObject({ rows: annotated, nextCursor: 'cursor', complete: false, scanned: 10 });
  expect(result.cards[0].rows).toEqual(annotated);
});
it('keeps CRM searches and reverse matching outside owner feedback', async () => {
  vi.mocked(searchProperties).mockResolvedValue({ rows: [{ id: 'p' }] } as any);
  vi.mocked(matchProperty).mockResolvedValue([{ id: 'c' }] as any);
  await dispatchTool('search_properties', ctx, { source: 'crm' }, '', {});
  await dispatchTool('match_property', ctx, { propertyId: 'p', limit: 5 }, '', {});
  expect(annotateWatchFeedback).not.toHaveBeenCalled();
});
it('binds matching feedback to its client and retains it in the result snapshot', async () => {
  const context = { ...ctx, adminDb: {} }, rows = [{ id: 'p', matchScore: 92 }];
  const annotated = [{ ...rows[0], feedbackNote: 'Historical alert' }];
  vi.mocked(matchContact).mockResolvedValue(rows as any);
  vi.mocked(annotateWatchFeedback).mockResolvedValue(annotated);
  vi.mocked(saveResultSet).mockResolvedValue('00000000-0000-4000-8000-000000000001');
  const result = await dispatchTool('match_contact', context, { contactId: 'c', limit: 5 }, '', {});
  expect(annotateWatchFeedback).toHaveBeenCalledExactlyOnceWith(context, rows, 'c');
  expect(saveResultSet).toHaveBeenCalledExactlyOnceWith(context, annotated, 'c');
  expect(result.data).toMatchObject({ rows: annotated, resultSetId: '00000000-0000-4000-8000-000000000001', scoreRecalculated: false });
});
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
