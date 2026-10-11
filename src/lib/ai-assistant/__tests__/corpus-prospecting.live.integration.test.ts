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

for (const number of [251, 252, 253]) {
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
    const base = { isFavoriteActive: true, reservedByAgentId: id, reservedByAgentName: 'Agent local', reservedAt: new Date().toISOString(), contactOutcome: null, collaborationStatus: null, takenByAgentId: null, notes: '', updatedAt: '2026-10-01T07:00:00.000Z' };
    const fixture: Record<string, Record<string, unknown>> = {
      [`${id}-alfa`]: { ...base, ownerName: 'Alin Matei' },
      beta: { ...base, title: 'Prospect Beta', ownerName: 'Dan Popa', ownerPhone: '', phoneExtractionStatus: 'awaiting_connection' },
      gamma: { ...base, title: 'Prospect Gamma', contactOutcome: 'negative', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      delta: { ...base, title: 'Prospect Delta', contactOutcome: 'follow_up', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      epsilon: { ...base, title: 'Prospect Epsilon', isFavoriteActive: false },
    };
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const history: AssistantMessage[] = number === 253 ? [{ id: 'selection', role: 'assistant', text: 'Prospectul selectat este Prospect Alfa.', createdAt: new Date().toISOString(), cards: [{ type: 'data', title: 'Prospect selectat', source: 'ownerListingFavorites', rows: [{ id: source.id, ...fixture[source.id] }] }] }] : [];
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), environment: 'Actual model and application planner/executor with local Firestore. No external phone calls or production certification.', executionVerified: false };
    try {
      await agency.set({ city: 'București' }); await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      await source.set({ title: 'Prospect Alfa', ownerName: 'Nume vechi', ownerPhone: '0722123456', phoneExtractionStatus: 'available', publicationStatus: 'ready', isCanonical: true });
      for (const [key, row] of Object.entries(fixture)) await favorites.doc(key).set(row);
      const provider = new OpenAIAdapter(), calls: unknown[] = [];
      const planned = await planTurn(ctx, prompt, history, { provider: { id: provider.id, respond: async request => { const result = await provider.respond(request); calls.push(...result.calls); return result; } } });
      report = { ...report, text: planned.text, cards: planned.cards, actions: planned.actions, metrics: planned.metrics, toolCalls: calls };
      expect(planned.metrics.status, planned.text).toBe('success');
      if (number === 253) {
        expect(planned.actions).toMatchObject([{ kind: 'update_prospect', listingId: source.id, patch: { state: 'taken' } }]);
        expect(planned.actions).toHaveLength(1);
        const execution = await executeSafePrefix(ctx, id, planned.actions, prompt);
        const confirmation = executionConfirmation(execution.results);
        report = { ...report, execution, confirmation };
        expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
        const saved = (await favorites.doc(source.id).get()).data()!;
        expect(saved).toMatchObject({ takenByAgentId: id, takenByAgentName: 'Agent local', isFavoriteActive: true, notes: '', ownerName: 'Alin Matei' });
        expect(confirmation).toMatch(/preluat/i); expect(confirmation).toContain('alfa');
        expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
        expect((await favorites.doc(source.id).get()).data()).toEqual(saved);
      } else {
        expect(planned.actions).toEqual([]);
        expect(planned.text).toContain('Alfa');
        if (number === 251) { expect(planned.text).toContain('Beta'); expect(planned.text).not.toMatch(/Gamma|Delta|Epsilon/); }
        else { expect(planned.text).toMatch(/telefon|număr|numar/i); expect(planned.text).not.toMatch(/am sunat|apel inițiat/i); }
      }
      for (const [key, row] of Object.entries(fixture)) if (number !== 253 || key !== source.id) expect((await favorites.doc(key).get()).data()).toEqual(row);
      report = { ...report, executionVerified: true, verification: number === 253 ? 'Selected record read and taken by current agent, confirmed from executor receipt; idempotent replay, unrelated records unchanged.' : 'Original question, real model, current agency prospects. Uncontacted records distinguished from follow-up, refusal and removed entries; advice does not initiate a call.' };
    } catch (error) { report = { ...report, failure: error instanceof Error ? error.message : String(error) }; throw error; }
    finally { await mkdir('.tmp/jarvis-corpus-prospecting', { recursive: true }); await writeFile(`.tmp/jarvis-corpus-prospecting/${scenarioId}.json`, JSON.stringify(report, null, 2)); await db.recursiveDelete(agency); await profile.delete(); await source.delete(); await db.terminate(); }
  }, 170000);
}
