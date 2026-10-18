import type { NamedChoice } from './named-choice-contract';
import { createHash } from 'node:crypto';
import { collectionFor, referencesAllowed, type AssistantContext } from './access';
import { actionSchema } from './contracts';
import { VERSIONS } from './models';
import type { planTurn } from './planner';
type PlannedTurn = Awaited<ReturnType<typeof planTurn>>;
type Input = { sessionId: string; requestId: string; prompt: string; currentRecord?: { resource: string; id: string } | null; choice?: NamedChoice };
export function requestCheckpointHash(input: Input) {
 return createHash('sha256').update(JSON.stringify([input.sessionId,input.requestId,input.prompt,input.currentRecord?.resource || null,input.currentRecord?.id || null,...(input.choice ? [input.choice.messageId,input.choice.source,input.choice.rowId] : [])])).digest('hex');
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
export async function saveRequestCheckpoint(ctx: AssistantContext, input: Input, result: PlannedTurn) {
 const session = collectionFor(ctx,'assistantSessions').doc(input.sessionId);
 const checkpoint = session.collection('requests').doc(input.requestId);
 await ctx.adminDb.runTransaction(async tx => {
  const [owner, existing] = await Promise.all([tx.get(session),tx.get(checkpoint)]);
  if (owner.data()?.ownerId !== ctx.uid || owner.data()?.turnId !== input.requestId) throw new Error('Solicitarea nu mai deține conversația.');
  if (existing.exists) throw new Error('Planificarea solicitării a fost deja salvată.');
  // Persist BEFORE execution. Recovery reuses the exact action order and existing
  // request-safe-N ledger keys; never regenerate a plan after an uncertain effect.
  tx.create(checkpoint, JSON.parse(JSON.stringify({ ownerId:ctx.uid,requestHash:requestCheckpointHash(input),version:JSON.stringify(VERSIONS),phase:'planned',createdAt:new Date().toISOString(),result })));
 });
}
