import { collectionFor, type AssistantContext } from './access';
import type { AssistantMessage } from './contracts';

// Covers failures before chatTurn owns the conversation lock. A stale worker
// cannot publish, and a different active turn keeps its lock and reply.
export async function saveWorkerTurnFailure(ctx: AssistantContext, input: { sessionId: string; requestId: string; prompt: string }, claimId: string) {
  const jobRef = ctx.adminDb.collection('assistantAgentJobs').doc(input.requestId);
  const sessionRef = collectionFor(ctx, 'assistantSessions').doc(input.sessionId);
  const replyRef = sessionRef.collection('messages').doc(`${input.requestId}-assistant`);
  const createdAt = new Date().toISOString();
  const message: AssistantMessage = { id: replyRef.id, role: 'assistant', outputType: 'ERROR_EVENT', accessRefs: [], createdAt, text: 'Nu am putut confirma finalizarea acestei comenzi. Verifică istoricul și înregistrările CRM înainte de a repeta o acțiune. Poți solicita din nou o citire.' };
  return ctx.adminDb.runTransaction(async tx => {
    const [job, member, session, reply] = await Promise.all([tx.get(jobRef), tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(sessionRef), tx.get(replyRef)]);
    const source = job.data();
    if (source?.claimId !== claimId || source?.status !== 'running' || source?.jobType !== 'turn' || source?.sessionId !== input.sessionId || source?.prompt !== input.prompt || source?.userId !== ctx.uid || source?.agencyId !== ctx.agencyId || source?.role !== ctx.role || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '')) return null;
    if ((session.exists && session.data()?.ownerId !== ctx.uid) || reply.exists) return null;
    if (!session.exists) tx.create(sessionRef, { ownerId: ctx.uid, title: input.prompt.slice(0, 100), createdAt, updatedAt: createdAt, busyUntil: 0 });
    tx.set(sessionRef.collection('messages').doc(`${input.requestId}-user`), { role: 'user', text: input.prompt, createdAt });
    tx.create(replyRef, message);
    if (session.exists) tx.update(sessionRef, { updatedAt: createdAt });
    return message;
  });
}
