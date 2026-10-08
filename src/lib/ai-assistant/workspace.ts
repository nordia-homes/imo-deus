import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { collectionFor, referencesAllowed, actionReferences, type AssistantContext } from './access';
import { actionSchema, cardPreview, uniqueReferences, type AssistantMessage, type AssistantPlan, type AssistantCard } from './contracts';
import { planTurn } from './planner';
import { executeAction } from './actions';
import { CommunicationError } from '@/lib/communications/server';
import { resolveAction } from './dependencies';
import { bindVerifiedOutputs, restoreVerifiedOutputs } from './verified-outputs';
import { operations, isReadOperation } from './operations';
import { approvalEnvelope, payloadHash, validateApproval } from './approval';
import { telemetryDocument, type AgentEvent, type TurnMetrics } from './telemetry';
import { VERSIONS } from './models';
import { sessionSummary } from './context';
import { executeSafePrefix } from './autonomy';
import { viewingConfirmation } from './execution-confirmation';
import { actionRisk } from './registry';
import { OperationFailure } from './operation-error';
import { MAX_PLAN_ACTIONS, PLAN_EXECUTION_MS } from './plan-limits';
import { failureCategory } from './failure';
import { bindCalendarRevisions } from './calendar-revisions';
import { bindAgencyRevisions } from './agency-revisions';
import { bindBusinessRevisions } from './business-revisions';
import { continuePlanRevision } from './plan-revisions';
import { summarizeOutcome, type GoalContract } from './outcome';
import type { GoalCoverage } from './goal-coverage';

function planGoal(request: string, actions: z.infer<typeof actionSchema>[], coverage?: GoalCoverage, coverageRequired = false): GoalContract {
  return { schemaVersion: 1, request: request.slice(0, 12000), requiredOutcome: request.slice(0, 2000), constraints: [], coverageRequired, ...(coverage ? { coverage } : {}), completionCriteria: actions.map((action, index) => ({ step: index + 1, description: action.kind === 'existing_operation' ? action.operation : action.kind })) };
}

export async function requireSession(ctx: AssistantContext, id: string) {
  const ref = collectionFor(ctx, 'assistantSessions').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.ownerId !== ctx.uid) throw new CommunicationError('Conversația nu este accesibilă.', 404);
  return ref;
}
export async function sessionHistory(ctx: AssistantContext, sessionId: string, before?: string) {
  const ref = await requireSession(ctx, sessionId);
  let query = ref.collection('messages').orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
  if (before) {
    const anchor = await ref.collection('messages').doc(before).get();
    if (!anchor.exists) throw new CommunicationError('Cursor invalid.');
    query = query.startAfter(anchor);
  }
  const docs = await query.limit(40).get();
  // Revalidate current access once per distinct resource in this request, including
  // legacy conversations whose references were copied exponentially between turns.
  const accessCache = new Map<string, Promise<unknown>>();
  const messages = await Promise.all(docs.docs.map(async d => {
    const row = { ...d.data(), id: d.id } as AssistantMessage;
    if (!(await referencesAllowed(ctx, row.accessRefs, accessCache))) return { id: row.id, role: row.role, text: 'Acest răspuns conține resurse la care nu mai ai acces.', createdAt: row.createdAt } as AssistantMessage;
    return { ...row, ...(row.accessRefs ? { accessRefs: uniqueReferences(row.accessRefs) } : {}) };
  }));
  return { messages: messages.reverse(), nextCursor: docs.size === 40 ? docs.docs.at(-1)!.id : null };
}
export async function chatTurn(ctx: AssistantContext, input: { sessionId: string; requestId: string; prompt: string }, progress?: (event: AgentEvent) => void | Promise<void>) {
  const ref = collectionFor(ctx, 'assistantSessions').doc(input.sessionId);
  const reply = ref.collection('messages').doc(`${input.requestId}-assistant`);
  const prior = await reply.get();
  if (prior.exists) { await requireSession(ctx, input.sessionId); if (!(await referencesAllowed(ctx, prior.data()?.accessRefs))) throw new CommunicationError('Accesul la resursele răspunsului a fost revocat.', 403); return { message: { ...prior.data(), id: prior.id } as AssistantMessage }; }
  const now = new Date().toISOString();
  const actorLock = collectionFor(ctx, 'assistantLocks').doc(`chat-${ctx.uid}`);
  await ctx.adminDb.runTransaction(async tx => {
    const [snap, actor] = await Promise.all([tx.get(ref), tx.get(actorLock)]);
    if (snap.exists && snap.data()?.ownerId !== ctx.uid) throw new CommunicationError('Conversația nu este accesibilă.', 404);
    if (Number(snap.data()?.busyUntil || 0) > Date.now()) throw new CommunicationError('O cerere este deja în curs în această conversație.', 409);
    if (Number(actor.data()?.busyUntil || 0) > Date.now()) throw new CommunicationError('O comandă a agentului este deja în curs.', 429);
    tx.set(actorLock, { busyUntil: Date.now() + 180000, turnId: input.requestId });
    if (!snap.exists) tx.create(ref, { ownerId: ctx.uid, title: input.prompt.slice(0, 100), createdAt: now, updatedAt: now, busyUntil: Date.now() + 180000, turnId: input.requestId });
    else tx.update(ref, { busyUntil: Date.now() + 180000, turnId: input.requestId });
    tx.set(ref.collection('messages').doc(`${input.requestId}-user`), { role: 'user', text: input.prompt, createdAt: now });
  });
  let turnMetrics: TurnMetrics | undefined;
  const started = Date.now();
  try {
    const history = (await sessionHistory(ctx, input.sessionId)).messages.filter(m => m.id !== `${input.requestId}-user`);
    const session = await ref.get();
    const result = await planTurn(ctx, input.prompt, history, { progress, summary: session.data()?.summary });
    turnMetrics = result.metrics;
    const autonomous = result.metrics.status === 'success' && result.actions.length ? await executeSafePrefix(ctx, input.requestId, result.actions, input.prompt) : { actions: result.actions, results: [], blocked: false };
    for (const step of autonomous.results) {
      const receipt = step.result as Record<string, unknown> | undefined;
      if (step.kind === 'create_contact' && typeof receipt?.contactId === 'string') result.accessRefs.push({ resource: 'contacts', id: receipt.contactId });
    }
    result.actions = autonomous.actions;
    if (result.goalCoverage && autonomous.results.length) {
      const consumed = autonomous.results.length;
      result.goalCoverage = { requirements: result.goalCoverage.requirements.map(row => {
        if (row.resolution !== 'planned') return row;
        const remaining = row.steps.filter(step => step > consumed).map(step => step - consumed);
        return remaining.length ? { ...row, steps: remaining } : { ...row, resolution: 'answered' as const, steps: [], evidenceCallIds: [`autonomy:${input.requestId}`] };
      }) };
    }
    if (autonomous.results.length || autonomous.blocked) {
      result.text = `Pași safe confirmați: ${autonomous.results.length}. ${autonomous.blocked ? 'Execuția a fost oprită; verifică înregistrările înainte de reluare. Pașii următori nu au fost executați.' : result.actions.length ? 'Planul rămas necesită confirmare.' : 'Nu au fost trimise mesaje sau publicate anunțuri.'}`;
      const confirmation = viewingConfirmation(autonomous.results);
      if (confirmation) result.text = `${confirmation}\n${result.text}`;
      result.cards.push({ type: 'data', outputType: 'ACTION_RESULT', title: 'Execuție autonomă autorizată', source: 'autonomy', rows: autonomous.results });
      if (autonomous.blocked) result.metrics.status = 'partial';
    }
    const planId = result.actions.length ? randomUUID() : undefined;
    const message: AssistantMessage = { id: reply.id, role: 'assistant', outputType: 'TEXT', text: result.text, cards: result.cards.map(card => ({ ...card, rows: card.rows.map(row => cardPreview(row)) })), accessRefs: [...result.accessRefs, ...actionReferences(result.actions)], createdAt: new Date().toISOString(), ...(planId ? { planId, actions: result.actions } : {}) };
    await ctx.adminDb.runTransaction(async tx => {
      const [fresh, actor, member] = await Promise.all([tx.get(ref), tx.get(actorLock), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
      if (fresh.data()?.turnId !== input.requestId) throw new CommunicationError('Cererea a expirat. Reîncarcă istoricul.', 409);
      if (planId) tx.create(collectionFor(ctx, 'assistantPlans').doc(planId), { ownerId: ctx.uid, sessionId: input.sessionId, telemetryId: input.requestId, actions: result.actions, goal: planGoal(input.prompt, result.actions, result.goalCoverage, true), outcome: summarizeOutcome('pending', result.actions.length, []), accessRefs: message.accessRefs, status: 'pending', createdAt: message.createdAt, expiresAt: Date.now() + 3600000, approval: approvalEnvelope(ctx.uid, ctx.agencyId, planId, result.actions, Date.now() + 3600000), versions: VERSIONS });
      tx.set(reply, message);
      tx.set(collectionFor(ctx, 'assistantTelemetry').doc(input.requestId), telemetryDocument(ctx, input.requestId, input.sessionId, { ...result.metrics, requiresApproval: Boolean(planId) }));
      tx.update(ref, { busyUntil: 0, updatedAt: message.createdAt, summary: sessionSummary([...history, message]) });
      if (actor.data()?.turnId === input.requestId) tx.update(actorLock, { busyUntil: 0 });
    });
    return { message };
  } catch (error) {
    const category = failureCategory(error);
    console.error(JSON.stringify({ event: 'jarvis_turn_failed', category }));
    const failure: AssistantMessage = { id: reply.id, role: 'assistant', outputType: 'ERROR_EVENT', text: 'Nu am putut confirma finalizarea comenzii. Verifică istoricul și înregistrările CRM înainte de a repeta o acțiune. Poți solicita din nou o citire.', createdAt: new Date().toISOString() };
    const saved = await ctx.adminDb.runTransaction(async tx => {
      const [fresh, actor, member] = await Promise.all([tx.get(ref), tx.get(actorLock), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
      if (fresh.data()?.turnId === input.requestId) tx.update(ref, { busyUntil: 0 });
      if (actor.data()?.turnId === input.requestId) tx.update(actorLock, { busyUntil: 0 });
      if (fresh.data()?.turnId !== input.requestId || fresh.data()?.ownerId !== ctx.uid || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) return false;
      tx.set(reply, failure);
      tx.update(ref, { updatedAt: failure.createdAt });
      tx.set(collectionFor(ctx, 'assistantTelemetry').doc(input.requestId), { ...telemetryDocument(ctx, input.requestId, input.sessionId, { ...(turnMetrics || { models: [], tools: [] }), status: 'failed', elapsedMs: Date.now() - started }), usageComplete: Boolean(turnMetrics), errorCategory: category });
      return true;
    });
    if (saved) return { message: failure };
    throw error;
  }
}
export async function getPlan(ctx: AssistantContext, id: string) {
  const ref = collectionFor(ctx, 'assistantPlans').doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.ownerId !== ctx.uid) throw new CommunicationError('Planul nu este accesibil.', 404);
  if (!(await referencesAllowed(ctx, actionReferences(doc.data()?.actions || [])))) throw new CommunicationError('Accesul la resursele planului a fost revocat.', 403);
  if (!(await referencesAllowed(ctx, doc.data()?.accessRefs || []))) throw new CommunicationError('Accesul la rezultatele planului a fost revocat.', 403);
  const row = doc.data()!;
  return { ref, revision: doc.updateTime ? `${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}` : null, data: { ...row, id: doc.id, outputType: ['pending', 'running'].includes(row.status) ? 'CONFIRMATION_CARD' : 'ACTION_RESULT', risks: (row.actions || []).map(actionRisk), externalCostNote: (row.actions || []).some((action: any) => action.kind === 'existing_operation' && operations[action.operation]?.external) ? 'Costul extern se verifică în previzualizarea canalului sau campaniei. Bugetele din plan sunt limitele aprobate; o valoare indisponibilă nu înseamnă cost zero.' : undefined } as AssistantPlan & { sessionId: string; expiresAt: number; approval?: ReturnType<typeof approvalEnvelope> } };
}
export async function saveAssistantMessage(ctx: AssistantContext, sessionId: string, messageId: string, text: string, cards: AssistantCard[] = [], actions: z.infer<typeof actionSchema>[] = []) {
  actions = await bindBusinessRevisions(ctx, await bindAgencyRevisions(ctx, await bindCalendarRevisions(ctx, actions)));
  for (const action of actions) if (action.kind === 'existing_operation' && (!Object.hasOwn(operations, action.operation) || isReadOperation(action.operation))) throw new CommunicationError('Această operație nu poate fi pregătită ca mutație.');
  const session = collectionFor(ctx, 'assistantSessions').doc(sessionId);
  const messageRef = session.collection('messages').doc(messageId);
  const now = new Date().toISOString();
  const message: AssistantMessage = { id: messageId, role: 'assistant', text, cards, createdAt: now, ...(actions.length ? { actions, planId: messageId, accessRefs: actionReferences(actions) } : {}) };
  return ctx.adminDb.runTransaction(async tx => {
    const [previous, priorMessage] = await Promise.all([tx.get(session), tx.get(messageRef)]);
    if (previous.exists && previous.data()?.ownerId !== ctx.uid) throw new CommunicationError('Conversația nu este accesibilă.', 404);
    if (priorMessage.exists) return priorMessage.data() as AssistantMessage;
    if (Number(previous.data()?.busyUntil || 0) > Date.now()) throw new CommunicationError('O comandă este în curs.', 409);
    if (!previous.exists) tx.create(session, { ownerId: ctx.uid, title: text.slice(0, 100), createdAt: now, updatedAt: now });
    else tx.update(session, { updatedAt: now });
    if (actions.length) tx.create(collectionFor(ctx, 'assistantPlans').doc(messageId), { ownerId: ctx.uid, sessionId, actions, goal: planGoal(text, actions), outcome: summarizeOutcome('pending', actions.length, []), status: 'pending', createdAt: now, expiresAt: Date.now() + 3600000, approval: approvalEnvelope(ctx.uid, ctx.agencyId, messageId, actions, Date.now() + 3600000), versions: VERSIONS });
    tx.create(messageRef, message);
    return message;
  });
}
export async function runPlan(ctx: AssistantContext, id: string, cancel = false, maxSteps = MAX_PLAN_ACTIONS) {
  const { ref, data, revision } = await getPlan(ctx, id);
  if (data.status === 'completed' || data.status === 'cancelled') return data;
  if (data.status === 'paused' && !cancel) return data;
  if (!cancel && data.waitUntil && data.waitUntil > Date.now()) return data;
  if (cancel && data.status === 'running') {
    return ctx.adminDb.runTransaction(async tx => {
      const [snapshot, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
      const fresh = snapshot.data();
      if (fresh?.ownerId !== ctx.uid || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Plan inaccesibil sau acces revocat.', 403);
      if (['completed', 'cancelled'].includes(fresh.status)) return { ...data, ...fresh };
      const now = new Date().toISOString();
      if (['pending', 'failed', 'paused'].includes(fresh.status)) {
        const patch = { status: 'cancelled' as const, cancelRequestedAt: now, completedAt: now, waitUntil: 0 };
        tx.update(ref, patch);
        if (fresh.telemetryId) tx.set(collectionFor(ctx, 'assistantTelemetry').doc(fresh.telemetryId), { executionStatus: 'cancelled' }, { merge: true });
        return { ...data, ...fresh, ...patch };
      }
      if (!['running', 'unknown'].includes(fresh.status)) throw new CommunicationError('Starea planului s-a schimbat. Reîncarcă rezultatul.', 409);
      tx.update(ref, { cancelRequestedAt: now });
      return { ...data, ...fresh, cancelRequestedAt: now, error: fresh.status === 'unknown'
        ? 'Oprirea a fost înregistrată. Rezultatul pasului anterior rămâne incert și necesită verificare; nu se repetă automat.'
        : 'Oprirea a fost solicitată. Pasul deja pornit trebuie să returneze rezultatul; pașii următori nu vor porni.' };
    });
  }
  const executionId = randomUUID();
  const claimed = await ctx.adminDb.runTransaction(async tx => {
    const [snap, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    if (snap.data()?.ownerId !== ctx.uid || !(cancel ? ['pending', 'failed', 'paused'] : ['pending', 'failed']).includes(snap.data()?.status)) throw new CommunicationError('Planul este deja în execuție sau necesită verificarea rezultatului. Repetarea automată este blocată.', 409);
    const currentRevision = snap.updateTime ? `${snap.updateTime.seconds}:${snap.updateTime.nanoseconds}` : null;
    if (!revision || currentRevision !== revision) throw new CommunicationError('Planul s-a modificat înainte de pornire. Reîncarcă rezultatul.', 409);
    if (!cancel && Number(snap.data()?.expiresAt) < Date.now()) throw new CommunicationError('Planul a expirat. Cere un plan nou cu date actuale.', 409);
    if (!cancel) validateApproval(snap.data()?.approval, ctx.uid, ctx.agencyId, id, snap.data()?.actions || []);
    const now = new Date().toISOString();
    const patch = cancel ? { status: 'cancelled' as const, completedAt: now, cancelRequestedAt: now, waitUntil: 0 }
      : { status: 'running' as const, startedAt: now, executionId, approvalUsedAt: snap.data()?.approvalUsedAt || now, approvedBy: ctx.uid };
    tx.update(ref, patch);
    if (snap.data()?.telemetryId) tx.set(collectionFor(ctx, 'assistantTelemetry').doc(snap.data()!.telemetryId), { approval: !cancel, approvalStatus: cancel ? 'cancelled' : 'approved', executionStatus: cancel ? 'cancelled' : 'running' }, { merge: true });
    return patch;
  });
  if (cancel) return { ...data, ...claimed };
  let results: Record<string, unknown>[] = [...(data.results || [])];
  const accessRefs = [...((data as any).accessRefs || []), ...actionReferences(data.actions)];
  const checkpointStarted = Date.now(), initialCount = results.length;
  const transition = (patch: Record<string, unknown>) => ctx.adminDb.runTransaction(async tx => {
    const fresh = (await tx.get(ref)).data();
    if (fresh?.ownerId !== ctx.uid || fresh.status !== 'running' || fresh.executionId !== executionId) throw new CommunicationError('Starea planului s-a schimbat. Verifică rezultatul.', 409);
    const now = new Date().toISOString();
    let next = fresh.cancelRequestedAt ? { status: 'cancelled', completedAt: now, waitUntil: 0 }
      : fresh.pauseRequestedAt ? { status: 'paused', pausedAt: now, waitUntil: 0 } : patch;
    if (!fresh.cancelRequestedAt && !fresh.pauseRequestedAt && patch.lastStartedStep !== undefined) {
      try {
        if (Number(data.expiresAt) < Date.now() || Number(fresh.expiresAt) < Date.now()) throw new Error('Planul a expirat. Cere un plan nou cu date actuale.');
        validateApproval(data.approval, ctx.uid, ctx.agencyId, id, data.actions);
        validateApproval(fresh.approval, ctx.uid, ctx.agencyId, id, data.actions);
        if (payloadHash(fresh.actions || []) !== payloadHash(data.actions)) throw new Error('Acțiunile planului s-au modificat. Cere un plan nou pentru aprobare.');
      } catch (error) {
        next = { status: 'failed', waitUntil: 0, error: error instanceof Error ? error.message : 'Aprobarea nu mai este validă.' };
      }
    }
    tx.update(ref, next);
    return next;
  });
  const saveProgress = (patch: Record<string, unknown>) => ctx.adminDb.runTransaction(async tx => {
    const fresh = (await tx.get(ref)).data();
    if (fresh?.ownerId !== ctx.uid || fresh.status !== 'running' || fresh.executionId !== executionId) throw new CommunicationError('Execuția a fost înlocuită. Verifică rezultatul.', 409);
    // Preserve in-flight receipts even when a stop was requested. A recovered
    // or resumed execution has a different identity and owns its own progress.
    tx.update(ref, patch);
  });
  try {
    const actions = z.array(actionSchema).min(1).max(MAX_PLAN_ACTIONS).parse(data.actions);
    for (const [index, action] of actions.entries()) {
      if (index < initialCount) continue;
      const fresh = await ref.get();
      if (fresh.data()?.cancelRequestedAt || fresh.data()?.pauseRequestedAt) {
        const patch = await transition({});
        return { ...data, ...patch, results };
      }
      if (results.length - initialCount >= maxSteps || Date.now() - checkpointStarted >= PLAN_EXECUTION_MS) {
        const patch = await transition({ status: 'pending', checkpointAt: new Date().toISOString() });
        return { ...data, ...patch, results };
      }
      // New plans verify committed asynchronous effects before advancing. Legacy
      // plans retain their original execution semantics; no implicit migration.
      if (data.goal?.schemaVersion === 1 && results.length) {
        const { readPlanOutcomes } = await import('./plan-outcomes');
        const verification = await readPlanOutcomes(ctx, id);
        const outcome = verification.outcome;
        if (outcome.pending || outcome.uncertain || outcome.failed) {
          const deadline = data.verificationDeadline || Date.now() + 30 * 60000;
          const canWait = Boolean(verification.pollAfterMs) && !outcome.failed && Date.now() < deadline;
          const patch = { status: canWait ? 'pending' as const : 'unknown' as const, outcome,
            waitUntil: canWait ? Date.now() + verification.pollAfterMs! : 0, verificationDeadline: deadline,
            error: canWait ? 'Aștept verificarea rezultatului înaintea pasului următor.' : 'Rezultatul anterior necesită reconciliere. Pașii următori nu au pornit.' };
          const saved = await transition(patch);
          return { ...data, ...saved, results };
        }
        results = bindVerifiedOutputs(results, verification.rows || []);
        await saveProgress({ results });
      }
      // Recheck current membership at every step, including existing domain handlers.
      const member = await ctx.adminDb.collection('users').doc(ctx.uid).get();
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Permisiunile s-au schimbat. Planul a fost oprit.', 403);
      const resolved = continuePlanRevision(resolveAction(action, results), results);
      // The transaction defines when this step starts. Controls committed before
      // it prevent execution; later controls stop after this in-flight step.
      const gate = await transition({ lastStartedStep: index + 1 });
      if (gate.status === 'paused' || gate.status === 'cancelled' || gate.status === 'failed') return { ...data, ...gate, results };
      const result = await executeAction(ctx, resolved, `${id}-${index}`);
      accessRefs.push(...actionReferences([resolved]));
      if (typeof result?.conversationId === 'string') accessRefs.push({ resource: 'conversations', id: result.conversationId });
      results.push({ step: index + 1, kind: action.kind, result });
      await saveProgress({ results, accessRefs });
    }
    const session = await requireSession(ctx, data.sessionId);
    // Serialize finalization with controls arriving during the last action.
    // Its receipt remains committed even when the plan itself is stopped.
    const status = await ctx.adminDb.runTransaction(async tx => {
      const fresh = (await tx.get(ref)).data();
      if (fresh?.ownerId !== ctx.uid || fresh.status !== 'running' || fresh.executionId !== executionId) throw new CommunicationError('Starea planului s-a schimbat. Verifică rezultatul.', 409);
      const status = fresh.cancelRequestedAt ? 'cancelled' as const : fresh.pauseRequestedAt ? 'paused' as const : 'completed' as const;
      const now = new Date().toISOString();
      tx.update(ref, { status, ...(status === 'paused' ? { pausedAt: now } : { completedAt: now }) });
      if (fresh.telemetryId) tx.set(collectionFor(ctx, 'assistantTelemetry').doc(fresh.telemetryId), { executionStatus: status, confirmedSteps: results.length }, { merge: true });
      if (status === 'completed') tx.set(session.collection('messages').doc(`${id}-result`), { role: 'assistant', accessRefs, text: [viewingConfirmation(results), `Execuția celor ${results.length} pași s-a încheiat. Rezultatele externe pot necesita verificare; consultă starea fiecărui rezultat.`].filter(Boolean).join('\n'), createdAt: now });
      return status;
    });
    if (status !== 'completed') return { ...data, status, results };
    let outcome = data.outcome;
    if (data.goal?.schemaVersion === 1) {
      const { readPlanOutcomes } = await import('./plan-outcomes');
      try {
        const verification = await readPlanOutcomes(ctx, id);
        outcome = verification.outcome;
        if (verification.pollAfterMs) {
          const { enqueueOutcomeWatch } = await import('./outcome-watcher');
          await enqueueOutcomeWatch(ctx, id);
        }
      }
      catch { outcome = summarizeOutcome('completed', data.actions.length, []); }
      await ctx.adminDb.runTransaction(async tx => {
        const fresh = (await tx.get(ref)).data();
        if (fresh?.ownerId === ctx.uid && fresh.status === 'completed' && fresh.executionId === executionId) tx.update(ref, { outcome, waitUntil: 0 });
      });
    }
    return { ...data, status: 'completed' as const, results, ...(outcome ? { outcome } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execuția nu a fost confirmată.';
    const externalStep = data.actions[results.length]?.kind === 'existing_operation';
    const failureStatus = externalStep || results.length === data.actions.length ? 'unknown' : 'failed';
    const stoppedStep = error instanceof OperationFailure ? { step: results.length + 1, result: error.result } : undefined;
    return ctx.adminDb.runTransaction(async tx => {
      const fresh = (await tx.get(ref)).data();
      if (fresh?.ownerId !== ctx.uid) throw new CommunicationError('Plan inaccesibil.', 403);
      // Another control or recovery may already have settled the plan. A late
      // failure must not overwrite its state or newer receipts.
      if (fresh.status !== 'running' || fresh.executionId !== executionId) return fresh;
      const status = failureStatus === 'unknown' ? 'unknown' : fresh.cancelRequestedAt ? 'cancelled' : fresh.pauseRequestedAt ? 'paused' : 'failed';
      const now = new Date().toISOString();
      const patch = { status, results, error: message, ...(stoppedStep ? { stoppedStep } : {}),
        ...(status === 'paused' ? { pausedAt: now, waitUntil: 0 } : status === 'cancelled' ? { completedAt: now, waitUntil: 0 } : {}) };
      tx.update(ref, patch);
      if (fresh.telemetryId) tx.set(collectionFor(ctx, 'assistantTelemetry').doc(fresh.telemetryId), { executionStatus: status, confirmedSteps: results.length }, { merge: true });
      return { ...fresh, ...patch };
    });
  }
}

export async function controlPlan(ctx: AssistantContext, id: string, command: 'pause' | 'resume') {
  const { ref } = await getPlan(ctx, id);
  await ctx.adminDb.runTransaction(async tx => {
    const [plan, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    const data = plan.data();
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || data?.ownerId !== ctx.uid) throw new CommunicationError('Acces revocat.', 403);
    if (command === 'resume') {
      if (data?.status !== 'paused') throw new CommunicationError('Planul nu este în pauză.', 409);
      validateApproval(data.approval, ctx.uid, ctx.agencyId, id, data.actions);
      tx.update(ref, { status: 'pending', pauseRequestedAt: null, pausedAt: null, resumedAt: new Date().toISOString() });
    } else {
      if (!['pending', 'running', 'failed', 'paused'].includes(data?.status)) throw new CommunicationError('Planul nu poate fi pus în pauză în această stare.', 409);
      tx.update(ref, { pauseRequestedAt: new Date().toISOString(), ...(data?.status === 'running' ? {} : { status: 'paused', pausedAt: new Date().toISOString() }) });
    }
  });
  return (await getPlan(ctx, id)).data;
}

// Reconcile confirmed ledgers after an interrupted HTTP response; never retry a provider.
export async function inspectPlan(ctx: AssistantContext, id: string) {
  const memberRef = ctx.adminDb.collection('users').doc(ctx.uid);
  const member = await memberRef.get();
  if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const { ref, data, revision } = await getPlan(ctx, id);
  if (!['running', 'unknown'].includes(data.status)) return data;
  const started = Date.parse(String((data as unknown as Record<string, unknown>).startedAt || ''));
  if (data.status === 'running' && Number.isFinite(started) && Date.now() - started < 10 * 60000) return data;
  const ledgers = await Promise.all(data.actions.map((_, index) => collectionFor(ctx, 'assistantExecutions').doc(`${id}-${index}`).get()));
  let results: Record<string, unknown>[] = [];
  for (const [index, ledger] of ledgers.entries()) {
    if (ledger.data()?.status !== 'completed') break;
    results.push({ step: index + 1, kind: data.actions[index].kind, result: ledger.data()?.result });
  }
  results = restoreVerifiedOutputs(results, data.results || []);
  const uncertain = ledgers.some(ledger => ['running', 'unknown'].includes(ledger.data()?.status));
  const accessRefs = [...((data as any).accessRefs || []), ...results.flatMap(step => typeof (step.result as any)?.conversationId === 'string' ? [{ resource: 'conversations' as const, id: (step.result as any).conversationId as string }] : [])];
  if (!(await referencesAllowed(ctx, accessRefs))) throw new CommunicationError('Accesul la rezultatele execuției a fost revocat.', 403);
  const recoveredStatus = results.length === data.actions.length ? 'completed' : uncertain || data.status === 'unknown' ? 'unknown' : 'failed';
  // Unknown effects must remain blocked: a pause must not make them resumable.
  const status = recoveredStatus === 'unknown' ? 'unknown' : (data as any).cancelRequestedAt ? 'cancelled' : (data as any).pauseRequestedAt ? 'paused' : recoveredStatus;
  const error = ['completed', 'paused', 'cancelled'].includes(status) ? null : status === 'unknown' ? 'Rezultatul unei acțiuni externe trebuie verificat în modulul corespunzător. Trimiterea nu se repetă automat.' : 'Execuția a fost întreruptă. Poți relua planul; pașii confirmați nu se repetă.';
  const inspectedAt = new Date().toISOString();
  const stop = status === 'paused' ? { pausedAt: inspectedAt, waitUntil: 0 } : status === 'cancelled' ? { completedAt: inspectedAt, waitUntil: 0 } : {};
  await ctx.adminDb.runTransaction(async tx => {
    const [fresh, currentMember] = await Promise.all([tx.get(ref), tx.get(memberRef)]);
    if (currentMember.data()?.agencyId !== ctx.agencyId || currentMember.data()?.role !== ctx.role || fresh.data()?.ownerId !== ctx.uid) throw new CommunicationError('Acces revocat.', 403);
    const currentRevision = fresh.updateTime ? `${fresh.updateTime.seconds}:${fresh.updateTime.nanoseconds}` : null;
    if (!revision || currentRevision !== revision || fresh.data()?.status !== data.status || fresh.data()?.startedAt !== (data as any).startedAt) throw new CommunicationError('Starea planului s-a schimbat. Reîncarcă rezultatul.', 409);
    tx.update(ref, { status, results, accessRefs, error, inspectedAt, ...stop });
  });
  return { ...data, status, results, error, ...stop };
}
