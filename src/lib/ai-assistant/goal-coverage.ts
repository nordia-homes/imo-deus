import { z } from 'zod';
import type { GoalOutcome, OutcomeEvidence } from './outcome';

export const goalCoverageSchema = z.object({ requirements: z.array(z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  sourceQuote: z.string().min(1).max(1000),
  description: z.string().min(1).max(500),
  resolution: z.enum(['planned', 'answered', 'needs_clarification', 'unsupported']),
  steps: z.array(z.number().int().min(1).max(100)).max(100),
  evidenceCallIds: z.array(z.string().min(1).max(180)).max(20),
}).strict()).min(1).max(30) }).strict();
export type GoalCoverage = z.infer<typeof goalCoverageSchema>;

// The model decomposes intent; the server validates references and evidence.
// This does not claim a semantic proof that every natural-language clause was found.
export function validateGoalCoverage(value: unknown, request: string, actionCount: number, successfulReads: Set<string>): GoalCoverage {
  const result = goalCoverageSchema.parse(value), ids = new Set<string>();
  for (const requirement of result.requirements) {
    if (ids.has(requirement.id)) throw new Error('ID de cerință duplicat.');
    ids.add(requirement.id);
    if (!request.includes(requirement.sourceQuote)) throw new Error('Cerința trebuie legată de un citat exact din cererea curentă.');
    if (new Set(requirement.steps).size !== requirement.steps.length || requirement.steps.some(step => step > actionCount)) throw new Error('Referință invalidă la pașii planului.');
    if (requirement.resolution === 'planned' && !requirement.steps.length) throw new Error('Cerința planificată necesită cel puțin un pas.');
    if (requirement.resolution !== 'planned' && requirement.steps.length) throw new Error('Numai cerințele planificate pot declara pași.');
    if (requirement.resolution === 'answered' && !requirement.evidenceCallIds.length) throw new Error('Răspunsul verificat necesită o citire reușită.');
    if (requirement.evidenceCallIds.some(id => !successfulReads.has(id))) throw new Error('Dovadă de citire necunoscută sau nereușită.');
  }
  const covered = new Set(result.requirements.flatMap(row => row.steps));
  if (Array.from({ length: actionCount }, (_, i) => i + 1).some(step => !covered.has(step))) throw new Error('Fiecare acțiune trebuie legată de o cerință.');
  return result;
}

export function goalCoverageOutcome(outcome: GoalOutcome, coverage: GoalCoverage | undefined, rows: OutcomeEvidence[], required: boolean): GoalOutcome {
  if (!required || ['CANCELLED', 'PAUSED'].includes(outcome.state)) return outcome;
  if (!coverage) return { ...outcome, state: outcome.state === 'AWAITING_APPROVAL' ? outcome.state : 'BLOCKED', note: 'Acoperirea întregii cereri nu a fost verificată. Rezultatele pașilor sunt afișate separat.' };
  const missing = coverage.requirements.filter(row => ['needs_clarification', 'unsupported'].includes(row.resolution));
  if (missing.length) {
    // Preserve pending approvals, provider waits and failures. A limitation in one
    // requirement is not evidence that the rest has already finished.
    const settled = outcome.state === 'COMPLETED' || outcome.state === 'PARTIALLY_COMPLETED';
    const state = settled ? missing.some(row => row.resolution === 'needs_clarification') ? 'NEEDS_CLARIFICATION' : outcome.confirmed > 0 ? 'PARTIALLY_COMPLETED' : 'BLOCKED' : outcome.state;
    return { ...outcome, state, note: `${outcome.note} Cerințe neacoperite: ${missing.map(row => row.description).join('; ').slice(0, 1000)}. Pașii confirmați nu încheie întregul obiectiv.` };
  }
  const evidence = new Map(rows.map(row => [row.step, row]));
  if (outcome.state === 'COMPLETED' && coverage.requirements.some(requirement => requirement.resolution === 'planned' && requirement.steps.some(step => !evidence.has(step)))) return { ...outcome, state: 'BLOCKED', note: 'Lipsește dovada pentru o cerință planificată.' };
  return outcome;
}
