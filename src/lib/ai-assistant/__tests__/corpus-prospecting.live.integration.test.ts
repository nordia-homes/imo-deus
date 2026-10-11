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

for (const number of [251, 252, 253, 254, 255, 256, 257, 258, 259]) {
  const scenarioId = `master-${String(number).padStart(4, '0')}`;
  it.skipIf(process.env.JARVIS_PROSPECTING_LIVE !== 'true')(`${scenarioId}: original command reaches its prospecting outcome`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-prospecting' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    const favorites = agency.collection('ownerListingFavorites');
    const source = db.collection('ownerListings').doc(`${id}-alfa`);
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
    finally { await mkdir('.tmp/jarvis-corpus-prospecting', { recursive: true }); await writeFile(`.tmp/jarvis-corpus-prospecting/${scenarioId}.json`, JSON.stringify(report, null, 2)); await db.recursiveDelete(agency); await profile.delete(); await source.delete(); await db.terminate(); }
  }, 170000);
}
