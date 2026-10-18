import { z } from 'zod';
import { recoveryEffects } from './recovery-effects';
import { collectionFor, referencesAllowed, type AssistantContext } from './access';
import { idSchema, type AccessReference } from './contracts';
import { requestCheckpointHash } from './request-checkpoint';
import { VERSIONS } from './models';

export const requestRecoverySchema = z.object({ mode: z.enum(['inspect', 'resume']), requestId: idSchema.optional() }).strict();
export type RecoveryRecord = {
 ownerId: string; input: Parameters<typeof requestCheckpointHash>[0]; planningPrompt: string; executionPrompt: string;
 authorityPrompt: string; executionScope: string; accessRefs: AccessReference[]; version: string;
 previousRequestId: string | null; status: 'pending' | 'complete' | 'plan_pending' | 'redirected';
};
export async function beginRequestRecovery(ctx: AssistantContext, record: Omit<RecoveryRecord, 'ownerId' | 'version' | 'previousRequestId' | 'status'>) {
 const session = collectionFor(ctx, 'assistantSessions').doc(record.input.sessionId);
 const ref = session.collection('recoveries').doc(record.input.requestId);
 await ctx.adminDb.runTransaction(async tx => {
  const [owner, previous] = await Promise.all([tx.get(session), tx.get(ref)]);
  if (owner.data()?.ownerId !== ctx.uid || owner.data()?.turnId !== record.input.requestId) throw new Error('Cererea nu mai deține conversația.');
  if (previous.exists) {
   if (requestCheckpointHash(previous.data()!.input) !== requestCheckpointHash(record.input)) throw new Error('Cerere de recuperare incompatibilă.');
   return;
  }
  // A validated named choice advances the same goal, with its now-expanded prompt.
  // Do not leave its old unresolved offer as a second resumable request.
  if (record.input.choice?.messageId.endsWith('-assistant')) {
   const source = session.collection('recoveries').doc(record.input.choice.messageId.slice(0, -10));
   const selected = await tx.get(source);
   if (selected.exists && selected.data()?.ownerId === ctx.uid && selected.data()?.executionScope === record.executionScope) tx.update(source, { status: 'redirected' });
  }
  tx.create(ref, JSON.parse(JSON.stringify({ ...record, ownerId: ctx.uid, version: JSON.stringify(VERSIONS), previousRequestId: owner.data()?.pendingRecoveryId || null, status: 'pending' })));
  tx.update(session, { pendingRecoveryId: record.input.requestId });
 });
}
export async function readRequestRecovery(ctx: AssistantContext, requestedId?: string) {
 const current = ctx.prospectingRequest;
 if (!current) throw new Error('Recuperarea necesită o conversație autentificată.');
 const session = collectionFor(ctx, 'assistantSessions').doc(current.sessionId);
 const owner = await session.get();
 if (owner.data()?.ownerId !== ctx.uid) throw new Error('Conversația nu este accesibilă.');
 const active = (await session.collection('recoveries').doc(current.requestId).get()).data();
 const requestId = requestedId || active?.previousRequestId;
 if (!requestId) return undefined;
 idSchema.parse(requestId);
 if (requestId === current.requestId) throw new Error('Cererea curentă nu poate fi propria continuare.');
 const record = (await session.collection('recoveries').doc(requestId).get()).data() as RecoveryRecord | undefined;
 if (!record || record.ownerId !== ctx.uid || record.input.sessionId !== current.sessionId || record.input.requestId !== requestId) throw new Error('Cererea nu este accesibilă în această conversație.');
 if (record.version !== JSON.stringify(VERSIONS)) throw new Error('Versiunea cererii necesită reconciliere înainte de reluare.');
 if (!(await referencesAllowed(ctx, record.accessRefs))) throw new Error('Accesul la datele cererii a fost revocat.');
 return { requestId, record };
}
export async function requestRecoveryTool(ctx: AssistantContext, input: z.infer<typeof requestRecoverySchema>) {
 const found = await readRequestRecovery(ctx, input.requestId);
 if (!found) return { data: { status: 'none', resumable: false }, refs: [] };
 const effects = input.mode==='inspect' ? await recoveryEffects(ctx,found.record) : undefined;
 return { data: { ...(effects ? {effects:{phase:effects.phase,steps:effects.steps}} : {}), requestId: found.requestId, prompt: found.record.planningPrompt, status: found.record.status, resumable: found.record.status === 'pending', instruction: 'Păstrează integral scopul și restricțiile originale. resume este numai pentru continuarea aceleiași cereri, fără modificări. Pentru schimbări, interdicții sau simpla verificare a stării, nu relua execuția. plan_pending se gestionează prin planul existent.' }, refs: effects?.refs || found.record.accessRefs };
}
