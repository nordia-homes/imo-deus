import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { HttpJevSelector, resetSelectionCircuit, selectionRequest, jevMode } from '../jev-selection';
import { capabilityIds } from '../capability-catalog';
import { JEV_MODEL } from '../jev';
beforeEach(() => { resetSelectionCircuit(); vi.stubEnv('TYPESAFE_API_KEY', 'synthetic'); });
afterEach(() => vi.unstubAllEnvs());
const state = { request: 'Programează o vizionare și trimite confirmarea.', context: [] };
const valid = () => ({ model: JEV_MODEL, answers: {facebook_publication:{type:'noul',noul:0.9},...Object.fromEntries(capabilityIds.map(id => [id, { type: 'noul', noul: ['calendar', 'communications'].includes(id) ? 0.9 : 0.01 }]))}, usage: { input_tokens: 100, output_tokens: 10 } });
it('selects multiple domains with the exact supported protocol and a pinned model', async () => { const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(valid())); const result = await new HttpJevSelector(fetcher).select(state); expect(result.modules).toEqual(['calendar', 'communications']); expect(result.workflows).toEqual(['facebook_publication']); expect(result.costUsd).toBeCloseTo(0.0000042); expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual(selectionRequest(state)); });
it.each(['model', 'missing', 'probability', 'oversized', 'error'])('falls back on %s response', async (kind) => { const body = valid(); if (kind === 'model')
    body.model = 'unknown'; if (kind === 'missing')
    delete body.answers.calendar; if (kind === 'probability')
    body.answers.calendar.noul = 2; const result = await new HttpJevSelector(async () => kind === 'error' ? new Response('', { status: 503 }) : kind === 'oversized' ? new Response('x'.repeat(40000)) : Response.json(body)).select(state); expect(result.status).toBe('fallback'); expect(result.modules).toEqual([]); });
it('does not truncate a large request or send it externally', async () => { const fetcher = vi.fn(); const result = await new HttpJevSelector(fetcher).select({ request: 'x'.repeat(17000), context: [] }); expect(result.reason).toBe('selection_context_too_large'); expect(fetcher).not.toHaveBeenCalled(); });
it('opens the circuit and preserves a no-cost fallback for later calls', async () => { const fetcher = vi.fn(async () => new Response('', { status: 429 })), selector = new HttpJevSelector(fetcher); for (let i = 0; i < 3; i++)
    await selector.select(state); expect(await selector.select(state)).toMatchObject({ reason: 'circuit_open', costUsd: 0 }); expect(fetcher).toHaveBeenCalledTimes(3); });
it('fails to off for unknown configuration values', () => { vi.stubEnv('JARVIS_JEV_MODE', 'anything'); expect(jevMode()).toBe('off'); });
