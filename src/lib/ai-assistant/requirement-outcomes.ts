import { goalCoverageSchema } from './goal-coverage';
import { summarizeOutcome, type GoalState, type OutcomeEvidence } from './outcome';

export type RequirementOutcome = {
  id: string; description: string; steps: number[];
  state: GoalState | 'ANSWERED' | 'UNSUPPORTED';
  confirmed: number; total: number; pending: number; uncertain: number; failed: number;
  note: string;
};
export type RequirementReport = { status: 'available' | 'missing' | 'invalid'; rows: RequirementOutcome[]; note: string };

// Project authorized plan evidence onto each original requirement. The model's
// decomposition is not proof that every natural-language clause was found.
export function requirementOutcomes(status: string, actionCount: number, coverage: unknown, evidence: OutcomeEvidence[]): RequirementReport {
  if (coverage === undefined) return { status: 'missing', rows: [], note: 'Acoperirea cererii nu este disponibilă pentru acest plan. Rezultatele pașilor sunt prezentate separat.' };
  const parsed = goalCoverageSchema.safeParse(coverage);
  const invalid = (): RequirementReport => ({ status: 'invalid', rows: [], note: 'Legătura dintre cerințe și pași nu este validă. Este necesară reconciliere; rezultatele pașilor nu confirmă întregul obiectiv.' });
  if (!parsed.success || !Number.isSafeInteger(actionCount) || actionCount < 0) return invalid();
  const requirements = parsed.data.requirements;
  if (new Set(requirements.map(row => row.id)).size !== requirements.length) return invalid();
  for (const row of requirements) {
    if (row.steps.some(step => step > actionCount) || new Set(row.steps).size !== row.steps.length) return invalid();
    if (row.resolution === 'planned' ? !row.steps.length : !!row.steps.length) return invalid();
    if (row.resolution === 'answered' && !row.evidenceCallIds.length) return invalid();
  }
  const covered = new Set(requirements.flatMap(row => row.steps));
  if (Array.from({ length: actionCount }, (_, i) => i + 1).some(step => !covered.has(step))) return invalid();
  const rows = requirements.map((row): RequirementOutcome => {
    const base = { id: row.id, description: row.description, steps: row.steps, confirmed: 0, total: row.steps.length, pending: 0, uncertain: 0, failed: 0 };
    if (row.resolution === 'answered') return { ...base, state: 'ANSWERED', note: 'Răspuns sau rezultat înregistrat înaintea execuției acestui plan. Dovezile de atunci nu au fost recitite prin această verificare.' };
    if (row.resolution === 'unsupported') return { ...base, state: 'UNSUPPORTED', note: 'Această cerință nu este susținută de planul curent.' };
    if (row.resolution === 'needs_clarification') return { ...base, state: 'NEEDS_CLARIFICATION', note: 'Este necesară o clarificare pentru această cerință.' };
    const positions = new Map(row.steps.map((step, index) => [step, index + 1]));
    const subset = evidence.filter(item => positions.has(item.step)).map(item => ({ ...item, step: positions.get(item.step)! }));
    // Keep duplicate observations: the shared reducer detects contradictions.
    const result = summarizeOutcome(status, row.steps.length, subset);
    return { ...base, state: result.state, confirmed: result.confirmed, pending: result.pending, uncertain: result.uncertain, failed: result.failed, note: result.note };
  });
  return { status: 'available', rows, note: 'Rezultate pentru cerințele identificate în plan, pe baza dovezilor disponibile. Confirmarea unui pas nu garantează un rezultat comercial ulterior.' };
}
