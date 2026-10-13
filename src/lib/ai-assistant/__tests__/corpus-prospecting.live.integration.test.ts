import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
const settingsContext = vi.hoisted(() => ({ current: null as any, invokes: 0, provider: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => settingsContext.current, requireAgencyAdminFromBearerToken: async () => {
  if (settingsContext.current?.role !== 'admin') throw Object.assign(new Error('Administrator required'), { status: 403 }); return settingsContext.current;
} }));
vi.mock('@/lib/ai-outreach/vapi', () => ({ createVapiOutboundCall: settingsContext.provider, isVapiOutboundConfigured: () => true, VapiDispatchError: class extends Error {} }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: { outreach_start: { method: 'POST', path: '/api/ai-outreach/calls', description: 'Pornește apelul AI.' }, outreach_settings_update: { method: 'POST', path: '/api/ai-outreach/settings', description: 'Actualizează setările outreach.' } }, isReadOperation: () => false, operationCatalog: () => [], operationContract: () => null, invokeOperation: async (_ctx: unknown, input: any) => {
  if (!['outreach_settings_update', 'outreach_start'].includes(input.operation)) throw new Error('External calls excluded');
  settingsContext.invokes++;
  const { POST } = input.operation === 'outreach_start' ? await import('@/app/api/ai-outreach/calls/route') : await import('@/app/api/ai-outreach/settings/route');
  const { NextRequest } = await import('next/server');
  const { operationResult } = await import('../operation-result');
  const response = await POST(new NextRequest('http://localhost/api/ai-outreach/settings', { method: 'POST', body: JSON.stringify(input.body) }));
  if (!response.ok) throw new Error('Settings handler rejected request');
  return operationResult(input.operation, await response.json());
} }));
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { planTurn } from '../planner';
import { OpenAIAdapter } from '../provider';
import { executeSafePrefix } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
import { executeAction } from '../actions';
import { VERSIONS } from '../models';
import type { AssistantContext } from '../access';
import type { AssistantMessage } from '../contracts';
import { chatTurn } from '../workspace';
import { resolveDatetime } from '../datetime';
import { stableId } from '@/lib/communications/crypto';
import { zonedParts } from '../zoned-time';
import { OWNER_RESERVATION_TTL_MS } from '@/lib/crm/prospect';

for (const number of [251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 286, 287, 288]) {
  const scenarioId = `master-${String(number).padStart(4, '0')}`;
  if (process.env.JARVIS_PROSPECTING_CASE && process.env.JARVIS_PROSPECTING_CASE !== scenarioId) continue;
  it.skipIf(process.env.JARVIS_PROSPECTING_LIVE !== 'true')(`${scenarioId}: original command reaches its prospecting outcome`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-prospecting' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    settingsContext.current = ctx; settingsContext.invokes = 0;
    const favorites = agency.collection('ownerListingFavorites');
    const source = db.collection('ownerListings').doc(`${id}-alfa`);
    const relatedSource = db.collection('ownerListings').doc(`${id}-related`);
    const conflictingSource = db.collection('ownerListings').doc(`${id}-conflict`);
    const draftSources: string[] = [];
    const base = { isFavoriteActive: true, reservedByAgentId: id, reservedByAgentName: 'Agent local', reservedAt: new Date().toISOString(), contactOutcome: null, collaborationStatus: null, takenByAgentId: null, notes: 'Istoric existent.', updatedAt: '2026-10-01T07:00:00.000Z' };
    const fixture: Record<string, Record<string, unknown>> = {
      [`${id}-alfa`]: { ...base, ownerName: 'Alin Matei' },
      beta: { ...base, title: 'Prospect Beta', ownerName: 'Dan Popa', ownerPhone: '', phoneExtractionStatus: 'awaiting_connection' },
      gamma: { ...base, title: 'Prospect Gamma', contactOutcome: 'negative', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      delta: { ...base, title: 'Prospect Delta', contactOutcome: 'follow_up', contactOutcomeAt: '2026-10-01T07:00:00.000Z' },
      epsilon: { ...base, title: 'Prospect Epsilon', isFavoriteActive: false },
    };
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const history: AssistantMessage[] = (number >= 253 && number <= 261 || [266, 270, 271, 272, 273, 274, 275, 276].includes(number)) ? [{ id: 'selection', role: 'assistant', text: 'Prospectul selectat este Prospect Alfa.', createdAt: new Date().toISOString(), cards: [{ type: 'data', title: 'Prospect selectat', source: 'ownerListingFavorites', rows: [{ id: source.id, ...fixture[source.id] }] }] }] : [];
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), environment: 'Actual model and application planner/executor with local Firestore. No external phone calls or production certification.', executionVerified: false };
    try {
      await agency.set({ city: 'București' }); await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      await source.set({ title: 'Prospect Alfa', ownerName: 'Nume vechi', ownerPhone: '0722123456', phoneExtractionStatus: 'available', publicationStatus: 'ready', isCanonical: true });
      for (const [key, row] of Object.entries(fixture)) await favorites.doc(key).set(row);
      if (number === 287) {
        await favorites.doc(source.id).update({ reservedAt: '2020-01-01T00:00:00Z' });
        await favorites.doc('beta').update({ reservedByAgentId: 'other', reservedByAgentName: 'Agent Beta' });
        await favorites.doc('gamma').update({ takenByAgentId: 'other', takenByAgentName: 'Agent Beta', reservedAt: '2020-01-01T00:00:00Z' });
        await favorites.doc('delta').update({ contactOutcomeByAgentId: 'other', contactOutcomeByAgentName: 'Agent Beta', reservedAt: '2020-01-01T00:00:00Z' });
        await favorites.doc('epsilon').update({ takenByAgentId: 'other', takenByAgentName: 'Agent Beta' });
        const before = (await favorites.get()).docs.map(doc => ({ id: doc.id, data: doc.data() }));
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', text: 'Prospectele discutate sunt atribuite în agenție.', createdAt: new Date().toISOString(), cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Prospecte', rows: before.map(row => ({ id: row.id })) }] });
        const request = { sessionId: id, requestId: `${id}-rights`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(result.message.cards?.flatMap(card => card.rows).map(row => row.id).sort()).toEqual(['beta', 'delta', 'epsilon', 'gamma']);
        expect(result.message.cards?.flatMap(card => card.rows).find(row => row.id === 'beta')).toMatchObject({ reservationState: 'valid' });
        expect(result.message.text).not.toMatch(/nu pot stabili|nu sunt afișate date/i);
        expect(result.message.text).toMatch(/nu am preluat|n-am preluat|nu s-a.*prelu/i);
        expect(result.message.text).toMatch(/expir/i);
        expect(result.message.text).toMatch(/liber|disponibil/i);
        expect(result.message.planId).toBeUndefined(); expect(result.message.actions).toBeUndefined();
        expect((report.telemetry as any).status).toBe('success');
        expect(await chatTurn(ctx, request)).toEqual(result);
        for (const row of before) expect((await favorites.doc(row.id).get()).data()).toEqual(row.data);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, executionVerified: true, verification: 'Original prohibition with selected prospect list through actual model and persisted chatTurn. Fresh ownership read covers other-agent reserved, taken, contacted and inactive assignments, excludes free expired reservation; no plan, takeover, mutation or external call; idempotent replay. Transactional contention and role checks verified separately in prospecting-workflow integration. Local only.' };
        return;
      }
      if (number === 286) {
        await db.recursiveDelete(favorites);
        const other = { ...base, reservedByAgentId: 'agent-beta', reservedByAgentName: 'Agent Beta' };
        const expected = [{ ...other, id: 'z-valid', title: 'Rezervat Magnolia' }, { ...other, id: 'z-undated', title: 'Rezervat Tei', reservedAt: null }];
        const records = [...Array.from({ length: 51 }, (_, index) => ({ ...base, id: `a-${String(index).padStart(3, '0')}`, title: 'Prospect propriu' })), ...expected,
          { ...other, id: 'z-expired', title: 'Expirat', reservedAt: '2020-01-01T00:00:00Z' },
          { ...other, id: 'z-taken', takenByAgentId: 'agent-beta', title: 'Preluat' },
          { ...other, id: 'z-outcome', contactOutcome: 'follow_up', contactOutcomeByAgentId: 'agent-beta', title: 'Contactat' },
          { ...other, id: 'z-removed', isFavoriteActive: false, title: 'Inactiv' }];
        for (const row of records) { const { id: key, ...data } = row; await favorites.doc(key).set(data); }
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        const request = { sessionId: id, requestId: `${id}-reservations`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(result.message.cards?.flatMap(card => card.rows).map(row => row.id).sort()).toEqual(expected.map(row => row.id).sort());
        for (const row of expected) expect(result.message.text).toContain(row.title);
        expect(result.message.text).toContain('Agent Beta');
        const expires = zonedParts(new Date(Date.parse(base.reservedAt) + OWNER_RESERVATION_TTL_MS), 'Europe/Bucharest');
        expect(result.message.text).toContain(expires.time);
        expect(result.message.cards?.flatMap(card => card.rows).find(row => row.id === 'z-valid')).toMatchObject({ expiresLocal: `${expires.date} ${expires.time} (ora București)` });
        expect(result.message.planId).toBeUndefined(); expect(result.message.actions).toBeUndefined();
        expect((report.telemetry as any).status).toBe('success');
        expect(await chatTurn(ctx, request)).toEqual(result);
        for (const row of records) { const { id: key, ...data } = row; expect((await favorites.doc(key).get()).data()).toEqual(data); }
        for (const row of expected) await favorites.doc(row.id).update({ isFavoriteActive: false });
        const empty = await chatTurn(ctx, { ...request, requestId: `${id}-empty` });
        expect(empty.message.cards?.flatMap(card => card.rows)).toEqual([]);
        expect(empty.message.text).toMatch(/nu (?:am|există)|niciun/i);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, empty: empty.message, executionVerified: true, verification: 'Original command through actual model and persisted chatTurn, local Firestore: 57 prospects, empty matching first page, exact two other-agent reservations with agent identity; own, expired, taken, contacted and inactive excluded. Undated reservation remains protected. No record mutation or provider call. Idempotent replay and fresh empty list after deactivation. Local evidence only.' };
        return;
      }
      if (number === 288) {
        // Empty matching first page must not hide the agent's later prospects.
        await db.recursiveDelete(favorites);
        const rows = Array.from({ length: 51 }, (_, index) => ({ id: `a-${String(index).padStart(3, '0')}`, isFavoriteActive: true, takenByAgentId: 'other-agent', title: 'Alt agent' }));
        const mine = [
          { id: 'z-mine-taken', ...base, title: 'Preluat Magnolia', takenByAgentId: id, reservedByAgentId: 'other-agent' },
          { id: 'z-mine-reserved', ...base, title: 'Rezervat Tei' },
          { id: 'z-mine-outcome', ...base, title: 'Contactat Salcâm', reservedByAgentId: 'other-agent', contactOutcome: 'follow_up', contactOutcomeByAgentId: id },
        ];
        const records = [...rows, ...mine, { id: 'z-expired', ...base, title: 'Rezervare expirată', reservedAt: '2020-01-01T00:00:00Z' }, { id: 'z-removed', ...base, isFavoriteActive: false }, { id: 'z-unassigned', isFavoriteActive: true, createdBy: id }];
        for (const row of records) { const { id: key, ...data } = row; await favorites.doc(key).set(data); }
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        const request = { sessionId: id, requestId: `${id}-active`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(result.message.cards?.flatMap(card => card.rows).map(row => row.id).sort()).toEqual(mine.map(row => row.id).sort());
        for (const row of mine) expect(result.message.text).toContain(row.title);
        expect(result.message.planId).toBeUndefined(); expect(result.message.actions).toBeUndefined();
        expect((report.telemetry as any).status).toBe('success');
        expect(await chatTurn(ctx, request)).toEqual(result);
        for (const row of records) { const { id: key, ...data } = row; expect((await favorites.doc(key).get()).data()).toEqual(data); }
        // A new request reads current assignment, not the previously displayed list.
        for (const row of mine) await favorites.doc(row.id).update({ isFavoriteActive: false });
        const empty = await chatTurn(ctx, { ...request, requestId: `${id}-empty` });
        expect(empty.message.cards?.flatMap(card => card.rows)).toEqual([]);
        expect(empty.message.text).toMatch(/nu (?:ai|am|există)|niciun/i);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, empty: empty.message, executionVerified: true, verification: 'Original command through actual model and persisted chatTurn, real local Firestore: 57 prospects across two pages, empty matching first page, exact current-agent assignment by CRM precedence, expired/inactive/unassigned excluded, exact three results, unchanged records, idempotent replay and fresh empty result after deactivation. No external contact or production certification.' };
        return;
      }
      if (number === 275 || number === 276) {
        const conversation = agency.collection('conversations').doc('selected-whatsapp');
        await conversation.set({ id: conversation.id, agencyId: id, channel: 'whatsapp', connectionId: 'connection', externalParticipantId: '40722123456', phone: '+40722123456', name: 'Alin Matei', assigneeId: id, collaboratorIds: [], lastInboundAt: null });
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', text: 'Conversație selectată; numărul apare în anunțul public al proprietarului.', createdAt: new Date().toISOString(), cards: [{ type: 'data', source: 'conversations', title: 'Conversație', rows: [{ id: conversation.id, phone: '+40722123456' }] }] });
        const request = { sessionId: id, requestId: `${id}-consent`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(result.message.actions).toBeUndefined(); expect(result.message.planId).toBeUndefined();
        expect(result.message.cards?.flatMap(card => card.rows).find(row => row.id === conversation.id)).toMatchObject({ consent: { all: 'unknown', service: 'unknown', marketing: 'unknown' }, humanConsent: { canRecord: true, recordedByJarvis: false, url: '/inbox?conversationId=selected-whatsapp' } });
        if (number === 275) {
          expect(result.message.text).toContain('/inbox?conversationId=selected-whatsapp');
          expect(result.message.text).toMatch(/dovad/);
        } else {
          expect(result.message.text).toMatch(/public/); expect(result.message.text).toMatch(/nu.*(?:acord|consimțământ)|necunoscut|necunoscute/);
        }
        expect(await chatTurn(ctx, request)).toEqual(result);
        expect((await agency.collection('communicationConsents').get()).empty).toBe(true);
        expect((await conversation.collection('messages').get()).empty).toBe(true);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, executionVerified: number === 276, humanStepPending: number === 275, verification: number === 275 ? 'Actual model and persisted chatTurn guided the agent to the exact Inbox conversation and agent evidence workflow. No consent written. Human recording remains pending; not complete corpus execution.' : 'Original assertion through actual model and persisted chatTurn with a public phone number: all consent scopes remain unknown, no consent inferred or written, no outbound message/job, idempotent replay. Local only.' };
        return;
      }
      if (number === 274) {
        const conversation = agency.collection('conversations').doc('selected-whatsapp');
        await conversation.set({ id: conversation.id, agencyId: id, channel: 'whatsapp', connectionId: 'connection', externalParticipantId: '40722123456', name: 'Alin Matei', assigneeId: id, collaboratorIds: [], lastInboundAt: new Date().toISOString() });
        const consent = agency.collection('communicationConsents').doc(stableId('connection', '40722123456', 'all'));
        await consent.set({ status: 'revoked' });
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', text: 'Conversație selectată.', createdAt: new Date().toISOString(), cards: [{ type: 'data', source: 'conversations', title: 'Conversație', rows: [{ id: conversation.id }] }] });
        const request = { sessionId: id, requestId: `${id}-blocked`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(result.message.actions).toBeUndefined(); expect(result.message.planId).toBeUndefined();
        expect(result.message.cards?.flatMap(card => card.rows).find(row => row.id === conversation.id)).toMatchObject({ status: 'blocked', consent: { all: 'revoked' } });
        expect(result.message.text).toMatch(/oprirea|refuz|retras|blocat/);
        expect(await chatTurn(ctx, request)).toEqual(result);
        expect((await consent.get()).data()).toEqual({ status: 'revoked' });
        await consent.delete();
        const unknown = await chatTurn(ctx, { ...request, requestId: `${id}-unknown` });
        report = { ...report, unknown: unknown.message };
        expect(unknown.message.actions).toBeUndefined();
        expect(unknown.message.cards?.flatMap(card => card.rows).find(row => row.id === conversation.id)).toMatchObject({ status: 'needs_message_preview', consent: { all: 'unknown', marketing: 'unknown', service: 'unknown' } });
        expect(unknown.message.text).toMatch(/previzualiz|mesaj.*concret|verific.*mesaj/);
        expect((await agency.collection('communicationConsents').get()).empty).toBe(true);
        expect((await conversation.collection('messages').get()).empty).toBe(true);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, executionVerified: true, verification: 'Original assertion through actual model and persisted chatTurn, selected WhatsApp conversation: global opt-out blocked, missing consent remains unknown and requires message preview, no mutation/consent/job/provider call, idempotent replay. Combined with separate real queue/worker emulator tests, not production certification.' };
        return;
      }
      if (number === 273) {
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set(history[0]);
        const request = { sessionId: id, requestId: `${id}-draft`, prompt, currentRecord: null };
        const result = await chatTurn(ctx, request);
        const telemetry = (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data();
        report = { ...report, final: result.message, telemetry };
        expect(result.message.actions).toBeUndefined(); expect(result.message.planId).toBeUndefined();
        expect(result.message.text).toContain('Alin Matei'); expect(result.message.text).toContain('Prospect Alfa');
        expect(result.message.text).toMatch(/colabor/i); expect(result.message.text).toMatch(/nu (?:a fost|am) trimis|netrimis/i);
        expect(result.message.text.length).toBeGreaterThan(180);
        expect(result.message.text).not.toMatch(/\d\s*%|comision(?:ul)? (?:este|de)|am trimis|mesaj(?:ul)? (?:a fost )?livrat/i);
        expect(await chatTurn(ctx, request)).toEqual(result);
        expect((await session.collection('messages').doc(request.requestId + '-assistant').get()).data()?.text).toBe(result.message.text);
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        for (const collection of ['tasks', 'aiOutreachCalls', 'conversations', 'outboundMessages']) expect((await agency.collection(collection).get()).empty).toBe(true);
        expect(settingsContext.invokes).toBe(0);
        await favorites.doc(source.id).update({ ownerName: 'Ioana Popescu', title: 'Garsonieră Cișmigiu', ownerPhone: '' });
        await source.update({ ownerPhone: '' });
        const refreshed = await chatTurn(ctx, { ...request, requestId: `${id}-refreshed` });
        report = { ...report, refreshed: refreshed.message };
        expect(refreshed.message.actions).toBeUndefined();
        expect(refreshed.message.text).toContain('Ioana Popescu'); expect(refreshed.message.text).toContain('Cișmigiu');
        expect(refreshed.message.text).not.toMatch(/Alin Matei|Prospect Alfa|0722123456/);
        expect(refreshed.message.text).toMatch(/nu (?:a fost|am) trimis|netrimis/i);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, executionVerified: true, verification: 'Original request, real model and persisted chatTurn: full collaboration draft with freshly read owner and listing, no invented numeric commission, persisted response/replay, prospect records unchanged, no external operation or AI call. Repeated request uses changed CRM name/title despite old conversation, succeeds without a phone. Text preparation only; no WhatsApp eligibility or production certification.' };
        return;
      }
      if (number === 272) {
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id, createdAt: new Date().toISOString() });
        await session.collection('messages').doc('selection').set(history[0]);
        const first = await chatTurn(ctx, { sessionId: id, requestId: `${id}-question`, prompt, currentRecord: null });
        report = { ...report, clarification: first.message };
        expect(first.message.prospectContinuation).toEqual({ listingId: source.id, request: prompt });
        expect((await agency.collection('tasks').get()).empty).toBe(true);
        const request = { sessionId: id, requestId: `${id}-answer`, prompt: 'Mâine la ora 10:30.', currentRecord: null };
        const final = await chatTurn(ctx, request);
        const tasks = await agency.collection('tasks').get();
        report = { ...report, final: final.message, tasks: tasks.docs.map(doc => doc.data()), telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
        expect(final.message.actions, final.message.text).toBeUndefined();
        expect(tasks.size, final.message.text).toBe(1);
        expect(tasks.docs[0].data()).toMatchObject({ ownerListingId: source.id, participantName: 'Alin Matei', participantPhone: '0722123456', status: 'open', agentId: id, startTime: '10:30' });
        expect(tasks.docs[0].data().dueDate.slice(0, 10)).toBe(resolveDatetime({ dayOffset: 1, time: '10:30' }).local.slice(0, 10));
        expect(final.message.text).toContain('10:30'); expect(final.message.text).toContain('Alin Matei');
        expect(await chatTurn(ctx, request)).toEqual(final);
        expect((await agency.collection('tasks').get()).size).toBe(1);
        expect((await agency.collection('aiOutreachCalls').get()).empty).toBe(true);
        expect(settingsContext.invokes).toBe(0);
        report = { ...report, executionVerified: true, verification: 'Actual model and persisted chatTurn clarification/reply; saved human callback task with prospect, participant, phone and Bucharest date/time; persisted confirmation; idempotent replay; no AI call. Local Firestore only, no production or browser certification.' };
        return;
      }
      if (number === 271) {
        const tasks = agency.collection('tasks'), calls = agency.collection('aiOutreachCalls'), owner = agency.collection('aiOutreachOwnerListingStatuses').doc(source.id);
        await favorites.doc(source.id).update({ contactOutcome: 'negative', contactOutcomeAt: new Date().toISOString() });
        await owner.set({ latestAiCallId: 'scheduled', aiNextFollowUpAt: '2099-01-01T10:00:00Z' });
        await calls.doc('scheduled').set({ ownerListingId: source.id, status: 'scheduled' });
        await calls.doc('running').set({ ownerListingId: source.id, status: 'calling', vapiCallId: 'already-running' });
        await tasks.doc('callback').set({ ownerListingId: source.id, agentId: id, description: 'Apel follow-up proprietar', status: 'open' });
        await tasks.doc('documents').set({ ownerListingId: source.id, agentId: id, description: 'Verifică documentele', status: 'open' });
        await tasks.doc('colleague').set({ ownerListingId: source.id, agentId: 'other-agent', description: 'Apel proprietar', status: 'open' });
        const planned = await planTurn(ctx, prompt, history); report = { ...report, planned };
        expect(planned.metrics.status, planned.text).toBe('success'); expect(planned.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(planned.actions).toEqual([{ kind: 'stop_prospect_followups', listingId: source.id }]);
        const key = randomUUID(), executed = await executeSafePrefix(ctx, key, planned.actions, prompt);
        expect(executed.blocked).toBe(false); expect(executed.actions).toEqual([]); expect(executed.results).toHaveLength(1);
        expect(executed.results[0].result).toMatchObject({ refusalVerified: true, canceledCallIds: ['scheduled'], removedTaskIds: ['callback'], activeCallIds: ['running'] });
        expect((await tasks.doc('callback').get()).exists).toBe(false);
        expect((await tasks.doc('documents').get()).exists).toBe(true); expect((await tasks.doc('colleague').get()).exists).toBe(true);
        expect((await calls.doc('scheduled').get()).data()?.status).toBe('canceled'); expect((await calls.doc('running').get()).data()?.status).toBe('calling');
        expect((await owner.get()).data()?.aiNextFollowUpAt).toBeNull();
        const archive = await agency.collection('assistantDeletedRecords').get(); expect(archive.size).toBe(1); expect(archive.docs[0].data().previous.description).toBe('Apel follow-up proprietar');
        const confirmation = executionConfirmation(executed.results); expect(confirmation).toContain('1 apeluri AI anulate'); expect(confirmation).toContain('1 taskuri'); expect(confirmation).toContain('nu au fost oprite');
        expect((await executeSafePrefix(ctx, key, planned.actions, prompt)).results).toEqual(executed.results);
        await favorites.doc(source.id).update({ contactOutcome: null, contactOutcomeAt: null });
        const noRefusal = await planTurn(ctx, prompt, history);
        expect(noRefusal.actions).toEqual([]); expect(noRefusal.metrics.status).toBe('success');
        report = { ...report, executed, confirmation, noRefusal, executionVerified: true, verification: 'Original request and actual model, native executor authorized by request, local Firestore: recorded manual refusal, scheduled call canceled, agent callback task archived and removed, unrelated and colleague tasks preserved, running call explicitly not stopped, idempotent replay, absent-refusal variant without actions. No real provider or durable UI session certification.' };
        return;
      }
      if (number === 270) {
        settingsContext.provider.mockReset();
        await agency.collection('aiOutreach').doc('settings').set({ enabled: true, callWindowStart: '09:00', callWindowEnd: '18:00' });
        const clarification = await planTurn(ctx, prompt, history);
        expect(clarification.metrics.status).toBe('clarification'); expect(clarification.actions).toEqual([]);
        expect(clarification.text).toContain('dată și oră');
        const followup = 'Mâine la ora 10:30.';
        const messages: AssistantMessage[] = [...history, { id: 'original', role: 'user', text: prompt, createdAt: new Date().toISOString() }, { id: 'question', role: 'assistant', text: clarification.text, createdAt: new Date().toISOString() }];
        const expected = resolveDatetime({ dayOffset: 1, time: '10:30' }).iso;
        const planned = await planTurn(ctx, followup, messages);
        report = { ...report, clarification, followup, planned };
        expect(planned.metrics.status, planned.text).toBe('success');
        expect(planned.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(planned.actions).toEqual([{ kind: 'existing_operation', operation: 'outreach_start', params: {}, query: {}, body: { ownerListing: { id: source.id, title: 'Prospect Alfa' }, scheduledAt: expected } }]);
        const key = randomUUID(), receipt = await executeAction(ctx, planned.actions[0], key);
        expect(receipt).toMatchObject({ executionState: 'queued', call: { status: 'scheduled', scheduledAt: expected } });
        const saved = await agency.collection('aiOutreachCalls').get();
        expect(saved.size).toBe(1); expect(saved.docs[0].data()).toMatchObject({ status: 'scheduled', scheduledAt: expected, ownerListingId: source.id, ownerPhone: '0722123456', vapiCallId: null });
        const confirmation = executionConfirmation([{ kind: 'existing_operation', result: receipt }]);
        expect(confirmation).toContain('10:30, ora Bucureștiului'); expect(confirmation).toContain('nu a fost încă efectuat');
        expect(await executeAction(ctx, planned.actions[0], key)).toEqual(receipt);
        expect(settingsContext.invokes).toBe(1); expect(settingsContext.provider).not.toHaveBeenCalled();
        report = { ...report, receipt, confirmation, executionVerified: true, verification: 'Original scheduling command requests missing date/time; actual-model continuation preserves selected prospect, resolves tomorrow 10:30 Bucharest, checks eligibility for the requested time and prepares a scheduled action. Approved-action executor and real HTTP handler persist exactly one scheduled call in local Firestore, no provider invocation, correct confirmation and idempotent replay. Approval UI, scheduler and eventual real telephone call are not exercised.' };
        return;
      }
      if (number === 266) {
        settingsContext.provider.mockReset().mockResolvedValue({ mode: 'live', vapiCallId: 'local-provider-call', raw: {} });
        await agency.collection('aiOutreach').doc('settings').set({ enabled: true, callWindowStart: '00:00', callWindowEnd: '00:00' });
        const planned = await planTurn(ctx, prompt, history);
        report = { ...report, planned };
        expect(planned.metrics.status, planned.text).toBe('success');
        expect(planned.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(planned.actions).toEqual([{ kind: 'existing_operation', operation: 'outreach_start', params: {}, query: {}, body: { ownerListing: { id: source.id, title: 'Prospect Alfa' } } }]);
        expect(settingsContext.provider).not.toHaveBeenCalled();
        expect((await agency.collection('aiOutreachCalls').get()).empty).toBe(true);
        const key = randomUUID(), receipt = await executeAction(ctx, planned.actions[0], key);
        expect(receipt).toMatchObject({ operation: 'outreach_start', executionState: 'running', call: { status: 'calling', vapiCallId: 'local-provider-call' } });
        const saved = await agency.collection('aiOutreachCalls').get();
        expect(saved.size).toBe(1); expect(saved.docs[0].data()).toMatchObject({ status: 'calling', ownerListingId: source.id, ownerPhone: '0722123456', vapiCallId: 'local-provider-call' });
        const confirmation = executionConfirmation([{ kind: 'existing_operation', result: receipt }]);
        expect(confirmation).toContain('Furnizorul a acceptat apelul AI.');
        expect(await executeAction(ctx, planned.actions[0], key)).toEqual(receipt);
        expect(settingsContext.provider).toHaveBeenCalledTimes(1); expect(settingsContext.invokes).toBe(1);
        await agency.collection('aiOutreach').doc('settings').update({ enabled: false });
        const disabled = await planTurn(ctx, prompt, history);
        expect(disabled.metrics.status, disabled.text).toBe('success'); expect(disabled.actions).toEqual([]);
        expect(disabled.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(disabled.text).toMatch(/dezactiv|nu.*activ/i);
        expect(settingsContext.provider).toHaveBeenCalledTimes(1);
        expect((await agency.collection('aiOutreachCalls').get()).size).toBe(1);
        report = { ...report, receipt, confirmation, disabled, executionVerified: true, verification: 'Original command, actual model, selected prospect preflight, prepared action, approved-action executor and real HTTP handler with local Firestore, simulated provider acceptance and idempotent replay. Disabled-service variant uses the actual model and produces no additional actions or calls. Approval UI and actual provider conversation are not certified.' };
        return;
      }
      if (number === 269) {
        const ref = agency.collection('aiOutreach').doc('settings');
        const initial = { enabled: false, desiredCommissionValue: '4', callWindowStart: '09:00', callWindowEnd: '18:00', maxDailyCalls: 50 };
        await ref.set(initial);
        const agent = await planTurn(ctx, prompt, []);
        expect(agent.actions).toEqual([]); expect(agent.text).toMatch(/administrator/i);
        expect(agent.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect((await ref.get()).data()).toEqual(initial);
        ctx.role = 'admin'; await profile.update({ role: 'admin' });
        const clarification = await planTurn(ctx, prompt, []);
        expect(clarification.actions).toEqual([]); expect(clarification.text).toMatch(/ce|care|specific|indic|dorești|doresti/i);
        expect((await ref.get()).data()).toEqual(initial);
        const followup = 'Setează limita la 12 apeluri pe zi și intervalul de la 10:00 la 17:30.';
        const messages: AssistantMessage[] = [{ id: 'request', role: 'user', text: prompt, createdAt: new Date().toISOString() }, { id: 'clarification', role: 'assistant', text: clarification.text, createdAt: new Date().toISOString() }];
        const planned = await planTurn(ctx, followup, messages);
        report = { ...report, agent, clarification, planned };
        expect(planned.metrics.status, planned.text).toBe('success');
        expect(planned.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(planned.actions).toEqual([{ kind: 'existing_operation', operation: 'outreach_settings_update', params: {}, query: {}, body: { maxDailyCalls: 12, callWindowStart: '10:00', callWindowEnd: '17:30' } }]);
        expect((await ref.get()).data()).toEqual(initial);
        const key = randomUUID();
        const receipt = await executeAction(ctx, planned.actions[0], key);
        expect(receipt).toMatchObject({ operation: 'outreach_settings_update', executionState: 'succeeded' });
        const saved = (await ref.get()).data();
        expect(saved).toMatchObject({ ...initial, maxDailyCalls: 12, callWindowStart: '10:00', callWindowEnd: '17:30', timezone: 'Europe/Bucharest' });
        const confirmation = executionConfirmation([{ kind: 'existing_operation', result: receipt }]);
        expect(confirmation).toMatch(/salvate/); expect(confirmation).toContain('12'); expect(confirmation).toContain('17:30');
        expect(await executeAction(ctx, planned.actions[0], key)).toEqual(receipt);
        expect(settingsContext.invokes).toBe(1); expect((await ref.get()).data()).toEqual(saved);
        expect((await agency.collection('aiOutreachCalls').get()).empty).toBe(true);
        report = { ...report, receipt, confirmation, executionVerified: true, verification: 'Original prompt, actual model with agent restriction and admin clarification, model continuation with explicit values, approved-action executor with real settings handler and local Firestore, preserved unspecified fields, committed receipt confirmation and idempotent replay. Approval UI is not exercised; no calls.' };
        return;
      }
      if (number === 267) {
        const settingsRef = agency.collection('aiOutreach').doc('settings');
        const variants = [];
        for (const enabled of [null, false, true]) {
          if (enabled !== null) await settingsRef.set({ enabled });
          const result = await planTurn(ctx, prompt, []);
          expect(result.metrics.status, result.text).toBe('success'); expect(result.actions).toEqual([]);
          expect(result.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
          expect(result.cards.find(card => card.source === 'aiOutreachSettings')).toMatchObject({ rows: [{ enabled: enabled === true }] });
          expect(result.text).toMatch(enabled === true ? /activ/i : /dezactiv|inactiv/i);
          expect(result.text).toMatch(/nu.*(porn|lans|iniț|init)/i);
          expect((await settingsRef.get()).data()).toEqual(enabled === null ? undefined : { enabled });
          expect((await agency.collection('aiOutreachCalls').get()).empty).toBe(true);
          variants.push({ enabled, ...result });
        }
        report = { ...report, variants, executionVerified: true, verification: 'Original negative command, actual model and application configuration reads with absent, disabled and enabled settings. No launch actions, activation, call records or external effects.' };
        return;
      }
      if (number === 268) {
        const settingsRef = agency.collection('aiOutreach').doc('settings');
        const result = await planTurn(ctx, prompt, []); report = { ...report, ...result };
        expect(result.metrics.status, result.text).toBe('success'); expect(result.actions).toEqual([]);
        expect(result.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(result.cards.find(card => card.source === 'aiOutreachSettings')).toMatchObject({ persisted: false, canEdit: false, rows: [{ enabled: false, timezone: 'Europe/Bucharest', maxDailyCalls: 50 }] });
        expect(result.text).toMatch(/dezactiv|inactiv/i); expect(result.text).toMatch(/09:00/); expect(result.text).toMatch(/18:00/);
        expect((await settingsRef.get()).exists).toBe(false);
        const stored = { enabled: true, desiredCommissionValue: '4', minimumCommissionValue: '3', callWindowStart: '10:00', callWindowEnd: '17:30', maxDailyCalls: 12, monthlyBudgetCap: 150, privateCredential: 'CANARY_SECRET_NEVER_DISCLOSE' };
        await settingsRef.set(stored);
        const configured = await planTurn(ctx, 'Verifică setările apelurilor AI.', []);
        expect(configured.metrics.status, configured.text).toBe('success'); expect(configured.actions).toEqual([]);
        expect(configured.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(configured.cards.find(card => card.source === 'aiOutreachSettings')).toMatchObject({ persisted: true, canEdit: false, rows: [{ enabled: true, maxDailyCalls: 12, monthlyBudgetCap: 150 }] });
        for (const value of ['10:00', '17:30', '12', '150']) expect(configured.text).toContain(value);
        expect(configured.text).toMatch(/administrator/i);
        expect(JSON.stringify(configured)).not.toContain('CANARY_SECRET');
        expect((await settingsRef.get()).data()).toEqual(stored);
        expect((await agency.collection('aiOutreachCalls').get()).empty).toBe(true);
        report = { ...report, configured, executionVerified: true, verification: 'Original prompt with actual model, real application reads and local Firestore. Default-disabled and configured agency settings, Bucharest hours, agent edit restriction, no secret disclosure, settings writes or calls.' };
        return;
      }
      if ([263, 264, 265].includes(number)) {
        const calls = agency.collection('aiOutreachCalls');
        const fixtureCalls: Record<string, Record<string, unknown>> = {
          'a-latest': { ownerListingTitle: 'Apartament Magnolia', status: 'completed', summary: 'Acceptă comisionul de 2%.', result: { documentsAvailable: 'Certificat energetic disponibil' }, startedAt: '2026-10-12T04:30:00Z', createdAt: '2026-10-01T07:00:00Z' },
          'b-failed': { ownerListingTitle: 'Casă Tei', status: 'failed', providerErrorMessage: 'Număr invalid', createdAt: '2026-10-10T07:00:00Z' },
          'c-unknown': { ownerListingTitle: 'Teren Salcâm', status: 'calling', providerErrorCode: 'vapi_create_unknown', outcome: 'needs_human_review', createdAt: '2026-10-11T07:00:00Z' },
          'z-failed': { ownerListingTitle: 'Garsonieră Lalele', status: 'failed', providerErrorMessage: 'Furnizor indisponibil', createdAt: '2026-10-09T07:00:00Z' },
          'zz-scheduled': { ownerListingTitle: 'Vilă Viitoare', status: 'scheduled', createdAt: '2026-10-13T07:00:00Z', scheduledAt: '2026-10-15T07:00:00Z' },
        };
        if (number !== 263) for (let i = 0; i < 101; i++) fixtureCalls[`m-old-${i.toString().padStart(3, '0')}`] = { status: 'completed', ownerListingTitle: 'Apel vechi', createdAt: '2026-01-01T07:00:00Z' };
        const batch = db.batch(); for (const [key, value] of Object.entries(fixtureCalls)) batch.set(calls.doc(key), value); await batch.commit();
        const result = await planTurn(ctx, prompt, []); report = { ...report, ...result };
        expect(result.metrics.status, result.text).toBe('success'); expect(result.actions).toEqual([]);
        expect(result.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        const rows = result.cards.flatMap(card => card.source === 'aiOutreachCalls' ? card.rows : []);
        if (number === 263) {
          for (const title of ['Magnolia', 'Tei', 'Salcâm', 'Lalele', 'Viitoare']) expect(result.text).toContain(title);
          expect(result.text).toMatch(/incert|necunoscut|neclar/i); expect(result.text).toMatch(/programat/i);
        } else if (number === 264) {
          expect(rows.map(row => row.id).sort()).toEqual(['b-failed', 'z-failed']);
          expect(result.text).toMatch(/Tei/); expect(result.text).toMatch(/Lalele/);
          expect(result.text).toMatch(/invalid/i); expect(result.text).toMatch(/indisponibil/i);
        } else {
          expect(rows.map(row => row.id)).toEqual(['a-latest']);
          expect(result.text).toContain('2%'); expect(result.text).toMatch(/energetic/i); expect(result.text).toMatch(/0?7[:.]30/);
          expect(result.text).not.toContain('Viitoare');
        }
        expect((await calls.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))).toEqual(Object.entries(fixtureCalls).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ id: key, ...value })));
        report = { ...report, executionVerified: true, verification: 'Original command, actual model and local Firestore reads. Correct status and result interpretation, full pagination for failures, latest attempted call independent of document order and newer pending schedules, Bucharest local time, no mutation or external call.' };
        return;
      }
      if (number === 261) {
        const batch = db.batch();
        for (let i = 0; i < 105; i++) batch.set(favorites.doc(`m-unrelated-${String(i).padStart(3, '0')}`), { ownerName: 'Alin Matei', ownerPhone: '0733123456', title: 'CANARY_UNRELATED_PHONE' });
        batch.set(favorites.doc('a-phone-match'), { ownerPhone: '+40 722 123 456', title: 'Apartament Magnolia', isFavoriteActive: true });
        batch.set(favorites.doc('z-phone-match'), { ownerPhone: '0040 722 123 456', title: 'Casă Tei', isFavoriteActive: false });
        await batch.commit();
        const originalFavorites = (await favorites.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const originalRespond = OpenAIAdapter.prototype.respond;
        const providerTrace: unknown[] = [];
        const spy = vi.spyOn(OpenAIAdapter.prototype, 'respond').mockImplementation(async function (this: OpenAIAdapter, request) {
          const response = await originalRespond.call(this, request);
          providerTrace.push({ calls: response.calls, errors: request.input.filter((item: any) => item.type === 'function_call_output' && typeof item.output === 'string' && item.output.includes('"error"')) });
          return response;
        });
        let result;
        try { result = await planTurn(ctx, prompt, history); }
        finally { spy.mockRestore(); }
        report = { ...report, ...result, providerTrace };
        expect(result.metrics.status, result.text).toBe('success');
        expect(result.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(result.actions).toEqual([]);
        expect(result.metrics.tools.filter(tool => tool.name === 'owner_prospects').length).toBeGreaterThanOrEqual(3);
        expect(result.text).toMatch(/Magnolia/); expect(result.text).toMatch(/Tei/);
        expect(result.text).toMatch(/inactiv/i); expect(result.text).toMatch(/agenți|agenti/i);
        expect(JSON.stringify(result)).not.toContain('CANARY_UNRELATED_PHONE');
        expect(result.metrics.tools.some(tool => tool.name === 'timeline')).toBe(false);
        await source.update({ ownerPhone: '' });
        const session = agency.collection('assistantSessions').doc(id);
        await session.set({ ownerId: id }); await session.collection('messages').doc('selection').set(history[0]);
        const question = await chatTurn(ctx, { sessionId: id, requestId: `${id}-question`, prompt, currentRecord: null });
        expect(question.message.ownerHistoryContinuation).toEqual({ listingId: source.id, request: prompt });
        const reply = { sessionId: id, requestId: `${id}-answer`, prompt: '+40 722 123 456', currentRecord: null };
        const resumed = await chatTurn(ctx, reply);
        const telemetry = (await agency.collection('assistantTelemetry').doc(reply.requestId).get()).data()!;
        report = { ...report, question: question.message, resumed: resumed.message, resumedTelemetry: telemetry };
        expect(telemetry.status, resumed.message.text).toBe('success');
        expect(telemetry.tools.filter((tool: any) => tool.status !== 'success')).toEqual([]);
        expect(resumed.message.text).toMatch(/Magnolia/); expect(resumed.message.text).toMatch(/Tei/);
        expect(resumed.message.actions || []).toEqual([]);
        expect(await chatTurn(ctx, reply)).toEqual(resumed);
        expect((await source.get()).data()?.ownerPhone).toBe('');
        expect((await favorites.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))).toEqual(originalFavorites);
        await source.update({ ownerPhone: '0722123456' });
        await favorites.doc('a-phone-match').delete(); await favorites.doc('z-phone-match').delete();
        const noMatches = await planTurn(ctx, prompt, history);
        report = { ...report, noMatches };
        expect(noMatches.metrics.status, noMatches.text).toBe('success');
        expect(noMatches.metrics.tools.filter(tool => tool.status !== 'success')).toEqual([]);
        expect(noMatches.actions).toEqual([]);
        expect(noMatches.text).toMatch(/nu.*(?:alte|alt)|niciun/i);
        expect(noMatches.text).not.toMatch(/Magnolia|Tei/);
        report = { ...report, executionVerified: true, verification: 'Original prompt, real model and local Firestore: all agency prospect pages read; normalized phone variants, inactive listing, same-name different-phone exclusion, missing-phone clarification and saved chat resumption, idempotent replay, no CRM mutations. Scope is agency prospects, not global listings or proof of identity.' };
        return;
      }
      if (number === 260) {
        const duplicateUrl = `https://example.com/${id}/shared-source`;
        const drafts = db.batch();
        for (let index = 0; index < 110; index++) {
          const draftId = `${id}-000-${String(index).padStart(3, '0')}`; draftSources.push(draftId);
          drafts.set(db.collection('ownerListings').doc(draftId), { link: duplicateUrl, originSourceUrl: duplicateUrl, publicationStatus: 'draft', isCanonical: false });
        }
        await drafts.commit();
        await source.update({ link: duplicateUrl });
        await relatedSource.set({ publicationStatus: 'ready', isCanonical: true, originSourceUrl: duplicateUrl });
        await agency.collection('properties').doc('duplicate-import').set({ ownerListingUrl: duplicateUrl, title: 'Import din URL duplicat' });
        await agency.collection('tasks').doc('duplicate-task').set({ propertyId: 'duplicate-import', description: 'Solicită releveul actualizat', status: 'open', dueDate: '2026-10-27' });
        await agency.collection('aiOutreachCalls').doc('orphan-call').set({ ownerListingId: 'deleted-prospect', ownerPhone: '+40 722 123 456', status: 'completed', summary: 'Proprietarul a cerut evaluarea garajului.', result: { documentsAvailable: 'Certificatul energetic este disponibil.' }, durationSeconds: 95, endedAt: '2026-10-08T07:00:00Z' });
        await agency.collection('tasks').doc('orphan-task').set({ ownerListingId: 'deleted-prospect', participantPhone: '0040 722 123 456', description: 'Trimite estimarea garajului', status: 'open', dueDate: '2026-10-26', startTime: '07:30', duration: 45 });
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
        expect(linkedRows.find(row => row.id === 'orphan-task')).toMatchObject({ readMode: 'interaction', interaction: { status: 'open', startTime: '07:30', duration: 45 } });
        expect(JSON.stringify(planned)).not.toContain('CANARY_PRIVATE_CONVERSATION');
        expect(JSON.stringify(planned)).not.toContain('CANARY_UNRELATED_OWNER');
        expect(planned.text).toContain('2%');
        expect(planned.text).toMatch(/sâmbăt|sambat/i);
        expect(planned.text).toMatch(/cadastral/i);
        expect(planned.text).toMatch(/recepți|recepti/i);
        expect(planned.text).toMatch(/garaj/i);
        expect(planned.text).toMatch(/0?7[:.]30/);
        expect(planned.text).toMatch(/45\s*(?:de\s*)?min/i);
        expect(planned.text).toMatch(/energetic/i);
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
        expect(resumed.message.text).toMatch(/0?7[:.]30/);
        expect(resumed.message.text).toMatch(/45\s*(?:de\s*)?min/i);
        expect(resumed.message.text).toMatch(/energetic/i);
        expect(JSON.stringify(resumed)).not.toContain('CANARY_PRIVATE_CONVERSATION');
        expect(await chatTurn(ctx, reply)).toEqual(resumed);
        expect((await source.get()).data()?.ownerPhone).toBe('');
        for (const [key, row] of Object.entries(fixture)) expect((await favorites.doc(key).get()).data()).toEqual(row);
        await source.update({ ownerPhone: '0722123456' });
        await conflictingSource.set({ publicationStatus: 'ready', isCanonical: true, link: `https://example.com/${id}/shared-source`, ownerPhone: '0733123456' });
        const conflictSession = agency.collection('assistantSessions').doc(`${id}-conflict`);
        await conflictSession.set({ ownerId: id, createdAt: new Date().toISOString() });
        await conflictSession.collection('messages').doc('selection').set(history[0]);
        const conflictQuestion = await chatTurn(ctx, { sessionId: conflictSession.id, requestId: `${id}-conflict-question`, prompt, currentRecord: null });
        const associationQuestionTelemetry = (await agency.collection('assistantTelemetry').doc(`${id}-conflict-question`).get()).data()!;
        report = { ...report, associationQuestion: conflictQuestion.message, associationQuestionTelemetry };
        expect(associationQuestionTelemetry.tools.filter((tool: any) => tool.status !== 'success')).toEqual([]);
        expect(conflictQuestion.message.ownerHistoryContinuation?.association).toMatchObject({ propertyId: 'duplicate-import' });
        expect(conflictQuestion.message.text).toContain('Import din URL duplicat');
        const conflictReply = { sessionId: conflictSession.id, requestId: `${id}-conflict-answer`, prompt: 'Da.', currentRecord: null };
        const originalRespond = OpenAIAdapter.prototype.respond;
        const associationCalls: unknown[] = [];
        const trace = vi.spyOn(OpenAIAdapter.prototype, 'respond').mockImplementation(async function(this: OpenAIAdapter, request) {
          const result = await originalRespond.call(this, request);
          associationCalls.push({ calls: result.calls, errors: request.input.filter((item: any) => item.type === 'function_call_output' && typeof item.output === 'string' && item.output.includes('\"error\"')) });
          return result;
        });
        let resolved;
        try { resolved = await chatTurn(ctx, conflictReply); }
        finally { trace.mockRestore(); }
        report = { ...report, associationCalls };
        const associationTelemetry = (await agency.collection('assistantTelemetry').doc(conflictReply.requestId).get()).data()!;
        report = { ...report, associationReply: resolved.message, associationTelemetry };
        expect(associationTelemetry.status, resolved.message.text).toBe('success');
        expect(associationTelemetry.tools.filter((tool: any) => tool.status !== 'success')).toEqual([]);
        expect(resolved.message.ownerHistoryContinuation).toBeUndefined();
        expect(resolved.message.actions || []).toEqual([]);
        expect(resolved.message.cards?.flatMap(card => card.rows).find(row => row.id === 'duplicate-import')).toMatchObject({ matchBasis: 'agent_confirmed_association' });
        expect(resolved.message.cards?.flatMap(card => card.rows).map(row => row.id)).toContain('duplicate-task');
        expect(resolved.message.text).toMatch(/releveu/i);
        expect(await chatTurn(ctx, conflictReply)).toEqual(resolved);
        expect((await agency.collection('properties').doc('duplicate-import').get()).data()).toEqual({ ownerListingUrl: `https://example.com/${id}/shared-source`, title: 'Import din URL duplicat' });
        report = { ...report, agencyLinkedHistoryVerified: true, indirectImportVerified: true, orphanInteractionsVerified: true, missingPhoneContinuationVerified: true, duplicateSourceOwnerVerified: true, conflictingAssociationContinuationVerified: true, multiPageSourceLookupVerified: true, interactionDetailsVerified: true, executionVerified: false, limitation: 'Missing phone clarified through persisted chat and actual model. Duplicate source URLs resolved when all agency candidates have the same owner phone. Conflicting URL associations clarified through saved chat and explicit read-only agent answer. All source URL pages read past 110 noncanonical drafts. Records without any usable association remain unresolved; execution remains subject to runtime budgets and no production certification.' };
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
    finally { await mkdir('.tmp/jarvis-corpus-prospecting', { recursive: true }); await writeFile(`.tmp/jarvis-corpus-prospecting/${scenarioId}.json`, JSON.stringify(report, null, 2)); await db.recursiveDelete(agency); await profile.delete(); await source.delete(); await relatedSource.delete(); await conflictingSource.delete(); if (draftSources.length) { const cleanup = db.batch(); for (const draftId of draftSources) cleanup.delete(db.collection('ownerListings').doc(draftId)); await cleanup.commit(); } await db.terminate(); }
  }, 240000);
}
