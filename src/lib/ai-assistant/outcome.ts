import { z } from 'zod';
import { goalCoverageSchema } from './goal-coverage';

export const goalStateSchema = z.enum(['RUNNING', 'WAITING_PROVIDER', 'AWAITING_APPROVAL', 'NEEDS_CLARIFICATION', 'PAUSED', 'BLOCKED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED']);
export type GoalState = z.infer<typeof goalStateSchema>;
export type OutcomeEvidence = { step: number; executionState: string; businessStatus?: string | null; evidenceSource?: string; verifiedAt?: string | null; watchable?: boolean; completionSatisfied?: boolean };
export type GoalOutcome = { schemaVersion: 1; state: GoalState; confirmed: number; total: number; pending: number; uncertain: number; failed: number; checkedAt: string; note: string };

// Pure reducer: a finished executor is NOT evidence of a finished business goal.
export function summarizeOutcome(status: string, total: number, rows: OutcomeEvidence[], now = new Date().toISOString()): GoalOutcome {
  const unique = new Map<number, OutcomeEvidence>();
  const conflicts = new Set<number>();
  const signature = (row: OutcomeEvidence) => JSON.stringify([row.executionState, row.businessStatus ?? null, row.evidenceSource ?? null, row.watchable ?? false, row.completionSatisfied ?? null]);
  for (const row of rows.filter(row => Number.isInteger(row.step) && row.step > 0 && row.step <= total)) {
    const previous = unique.get(row.step);
    if (previous && signature(previous) !== signature(row)) conflicts.add(row.step);
    unique.set(row.step, row);
  }
  let confirmed = 0, pending = 0, uncertain = 0, failed = 0;
  for (const row of unique.values()) {
    if (conflicts.has(row.step)) uncertain++;
    else if (row.completionSatisfied === true) confirmed++;
    else if (['failed', 'cancelled', 'unavailable'].includes(row.executionState)) failed++;
    else if (['queued', 'running'].includes(row.executionState) && row.watchable) pending++;
    else if (row.executionState === 'succeeded' && row.evidenceSource && row.completionSatisfied !== false) confirmed++;
    else uncertain++;
  }
  let state: GoalState;
  if (status === 'cancelled') state = 'CANCELLED';
  else if (status === 'paused') state = 'PAUSED';
  // A failed sibling does not settle a provider wait or an uncertain effect.
  else if (uncertain) state = 'BLOCKED';
  else if (pending) state = 'WAITING_PROVIDER';
  else if (failed) state = confirmed ? 'PARTIALLY_COMPLETED' : 'FAILED';
  else if (total > 0 && confirmed === total) state = 'COMPLETED';
  else if (status === 'pending' && unique.size === 0) state = 'AWAITING_APPROVAL';
  else if (['failed', 'unknown', 'completed'].includes(status)) state = 'BLOCKED';
  else state = 'RUNNING';
  const notes: Record<GoalState, string> = {
    RUNNING: 'Pașii rămași sunt în curs.', WAITING_PROVIDER: 'Aștept rezultatul furnizorului; apelul inițial nu se repetă.',
    AWAITING_APPROVAL: 'Planul este pregătit și necesită aprobare.', NEEDS_CLARIFICATION: 'Lipsește o informație necesară.',
    PAUSED: 'Planul este în pauză.', BLOCKED: 'Rezultatul complet nu este verificat. Este necesară reconciliere sau intervenție.',
    COMPLETED: 'Rezultatele pașilor sunt confirmate prin dovezile disponibile.', PARTIALLY_COMPLETED: 'O parte din rezultate este confirmată; există pași nereușiți.',
    FAILED: 'Rezultatul cerut nu a fost confirmat.', CANCELLED: 'Pașii rămași au fost opriți; efectele deja pornite pot continua.',
  };
  const mixed = failed > 0 && (pending > 0 || uncertain > 0);
  const note = mixed ? `${notes[state]} Rezultate confirmate: ${confirmed}; pași nereușiți: ${failed}; în așteptarea furnizorului: ${pending}; rezultate incerte: ${uncertain}.` : notes[state];
  return { schemaVersion: 1, state, confirmed, total, pending, uncertain, failed, checkedAt: now, note };
}

export const goalContractSchema = z.object({
  schemaVersion: z.literal(1), request: z.string().max(12000), requiredOutcome: z.string().max(2000),
  constraints: z.array(z.string().max(500)).max(20),
  coverageRequired: z.boolean().optional(), coverage: goalCoverageSchema.optional(),
  completionCriteria: z.array(z.object({ step: z.number().int().positive(), description: z.string().max(500) }).strict()).max(100),
}).strict();
export type GoalContract = z.infer<typeof goalContractSchema>;
