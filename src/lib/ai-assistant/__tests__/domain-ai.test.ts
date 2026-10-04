import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../telemetry', async importOriginal => ({ ...(await importOriginal<typeof import('../telemetry')>()), recordTelemetry: vi.fn() }));
import { assistantDomainText } from '../domain-ai';
import { recordTelemetry } from '../telemetry';
import { AgentBudget } from '../budget';
import { ProviderError } from '../provider';
import type { ProviderRequest, ProviderResult } from '../provider';
import type { AssistantContext } from '../access';
const usage = { inputTokens: 100, outputTokens: 50, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
afterEach(() => vi.clearAllMocks());
describe('domain AI uses the same model policy and accounts auxiliary cost', () => {
  it('uses Luna, strips secrets and debits the shared parent budget', async () => {
    const budget = new AgentBudget(), respond = vi.fn<(request: ProviderRequest) => Promise<ProviderResult>>(async () => ({ text: 'Scenariu', intentStatus: 'answer', calls: [], items: [], status: 'completed', usage, latencyMs: 10 }));
    expect(await assistantDomainText({ ...ctx, agentBudget: budget }, 'Scrie un scenariu', { title: 'Apartament', apiKey: 'DO_NOT_SEND' }, { id: 'fixture', respond })).toBe('Scenariu');
    expect(respond.mock.calls[0][0]).toMatchObject({ decision: { model: 'gpt-6-luna' }, tools: [], maxOutputTokens: 900 });
    expect(JSON.stringify(respond.mock.calls[0][0])).not.toContain('DO_NOT_SEND'); expect(budget.tokens).toBe(150);
    expect(recordTelemetry).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'a' }), expect.any(String), 'domain_ai', expect.objectContaining({ status: 'auxiliary' }));
  });
  it('does not silently escalate or retry an auxiliary provider failure', async () => {
    const respond = vi.fn().mockRejectedValue(new ProviderError('temporary', true));
    await expect(assistantDomainText(ctx, 'Scrie', {}, { id: 'fixture', respond })).rejects.toThrow();
    expect(respond).toHaveBeenCalledTimes(1); expect(recordTelemetry).toHaveBeenCalledWith(ctx, expect.any(String), 'domain_ai', expect.objectContaining({ models: [expect.objectContaining({ outcome: 'failed', usage: { inputTokens: expect.any(Number), outputTokens: 900, cachedTokens: 0, cacheWriteTokens: expect.any(Number), estimated: true } })] }));
  });
  it('rejects incomplete output instead of reporting generated text as confirmed', async () => {
    const respond = vi.fn(async () => ({ text: 'Incomplet', calls: [], items: [], status: 'incomplete', usage, latencyMs: 10 }));
    await expect(assistantDomainText(ctx, 'Scrie', {}, { id: 'fixture', respond })).rejects.toThrow('nu este confirmat');
    expect(recordTelemetry).toHaveBeenCalledTimes(1);
  });
});
