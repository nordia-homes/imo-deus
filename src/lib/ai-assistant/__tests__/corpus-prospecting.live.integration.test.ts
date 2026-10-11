import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, operationCatalog: () => [], operationContract: () => null, invokeOperation: () => { throw new Error('External calls excluded'); } }));
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { planTurn } from '../planner';
import { OpenAIAdapter } from '../provider';
import { executeSafePrefix } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
import { VERSIONS } from '../models';
import type { AssistantContext } from '../access';
import type { AssistantMessage } from '../contracts';
import { chatTurn } from '../workspace';
import { resolveDatetime } from '../datetime';

for (const number of [251, 252, 253, 254, 255, 256, 257, 258, 259, 260]) {
  const scenarioId = `master-${String(number).padStart(4, '0')}`;
  if (process.env.JARVIS_PROSPECTING_CASE && process.env.JARVIS_PROSPECTING_CASE !== scenarioId) continue;
  it.skipIf(process.env.JARVIS_PROSPECTING_LIVE !== 'true')(`${scenarioId}: original command reaches its prospecting outcome`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-prospecting' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    const favorites = agency.collection('ownerListingFavorites');
    const source = db.collection('ownerListings').doc(`${id}-alfa`);
    const relatedSource = db.collection('ownerListings').doc(`${id}-related`);
    const base = { isFavoriteActive: true, reservedByAgentId: id, reservedByAgentName: 'Agent local', reservedAt: new Date().toISOString(), contactOutcome: null, collaborationStatus: null, takenByAgentId: null, notes: 'Istoric existent.', updatedAt: '2026-10-01T07:00:00.000Z' };
    const fixture: Record<string, Record<string, unknown>> = {
      [`${id}-alfa`]: { ...base, ownerName: 'Alin Matei' },
      beta: { ...base, title: 'Prospect Beta', ownerName: 'Dan Popa', ownerPhone: '', phoneExtractionStatus: 'awaiting_connection' },
      gamma: { ...base, title: 'Prospect Gamma', contactOutcome: 'negative', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      delta: { ...base, title: 'Prospect Delta', contactOutcome: 'follow_up', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      epsilon: { ...base, title: 'Prospect Epsilon', isFavoriteActive: false },
    };
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const history: AssistantMessage[] = number >= 253 ? [{ id: 'selection', role: 'assistant', text: 'Prospectul selectat este Prospect Alfa.', createdAt: new Date().toISOString(), cards: [{ type: 'data', title: 'Prospect selectat', source: 'ownerListingFavorites', rows: [{ id: source.id, ...fixture[source.id] }] }] }] : [];
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), environment: 'Actual model and application planner/executor with local Firestore. No external phone calls or production certification.', executionVerified: false };
    try {
      await agency.set({ city: 'București' }); await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      await source.set({ title: 'Prospect Alfa', ownerName: 'Nume vechi', ownerPhone: '0722123456', phoneExtractionStatus: 'available', publicationStatus: 'ready', isCanonical: true });
      for (const [key, row] of Object.entries(fixture)) await favorites.doc(key).set(row);
      if (number === 260) {
        const duplicateUrl = `https://example.com/${id}/shared-source`;
        await source.update({ link: duplicateUrl });
        await relatedSource.set({ publicationStatus: 'ready', isCanonical: true, originSourceUrl: duplicateUrl });
        await agency.collection('properties').doc('duplicate-import').set({ ownerListingUrl: duplicateUrl, title: 'Import din URL duplicat' });
        await agency.collection('tasks').doc('duplicate-task').set({ propertyId: 'duplicate-import', description: 'Solicită releveul actualizat', status: 'open', dueDate: '2026-10-27' });
        await agency.collection('aiOutreachCalls').doc('orphan-call').set({ ownerListingId: 'deleted-prospect', ownerPhone: '+40 722 123 456', status: 'completed', summary: 'Proprietarul a cerut evaluarea garajului.', endedAt: '2026-10-08T07:00:00Z' });
        await agency.collection('tasks').doc('orphan-task').set({ ownerListingId: 'deleted-prospect', participantPhone: '0040 722 123 456', description: 'Trimite estimarea garajului', status: 'open', dueDate: '2026-10-26' });
        await agency.collection('properties').doc('imported-property').set({ ownerListingId: relatedSource.id, title: 'Proprietate importată fără telefon din anunțul asociat' });
        await agency.collection('tasks').doc('property-task').set({ propertyId: 'imported-property', description: 'Pregătire documente cadastrale', status: 'open', dueDate: '2026-10-25', createdAt: '2026-10-10T08:00:00Z' });
        await agency.collection('conversations').doc('owner-conversation').set({ agencyId: id, assigneeId: id, collaboratorIds: [], phone: '+40 722 123 456', name: 'Alin Matei' });
        await agency.collection('conversations').doc('owner-conversation').collection('messages').doc('owner-message').set({ text: 'Cheile sunt la recepție.', direction: 'received', createdAt: '2026-10-10T09:00:00Z' });
        await agency.collection('conversations').doc('private-conversation').set({ agencyId: id, assigneeId: 'another', collaboratorIds: [], phone: '+40 722 123 456', name: 'CANARY_PRIVATE_CONVERSATION' });
        await favorites.doc(relatedSource.id).set({ ownerPhone: '0040 722 123 456', ownerName: 'Alin Matei', isFavoriteActive: false });
        await agency.collection('aiOutreachCalls').doc('related-call').set({ ownerListingId: relatedSource.id, status: 'completed', summary: 'Proprietarul acceptă vizionări sâmbăta.', endedAt: '2026-10-09T07:00:00.000Z' });
        await agency.collection('aiOutreachCalls').doc('recorded-call').set({ ownerListingId: source.id, status: 'completed', summary: 'Proprietarul acceptă comisionul de 2%.', endedAt: '2026-10-10T07:00:00.000Z' });
        await agency.collection('tasks').doc('planned-followup').set({ ownerListingId: source.id, description: 'Revenire la proprietar', status: 'open', dueDate: '2026-10-24', createdAt: '2026-10-10T08:00:00.000Z' });
        await agency.collection('aiOutreachCalls').doc('unrelated-call').set({ ownerListingId: 'beta', summary: 'CANARY_UNRELATED_OWNER' });
      }
      if ([254, 255, 259].includes(number)) {
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set(history[0]);
        const first = await chatTurn(ctx, { sessionId: id, requestId: `${id}-question`, prompt, currentRecord: null });
        report = { ...report, clarification: first.message };
        expect(first.message.prospectContinuation?.listingId, first.message.text).toBe(source.id);
        expect(first.message.actions).toBeUndefined();
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        const answer = number === 254 ? 'Colaborează.' : number === 259 ? 'Comision 2%, fără exclusivitate. Vizionările se fac doar după ora 18:00.' : 'Nu este interesat. A cerut să nu mai fie contactat.';
        const request = { sessionId: id, requestId: `${id}-answer`, prompt: answer, currentRecord: null };
        const final = await chatTurn(ctx, request);
        const saved = (await favorites.doc(source.id).get()).data()!;
        report = { ...report, answer, final: final.message, saved, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(final.message.actions, final.message.text).toBeUndefined();
        expect(final.message.planId).toBeUndefined();
        expect(final.message.text).toContain(source.id);
        expect(saved.notes).toContain('Istoric existent.');
        if (number === 254) { expect(saved.collaborationStatus).toBe('collaborates'); expect(final.message.text).toContain('Colaborează'); }
        else if (number === 259) { expect(saved.notes).toContain('2%'); expect(saved.notes).toMatch(/exclusivitate/i); expect(saved.notes).toContain('18:00'); expect(saved.collaborationStatus).toBeNull(); expect(saved.contactOutcome).toBeNull(); expect(final.message.text).toContain('18:00'); } else { expect(saved.contactOutcome).toBe('negative'); expect(saved.contactOutcomeByAgentId).toBe(id); expect(saved.notes).toMatch(/nu mai fie contactat/i); expect(final.message.text).toMatch(/nu mai fie contactat/i); }
        expect(await chatTurn(ctx, request)).toEqual(final);
        expect((await favorites.doc(source.id).get()).data()).toEqual(saved);
        for (const [key, row] of Object.entries(fixture)) if (key !== source.id) expect((await favorites.doc(key).get()).data()).toEqual(row);
        report = { ...report, executionVerified: true, verification: 'Full chatTurn flow, real model, saved clarification and reply, automatic write, persisted final confirmation, request replay, notes and unrelated records preserved.' };
        return;
      }
      const provider = new OpenAIAdapter(), calls: unknown[] = [];
      const planned = await planTurn(ctx, prompt, history, { provider: { id: provider.id, respond: async request => { const result = await provider.respond(request); calls.push(...result.calls); return result; } } });
      report = { ...report, text: planned.text, cards: planned.cards, actions: planned.actions, metrics: planned.metrics, toolCalls: calls };
      const executionPrompt = prompt;
      expect(planned.metrics.status, planned.text).toBe('success');
      if (number === 260) {
        expect(planned.actions).toEqual([]);
        expect(planned.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        const timeline = planned.cards.filter(card => card.source === 'timeline') as any[];
        expect(timeline.length, planned.text).toBeGreaterThan(0);
        const rows = timeline.flatMap(card => card.rows || []);
        expect(rows.map(row => row.id)).toContain('recorded-call');
        expect(rows.map(row => row.id)).toContain('planned-followup');
        expect(rows.map(row => row.id)).toContain('related-call');
        expect(rows.map(row => row.id)).toContain('property-task');
        expect(rows.map(row => row.id)).toContain('owner-message');
        expect(rows.map(row => row.id)).toContain('duplicate-task');
        expect(planned.text).toMatch(/releveu/i);
        const linkedRows = planned.cards.flatMap(card => card.source === 'owner_history' ? card.rows : []) as any[];
        expect(linkedRows.find(row => row.id === 'duplicate-import')).toMatchObject({ matchBasis: 'verified_source_candidates', linkedListingIds: [source.id, relatedSource.id].sort() });
        expect(linkedRows.find(row => row.id === 'orphan-call')).toMatchObject({ readMode: 'interaction', interaction: { summary: 'Proprietarul a cerut evaluarea garajului.' } });
        expect(linkedRows.find(row => row.id === 'orphan-task')).toMatchObject({ readMode: 'interaction', interaction: { status: 'open' } });
        expect(JSON.stringify(planned)).not.toContain('CANARY_PRIVATE_CONVERSATION');
        expect(JSON.stringify(planned)).not.toContain('CANARY_UNRELATED_OWNER');
        expect(planned.text).toContain('2%');
        expect(planned.text).toMatch(/sâmbăt|sambat/i);
        expect(planned.text).toMatch(/cadastral/i);
        expect(planned.text).toMatch(/recepți|recepti/i);
        expect(planned.text).toMatch(/garaj/i);
        expect(planned.text).toMatch(/26 octombrie|26\.10|2026-10-26/);
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        await source.update({ ownerPhone: '' });
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set(history[0]);
        const question = await chatTurn(ctx, { sessionId: id, requestId: `${id}-identity`, prompt, currentRecord: null });
        report = { ...report, identityClarification: question.message, clarificationTelemetry: (await agency.collection('assistantTelemetry').doc(`${id}-identity`).get()).data() };
        expect(question.message.ownerHistoryContinuation).toEqual({ listingId: source.id, request: prompt });
        expect(question.message.text).toMatch(/telefon/i);
        const incomplete = await chatTurn(ctx, { sessionId: id, requestId: `${id}-incomplete`, prompt: '0722', currentRecord: null });
        expect(incomplete.message.ownerHistoryContinuation).toEqual(question.message.ownerHistoryContinuation);
        const reply = { sessionId: id, requestId: `${id}-phone`, prompt: 'Telefonul proprietarului este +40 722 123 456.', currentRecord: null };
        const resumed = await chatTurn(ctx, reply);
        const resumedTelemetry = (await agency.collection('assistantTelemetry').doc(reply.requestId).get()).data()!;
        report = { ...report, identityClarification: question.message, identityReply: resumed.message, identityTelemetry: resumedTelemetry };
        expect(resumed.message.ownerHistoryContinuation).toBeUndefined();
        expect(resumed.message.actions || []).toEqual([]);
        expect(resumedTelemetry.status, resumed.message.text).toBe('success');
        expect(resumedTelemetry.tools.filter((tool: any) => tool.status !== 'success')).toEqual([]);
        const resumedRows = resumed.message.cards?.flatMap(card => card.rows) || [];
        for (const key of ['recorded-call', 'related-call', 'orphan-call', 'orphan-task', 'property-task', 'owner-message', 'duplicate-task']) expect(resumedRows.map(row => row.id)).toContain(key);
        expect(resumed.message.text).toMatch(/2%/);
        expect(resumed.message.text).toMatch(/garaj/i);
        expect(JSON.stringify(resumed)).not.toContain('CANARY_PRIVATE_CONVERSATION');
        expect(await chatTurn(ctx, reply)).toEqual(resumed);
        expect((await source.get()).data()?.ownerPhone).toBe('');
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        report = { ...report, agencyLinkedHistoryVerified: true, indirectImportVerified: true, orphanInteractionsVerified: true, missingPhoneContinuationVerified: true, duplicateSourceOwnerVerified: true, executionVerified: false, limitation: 'Missing phone clarified through persisted chat and actual model. Duplicate source URLs resolved when all agency candidates have the same owner phone. Conflicting identities and records without any usable association remain unresolved; no production certification.' };
        return;
      }
      if (number === 257) {
        const expectedDay = resolveDatetime({ dayOffset: 14, time: '12:00' }).local.slice(0, 10);
        expect(planned.actions).toHaveLength(1);
        expect(planned.actions[0]).toMatchObject({ kind: 'create_task', ownerListingId: source.id, dueDate: expectedDay });
        expect(planned.actions[0]).not.toHaveProperty('startTime');
        const execution = await executeSafePrefix(ctx, id, planned.actions, prompt);
        const confirmation = executionConfirmation(execution.results);
        report = { ...report, execution, confirmation };
        expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
        const tasks = await agency.collection('tasks').get();
        expect(tasks.size).toBe(1);
        expect(tasks.docs[0].data()).toMatchObject({ ownerListingId: source.id, dueDate: expectedDay, status: 'open', agentId: id, participantName: 'Alin Matei', participantPhone: '0722123456' });
        expect(tasks.docs[0].data()).not.toHaveProperty('propertyId');
        expect(tasks.docs[0].data()).not.toHaveProperty('startTime');
        expect(confirmation).toContain(source.id); expect(confirmation).toContain(expectedDay);
        expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
        expect((await agency.collection('tasks').get()).size).toBe(1);
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        report = { ...report, executionVerified: true, verification: 'Original prompt with selected prospect. Task saved with source listing, current participant, date 14 calendar days ahead in Bucharest and no invented hour. Confirmed saved ID, replay creates no duplicate; prospects unchanged.' };
        return;
      }
      if (number >= 253) {
        const patch = number === 253 ? { state: 'taken' } : [254, 258].includes(number) ? { collaborationStatus: 'collaborates' } : { contactOutcome: 'negative' };
        expect(planned.actions).toMatchObject([{ kind: 'update_prospect', listingId: source.id, patch }]);
        expect(planned.actions).toHaveLength(1);
        const execution = await executeSafePrefix(ctx, id, planned.actions, executionPrompt);
        const confirmation = executionConfirmation(execution.results);
        report = { ...report, execution, confirmation };
        expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
        const saved = (await favorites.doc(source.id).get()).data()!;
        expect(saved).toMatchObject({ isFavoriteActive: true, ownerName: 'Alin Matei' });
        expect(saved.notes).toContain('Istoric existent.');
        if (number === 253) { expect(saved).toMatchObject({ takenByAgentId: id, takenByAgentName: 'Agent local' }); expect(confirmation).toMatch(/preluat/i); }
        else if ([254, 258].includes(number)) { expect(saved.collaborationStatus).toBe('collaborates'); expect(confirmation).toContain('Colaborează'); }
        else { expect(saved.contactOutcome).toBe('negative'); expect(saved.contactOutcomeByAgentId).toBe(id); expect(confirmation).toContain('negativ'); }
        if (number === 255) { expect(saved.notes).toMatch(/nu mai fie contactat/i); expect(confirmation).toMatch(/nu mai fie contactat/i); }
        expect(confirmation).toContain('alfa');
        expect((await executeSafePrefix(ctx, id, planned.actions, executionPrompt)).results).toEqual(execution.results);
        expect((await favorites.doc(source.id).get()).data()).toEqual(saved);
      } else {
        expect(planned.actions).toEqual([]);
        expect(planned.text).toContain('Alfa');
        if (number === 251) { expect(planned.text).toContain('Beta'); expect(planned.text).not.toMatch(/Gamma|Delta|Epsilon/); }
        else { expect(planned.text).toMatch(/telefon|număr|numar/i); expect(planned.text).not.toMatch(/am sunat|apel inițiat/i); }
      }
      for (const [key, row] of Object.entries(fixture)) if (number < 253 || key !== source.id) expect((await favorites.doc(key).get()).data()).toEqual(row);
      report = { ...report, executionVerified: true, verification: number >= 253 ? 'Selected record updated with requested state/outcome, confirmed from executor receipt; idempotent replay, notes preserved, unrelated records unchanged. Missing details clarified before writes.' : 'Original question, real model, current agency prospects. Uncontacted records distinguished from follow-up, refusal and removed entries; advice does not initiate a call.' };
    } catch (error) { report = { ...report, failure: error instanceof Error ? error.message : String(error) }; throw error; }
    finally { await mkdir('.tmp/jarvis-corpus-prospecting', { recursive: true }); await writeFile(`.tmp/jarvis-corpus-prospecting/${scenarioId}.json`, JSON.stringify(report, null, 2)); await db.recursiveDelete(agency); await profile.delete(); await source.delete(); await relatedSource.delete(); await db.terminate(); }
  }, 240000);
}
