import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, operationCatalog: () => [], operationContract: () => null, invokeOperation: () => { throw new Error('External operations excluded from local search trial'); } }));
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { planTurn } from '../planner';
import { OpenAIAdapter } from '../provider';
import { AgentBudget } from '../budget';
import { VERSIONS } from '../models';
import type { AssistantContext } from '../access';

const cases = Array.from({ length: 20 }, (_, index) => 201 + index);
for (const number of cases.filter(number => !process.env.JARVIS_OWNER_CASE_FROM || number >= Number(process.env.JARVIS_OWNER_CASE_FROM))) {
  const scenarioId = `master-${String(number).padStart(4, '0')}`;
  it.skipIf(process.env.JARVIS_OWNER_SEARCH_LIVE !== 'true')(`${scenarioId}: actual model finds only the requested owner listings`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-owner-search' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const listings = db.collection('ownerListings');
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const zone = ({ 204: 'Cișmigiu', 205: 'Floreasca', 206: 'Pipera', 207: 'Aviației', 208: 'Drumul Taberei', 209: 'Berceni', 210: 'Militari', 213: 'Cișmigiu', 214: 'Floreasca', 215: 'Pipera', 216: 'Aviației', 217: 'Drumul Taberei', 218: 'Berceni' } as Record<number, string>)[number] || 'Titan';
    const priceMax = ({ 211: 130000, 212: 160000, 213: 180000, 214: 250000, 215: 200000, 216: 250000, 217: 120000, 218: 140000, 219: 200000, 220: 80000 } as Record<number, number>)[number];
    const priceMin = ({ 216: 150000, 217: 80000 } as Record<number, number>)[number];
    const requestedRooms = [202, 203, 211, 212, 213, 214, 217, 218, 219, 220].includes(number);
    const apartmentOnly = [202, 203, 215, 220].includes(number);
    const otherZone = zone === 'Militari' ? 'Titan' : 'Militari';
    const rooms = number === 220 ? 1 : number === 219 ? 4 : [203, 212, 214, 218].includes(number) ? 3 : 2;
    const base = { scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, location: `București, ${zone === 'Cișmigiu' ? 'Cismigiu' : zone === 'Aviației' ? 'Aviatiei' : zone === 'Drumul Taberei' ? 'Drumul-Taberei' : zone}`, propertyType: 'apartment', roomsValue: rooms, transactionType: 'sale', price: `${priceMin || (number === 220 ? 70000 : 120000)} EUR`, lastVerifiedAt: new Date().toISOString() };
    const fixture = new Map<string, Record<string, unknown>>();
    const add = (key: string, patch: Record<string, unknown>) => fixture.set(`${id}-${key}`, { ...base, title: `Anunț ${key}`, link: `https://example.test/listing/${key}`, ...patch });
    // Matching records are beyond the first backend page, with adverse records in front.
    for (let i = 0; i < 260; i++) add(`a-${String(i).padStart(3, '0')}`, { location: `București ${otherZone}` });
    add('b-substring', { location: `${zone}um` });
    add('b-title-only', { location: otherZone, title: `Apartament ${zone}` });
    add('b-unpublished', { publicationStatus: 'discovered' });
    add('b-duplicate', { isCanonical: false });
    add('b-other-city', { scopeKey: 'brasov' });
    if (requestedRooms) add('b-wrong-rooms', { roomsValue: rooms === 2 ? 3 : 2 });
    if (apartmentOnly) add('b-house', { propertyType: 'house' });
    add('z-sale', { title: `Apartament ${zone}, vânzare` });
    add(priceMax ? 'b-rent' : 'z-rent', { title: `Apartament ${zone}, închiriere`, transactionType: 'rent', price: '600 EUR' });
    if (!requestedRooms && !apartmentOnly) add('z-house', { title: `Casă ${zone}`, propertyType: 'house', roomsValue: 4 });
    add('b-expensive-rent', { transactionType: 'rent', price: '10000.01 EUR' });
    if (priceMax) {
      add('z-boundary', { price: `${priceMax} EUR`, title: `Apartament ${zone}, preț exact la limită` });
      add('z-fraction', { price: `${priceMax - 0.01} EUR` });
      add('b-over-budget', { price: `${priceMax + 0.01} EUR` });
      add('b-ron', { price: '100000 RON' });
      add('b-unknown-currency', { price: '100000' });
    }
    if (priceMin) add('b-below-budget', { price: `${priceMin - 0.01} EUR` });
    if (number === 220) {
      // Published structured labels, not a studio inferred from marketing prose.
      Object.assign(fixture.get(`${id}-z-sale`)!, { roomsValue: null, rooms: 'garsonieră', title: 'Garsonieră Titan' });
      Object.assign(fixture.get(`${id}-z-fraction`)!, { roomsValue: 0, rooms: 'o cameră' });
      add('b-ambiguous-rooms', { roomsValue: null, rooms: '1-2', price: '70000 EUR' });
      add('b-title-studio', { roomsValue: 2, title: 'Garsonieră în titlu', price: '70000 EUR' });
    }
    const expected = [...fixture.keys()].filter(key => key.includes('-z-')).sort();
    const budget = new AgentBudget();
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), executionVerified: false, environment: 'actual model + local Firestore; collected-listing fixtures, no live portal certification' };
    try {
      await agency.set({ city: 'București' });
      await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      const batch = db.batch();
      for (const [key, row] of fixture) batch.set(listings.doc(key), row);
      await batch.commit();
      await agency.collection('properties').doc('portfolio').set({ title: `Apartament ${zone}`, status: 'Activ', location: zone });
      const provider = new OpenAIAdapter(), toolCalls: unknown[] = [];
      const planned = await planTurn(ctx, prompt, [], { provider: { id: provider.id, respond: async request => {
        const response = await provider.respond(request); toolCalls.push(...response.calls); return response;
      } }, budget });
      report = { ...report, text: planned.text, plannerStatus: planned.metrics.status, cards: planned.cards, actions: planned.actions, tools: planned.metrics.tools, models: planned.metrics.models, toolCalls, costUsd: budget.cost };
      expect(planned.metrics.status, planned.text).toBe('success');
      expect(planned.actions).toEqual([]);
      const cards = planned.cards.filter(card => card.type === 'results' && card.source === 'owners');
      const rows = cards.flatMap(card => 'rows' in card ? card.rows : []) as Record<string, unknown>[];
      expect([...new Set(rows.map(row => row.id))].sort()).toEqual(expected);
      for (const row of rows) {
        expect(row.link).toBe(fixture.get(String(row.id))!.link);
        expect(row.transactionType).toBe(fixture.get(String(row.id))!.transactionType);
      }
      expect(planned.text.length).toBeGreaterThan(30);
      if (priceMax) {
        const compactText = planned.text.toLowerCase().replace(/[\s.,€*]/g, '');
        expect(compactText).toContain(String(priceMax));
        if (priceMin) expect(compactText).toContain(String(priceMin));
        expect(compactText).not.toMatch(/strictmaimic|nuseîncadrează|nuseincadreaza/);
        expect(compactText).not.toMatch(new RegExp('exclus[^;!?]{0,100}' + priceMax));
        expect(rows.every(row => row.transactionType === 'sale')).toBe(true);
        expect(rows.some(row => row.price === `${priceMax} EUR`)).toBe(true);
        expect(cards.every(card => 'appliedTransactionType' in card && card.appliedTransactionType === 'sale')).toBe(true);
      }
      for (const [key, row] of fixture) expect((await listings.doc(key).get()).data()).toEqual(row);
      expect((await agency.collection('properties').get()).size).toBe(1);
      report = { ...report, executionVerified: true, expectedIds: expected, verification: 'Original prompt; actual model, production planner/search and real local Firestore. Correct zone, room/type constraints, budget-driven sale selection, inclusive price boundaries, EUR rental ceiling, source links, pagination beyond 250 and unpublished/duplicate/wrong-city/title-only exclusions. Listing data unchanged. No portal freshness or production certification.' };
    } catch (error) {
      report = { ...report, failure: error instanceof Error ? error.message : String(error) }; throw error;
    } finally {
      await mkdir('.tmp/jarvis-corpus-owner-search', { recursive: true });
      await writeFile(`.tmp/jarvis-corpus-owner-search/${scenarioId}.json`, JSON.stringify(report, null, 2));
      const cleanup = db.batch(); for (const key of fixture.keys()) cleanup.delete(listings.doc(key)); await cleanup.commit();
      await db.recursiveDelete(agency); await profile.delete(); await db.terminate();
    }
  }, 170000);
}
