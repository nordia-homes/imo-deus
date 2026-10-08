import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => runtime.ctx }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {}, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: { global_search: { method: 'GET', path: '/api/search', description: 'Căutare CRM' } }, isReadOperation: (name: string) => name === 'global_search', operationCatalog: () => [], operationContract: () => null, invokeOperation: async (_ctx: unknown, input: any) => {
  if (input.operation !== 'global_search') throw new Error('External operations excluded from the local calendar trial');
  const { GET } = await import('@/app/api/search/route');
  const { NextRequest } = await import('next/server');
  const response = await GET(new NextRequest('http://localhost/api/search?q=' + encodeURIComponent(input.query.q)));
  if (!response.ok) throw new Error('Local search failed');
  return response.json();
} }));
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { planTurn } from '../planner';
import { OpenAIAdapter } from '../provider';
import { executeSafePrefix } from '../autonomy';
import { resolveDatetime } from '../datetime';
import { AgentBudget } from '../budget';
import { VERSIONS } from '../models';
import { taskInterval } from '@/lib/crm/calendar';
import { executionConfirmation } from '../execution-confirmation';
import { currentRecordMessage } from '../current-record';
import { currentRecordFromPath } from '../current-record-contract';
import type { AssistantContext } from '../access';
import type { AssistantMessage } from '../contracts';

const contextCases = ['master-0155', 'master-0158', 'master-0159'];
const editCases = ['master-0160', 'master-0161', 'master-0162', 'master-0163', 'master-0164', 'master-0165'];
const noteCases = ['master-0166', 'master-0167'];
const cases = [...noteCases, ...editCases, ...contextCases, 'master-0156', 'master-0178', 'master-0179', 'master-0180', 'master-0181'];
const selected = process.env.JARVIS_CORPUS_CASE;
if (selected && !cases.includes(selected)) throw new Error('Unknown calendar corpus case');
for (const scenarioId of cases.filter(id => (!selected || id === selected) && (process.env.JARVIS_CORPUS_BATCH !== 'context' || contextCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-edits' || editCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-notes' || noteCases.includes(id)))) {
  it.skipIf(process.env.JARVIS_CORPUS_LIVE !== 'true')(`${scenarioId}: model chooses actions and the CRM stores the requested result`, async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const db = new Firestore({ projectId: 'demo-imodeus-corpus-calendar' });
    const id = randomUUID(), agency = db.collection('agencies').doc(id), profile = db.collection('users').doc(id);
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    runtime.ctx = ctx;
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const date = resolveDatetime({ dayOffset: 1, time: '10:00' });
    const isDelete = scenarioId === 'master-0166', isNote = scenarioId === 'master-0167';
    const newNote = 'Clientul dorește să revină împreună cu familia.';
    const isEdit = editCases.includes(scenarioId) || noteCases.includes(scenarioId);
    const isViewing = isEdit || [...contextCases, 'master-0156'].includes(scenarioId);
    const viewingTime = scenarioId === 'master-0158' ? '10:00' : ['master-0160', 'master-0161'].includes(scenarioId) ? '18:00' : scenarioId === 'master-0162' ? '17:30' : '17:00';
    const viewingDate = resolveDatetime(scenarioId === 'master-0158' ? { weekday: 'friday', time: viewingTime } : { dayOffset: ['master-0164', 'master-0167'].includes(scenarioId) ? -1 : 1, time: viewingTime }).iso;
    const seedTask = { id: 'task-selected', description: 'Sună-l pe Andrei', dueDate: date.iso, startTime: '10:00', duration: 30, contactId: 'andrei', contactName: 'Andrei', agentId: id, status: scenarioId === 'master-0181' ? 'completed' : 'open', updatedAt: '2026-01-01T00:00:00.000Z' };
    const history: AssistantMessage[] = ['master-0180', 'master-0181'].includes(scenarioId) ? [{ id: 'selected-task-context', role: 'assistant', text: 'Taskul selectat este task-selected: Sună-l pe Andrei.', cards: [{ type: 'data', source: 'tasks', title: 'Task selectat', rows: [seedTask] }], createdAt: new Date().toISOString() }] : [];
    const contactName = scenarioId === 'master-0163' ? 'Maria' : 'Andrei';
    const seedViewing = { id: 'viewing-selected', contactId: 'andrei', contactName, propertyId: 'titan', propertyTitle: 'Apartament Titan', viewingDate: resolveDatetime({ dayOffset: ['master-0164', 'master-0167'].includes(scenarioId) ? -1 : 1, time: '17:00' }).iso, duration: 60, status: 'scheduled', notes: 'Acces pe intrarea principală.', agentId: id, updatedAt: '2026-01-01T00:00:00.000Z' };
    if (['master-0162', 'master-0164', 'master-0165', ...noteCases].includes(scenarioId)) history.push({ id: 'viewing-selection', role: 'assistant', text: 'Vizionarea selectată este viewing-selected.', cards: [{ type: 'data', source: 'viewings', title: 'Vizionare selectată', rows: [seedViewing] }], createdAt: new Date().toISOString() });
    if (isNote) history.unshift({ id: 'note-content', role: 'user', text: `Textul notei pentru vizionare este: ${newNote}`, createdAt: new Date().toISOString() });
    if (scenarioId === 'master-0162') history.unshift({ id: 'shift-direction', role: 'user', text: 'Vreau să amân vizionarea selectată, adică să o mut mai târziu.', createdAt: new Date().toISOString() });
    if (contextCases.includes(scenarioId)) {
      if (scenarioId === 'master-0159') history.push({ id: 'previous-time', role: 'user', text: 'Pentru următoarea programare vreau mâine la ora 17.', createdAt: new Date().toISOString() });
      history.push({ id: 'current-selection', role: 'assistant', text: 'Proprietatea selectată este Apartament Titan (titan).' + (scenarioId === 'master-0158' ? ' Clientul selectat este Andrei (andrei).' : ''), cards: [
        { type: 'data', source: 'properties', title: 'Proprietate selectată', rows: [{ id: 'titan', title: 'Apartament Titan' }], complete: true },
        ...(scenarioId === 'master-0158' ? [{ type: 'data' as const, source: 'contacts', title: 'Client selectat', rows: [{ id: 'andrei', name: 'Andrei' }], complete: true }] : []),
      ], createdAt: new Date().toISOString() });
    }
    const budget = new AgentBudget(), previous = process.env.JARVIS_AUTONOMOUS;
    process.env.JARVIS_AUTONOMOUS = 'true';
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), context: history, environment: 'actual model + local Firestore; external catalog excluded', executionVerified: false };
    try {
      await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      if (!isViewing) await agency.collection('assistantPolicies').doc(id).set({ ownerId: id, role: 'agent', enabled: true, viewings: true, expiresAt: Date.now() + 180000 });
      await agency.collection('contacts').doc('andrei').set({ name: contactName, phone: '0700000001', contactType: 'Cumparator' });
      await agency.collection('properties').doc('titan').set({ title: 'Apartament Titan', location: 'Titan', status: isNote ? 'Inactiv' : 'Activ' });
      if (isEdit) await agency.collection('viewings').doc(seedViewing.id).set(seedViewing);
      if (scenarioId === 'master-0159') {
        const currentRecord = currentRecordFromPath('/leads/andrei')!;
        history.push(await currentRecordMessage(ctx, currentRecord));
        report = { ...report, currentRecord, context: history };
      }
      if (['master-0179', 'master-0180', 'master-0181'].includes(scenarioId)) await agency.collection('tasks').doc(seedTask.id).set(seedTask);
      const provider = new OpenAIAdapter(), diagnostics: unknown[] = [], seenErrors = new Set<string>();
      const planned = await planTurn(ctx, prompt, history, { provider: { id: provider.id, respond: async request => {
        for (const item of request.input as any[]) if (item.type === 'function_call_output' && !seenErrors.has(item.call_id)) { try { const output = JSON.parse(item.output); if (output.error) { diagnostics.push({ callId: item.call_id, error: output.error }); seenErrors.add(item.call_id); } } catch {} }
        return provider.respond(request);
      } }, budget });
      report = { ...report, plannerStatus: planned.metrics.status, text: planned.text, actions: planned.actions, tools: planned.metrics.tools, models: planned.metrics.models, diagnostics, costUsd: budget.cost };
      expect(planned.metrics.status, planned.text).toBe('success');
      expect(planned.actions.map(action => action.kind)).toEqual([isDelete ? 'delete_viewing' : isEdit ? 'update_viewing' : isViewing ? 'schedule_viewing' : scenarioId === 'master-0178' ? 'create_task' : 'update_task']);
      const executed = await executeSafePrefix(ctx, id, planned.actions, prompt);
      report = { ...report, execution: executed };
      expect(executed.blocked).toBe(false); expect(executed.actions).toEqual([]); expect(executed.results).toHaveLength(1);
      const tasks = await agency.collection('tasks').get(), viewings = await agency.collection('viewings').get(), contacts = await agency.collection('contacts').get();
      expect(contacts.size).toBe(1);
      if (isDelete) {
        expect(viewings.size).toBe(0); expect(tasks.size).toBe(0);
        const deleted = await agency.collection('assistantDeletedRecords').get();
        expect(deleted.size).toBe(1); expect(deleted.docs[0].data()).toMatchObject({ resource: 'viewings', id: seedViewing.id, previous: seedViewing });
      } else if (isViewing) {
        expect(tasks.size).toBe(0); expect(viewings.size).toBe(1);
        expect(viewings.docs[0].data()).toMatchObject({ contactId: 'andrei', propertyId: 'titan', status: scenarioId === 'master-0164' ? 'completed' : ['master-0163', 'master-0165'].includes(scenarioId) ? 'cancelled' : 'scheduled', viewingDate });
        if (isEdit) {
          expect(viewings.docs[0].id).toBe(seedViewing.id);
          expect(viewings.docs[0].data()).toMatchObject({ agentId: id, duration: 60 });
          expect(viewings.docs[0].data().notes).toContain(seedViewing.notes);
          if (isNote) expect(viewings.docs[0].data().notes).toBe(`${seedViewing.notes}\n${newNote}`);
          if (scenarioId === 'master-0165') expect(viewings.docs[0].data().notes).toMatch(/client/i);
        }
      } else {
        expect(viewings.size).toBe(0); expect(tasks.size).toBe(1);
        const task = tasks.docs[0].data();
        expect(task.contactId).toBe('andrei');
        expect(task.status).toBe(scenarioId === 'master-0180' ? 'completed' : 'open');
        if (['master-0178', 'master-0179'].includes(scenarioId)) expect(taskInterval(task)?.start).toBe(resolveDatetime({ dayOffset: 1, time: scenarioId === 'master-0179' ? '11:00' : '10:00' }).iso);
      }
      const again = await executeSafePrefix(ctx, id, planned.actions, prompt);
      expect(again.blocked).toBe(false); expect(again.results).toEqual(executed.results);
      expect((await agency.collection('contacts').get()).size).toBe(1);
      expect((await agency.collection('tasks').get()).size).toBe(tasks.size);
      expect((await agency.collection('viewings').get()).size).toBe(viewings.size);
      const confirmation = executionConfirmation(executed.results);
      expect(confirmation).toContain(isDelete ? 'Vizionare ștearsă' : isNote ? 'Notă adăugată' : isEdit ? 'Vizionare' : isViewing ? 'Vizionare programată' : 'Task');
      if (isViewing && !isDelete && !isNote || ['master-0178', 'master-0179'].includes(scenarioId)) expect(confirmation).toContain(isViewing ? viewingTime : scenarioId === 'master-0179' ? '11:00' : '10:00');
      if (isNote) expect(confirmation).toContain(newNote);
      if (isDelete) expect((await agency.collection('assistantDeletedRecords').get()).size).toBe(1);
      report = { ...report, executionVerified: true, confirmation, storedTasks: tasks.docs.map(doc => doc.data()), storedViewings: viewings.docs.map(doc => doc.data()) };
    } catch (error) {
      report = { ...report, failure: error instanceof Error ? error.message : String(error) }; throw error;
    } finally {
      await mkdir('.tmp/jarvis-corpus-calendar', { recursive: true });
      await writeFile(`.tmp/jarvis-corpus-calendar/${scenarioId}.json`, JSON.stringify(report, null, 2));
      if (previous === undefined) delete process.env.JARVIS_AUTONOMOUS; else process.env.JARVIS_AUTONOMOUS = previous;
      await db.recursiveDelete(agency); await profile.delete(); await db.terminate();
    }
  }, 170000);
}
