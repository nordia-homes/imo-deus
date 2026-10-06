import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedModel, routeModel, usageCost, MODEL_IDS } from '../models';
import { AgentBudget, BudgetExceeded, DEFAULT_LIMITS } from '../budget';
import { payloadHash, approvalEnvelope, validateApproval } from '../approval';
import { filterMatches, compressedResult, contextMessages } from '../context';
it('retains year and CRM comparison uncertainty when large owner results are compressed', () => {
  const value = compressedResult({ rows: [{ id: 'owner', constructionYear: null, constructionYearEvidenceKind: 'declared_interval', constructionYearLowerBound: 1977, constructionYearUpperBound: 1990, yearFilterSatisfied: false, description: 'x'.repeat(20000) }], crmComparison: { mode: 'exact_references', semanticDuplicateDetection: false } }, 1500);
  const result = JSON.parse(value);
  expect(result).toMatchObject({ complete: false, crmComparison: { semanticDuplicateDetection: false }, rows: [{ yearFilterSatisfied: false, constructionYearEvidenceKind: 'declared_interval', constructionYearLowerBound: 1977 }] });
  expect(Buffer.byteLength(value)).toBeLessThanOrEqual(1500);
});
import { configuredMcpServers, publicAddress, validateMcpArguments } from '../mcp';
import type { AssistantAction, AssistantMessage } from '../contracts';
afterEach(() => { vi.unstubAllEnvs(); });
const action: AssistantAction = { kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00.000Z' };
describe('Luna-first routing and costs', () => {
  it.each(['gpt-6-astra', 'gpt-5.6-sol', 'gpt-4.1-mini', '__proto__', 'gpt-6-sol'])('rejects unallowlisted model %s', id => { expect(() => allowedModel(id)).toThrow(); });
  it('uses Luna for ordinary tools and a single failure', () => { expect(routeModel().model).toBe('gpt-6-luna'); expect(routeModel({ invalidCalls: 1, estimatedTools: 3 }).logical).toBe('LUNA'); });
  it('escalates only on evidence and sufficient budget', () => { expect(routeModel({ invalidCalls: 3 }).logical).toBe('SOL'); expect(routeModel({ invalidCalls: 3, remainingCost: 0.001 }).logical).toBe('LUNA'); expect(routeModel({ dependencyDepth: 5, estimatedTools: 8 }).logical).toBe('SOL'); });
  it('never treats an outage as a quality escalation', () => { expect(routeModel({ invalidCalls: 5, infrastructureFailure: true }).logical).toBe('LUNA'); });
  it('honors the escalation flag and rejects a forbidden env mapping', () => { expect(routeModel({ invalidCalls: 4 }, false).logical).toBe('LUNA'); vi.stubEnv('OPENAI_ASSISTANT_MODEL', 'gpt-6-astra'); expect(() => routeModel()).toThrow(); });
  it('prices cached input and cache writes separately', () => { expect(usageCost(MODEL_IDS[0], { inputTokens: 1000000, outputTokens: 0, cachedTokens: 500000, cacheWriteTokens: 200000, estimated: false })).toBeCloseTo(0.06); });
  it('blocks token, tool, time and cost runaway before another call', () => { const budget = new AgentBudget({ ...DEFAULT_LIMITS, maxToolCalls: 1 }); budget.tool(); expect(() => budget.tool()).toThrow(BudgetExceeded); expect(() => budget.reserve('gpt-6.1-sol', 1000000, 4000)).toThrow(BudgetExceeded); });
});
describe('bound approvals and contextual matching', () => {
  it('binds approval to tenant, actor, plan, exact payload and expiration', () => { const envelope = approvalEnvelope('u', 'a', 'p', [action], Date.now() + 60000); expect(() => validateApproval(envelope, 'u', 'a', 'p', [action])).not.toThrow(); for (const [u, a, p] of [['other', 'a', 'p'], ['u', 'other', 'p'], ['u', 'a', 'other']]) expect(() => validateApproval(envelope, u, a, p, [action])).toThrow(); expect(() => validateApproval(envelope, 'u', 'a', 'p', [{ ...action, description: 'Changed' }])).toThrow(); expect(() => validateApproval({ ...envelope, expiresAt: 0 }, 'u', 'a', 'p', [action])).toThrow(); });
  it('hashes semantic payload independent of object key order', () => { expect(payloadHash([action])).toBe(payloadHash([{ dueDate: action.dueDate, description: action.description, kind: action.kind }])); });
  it('filters only the existing set and preserves exact scores, reasons and stable ties', () => { const rows = [{ id: '1', price: 140000, location: 'Titan', matchScore: 82, reasoning: 'Existing reason' }, { id: '2', price: 100000, location: 'Titan', matchScore: 92 }, { id: '3', price: 90000, location: 'Pipera', matchScore: 99 }]; const filtered = filterMatches(rows, { priceMax: 150000, zone: 'Titan', limit: 2, sortBy: 'score' }); expect(filtered.map(row => row.id)).toEqual(['2', '1']); expect(filtered[1]).toBe(rows[0]); expect(rows[0].matchScore).toBe(82); expect(rows[0].reasoning).toBe('Existing reason'); });
  it('trims context without manufacturing CRM summaries', () => { const history = Array.from({ length: 30 }, (_, i) => ({ id: String(i), text: 'x'.repeat(2000), role: 'user', createdAt: '' })) as AssistantMessage[]; expect(contextMessages(history, 5000)).toHaveLength(2); });
  it('discloses compressed results and preserves a byte-bounded continuation for large fields', () => { const raw = compressedResult({ value: 'ș'.repeat(20000), offset: 100, total: 20100 }, 500); const compressed = JSON.parse(raw); expect(compressed.complete).toBe(false); expect(compressed.nextOffset).toBe(100 + compressed.value.length); expect(compressed.value.length).toBeGreaterThan(0); expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(500); });
});
describe('MCP isolation and hostile input', () => {
  it.each(['127.0.0.1', '10.1.1.1', '172.20.1.1', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1', '224.0.0.1', 'invalid'])('rejects private/reserved address %s', ip => { expect(publicAddress(ip)).toBe(false); });
  it('isolates server discovery to its configured agency', () => { vi.stubEnv('JARVIS_MCP', 'true'); vi.stubEnv('JARVIS_MCP_SERVERS', JSON.stringify([{ id: 'server', endpoint: 'https://example.com/mcp', agencyIds: ['a'], tools: ['search'] }])); expect(configuredMcpServers({ agencyId: 'b' })).toEqual([]); expect(configuredMcpServers({ agencyId: 'a' })).toHaveLength(1); });
  it('blocks arbitrary arguments and schemas with external references', () => { const schema = { type: 'object', properties: { count: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['count'] }; expect(() => validateMcpArguments(schema, { count: 5 })).not.toThrow(); expect(() => validateMcpArguments(schema, { count: 100 })).toThrow(); expect(() => validateMcpArguments(schema, { count: 5, agencyId: 'other' })).toThrow(); expect(() => validateMcpArguments({ $ref: 'https://attacker' }, {})).toThrow(); });
});
