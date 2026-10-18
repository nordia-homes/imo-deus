import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {
    }, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, operationCatalog: () => [], operationContract: () => null, invokeOperation: () => { throw new Error('External operations are excluded from this local trial'); } }));
import { planTurn } from '../planner';
import type { ProviderResult } from '../provider';
import { executeSafePrefix } from '../autonomy';
import { viewingConfirmation } from '../execution-confirmation';
import { resolveDatetime } from '../datetime';
import { AgentBudget } from '../budget';
import { VERSIONS } from '../models';
import type { AssistantContext } from '../access';
it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST).each(['off', 'shadow', 'active', 'unavailable'])('persists the buyer and viewing exactly once with Jev %s', async (mode) => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ''))
        throw new Error('Local emulator required');
    const db = new Firestore({ projectId: 'demo-imodeus-jev' }), id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    vi.stubEnv('JARVIS_JEV_MODE', mode === 'unavailable' ? 'active' : mode);
    const prompt = 'Programează o vizionare pentru apartamentul Cișmigiu cu Matei Alin, număr de telefon 0123123123, pentru mâine la ora 07:30.';
    const date = resolveDatetime({ dayOffset: 1, time: '07:30' }).iso;
    const usage = { inputTokens: 200, outputTokens: 80, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
    function call(name: string, payload: unknown): ProviderResult { const callId = randomUUID(), args = JSON.stringify({ payload: JSON.stringify(payload) }); return { calls: [{ id: callId, name, arguments: args }], items: [{ type: 'function_call', call_id: callId, name, arguments: args }], text: '', usage, status: 'completed', latencyMs: 1 }; }
    const reads = [call('read', { resource: 'properties', search: 'Cismigiu' }), call('read', { resource: 'contacts', search: '0123123123' })];
    const queue: ProviderResult[] = [...reads, call('resolve_datetime', { dayOffset: 1, time: '07:30' }), call('propose_actions', { actions: [{ kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', contactType: 'Cumparator' }, { kind: 'schedule_viewing', propertyId: 'apartment', contactId: '@step:1:contactId', viewingDate: date, duration: 60, notes: '' }] }), call('goal_coverage', { requirements: [{ id: 'viewing', sourceQuote: prompt, description: 'Cumpărător și vizionare', resolution: 'planned', steps: [1, 2], evidenceCallIds: reads.map(r => r.calls[0].id) }] })];
    const final: ProviderResult = { calls: [], items: [], text: 'Plan pregătit.', intentStatus: 'answer', usage, status: 'completed', latencyMs: 1 };
    const respond = vi.fn(async () => queue.shift() || final), select = vi.fn(async () => { if (mode === 'unavailable')
        throw new Error('fixture unavailable'); return { modules: ['marketing' as const], inputTokens: 100, outputTokens: 10, costUsd: 0.0000042, latencyMs: 1, status: 'ok' as const, reason: 'deliberately_wrong_domain', estimated: false }; });
    try {
        await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
        await agency.collection('properties').doc('apartment').set({ title: 'Apartament – Cișmigiu', status: 'Activ', address: 'București' });
        const planned = await planTurn(ctx, prompt, [], { provider: { id: 'fixture', respond }, jevSelector: { select } });
        expect(planned.metrics.status, planned.text).toBe('success');
        expect(planned.actions.map(a => a.kind)).toEqual(['create_contact', 'schedule_viewing']);
        expect(planned.cards.flatMap(c => c.rows).some(r => r.id === 'apartment')).toBe(true);
        const executed = await executeSafePrefix(ctx, id, planned.actions, prompt);
        expect(executed.blocked, JSON.stringify(executed)).toBe(false);
        expect(executed.actions).toEqual([]);
        const replay = await executeSafePrefix(ctx, id, planned.actions, prompt);
        expect(replay.blocked).toBe(false);
        const contacts = await agency.collection('contacts').get(), viewings = await agency.collection('viewings').get();
        expect(contacts.size).toBe(1);
        expect(viewings.size).toBe(1);
        expect(contacts.docs[0].data()).toMatchObject({ name: 'Matei Alin', phone: '0123123123' });
        expect(viewings.docs[0].data()).toMatchObject({ contactId: contacts.docs[0].id, propertyId: 'apartment', viewingDate: date, status: 'scheduled' });
        const confirmation = viewingConfirmation(executed.results);
        expect(confirmation).toContain('07:30');
        expect(confirmation).toContain('Matei Alin');
        expect(confirmation).toContain('Cișmigiu');
        expect(select).toHaveBeenCalledTimes(mode === 'off' ? 0 : 1);
    }
    finally {
        vi.unstubAllEnvs();
        await db.recursiveDelete(agency);
        await profile.delete();
        await db.terminate();
    }
}, 60000);
