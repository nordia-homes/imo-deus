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

const cases = Array.from({ length: 45 }, (_, index) => 201 + index).concat([1001, 1002]);
for (const number of cases.filter(number => !process.env.JARVIS_OWNER_CASE_FROM || number >= Number(process.env.JARVIS_OWNER_CASE_FROM))) {
  const scenarioId = number > 1000 ? number === 1001 ? 'variant-explicit-rental' : 'variant-small-budget' : `master-${String(number).padStart(4, '0')}`;
  it.skipIf(process.env.JARVIS_OWNER_SEARCH_LIVE !== 'true')(`${scenarioId}: actual model finds only the requested owner listings`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-owner-search' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const listings = db.collection('ownerListings');
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    const prompt = number === 1001 ? 'Găsește apartamente de închiriat în Titan.' : number === 1002 ? 'Găsește apartamente în Titan până la 900 euro.' : corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const zone = ({ 204: 'Cișmigiu', 205: 'Floreasca', 206: 'Pipera', 207: 'Aviației', 208: 'Drumul Taberei', 209: 'Berceni', 210: 'Militari', 213: 'Cișmigiu', 214: 'Floreasca', 215: 'Pipera', 216: 'Aviației', 217: 'Drumul Taberei', 218: 'Berceni', 223: 'Drumul Taberei', 225: 'Pipera', 226: 'Floreasca', 228: 'Drumul Taberei', 232: 'Cișmigiu', 233: 'Floreasca', 234: 'Pipera', 235: 'Pipera', 237: 'Berceni', 238: 'Drumul Taberei', 242: 'Drumul Taberei' } as Record<number, string>)[number] || 'Titan';
    const priceMax = ({ 211: 130000, 212: 160000, 213: 180000, 214: 250000, 215: 200000, 216: 250000, 217: 120000, 218: 140000, 219: 200000, 220: 80000, 229: 120000, 230: 140000, 231: 180000, 232: 200000, 233: 300000, 234: 180000, 235: 250000, 240: 130000, 244: 150000, 1002: 900 } as Record<number, number>)[number];
    const priceMin = ({ 216: 150000, 217: 80000, 235: 150000 } as Record<number, number>)[number];
    const yearAfter = ({ 221: 1977, 222: 1977, 223: 1977, 224: 1990, 225: 2000, 226: 2000, 229: 1977, 230: 1990, 231: 1977, 232: 1977, 233: 2000, 234: 2010, 235: 2000, 241: 1977, 242: 1977 } as Record<number, number>)[number];
    const requestedRooms = [202, 203, 211, 212, 213, 214, 217, 218, 219, 220, 222, 223, 225, 226, 229, 230, 231, 232, 233, 234, 235, 239, 240, 241, 242, 245].includes(number);
    const apartmentOnly = [202, 203, 215, 220, 221, 224, 227, 236, 244, 1001, 1002].includes(number);
    const otherZone = zone === 'Militari' ? 'Titan' : 'Militari';
    const roomsAny = ({ 236: [2, 3], 237: [1, 2], 238: [3, 4] } as Record<number, number[]>)[number];
    const rooms = roomsAny ? roomsAny[0] : number === 220 ? 1 : number === 219 ? 4 : [203, 212, 214, 218, 223, 226, 231, 233, 235, 241].includes(number) ? 3 : 2;
    const base = { scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, location: `București, ${zone === 'Cișmigiu' ? 'Cismigiu' : zone === 'Aviației' ? 'Aviatiei' : zone === 'Drumul Taberei' ? 'Drumul-Taberei' : zone}`, propertyType: 'apartment', roomsValue: rooms, transactionType: 'sale', price: `${priceMin || (number === 220 ? 70000 : 120000)} EUR`, lastVerifiedAt: new Date().toISOString(), ...(yearAfter ? { constructionYear: yearAfter + 1 } : number === 227 || number === 228 ? { constructionYear: 1985 } : {}) };
    const fixture = new Map<string, Record<string, unknown>>();
    const add = (key: string, patch: Record<string, unknown>) => fixture.set(`${id}-${key}`, { ...base, title: `Anunț ${key}`, link: `https://example.test/listing/${key}`, ...patch });
    // Matching records are beyond the first backend page, with adverse records in front.
    for (let i = 0; i < 260; i++) add(`a-${String(i).padStart(3, '0')}`, { location: `București ${otherZone}`, ...(number === 243 ? { constructionYear: 1980 } : {}) });
    add('b-substring', { location: `${zone}um` });
    add('b-title-only', { location: otherZone, title: `Apartament ${zone}` });
    add('b-unpublished', { publicationStatus: 'discovered' });
    add('b-duplicate', { isCanonical: false });
    add('b-other-city', { scopeKey: 'brasov' });
    if (requestedRooms) add('b-wrong-rooms', { roomsValue: rooms === 2 ? 3 : 2 });
    if (apartmentOnly) add('b-house', { propertyType: 'house' });
    add(number > 1000 ? 'b-sale' : 'z-sale', { title: `Apartament ${zone}, vânzare` });
    add(number > 1000 ? 'z-rent' : 'b-rent', { title: `Apartament ${zone}, închiriere`, transactionType: 'rent', price: '600 EUR' });
    if (!requestedRooms && !apartmentOnly) add('z-house', { title: `Casă ${zone}`, propertyType: 'house', roomsValue: roomsAny ? roomsAny[1] : 4 });
    add('b-expensive-rent', { transactionType: 'rent', price: '10000.01 EUR' });
    if (priceMax && number < 1000) {
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
    if (yearAfter) {
      add('z-declared', { constructionYear: `after_${yearAfter}`, constructionYearValue: yearAfter + 1, title: `Apartament declarat după ${yearAfter}` });
      add('z-range', { constructionYear: `${yearAfter + 1}–${yearAfter + 4}`, title: 'Apartament cu interval de construcție declarat' });
      add('z-structured', { constructionYear: '  ', year: '', constructionYearValue: yearAfter + 2, title: 'Apartament cu an structurat' });
      add('b-year-boundary', { constructionYear: yearAfter });
      add('b-older', { constructionYear: yearAfter - 1 });
      add('b-overlapping-range', { constructionYear: `${yearAfter - 2}–${yearAfter + 4}` });
      add(number === 241 || number === 242 ? 'z-unknown-year' : 'b-unknown-year', { constructionYear: null });
      add(number === 241 || number === 242 ? 'z-renovation-only' : 'b-renovation-only', { constructionYear: '', description: 'Renovat complet în 2020' });
    }
    if (number === 227 || number === 228) {
      add('z-lower-year', { constructionYear: 1980 });
      add('z-upper-year', { constructionYear: number === 227 ? 1990 : 1989 });
      add('z-range', { constructionYear: '1980–1989' });
      if (number === 228) add('z-before', { constructionYear: 'înainte de 1990', constructionYearValue: 1989 });
      else {
        add('b-before-open', { constructionYear: 'before_1990' });
        add('b-too-old', { constructionYear: 1979 });
        add('b-overlap-lower', { constructionYear: '1979–1985' });
      }
      add('b-too-new', { constructionYear: number === 227 ? 1991 : 1990 });
      add('b-overlap-upper', { constructionYear: '1985–1991' });
      add('b-after-open', { constructionYear: 'after_1980' });
      add('b-unknown-year', { constructionYear: null });
      add('b-renovation-only', { constructionYear: '', description: 'Renovat în 1985' });
    }
    if (roomsAny) {
      add('z-second-room-count', { roomsValue: roomsAny[1] });
      add('z-room-label', { roomsValue: null, rooms: `${roomsAny[0]} camere` });
      add('b-outside-room-count', { roomsValue: 5 });
      add('b-unknown-rooms', { roomsValue: null });
      add('b-ambiguous-rooms', { roomsValue: null, rooms: `${roomsAny[0]}-${roomsAny[1]}` });
      add('b-title-only-rooms', { roomsValue: 5, title: `Apartament ${roomsAny[0]} camere în titlu` });
    }
    if (number === 239 || number === 240) {
      add('z-old-year', { constructionYear: 1965 });
      add('z-new-year', { constructionYear: 2020 });
      add('z-declared-year', { constructionYear: 'after_1977' });
      add('z-unknown-year', { constructionYear: null });
      add('z-blank-year', { constructionYear: '', description: 'Renovat în 2020' });
    }
    if (number === 243) {
      // No zone or exact-year request: only the explicitly declared open interval.
      for (const [key, row] of [...fixture]) {
        if (key.includes('-z-')) { fixture.delete(key); fixture.set(key.replace('-z-', '-b-'), row); }
      }
      add('z-label-ro', { constructionYear: 'după 1977', location: 'București Titan' });
      add('z-label-en', { constructionYear: 'after_1977', location: 'București Militari', propertyType: 'house' });
      add('b-exact-year', { constructionYear: 1978 });
      add('b-closed-range', { constructionYear: '1978–1990' });
      add('b-other-threshold', { constructionYear: 'after_1990' });
      add('b-marketing-only', { description: 'după 1977', constructionYear: null });
    }
    if (number === 244) {
      add('z-known-year', { constructionYear: 1965 });
      add('z-declared-year', { constructionYear: 'after_1977' });
      add('z-unknown-year', { constructionYear: null });
    }
    if (number === 245) {
      add('b-imported-id', {});
      add('b-imported-url', {});
      add('b-imported-origin', { originSourceUrl: 'https://example.test/original/245' });
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
      if (number === 245) {
        await agency.collection('properties').doc('imported-id').set({ ownerListingId: `${id}-b-imported-id`, status: 'Activ' });
        await agency.collection('properties').doc('imported-url').set({ ownerListingUrl: fixture.get(`${id}-b-imported-url`)!.link, status: 'Inactiv' });
        await agency.collection('properties').doc('imported-origin').set({ ownerListingUrl: 'https://example.test/original/245', status: 'Activ' });
      }
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
      if (priceMax && number < 1000) {
        const compactText = planned.text.toLowerCase().replace(/[\s.,€*]/g, '');
        expect(compactText).toContain(String(priceMax));
        if (priceMin) expect(compactText).toContain(String(priceMin));
        expect(compactText).not.toMatch(/strictmaimic|nuseîncadrează|nuseincadreaza/);
        expect(compactText).not.toMatch(new RegExp('exclus[^;!?]{0,100}' + priceMax));
        expect(rows.every(row => row.transactionType === 'sale')).toBe(true);
        expect(rows.some(row => row.price === `${priceMax} EUR`)).toBe(true);
        expect(cards.every(card => 'appliedTransactionType' in card && card.appliedTransactionType === 'sale')).toBe(true);
      }
      if (yearAfter) {
        expect(rows.filter(row => row.constructionYearEvidenceKind !== 'unknown').every(row => row.yearFilterSatisfied === true)).toBe(true);
        const declared = rows.find(row => row.id === `${id}-z-declared`)!;
        expect(declared).toMatchObject({ constructionYear: null, constructionYearKnown: false, constructionYearEvidenceKind: 'declared_interval', constructionYearLowerBound: yearAfter + 1 });
        expect(rows.find(row => row.id === `${id}-z-range`)).toMatchObject({ constructionYear: null, constructionYearUpperBound: yearAfter + 4 });
        expect(rows.find(row => row.id === `${id}-z-structured`)).toMatchObject({ constructionYear: yearAfter + 2, constructionYearKnown: true });
      }
      if (number === 227 || number === 228) {
        expect(rows.every(row => row.yearFilterSatisfied === true)).toBe(true);
        expect(rows.find(row => row.id === `${id}-z-range`)).toMatchObject({ constructionYear: null, constructionYearKnown: false, constructionYearLowerBound: 1980, constructionYearUpperBound: 1989 });
        if (number === 228) expect(rows.find(row => row.id === `${id}-z-before`)).toMatchObject({ constructionYear: null, constructionYearKnown: false, constructionYearLowerBound: null, constructionYearUpperBound: 1989 });
      }
      if (number >= 236 && number <= 240) {
        expect(planned.text).toMatch(new RegExp(`(?:găsit|identificat|total)[^\\n]{0,25}\\b${expected.length}\\b`, 'i'));
        for (const key of expected) expect(planned.text).toContain(String(fixture.get(key)!.title));
      }
      if (roomsAny) expect(new Set(rows.map(row => row.rooms))).toEqual(new Set(roomsAny));
      if (number === 239 || number === 240) {
        expect(rows.every(row => row.yearFilterSatisfied === null)).toBe(true);
        expect(rows.find(row => row.id === `${id}-z-unknown-year`)).toMatchObject({ constructionYear: null, constructionYearKnown: false });
        expect(rows.find(row => row.id === `${id}-z-blank-year`)).toMatchObject({ constructionYear: null, constructionYearKnown: false });
      }
      if ([241, 242, 244].includes(number)) {
        expect(planned.text).toMatch(/necunoscut|fără an|fara an/i);
        expect(rows.some(row => row.constructionYearEvidenceKind === 'unknown')).toBe(true);
        expect(rows.some(row => row.constructionYearEvidenceKind !== 'unknown')).toBe(true);
        for (const key of expected) expect(planned.text).toContain(String(fixture.get(key)!.title));
      }
      if (number === 243) expect(rows.every(row => row.constructionYearEvidenceKind === 'declared_interval' && row.constructionYearLowerBound === 1978 && row.constructionYearUpperBound === null)).toBe(true);
      if (number === 245) {
        expect(cards.every(card => card.crmComparison?.mode === 'exact_references')).toBe(true);
        expect(planned.text).toMatch(/referin|import|URL/i);
      }
      for (const [key, row] of fixture) expect((await listings.doc(key).get()).data()).toEqual(row);
      expect((await agency.collection('properties').get()).size).toBe(number === 245 ? 4 : 1);
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
