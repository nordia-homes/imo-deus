import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ assistantContext: vi.fn(async () => ({ uid: 'u', agencyId: 'a', role: 'agent' })) }));
vi.mock('../actions', () => ({ executeAction: vi.fn(async () => ({ updated: 1, complete: true })) }));
vi.mock('../registry', () => ({ requireTool: vi.fn() }));
import { POST } from '@/app/api/crm/actions/route';
import { executeAction } from '../actions';
const request = (action: object) => new Request('https://crm.example/api/crm/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: '11111111-1111-4111-8111-111111111111', action }) });
beforeEach(() => vi.clearAllMocks());
describe('manual action routing', () => {
  it('allows the registered notification read-all adapter used by the manual page', async () => {
    const response = await POST(request({ kind: 'existing_operation', operation: 'notification_read_all' }));
    expect(response.status).toBe(200); expect(executeAction).toHaveBeenCalledOnce();
  });
  it('requires dedicated flows for external operations and automation approval', async () => {
    expect((await POST(request({ kind: 'existing_operation', operation: 'message_send' }))).status).toBe(400);
    expect(executeAction).not.toHaveBeenCalled();
  });
});
