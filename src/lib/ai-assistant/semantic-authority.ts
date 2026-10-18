import { createHash } from 'node:crypto';
import { payloadHash } from './approval';
import type { AssistantAction } from './contracts';
import type { GoalCoverage } from './goal-coverage';

/** Internal server binding. Never accepted from a browser or stored as a permission grant.
 * The model interprets language; this binding does NOT certify semantic correctness.
 * Role/resource checks, revisions, dates and execution ledgers remain mandatory. */
const requestHash = (request: string) => createHash('sha256').update(request).digest('hex');
export type SemanticAuthority = { requestHash: string; evaluated: string[]; executable: string[] };
export function bindSemanticAuthority(request: string, actions: AssistantAction[], coverage?: GoalCoverage): SemanticAuthority | undefined {
 if (!coverage?.requirements.some(row => row.execution)) return undefined;
 const evaluated: string[] = [], executable: string[] = [];
 actions.forEach((action, index) => {
  const hash = `${index + 1}:${payloadHash([action])}`, requirements = coverage.requirements.filter(row => row.steps.includes(index + 1));
  evaluated.push(hash);
  // Every requirement attached to this action must explicitly request execution.
  // Missing, draft-only, prohibited or unresolved conditional intent cannot fall
  // back to a verb match and execute a partially interpreted request.
  if (requirements.length && requirements.every(row => row.resolution === 'planned' && row.execution?.mode === 'execute' && row.execution.conditions.every(condition => condition.satisfied && condition.evidenceCallIds.length > 0))) executable.push(hash);
 });
 return { requestHash: requestHash(request), evaluated, executable };
}
export function semanticActionDecision(authority: SemanticAuthority | undefined, request: string, action: AssistantAction, step = 1): boolean | undefined {
 if (!authority) return undefined;
 if (authority.requestHash !== requestHash(request)) return false;
 const hash = `${step}:${payloadHash([action])}`;
 return authority.evaluated.includes(hash) && authority.executable.includes(hash);
}
export const SEMANTIC_EXECUTION_POLICY = 'Interpretează intenția în limbaj natural, nu după potrivirea cu formulări exemplu. Pentru FIECARE cerință din goal_coverage completează execution: mode=execute când agentul cere realizarea acțiunii (inclusiv pașii necesari, precum crearea cumpărătorului pentru vizionare), prepare când cere doar propunere/ciornă/verificare, prohibited pentru interdicție. Separă cerințele compuse: o verificare nu anulează o comandă distinctă și o interdicție nu autorizează alte modificări. Păstrează fiecare condiție și excepție în conditions cu citat exact. satisfied=true necesită o citire actuală care dovedește concret condiția și ID-ul ei în evidenceCallIds; simpla existență a unui apel nu dovedește condiția. Nu transforma condițiile viitoare în adevăruri. Nu omite clauze pentru a încheia. Folosește numai ID-uri obținute din CRM, păstrează toate restricțiile cererii și confirmă succesul numai din rezultatul execuției. Acest contract nu acordă roluri sau acces la resurse.';
