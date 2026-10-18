import { canExecutePreparedProspecting } from './prospecting-plan';
import type { NamedChoice } from './named-choice-contract';
import { createHash } from 'node:crypto';
import { collectionFor, referencesAllowed, type AssistantContext } from './access';
import { actionSchema } from './contracts';
import { VERSIONS } from './models';
import type { planTurn } from './planner';
type PlannedTurn = Awaited<ReturnType<typeof planTurn>>;
export function incompletePlanning(result: PlannedTurn, prompt: string) {
 return ['partial', 'failed', 'unavailable'].includes(result.metrics.status) && !canExecutePreparedProspecting(prompt, result.metrics.status, result.actions, result.goalCoverage);
}
type Input = { sessionId: string; requestId: string; prompt: string; currentRecord?: { resource: string; id: string } | null; choice?: NamedChoice };
export function requestCheckpointHash(input: Input) {
 return createHash('sha256').update(JSON.stringify([input.sessionId,input.requestId,input.prompt,input.currentRecord?.resource || null,input.currentRecord?.id || null,...(input.choice ? [input.choice.messageId,input.choice.source,input.choice.rowId,...(input.choice.rowIds ? [input.choice.rowIds] : []),...(input.choice.offerId ? [input.choice.offerId] : [])] : [])])).digest('hex');
}
export async function loadRequestCheckpoint(ctx: AssistantContext, input: Input): Promise<PlannedTurn | undefined> {
 const session = collectionFor(ctx,'assistantSessions').doc(input.sessionId);
 const owner = await session.get();
 if (owner.data()?.ownerId !== ctx.uid) throw new Error('Conversația nu este accesibilă.');
 const saved = (await session.collection('requests').doc(input.requestId).get()).data();
 if (!saved) return undefined;
 if (saved.ownerId !== ctx.uid || saved.requestHash !== requestCheckpointHash(input) || saved.version !== JSON.stringify(VERSIONS)) throw new Error('Solicitarea salvată necesită verificare; nu poate fi înlocuită sau reluată cu alt conținut.');
 const result = saved.result as PlannedTurn;
 if (!Array.isArray(result?.actions) || !Array.isArray(result.accessRefs) || !result.metrics || !(await referencesAllowed(ctx,result.accessRefs))) throw new Error('Rezultatul salvat nu mai este accesibil.');
 result.actions.forEach(action => actionSchema.parse(action));
 return result;
}
export async function saveRequestCheckpoint(ctx: AssistantContext, input: Input, result: PlannedTurn, owningRequestId = input.requestId, replaceIncomplete = false) {
 const session = collectionFor(ctx,'assistantSessions').doc(input.sessionId);
 const checkpoint = session.collection('requests').doc(input.requestId);
 await ctx.adminDb.runTransaction(async tx => {
  const [owner, existing] = await Promise.all([tx.get(session),tx.get(checkpoint)]);
  if (owner.data()?.ownerId !== ctx.uid || owner.data()?.turnId !== owningRequestId) throw new Error('Solicitarea nu mai deține conversația.');
  if (existing.exists && !(replaceIncomplete && existing.data()?.phase === 'planning_incomplete' && existing.data()?.ownerId === ctx.uid && existing.data()?.requestHash === requestCheckpointHash(input) && existing.data()?.version === JSON.stringify(VERSIONS))) throw new Error('Planificarea solicitării a fost deja salvată.');
  // Persist BEFORE execution. Recovery reuses the exact action order and existing
  // request-safe-N ledger keys; never regenerate a plan after an uncertain effect.
  const saved = JSON.parse(JSON.stringify({ ownerId:ctx.uid,requestHash:requestCheckpointHash(input),version:JSON.stringify(VERSIONS),phase:incompletePlanning(result,input.prompt)?'planning_incomplete':'planned',createdAt:new Date().toISOString(),result }));
  if (existing.exists) tx.set(checkpoint, saved); else tx.create(checkpoint, saved);
 });
}
