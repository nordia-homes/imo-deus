import { expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {}, agencyCollection: vi.fn() }));
import corpus from '../../../../docs/jarvis/evals/continuation-scenarios.json';
import { searchSchema } from '../contracts';
import { searchMatches } from '../search';
import { constructionYearEvidence } from '../search-criteria';
import { summarizeOutcome, type OutcomeEvidence } from '../outcome';
import { validateGoalCoverage } from '../goal-coverage';
import { bindVerifiedOutputs } from '../verified-outputs';
import { quietAt } from '../daily-brief-contract';
import { officialUrl } from '../official-source-contract';
import { validatePreference } from '../preferences';

const baseListing = { publicationStatus: 'ready', isCanonical: true, price: '120000 €', roomsValue: 2, propertyType: 'apartment', transactionType: 'sale', location: 'Titan' };
const requirement = { id: 'task', sourceQuote: 'Creează task', description: 'Sarcina cerută', resolution: 'planned', steps: [1], evidenceCallIds: [] };

// Each JSON row is an independently named scenario in the persisted test report.
// These are deterministic behavior checks, not live-model or provider acceptance.
for (const scenario of corpus.scenarios) {
  it(`${scenario.id} [${scenario.category}] ${scenario.name}`, () => {
    const input = scenario.input as Record<string, any>;
    switch (scenario.category) {
      case 'search': {
        const row = { ...baseListing, ...input.row };
        const query = searchSchema.parse(input.query);
        expect(searchMatches(row, query)).toBe(scenario.expected);
        const evidence = constructionYearEvidence(row);
        if (evidence.constructionYear === null) expect(evidence.constructionYearKnown).toBe(false);
        break;
      }
      case 'outcome': {
        const outcome = summarizeOutcome(input.status, input.total, input.evidence as OutcomeEvidence[]);
        expect(outcome.state).toBe(scenario.expected);
        expect(outcome.confirmed).toBeLessThanOrEqual(input.total);
        break;
      }
      case 'coverage': {
        const check = () => validateGoalCoverage({ requirements: [{ ...requirement, ...input.patch }] }, 'Creează task pentru Andrei', input.count, new Set(input.reads));
        if (scenario.expected) expect(check).not.toThrow(); else expect(check).toThrow();
        break;
      }
      case 'outputs': {
        const original = [{ step: 1, result: { jobId: 'job-1', executionState: 'queued' }, ...(input.previous ? { outputs: input.previous } : {}) }];
        const snapshot = structuredClone(original);
        const check = () => bindVerifiedOutputs(original, [{ step: 1, completionSatisfied: input.satisfied, outputs: input.outputs }]);
        if (scenario.expected === false) expect(check).toThrow();
        else if (scenario.expected === 'ignored') expect(check()).toEqual(original);
        else expect(check()[0].outputs).toEqual(input.outputs);
        expect(original).toEqual(snapshot);
        break;
      }
      case 'quiet': expect(quietAt(input.time, input.start, input.end)).toBe(scenario.expected); break;
      case 'official_url': if (scenario.expected) expect(() => officialUrl(input.url)).not.toThrow(); else expect(() => officialUrl(input.url)).toThrow(); break;
      case 'preference': if (scenario.expected) expect(() => validatePreference(input.key, input.value)).not.toThrow(); else expect(() => validatePreference(input.key, input.value)).toThrow(); break;
      default: throw new Error(`Scenario category has no evaluator: ${scenario.category}`);
    }
  });
}
