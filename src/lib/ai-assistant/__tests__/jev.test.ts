import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JEV_MODEL, observeJev, resetJevCircuit } from '../jev';
beforeEach(() => { resetJevCircuit(); vi.stubEnv('TYPESAFE_API_KEY', 'synthetic-secret'); });
afterEach(() => vi.unstubAllEnvs());
const answer = { model: JEV_MODEL, answers: { route: { type: 'choice', choice: 'FAST_TOOL', confidence: 0.99, probabilities: { FAST_TOOL: 0.99, JARVIS_PLANNER: 0.01, CLARIFY: 0 } } }, usage: { input_tokens: 100, output_tokens: 10 } };
it('records a shadow decision without granting a fast path or exposing the key', async () => {
  const fetcher = vi.fn(async () => Response.json(answer));
  const result = await observeJev('Arată taskurile', ['read'], { fetcher });
  expect(result).toMatchObject({ route: 'FAST_TOOL', actualRoute: 'JARVIS_PLANNER', status: 'ok', estimated: false });
  expect(result?.costUsd).toBeCloseTo(0.0000042);
  expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  expect(fetcher.mock.calls).toHaveLength(1);
});
it('fails closed on unknown labels, models and probability distributions', async () => {
  for (const malformed of [{ ...answer, model: 'other' }, { ...answer, answers: { route: { ...answer.answers.route, choice: 'EXECUTE_ALL' } } }, { ...answer, answers: { route: { ...answer.answers.route, probabilities: { FAST_TOOL: 1, JARVIS_PLANNER: 1, CLARIFY: 1 } } } }]) {
    resetJevCircuit();
    expect(await observeJev('read', [], { fetcher: async () => Response.json(malformed) })).toMatchObject({ status: 'fallback', route: 'JARVIS_PLANNER' });
  }
});
it('bounds errors and stops calling an unavailable provider', async () => {
  const fetcher = vi.fn(async () => new Response('secret provider body', { status: 529 }));
  for (let i = 0; i < 3; i++) await observeJev('x', [], { fetcher });
  expect(await observeJev('x', [], { fetcher })).toMatchObject({ reasonCode: 'circuit_open', costUsd: 0 });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not call when disabled or unconfigured', async () => {
  vi.stubEnv('JARVIS_JEV_MODE', 'off');
  const fetcher = vi.fn();
  expect(await observeJev('x', [], { fetcher })).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});
