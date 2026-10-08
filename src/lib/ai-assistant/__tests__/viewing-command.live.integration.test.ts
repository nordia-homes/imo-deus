import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {}, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, operationCatalog: () => [], operationContract: () => null, invokeOperation: () => { throw new Error('External operations are excluded from this local trial'); } }));
import { planTurn } from '../planner';
import { OpenAIAdapter } from '../provider';
import { executeSafePrefix } from '../autonomy';
import { viewingConfirmation } from '../execution-confirmation';
import { resolveDatetime } from '../datetime';
import { AgentBudget } from '../budget';
import { VERSIONS } from '../models';
import type { AssistantContext } from '../access';

it.skipIf(process.env.JARVIS_LIVE_VIEWING_EVAL !== 'true')('real model command creates the buyer and tomorrow viewing in the emulator', async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host || '')) throw new Error('Local emulator required');
  dotenv.config({ path: '.env.local', quiet: true });
  if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
  const db = new Firestore({ projectId: 'demo-imodeus-viewing-live' });
  const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
  const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
  const budget = new AgentBudget();
  const prompt = 'Programează o vizionare pentru apartamentul „Cișmigiu” cu Matei Alin, număr de telefon 0123123123, pentru mâine la ora 07:30.';
  const previous = process.env.JARVIS_AUTONOMOUS;
  process.env.JARVIS_AUTONOMOUS = 'true';
  try {
    await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
    await agency.collection('properties').doc('apartment').set({ title: 'Apartament – Cișmigiu', status: 'Activ', address: 'București' });
    await agency.collection('assistantPolicies').doc(id).set({ ownerId: id, role: 'agent', enabled: true, viewings: true, expiresAt: Date.now() + 180000 });
    const planned = await planTurn(ctx, prompt, [], { provider: new OpenAIAdapter(), budget });
    await mkdir('.tmp/jarvis-viewing-live', { recursive: true });
    const report = { versions: VERSIONS, prompt, status: planned.metrics.status, text: planned.text, actions: planned.actions, tools: planned.metrics.tools, costUsd: budget.cost, modelCalls: planned.metrics.models.length, executionVerified: false };
    await writeFile('.tmp/jarvis-viewing-live/result.json', JSON.stringify(report, null, 2));
    expect(planned.metrics.status, planned.text).toBe('success');
    expect(planned.actions.map(action => action.kind)).toEqual(['create_contact', 'schedule_viewing']);
    const executed = await executeSafePrefix(ctx, id, planned.actions, prompt);
    expect(executed.blocked).toBe(false); expect(executed.actions).toEqual([]);
    const contacts = await agency.collection('contacts').get(), viewings = await agency.collection('viewings').get();
    expect(contacts.size).toBe(1); expect(viewings.size).toBe(1);
    expect(contacts.docs[0].data()).toMatchObject({ name: 'Matei Alin', phone: '0123123123', contactType: 'Cumparator' });
    expect(viewings.docs[0].data()).toMatchObject({ contactId: contacts.docs[0].id, propertyId: 'apartment', viewingDate: resolveDatetime({ dayOffset: 1, time: '07:30' }).iso, status: 'scheduled' });
    const confirmation = viewingConfirmation(executed.results);
    expect(confirmation).toContain('07:30'); expect(confirmation).toContain('Matei Alin'); expect(confirmation).toContain('Cișmigiu');
    await writeFile('.tmp/jarvis-viewing-live/result.json', JSON.stringify({ ...report, executionVerified: true, confirmation, storedContact: contacts.docs[0].data(), storedViewing: viewings.docs[0].data() }, null, 2));
  } finally {
    if (previous === undefined) delete process.env.JARVIS_AUTONOMOUS; else process.env.JARVIS_AUTONOMOUS = previous;
    await db.recursiveDelete(agency); await profile.delete(); await db.terminate();
  }
}, 170000);
