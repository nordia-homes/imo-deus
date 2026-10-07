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
import { approvalEnvelope, validateApproval } from './approval';
import { telemetryDocument, type AgentEvent, type TurnMetrics } from './telemetry';
import { VERSIONS } from './models';
import { sessionSummary } from './context';
import { executeSafePrefix } from './autonomy';
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
  return { ref, revision: doc.updateTime ? `${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}` : null, data: { ...row, id: doc.id, outputType: ['pending', 'running'].includes(row.status) ? 'CONFIRMATION_CARD' : 'ACTION_RESULT', risks: (row.actions || []).map(actionRisk), externalCostNote: (row.actions || []).some((action: any) => action.kind === 'existing_operation' && operations[action.operation]?.external) ? 'Costul extern se verifică în previzualizarea canalului sau campaniei. Bugetele din plan sunt limitele aprobate; o valoare indisponibilă nu înseamnă cost zero.' : undefined } as AssistantPlan & { sessionId: string; expiresAt: number } };
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
  const { ref, data } = await getPlan(ctx, id);
  if (data.status === 'completed' || data.status === 'cancelled') return data;
  if (data.status === 'paused' && !cancel) return data;
  if (!cancel && data.waitUntil && data.waitUntil > Date.now()) return data;
  if (cancel && data.status === 'running') {
    await ctx.adminDb.runTransaction(async tx => {
      const fresh = await tx.get(ref);
      if (fresh.data()?.ownerId !== ctx.uid) throw new CommunicationError('Plan inaccesibil.', 403);
      if (fresh.data()?.status === 'running') tx.update(ref, { cancelRequestedAt: new Date().toISOString() });
    });
    return { ...data, error: 'Oprirea a fost solicitată. Pasul deja pornit trebuie să returneze rezultatul; pașii următori nu vor porni.' };
  }
  await ctx.adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.data()?.ownerId !== ctx.uid || !(cancel ? ['pending', 'failed', 'paused'] : ['pending', 'failed']).includes(snap.data()?.status)) throw new CommunicationError('Planul este deja în execuție sau necesită verificarea rezultatului. Repetarea automată este blocată.', 409);
    if (Number(snap.data()?.expiresAt) < Date.now()) throw new CommunicationError('Planul a expirat. Cere un plan nou cu date actuale.', 409);
    if (!cancel) validateApproval(snap.data()?.approval, ctx.uid, ctx.agencyId, id, snap.data()?.actions || []);
    tx.update(ref, { status: cancel ? 'cancelled' : 'running', startedAt: new Date().toISOString(), ...(cancel ? {} : { approvalUsedAt: snap.data()?.approvalUsedAt || new Date().toISOString(), approvedBy: ctx.uid }) });
    if (snap.data()?.telemetryId) tx.set(collectionFor(ctx, 'assistantTelemetry').doc(snap.data()!.telemetryId), { approval: !cancel, approvalStatus: cancel ? 'cancelled' : 'approved', executionStatus: cancel ? 'cancelled' : 'running' }, { merge: true });
  });
  if (cancel) return { ...data, status: 'cancelled' as const };
  let results: Record<string, unknown>[] = [...(data.results || [])];
  const accessRefs = [...((data as any).accessRefs || []), ...actionReferences(data.actions)];
  const checkpointStarted = Date.now(), initialCount = results.length;
  try {
    const actions = z.array(actionSchema).min(1).max(MAX_PLAN_ACTIONS).parse(data.actions);
    for (const [index, action] of actions.entries()) {
      if (index < initialCount) continue;
      const fresh = await ref.get();
      if (fresh.data()?.cancelRequestedAt) {
        await ref.update({ status: 'cancelled', results, accessRefs, completedAt: new Date().toISOString() });
        return { ...data, status: 'cancelled' as const, results };
      }
      if (fresh.data()?.pauseRequestedAt) {
        await ref.update({ status: 'paused', results, accessRefs, pausedAt: new Date().toISOString() });
        return { ...data, status: 'paused' as const, results };
      }
      if (results.length - initialCount >= maxSteps || Date.now() - checkpointStarted >= PLAN_EXECUTION_MS) {
        await ref.update({ status: 'pending', results, accessRefs, checkpointAt: new Date().toISOString() });
        return { ...data, status: 'pending' as const, results };
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
          await ref.update(patch);
          return { ...data, ...patch, results };
        }
        results = bindVerifiedOutputs(results, verification.rows || []);
        await ref.update({ results });
      }
      // Recheck current membership at every step, including existing domain handlers.
      const member = await ctx.adminDb.collection('users').doc(ctx.uid).get();
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Permisiunile s-au schimbat. Planul a fost oprit.', 403);
      const resolved = continuePlanRevision(resolveAction(action, results), results);
      const result = await executeAction(ctx, resolved, `${id}-${index}`);
      accessRefs.push(...actionReferences([resolved]));
      if (typeof result?.conversationId === 'string') accessRefs.push({ resource: 'conversations', id: result.conversationId });
      results.push({ step: index + 1, kind: action.kind, result });
      await ref.update({ results, accessRefs });
    }
    const session = await requireSession(ctx, data.sessionId);
    const batch = ctx.adminDb.batch();
    batch.update(ref, { status: 'completed', completedAt: new Date().toISOString() });
    if ((data as any).telemetryId) batch.set(collectionFor(ctx, 'assistantTelemetry').doc((data as any).telemetryId), { executionStatus: 'completed', confirmedSteps: results.length }, { merge: true });
    batch.set(session.collection('messages').doc(`${id}-result`), { role: 'assistant', accessRefs, text: `Execuția celor ${results.length} pași s-a încheiat. Rezultatele externe pot necesita verificare; consultă starea fiecărui rezultat.`, createdAt: new Date().toISOString() });
    await batch.commit();
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
      await ref.update({ outcome, waitUntil: 0 });
    }
    return { ...data, status: 'completed' as const, results, ...(outcome ? { outcome } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execuția nu a fost confirmată.';
    const externalStep = data.actions[results.length]?.kind === 'existing_operation';
    const status = externalStep || results.length === data.actions.length ? 'unknown' : 'failed';
    const stoppedStep = error instanceof OperationFailure ? { step: results.length + 1, result: error.result } : undefined;
    await ref.update({ status, results, error: message, ...(stoppedStep ? { stoppedStep } : {}) });
    if ((data as any).telemetryId) await collectionFor(ctx, 'assistantTelemetry').doc((data as any).telemetryId).set({ executionStatus: status, confirmedSteps: results.length }, { merge: true });
    return { ...data, status, results, error: message, ...(stoppedStep ? { stoppedStep } : {}) };
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
  const status = results.length === data.actions.length ? 'completed' : uncertain || data.status === 'unknown' ? 'unknown' : 'failed';
  const error = status === 'completed' ? null : status === 'unknown' ? 'Rezultatul unei acțiuni externe trebuie verificat în modulul corespunzător. Trimiterea nu se repetă automat.' : 'Execuția a fost întreruptă. Poți relua planul; pașii confirmați nu se repetă.';
  await ctx.adminDb.runTransaction(async tx => {
    const [fresh, currentMember] = await Promise.all([tx.get(ref), tx.get(memberRef)]);
    if (currentMember.data()?.agencyId !== ctx.agencyId || currentMember.data()?.role !== ctx.role || fresh.data()?.ownerId !== ctx.uid) throw new CommunicationError('Acces revocat.', 403);
    const currentRevision = fresh.updateTime ? `${fresh.updateTime.seconds}:${fresh.updateTime.nanoseconds}` : null;
    if (!revision || currentRevision !== revision || fresh.data()?.status !== data.status || fresh.data()?.startedAt !== (data as any).startedAt) throw new CommunicationError('Starea planului s-a schimbat. Reîncarcă rezultatul.', 409);
    tx.update(ref, { status, results, accessRefs, error, inspectedAt: new Date().toISOString() });
  });
  return { ...data, status, results, error };
}
