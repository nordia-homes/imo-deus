import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { communicationRecoveryRequest, conversationSyncAction, failedToday, syncDiagnosis } from '../communication-recovery';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
it.each([['Sincronizează conversația cu providerul.', 'sync'], ['Verifică de ce sincronizarea conversației a eșuat.', 'diagnose'], ['Spune-mi ce comunicări au eșuat azi.', 'failed']])('recognizes %s', (text, mode) => expect(communicationRecoveryRequest(text)).toBe(mode));
it.each(['Nu sincroniza conversația cu providerul', 'Explică sincronizarea', 'Arată conexiunile'])('does not authorize %s', text => expect(communicationRecoveryRequest(text)).toBeNull());
it('authorizes only the exact selected sync operation', () => {
  const action: any = { kind: 'existing_operation', operation: 'conversation_sync', params: { conversationId: 'c' }, query: {}, body: {} };
  expect(conversationSyncAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Sincronizează conversația cu providerul.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Verifică de ce sincronizarea conversației a eșuat.')).toBe(false);
  expect(conversationSyncAction({ ...action, body: { assigneeId: 'other' } })).toBe(false);
});
it('reports failure day in Bucharest, not creation time or UTC day', () => {
  const at = Date.parse('2026-10-16T00:10:00+03:00');
  const row = { status: 'failed', direction: 'sent', createdAt: '2026-10-15T12:00:00Z', failedAt: '2026-10-15T21:05:00Z' };
  expect(failedToday(row, at)).toBe(true);
  for (const patch of [{ failedAt: '2026-10-15T20:59:59Z' }, { failedAt: '2026-10-15T21:11:00Z' }, { failedAt: null }, { status: 'unknown' }, { status: 'delivered' }, { direction: 'received' }]) expect(failedToday({ ...row, ...patch }, at)).toBe(false);
});
it('does not expose raw provider errors or invent a failure cause', () => {
  const result = syncDiagnosis({ id: 'c', channel: 'messenger', error: 'token=secret', syncErrorCode: 'secret' });
  expect(result.status).toBe('unknown'); expect(JSON.stringify(result)).not.toContain('secret');
  expect(syncDiagnosis({ id: 'c', channel: 'whatsapp', syncStatus: 'failed' }).status).toBe('webhook_only');
  expect(syncDiagnosis({ id: 'c', channel: 'messenger', syncStatus: 'failed', syncErrorCode: 'access_changed' }).reason).toContain('Accesul');
});
it.each(['partial', 'throttled', 'webhook_only'])('does not confirm a completed import for %s', status => {
  const text = executionConfirmation([{ kind: 'existing_operation', result: { operation: 'conversation_sync', status, complete: false, processed: 0 } }]);
  expect(text).toBeTruthy(); expect(text).not.toContain('s-a încheiat');
});