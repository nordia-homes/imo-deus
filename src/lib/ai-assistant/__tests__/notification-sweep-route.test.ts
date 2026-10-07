import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ set: vi.fn(), sweep: vi.fn(), jobs: vi.fn(), automations: vi.fn(), voice: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminDb: { collection: () => ({ doc: () => ({ set: mocks.set }) }) } }));
vi.mock('../notification-sweep', () => ({ sweepAssistantNotifications: mocks.sweep }));
vi.mock('../jobs', () => ({ drainAgentJobs: mocks.jobs }));
vi.mock('../automation-worker', () => ({ drainAssistantAutomations: mocks.automations }));
vi.mock('@/lib/jarvis-voice/health', () => ({ probeVoiceOutput: mocks.voice }));
import { POST } from '@/app/api/ai-assistant/worker/route';
const request = (token = 'synthetic-worker-secret', suffix = '') => new Request(`https://example.test/api/ai-assistant/worker${suffix}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('AI_ASSISTANT_WORKER_SECRET', 'synthetic-worker-secret');
  mocks.sweep.mockResolvedValue({ status: 'completed', scanned: 25, withdrawn: 3 });
  mocks.jobs.mockResolvedValue({ processed: 0 }); mocks.automations.mockResolvedValue({ processed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
it('requires the worker secret before scanning any inbox', async () => {
  expect((await POST(request('wrong'))).status).toBe(403);
  expect(mocks.sweep).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
});
it('includes bounded sweep evidence in the protected response', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ notifications: { scanned: 25, withdrawn: 3 } });
  expect(mocks.sweep).toHaveBeenCalledTimes(1); expect(mocks.automations).toHaveBeenCalledTimes(1);
});
it('does not block jobs or expose exception contents after a sweep failure', async () => {
  mocks.sweep.mockRejectedValue(new Error('Sensitive internal failure'));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ processed: 0, jobs: { processed: 0 }, notifications: { status: 'failed' } });
  expect(mocks.jobs).toHaveBeenCalledTimes(1); expect(mocks.automations).toHaveBeenCalledTimes(1);
});
it('does not scan during a voice-only health probe', async () => {
  mocks.voice.mockResolvedValue({ ready: true });
  expect((await POST(request(undefined, '?probe=voice'))).status).toBe(200);
  expect(mocks.sweep).not.toHaveBeenCalled(); expect(mocks.jobs).not.toHaveBeenCalled();
});
