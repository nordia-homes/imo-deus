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
import { appointmentSignature, participantSignature } from '@/lib/crm/viewing-attendance';
import { interpretReply } from '@/lib/communications/viewing-confirmation';
function recordAttendance(change: any, row: any, contact: any, property: any, _actor: string, now: string) {
  return { ...change, source: 'whatsapp_reply', recordedAt: now, replyAt: now, replyId: 'fixture-' + change.participant, templateMessageId: 'fixture-template', appointment: appointmentSignature(row), recipient: participantSignature(change.participant, contact, property), text: change.status === 'confirmed' ? 'Confirm' : 'Nu vin' };
}

import { viewingAttendance } from '../viewing-attendance';
import { zonedParts } from '../zoned-time';
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
const readCases = ['master-0168', 'master-0169', 'master-0170', 'master-0171'];
const historyCases = ['master-0172', 'master-0173', 'master-0174', 'master-0175'];
const followupCases = ['master-0176', 'master-0177'];
const agendaCases = ['master-0182', 'master-0183', 'master-0184'];
const priorityCases = ['master-0185', 'master-0186'];
const deferralCases = ['master-0187'];
const taskContextCases = ['master-0189', 'master-0190', 'master-0191'];
const availabilityCases = ['master-0192', 'master-0193'];
const confirmationCases = ['master-0195', 'master-0196'];
const attendanceCases = ['master-0197'];
const riskCase = 'master-0198';
const cases = [...attendanceCases, ...confirmationCases, ...availabilityCases, ...taskContextCases, ...deferralCases, ...priorityCases, ...agendaCases, ...followupCases, ...historyCases, ...readCases, ...noteCases, ...editCases, ...contextCases, 'master-0156', 'master-0178', 'master-0179', 'master-0180', 'master-0181'];
cases.push(riskCase, 'master-0199', 'master-0200');
const selected = process.env.JARVIS_CORPUS_CASE;
if (selected && !cases.includes(selected)) throw new Error('Unknown calendar corpus case');
for (const scenarioId of cases.filter(id => (!selected || id === selected) && (process.env.JARVIS_CORPUS_BATCH !== 'attendance' || attendanceCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'confirmations' || confirmationCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'availability' || availabilityCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'task-context' || taskContextCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'task-deferral' || deferralCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'task-priorities' || priorityCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'task-agenda' || agendaCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-followups' || followupCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'property-history' || historyCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-details' || readCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'context' || contextCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-edits' || editCases.includes(id)) && (process.env.JARVIS_CORPUS_BATCH !== 'viewing-notes' || noteCases.includes(id)))) {
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
    const isRisk = scenarioId === riskCase;
    const isReview = scenarioId === 'master-0199';
    const isOrder = scenarioId === 'master-0200';
    const isAttendance = attendanceCases.includes(scenarioId); const isConfirmation = confirmationCases.includes(scenarioId); const isAvailability = availabilityCases.includes(scenarioId); const isDeferral = deferralCases.includes(scenarioId);
    const isTaskContext = taskContextCases.includes(scenarioId);
    const isPriority = priorityCases.includes(scenarioId);
    const isAgenda = agendaCases.includes(scenarioId);
    const isFollowup = followupCases.includes(scenarioId);
    const isHistory = historyCases.includes(scenarioId);
    const isRead = readCases.includes(scenarioId) || isHistory;
    const isDelete = scenarioId === 'master-0166', isNote = scenarioId === 'master-0167';
    const newNote = 'Clientul dorește să revină împreună cu familia.';
    const isEdit = editCases.includes(scenarioId) || noteCases.includes(scenarioId);
    const isViewing = isRisk || isAttendance || isConfirmation || isAvailability || isFollowup || isRead || isEdit || [...contextCases, 'master-0156'].includes(scenarioId);
    const viewingTime = scenarioId === 'master-0158' ? '10:00' : ['master-0160', 'master-0161'].includes(scenarioId) ? '18:00' : scenarioId === 'master-0162' ? '17:30' : '17:00';
    const viewingDate = resolveDatetime(scenarioId === 'master-0158' ? { weekday: 'friday', time: viewingTime } : { dayOffset: ['master-0164', 'master-0167'].includes(scenarioId) ? -1 : 1, time: viewingTime }).iso;
    const seedTask = { id: 'task-selected', description: 'Sună-l pe Andrei', dueDate: date.iso, startTime: '10:00', duration: 30, contactId: 'andrei', contactName: 'Andrei', agentId: id, status: scenarioId === 'master-0181' ? 'completed' : 'open', updatedAt: '2026-01-01T00:00:00.000Z' };
    const history: AssistantMessage[] = ['master-0180', 'master-0181', 'master-0182'].includes(scenarioId) ? [{ id: 'selected-task-context', role: 'assistant', text: 'Taskul selectat este task-selected: Sună-l pe Andrei.', cards: [{ type: 'data', source: 'tasks', title: 'Task selectat', rows: [seedTask] }], createdAt: new Date().toISOString() }] : [];
    const contactName = scenarioId === 'master-0163' ? 'Maria' : 'Andrei';
    const seedViewing = { id: 'viewing-selected', contactId: 'andrei', contactName, propertyId: 'titan', propertyTitle: 'Apartament Titan', viewingDate: resolveDatetime({ dayOffset: ['master-0164', 'master-0167'].includes(scenarioId) ? -1 : 1, time: '17:00' }).iso, duration: 60, status: 'scheduled', notes: 'Acces pe intrarea principală.', agentId: id, updatedAt: '2026-01-01T00:00:00.000Z' };
    if (isRead) {
      seedViewing.contactName = 'Nume vechi'; seedViewing.propertyTitle = 'Titlu vechi';
      if (scenarioId !== 'master-0170') seedViewing.viewingDate = resolveDatetime({ dayOffset: 0, time: '17:00' }).iso;
    }
    if (['master-0171', 'master-0162', 'master-0164', 'master-0165', ...noteCases].includes(scenarioId)) history.push({ id: 'viewing-selection', role: 'assistant', text: 'Vizionarea selectată este viewing-selected.', cards: [{ type: 'data', source: 'viewings', title: 'Vizionare selectată', rows: [seedViewing] }], createdAt: new Date().toISOString() });
    if (isNote) history.unshift({ id: 'note-content', role: 'user', text: `Textul notei pentru vizionare este: ${newNote}`, createdAt: new Date().toISOString() });
    if (scenarioId === 'master-0162') history.unshift({ id: 'shift-direction', role: 'user', text: 'Vreau să amân vizionarea selectată, adică să o mut mai târziu.', createdAt: new Date().toISOString() });
    if (contextCases.includes(scenarioId)) {
      if (scenarioId === 'master-0159') history.push({ id: 'previous-time', role: 'user', text: 'Pentru următoarea programare vreau mâine la ora 17.', createdAt: new Date().toISOString() });
      history.push({ id: 'current-selection', role: 'assistant', text: 'Proprietatea selectată este Apartament Titan (titan).' + (scenarioId === 'master-0158' ? ' Clientul selectat este Andrei (andrei).' : ''), cards: [
        { type: 'data', source: 'properties', title: 'Proprietate selectată', rows: [{ id: 'titan', title: 'Apartament Titan' }], complete: true },
        ...(scenarioId === 'master-0158' ? [{ type: 'data' as const, source: 'contacts', title: 'Client selectat', rows: [{ id: 'andrei', name: 'Andrei' }], complete: true }] : []),
      ], createdAt: new Date().toISOString() });
    }
    if (isHistory && scenarioId !== 'master-0173') history.push({ id: 'property-selection', role: 'assistant', text: 'Proprietatea selectată este Apartament Cismigiu (titan).', cards: [{ type: 'data', source: 'properties', title: 'Proprietate selectată', rows: [{ id: 'titan', title: 'Apartament Cismigiu' }], complete: true }], createdAt: new Date().toISOString() });
    const budget = new AgentBudget(), previous = process.env.JARVIS_AUTONOMOUS;
    process.env.JARVIS_AUTONOMOUS = 'true';
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, runAt: new Date().toISOString(), context: history, environment: 'actual model + local Firestore; external catalog excluded', executionVerified: false };
    try {
      await profile.set({ agencyId: id, role: 'agent', name: 'Agent local' });
      if (!isViewing && !isTaskContext && !isReview && !isOrder) await agency.collection('assistantPolicies').doc(id).set({ ownerId: id, role: 'agent', enabled: true, viewings: true, expiresAt: Date.now() + 180000 });
      await agency.collection('contacts').doc('andrei').set({ name: contactName, phone: '0700000001', contactType: 'Cumparator' });
      await agency.collection('properties').doc('titan').set({ title: 'Apartament Titan', location: 'Titan', ownerName: 'Proprietar local', ownerPhone: '0700000002', status: isNote ? 'Inactiv' : 'Activ' });
      if (isOrder) {
        const day = date.local.slice(0, 10);
        for (const [key, fields] of Object.entries({ fixed: { startTime: '12:00', duration: 60, description: 'Apel stabilit' }, short: { duration: 30, description: 'Verifică actele' }, long: { duration: 60, description: 'Pregătește dosarul' }, unplaced: { duration: 600, description: 'Raport extins' }, done: { status: 'completed' }, colleague: { agentId: 'other' } })) await agency.collection('tasks').doc(key).set({ agentId: id, status: 'open', dueDate: day, description: 'Altă sarcină', ...fields });
        await agency.collection('viewings').doc('fixed-viewing').set({ ...seedViewing, viewingDate: date.iso, contactName: 'Vechi', propertyTitle: 'Titlu vechi' });
        await agency.collection('viewings').doc('cancelled').set({ ...seedViewing, status: 'cancelled' });
      }
      if (isReview) {
        const early = resolveDatetime({ dayOffset: 0, time: '00:00' });
        expect(Date.now() - Date.parse(early.iso), 'Run this live fixture after 00:02 Bucharest').toBeGreaterThan(120000);
        for (const [key, extra] of Object.entries({ overdue: { startTime: '00:00' }, untimed: {}, done: { status: 'completed' }, colleague: { agentId: 'other' }, yesterday: { dueDate: resolveDatetime({ dayOffset: -1, time: '12:00' }).local.slice(0, 10) }, future: { dueDate: date.iso } })) {
          await agency.collection('tasks').doc(key).set({ description: key === 'overdue' ? 'Sună clientul pentru acte' : 'Verifică documentele', status: 'open', agentId: id, dueDate: early.local.slice(0, 10), ...extra });
        }
        for (const [key, extra] of Object.entries({ elapsed: {}, done: { status: 'completed' }, cancelled: { status: 'cancelled' }, colleague: { agentId: 'other' }, tomorrow: { viewingDate: date.iso }, ongoing: { viewingDate: new Date().toISOString(), duration: 60 } })) await agency.collection('viewings').doc(key).set({ ...seedViewing, viewingDate: early.iso, duration: 1, ...extra });
      }
      if (isAttendance || isRisk) {
        const contact = (await agency.collection('contacts').doc('andrei').get()).data()!, property = (await agency.collection('properties').doc('titan').get()).data()!;
        const now = new Date().toISOString();
        for (const [viewingId, time] of [['unknown', '10:00'], ['client-only', '12:00'], ['declined', '14:00'], ['stale', '16:00'], ['confirmed', '18:00']]) {
          const row = { ...seedViewing, id: viewingId, viewingDate: resolveDatetime({ dayOffset: 1, time }).iso };
          const client = recordAttendance({ participant: 'client', status: viewingId === 'declined' ? 'declined' : 'confirmed' }, row, contact, property, id, now);
          const owner = recordAttendance({ participant: 'owner', status: 'confirmed' }, row, contact, property, id, now);
          await agency.collection('viewings').doc(viewingId).set({ ...row, notes: viewingId === 'unknown' ? 'Mesaj de confirmare pregătit' : '', confirmations: viewingId === 'unknown' ? null : viewingId === 'client-only' ? { client } : { client, owner }, ...(viewingId === 'stale' ? { viewingDate: resolveDatetime({ dayOffset: 1, time: '17:00' }).iso } : {}) });
        }
        await agency.collection('viewings').doc('cancelled').set({ ...seedViewing, status: 'cancelled' });
        await agency.collection('viewings').doc('completed').set({ ...seedViewing, status: 'completed' });
        await agency.collection('viewings').doc('other-agent').set({ ...seedViewing, agentId: 'another-agent' });
        await agency.collection('viewings').doc('other-day').set({ ...seedViewing, viewingDate: resolveDatetime({ dayOffset: 2, time: '17:00' }).iso });
        if (isRisk) history.push({ id: 'previous-unconfirmed-list', role: 'assistant', text: 'Acestea sunt vizionările discutate anterior, atunci fără confirmare.', createdAt: now,
          cards: [{ type: 'data', source: 'viewings', title: 'Vizionări', rows: ['unknown', 'declined', 'stale', 'confirmed'].map(id => ({ id, clientConfirmation: { status: 'unknown' }, ownerConfirmation: { status: 'unknown' } })) }] });
      }
      if (isConfirmation) {
        history.push({ id: 'selected-viewing-for-message', role: 'assistant', text: 'Vizionarea selectată este viewing-selected.', cards: [{ type: 'data', source: 'viewings', title: 'Selecție anterioară', rows: [{ ...seedViewing, contactName: 'Nume vechi', propertyTitle: 'Titlu vechi' }] }], createdAt: new Date().toISOString() });
        await agency.collection('properties').doc('titan').update({ address: 'Strada Teiului 10' });
        await agency.collection('viewings').doc(seedViewing.id).set({ ...seedViewing, contactName: 'Nume vechi', propertyTitle: 'Titlu vechi', viewingDate: resolveDatetime({ dayOffset: 1, time: '18:00' }).iso });
      }
      if (isAvailability) {
        const at = (time: string) => resolveDatetime({ dayOffset: 1, time }).iso;
        await agency.collection('tasks').doc('busy-task').set({ description: 'Documente', status: 'open', agentId: id, dueDate: at('16:00'), startTime: '16:00', duration: 60 });
        await agency.collection('viewings').doc('busy-viewing').set({ ...seedViewing, id: 'busy-viewing', viewingDate: at('17:30') });
        await agency.collection('viewings').doc('property-busy').set({ ...seedViewing, id: 'property-busy', agentId: 'colleague', contactId: 'other-contact', viewingDate: at('18:30'), duration: 30 });
        await agency.collection('viewings').doc('cancelled').set({ ...seedViewing, id: 'cancelled', viewingDate: at('19:00'), status: 'cancelled' });
        if (scenarioId === 'master-0193') history.push({ id: 'viewing-constraints', role: 'user', text: 'Pentru următoarea vizionare: clientul Andrei (andrei), proprietatea Apartament Titan (titan), durata 60 de minute, mâine între 16:00 și 20:00. Alege primul interval liber pentru mine, client și proprietate.', createdAt: new Date().toISOString() });
      }
      if (isTaskContext) {
        await agency.collection('properties').doc('other-property').set({ title: 'Apartament vechi', ownerName: 'Alt proprietar', ownerPhone: '0700000099' });
        await agency.collection('contacts').doc('other-contact').set({ name: 'Alt client', phone: '0700000098' });
        history.push({ id: 'old-selection', role: 'assistant', text: 'Selecție anterioară.', cards: [{ type: 'data', source: 'properties', title: 'Proprietate veche', rows: [{ id: 'other-property', title: 'Apartament vechi' }] }, { type: 'data', source: 'contacts', title: 'Client vechi', rows: [{ id: 'other-contact', name: 'Alt client' }] }], createdAt: new Date().toISOString() });
        if (scenarioId === 'master-0191') {
          await agency.collection('tasks').doc('task-selected').set({ ...seedTask, propertyId: 'other-property', propertyTitle: 'Apartament vechi' });
          history.push({ id: 'selected-task', role: 'assistant', text: 'Taskul selectat este task-selected.', cards: [{ type: 'data', source: 'tasks', title: 'Task selectat', rows: [{ ...seedTask, propertyId: 'other-property' }] }], createdAt: new Date().toISOString() });
        } else history.push({ id: 'task-details', role: 'user', text: 'Pentru taskul pe care urmează să îl creez: descrierea este «Discută documentele lipsă», scadența mâine la 10:00, durata 30 minute.', createdAt: new Date().toISOString() });
        const currentRecord = currentRecordFromPath(scenarioId === 'master-0190' ? '/leads/andrei' : '/properties/titan')!;
        history.push(await currentRecordMessage(ctx, currentRecord));
        report = { ...report, currentRecord, context: history };
      }
      if (isEdit || isRead) await agency.collection('viewings').doc(seedViewing.id).set(seedViewing);
      if (isRead) {
        for (const [key, extra] of Object.entries({ later: { viewingDate: new Date(Date.parse(seedViewing.viewingDate) + 3600000).toISOString() }, cancelled: { status: 'cancelled' }, colleague: { agentId: 'other-agent' } })) {
          await agency.collection('viewings').doc(key).set({ ...seedViewing, id: key, ...extra });
        }
      }
      if (isHistory) {
        await agency.collection('properties').doc('titan').update({ title: 'Apartament Cismigiu', location: 'Cismigiu' });
        await agency.collection('contacts').doc('maria').set({ name: 'Maria', contactType: 'Cumparator' });
        await agency.collection('viewings').doc('viewing-selected').set({ ...seedViewing, status: 'completed', viewingDate: resolveDatetime({ dayOffset: -3, time: '17:00' }).iso });
        await agency.collection('viewings').doc('colleague').set({ ...seedViewing, id: 'colleague', status: 'completed', agentId: 'other-agent', viewingDate: resolveDatetime({ dayOffset: -2, time: '17:00' }).iso });
        await agency.collection('viewings').doc('last-maria').set({ ...seedViewing, id: 'last-maria', contactId: 'maria', status: 'completed', viewingDate: resolveDatetime({ dayOffset: -1, time: '17:00' }).iso });
        await agency.collection('viewings').doc('unrelated').set({ ...seedViewing, id: 'unrelated', propertyId: 'other-property', status: 'completed', viewingDate: resolveDatetime({ dayOffset: -1, time: '18:00' }).iso });
      }
      if (isFollowup) {
        for (let i = 0; i < 6; i++) await agency.collection('viewings').doc(`follow-${i}`).set({ ...seedViewing, id: `follow-${i}`, status: 'completed', viewingDate: resolveDatetime({ dayOffset: -1, time: `${String(10 + i).padStart(2, '0')}:00` }).iso });
        await agency.collection('viewings').doc('cancelled').set({ ...seedViewing, id: 'cancelled', status: 'cancelled', viewingDate: resolveDatetime({ dayOffset: -1, time: '16:00' }).iso });
        await agency.collection('tasks').doc('existing-followup').set({ description: 'Follow-up deja înregistrat', viewingId: 'follow-5', contactId: 'andrei', propertyId: 'titan', agentId: id, status: 'open', dueDate: date.local.slice(0, 10) });
      }
      if (isAgenda) {
        if (scenarioId === 'master-0182') {
          await agency.collection('tasks').doc('task-selected').set(seedTask);
          await agency.collection('tasks').doc('task-original').set({ ...seedTask, id: 'task-original' });
        } else {
          const dates = { 'today-date': resolveDatetime({ dayOffset: 0, time: '12:00' }).local.slice(0, 10), 'today-clock': resolveDatetime({ dayOffset: 0, time: '17:00' }).iso,
            'yesterday': resolveDatetime({ dayOffset: -1, time: '12:00' }).local.slice(0, 10), 'old': resolveDatetime({ dayOffset: -60, time: '12:00' }).local.slice(0, 10),
            'tomorrow': date.iso, 'completed': resolveDatetime({ dayOffset: 0, time: '12:00' }).iso, 'colleague': resolveDatetime({ dayOffset: 0, time: '12:00' }).iso };
          for (const [key, dueDate] of Object.entries(dates)) await agency.collection('tasks').doc(key).set({ id: key, description: `Sarcină ${key}`, dueDate, status: key === 'completed' ? 'completed' : 'open', agentId: key === 'colleague' ? 'other-agent' : id });
        }
      }
      const priorityNames: Record<string, string> = { accepted: 'Finalizează oferta acceptată', pending: 'Discută oferta în așteptare', negotiation: 'Revino la negociere', viewing: 'Cere feedback după vizionare', priority: 'Sună clientul prioritar', overdue: 'Recuperează documentele restante', today: 'Verifică documentele de azi', future: 'Organizează arhiva' };
      if (isPriority) {
        for (const [contactId, extra] of Object.entries({ accepted: { offers: [{ propertyId: 'titan', status: 'Acceptată' }] }, pending: { offers: [{ propertyId: 'titan', status: 'În așteptare' }] }, negotiation: { status: 'În negociere' }, viewing: {}, priority: { priority: 'Ridicată' } })) await agency.collection('contacts').doc(contactId).set({ name: contactId, status: 'Nou', ...extra });
        await agency.collection('viewings').doc('done-viewing').set({ contactId: 'viewing', propertyId: 'titan', agentId: id, status: 'completed', viewingDate: resolveDatetime({ dayOffset: -1, time: '17:00' }).iso });
        for (const [key, description] of Object.entries(priorityNames)) await agency.collection('tasks').doc(key).set({ id: key, description, agentId: id, status: 'open', contactId: ['overdue', 'today', 'future'].includes(key) ? 'andrei' : key, propertyId: 'titan', dueDate: resolveDatetime({ dayOffset: key === 'overdue' ? -1 : key === 'today' ? 0 : 1, time: '12:00' }).local.slice(0, 10), ...(key === 'viewing' ? { viewingId: 'done-viewing' } : {}) });
        await agency.collection('tasks').doc('completed').set({ description: 'Task finalizat', status: 'completed', agentId: id, dueDate: '2026-01-01' });
        await agency.collection('tasks').doc('colleague').set({ description: 'Task coleg', status: 'open', agentId: 'colleague', dueDate: '2026-01-01' });
      }
      if (isDeferral) {
        for (let i = 0; i < 5; i++) await agency.collection('tasks').doc(`move-${i}`).set({ id: `move-${i}`, description: `Task neurgent ${i}`, agentId: id, status: 'open', dueDate: resolveDatetime({ dayOffset: 3, time: '12:00' }).local.slice(0, 10), duration: 30, ...(i === 0 ? { startTime: '09:00' } : {}), updatedAt: '2026-01-01T00:00:00.000Z' });
        await agency.collection('contacts').doc('high-priority').set({ name: 'Client prioritar', status: 'Nou', priority: 'Ridicată' });
        await agency.collection('viewings').doc('today-viewing').set({ ...seedViewing, viewingDate: resolveDatetime({ dayOffset: 0, time: '17:00' }).iso });
        for (const [key, extra] of Object.entries({ urgent: { contactId: 'high-priority' }, today: { dueDate: resolveDatetime({ dayOffset: 0, time: '12:00' }).local.slice(0, 10) }, already: { dueDate: date.local.slice(0, 10) }, linked: { viewingId: 'today-viewing', contactId: 'andrei', propertyId: 'titan' }, done: { status: 'completed' }, colleague: { agentId: 'other' } })) await agency.collection('tasks').doc(key).set({ id: key, description: `Păstrează ${key}`, agentId: id, status: 'open', dueDate: resolveDatetime({ dayOffset: 3, time: '12:00' }).local.slice(0, 10), ...extra });
      }
      const beforeDeferral = isDeferral ? (await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data()) : [];
      const beforePriorities = isPriority ? (await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data()) : [];
      const beforeAgenda = isAgenda ? (await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data()) : [];
      const beforeRead = isRead ? (await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data()) : [];
      if (scenarioId === 'master-0159') {
        const currentRecord = currentRecordFromPath('/leads/andrei')!;
        history.push(await currentRecordMessage(ctx, currentRecord));
        report = { ...report, currentRecord, context: history };
      }
      if (['master-0179', 'master-0180', 'master-0181'].includes(scenarioId)) await agency.collection('tasks').doc(seedTask.id).set(seedTask);
      const provider = new OpenAIAdapter(), diagnostics: unknown[] = [], toolCalls: unknown[] = [], seenErrors = new Set<string>();
      const reviewBefore = isReview || isOrder ? await Promise.all(['tasks', 'viewings'].map(async source => (await agency.collection(source).orderBy('__name__').get()).docs.map(doc => doc.data()))) : null;
      const reviewClockBefore = zonedParts(new Date(), 'Europe/Bucharest').time;
      const attendanceBefore = isAttendance || isRisk ? (await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data()) : null;
      if (isConfirmation || isRisk) {
        const missing = await planTurn(ctx, prompt, [], { provider, budget: new AgentBudget() });
        report = { ...report, missingSelectionTrial: { status: missing.metrics.status, text: missing.text, actions: missing.actions } };
        expect(missing.actions).toEqual([]); expect(missing.metrics.status, missing.text).toBe('clarification');
      }
      const confirmationBefore = isConfirmation ? await Promise.all(['viewings', 'contacts', 'properties'].map(async source => (await agency.collection(source).orderBy('__name__').get()).docs.map(doc => doc.data()))) : null;
      const availabilityBefore = isAvailability ? { tasks: (await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data()), viewings: (await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data()) } : null;
      if (['master-0189', 'master-0190'].includes(scenarioId)) {
        const missing = await planTurn(ctx, prompt, history.filter(message => message.id !== 'task-details'), { provider, budget: new AgentBudget() });
        report = { ...report, missingDetailsTrial: { status: missing.metrics.status, text: missing.text, actions: missing.actions, tools: missing.metrics.tools } };
        expect(missing.actions).toEqual([]); expect(missing.metrics.status, missing.text).toBe('clarification');
        expect((await agency.collection('tasks').get()).size).toBe(0);
      }
      const planned = await planTurn(ctx, prompt, history, { provider: { id: provider.id, respond: async request => {
        for (const item of request.input as any[]) if (item.type === 'function_call_output' && !seenErrors.has(item.call_id)) { try { const output = JSON.parse(item.output); if (output.error) { diagnostics.push({ callId: item.call_id, error: output.error }); seenErrors.add(item.call_id); } } catch {} }
        const response = await provider.respond(request); toolCalls.push(...response.calls); return response;
      } }, budget });
      report = { ...report, plannerStatus: planned.metrics.status, text: planned.text, actions: planned.actions, tools: planned.metrics.tools, models: planned.metrics.models, diagnostics, toolCalls, costUsd: budget.cost };
      expect(planned.metrics.status, planned.text).toBe('success');
      if (isOrder) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        expect(planned.metrics.tools.some(tool => tool.name === 'tomorrow_order')).toBe(true);
        const rows = planned.cards.filter(card => card.source === 'calendar').flatMap(card => card.rows);
        expect(rows.map(row => row.id)).toEqual(['short', 'fixed-viewing', 'fixed', 'long']);
        expect(rows.map(row => String(row.startLocal).slice(11, 16))).toEqual(['09:00', '10:00', '12:00', '13:00']);
        expect(rows[1].title).toBe('Andrei — Apartament Titan');
        for (const text of ['București', 'Raport extins', '09:00', '10:00', '12:00', '13:00', '15']) expect(planned.text).toContain(text);
        expect(await Promise.all(['tasks', 'viewings'].map(async source => (await agency.collection(source).orderBy('__name__').get()).docs.map(doc => doc.data())))).toEqual(reviewBefore);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        report = { ...report, executionVerified: true, cards: planned.cards, verification: 'Original prompt with actual model and local CRM. Fixed viewing/task hours preserved; flexible tasks proposed in buffered gaps; oversized task disclosed; fresh participant/property titles; completed/cancelled/colleague records excluded. Calendar unchanged and no messages sent. Not production certification.' };
        return;
      }
      if (isReview) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        expect(planned.metrics.tools.some(tool => tool.name === 'today_review')).toBe(true);
        const rows = planned.cards.flatMap(card => card.rows);
        expect(rows).toHaveLength(3);
        expect(rows.find(row => row.id === 'overdue')).toMatchObject({ category: 'overdue_task' });
        expect(rows.find(row => row.id === 'untimed')).toMatchObject({ category: 'untimed_task' });
        expect(rows.find(row => row.id === 'elapsed')).toMatchObject({ category: 'viewing_outcome_missing', contactName: 'Andrei', propertyTitle: 'Apartament Titan' });
        expect(planned.text).toContain('București');
        expect(planned.text).toContain('Sună clientul pentru acte');
        expect(planned.text).toContain('Apartament Titan');
        expect([reviewClockBefore, zonedParts(new Date(), 'Europe/Bucharest').time].some(clock => planned.text.includes(clock))).toBe(true);
        expect(planned.text).not.toMatch(/checkedAt|complete=true|issues/);
        expect(await Promise.all(['tasks', 'viewings'].map(async source => (await agency.collection(source).orderBy('__name__').get()).docs.map(doc => doc.data())))).toEqual(reviewBefore);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        report = { ...report, executionVerified: true, cards: planned.cards, verification: 'Original prompt with actual model and local CRM: elapsed open task, untimed task and elapsed viewing without recorded outcome; ongoing/completed/cancelled/other-day/colleague records excluded. Collections unchanged; no outbound messages. Not production certification.' };
        return;
      }
      if (isRisk) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        expect(planned.metrics.tools.some(tool => tool.name === 'viewing_risk')).toBe(true);
        const rows = planned.cards.filter(card => card.source === 'viewings').flatMap(card => card.rows);
        expect(rows.map(row => row.id)).toEqual(['declined', 'unknown', 'stale', 'confirmed']);
        expect(rows[0]).toMatchObject({ priority: 'urgent', clientConfirmation: { status: 'declined' } });
        expect(rows[2]).toMatchObject({ priority: 'verification_needed', clientConfirmation: { status: 'unknown', reason: 'stale_or_invalid' } });
        expect(rows[3].priority).toBe('no_known_warning');
        expect(planned.text).toContain('București'); expect(planned.text).not.toMatch(/\d+\s*%/);
        expect(planned.text.toLowerCase()).toContain('refuz');
        expect((await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(attendanceBefore);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        report = { ...report, executionVerified: true, cards: planned.cards, verification: 'Original contextual request with actual model and fresh local CRM WhatsApp evidence. Unknown, stale and explicit refusal distinguished; unrelated appointments excluded; no writes or outbound messages. Missing context requests clarification. No production or Meta delivery certification.' };
        return;
      }
      if (isAttendance) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        const rows = planned.cards.filter(card => card.source === 'viewings').flatMap(card => card.rows);
        expect(rows.map(row => row.id)).toEqual(['unknown', 'client-only', 'declined', 'stale']);
        expect(rows[0]).toMatchObject({ clientConfirmation: { status: 'unknown' }, ownerConfirmation: { status: 'unknown' } });
        expect(rows[1]).toMatchObject({ clientConfirmation: { status: 'confirmed' }, ownerConfirmation: { status: 'unknown' } });
        expect(rows[2].clientConfirmation).toMatchObject({ status: 'declined' });
        expect(rows[3].clientConfirmation).toMatchObject({ status: 'unknown', reason: 'stale_or_invalid' });
        expect(planned.text).toContain('București');
        expect((await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(attendanceBefore);
        const replyTrials = [];
        for (const [text, expected] of [['Voi fi acolo, la ora stabilită. Ne vedem mâine!', 'confirmed'], ['Din păcate a intervenit ceva și nu mai reușesc să ajung.', 'declined'], ['Aș putea ajunge mâine la 19 în loc de 18?', 'reschedule_requested'], ['Vin doar dacă termin ședința la timp.', 'unknown'], ['Mulțumesc pentru mesaj.', 'unknown']]) {
          const result = await interpretReply(text, 'Confirmați vizionarea Apartament Titan mâine la 18:00, ora Bucureștiului.', { agencyId: id, uid: id }, provider);
          replyTrials.push({ text, expected, ...result });
          report = { ...report, replyTrials };
          expect(result.status, text).toBe(expected);
        }
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).empty).toBe(true);
        report = { ...report, executionVerified: true, cards: planned.cards, verification: 'Original read returns four unconfirmed appointments from WhatsApp-evidence fixtures without writes. Five free-text replies classified with real model. Meta delivery not exercised.' };
        return;
      }
      if (isConfirmation) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        const rows = (planned.cards || []).filter(card => card.source === 'viewing_confirmation').flatMap(card => card.rows || []);
        expect(rows).toHaveLength(1);
        const owner = scenarioId === 'master-0196';
        expect(rows[0]).toMatchObject({ recipient: owner ? 'owner' : 'client', recipientName: owner ? 'Proprietar local' : 'Andrei', recipientPhone: owner ? '0700000002' : '0700000001' });
        for (const value of ['18:00', 'Apartament Titan', 'Strada Teiului 10', owner ? 'Proprietar local' : 'Andrei']) expect(planned.text).toContain(value);
        expect(planned.text).toMatch(/netrimis|nu (?:a fost |este |am )?trimis/i);
        expect(planned.text).not.toMatch(/Nume vechi|Titlu vechi|17:00|UTC|GMT/);
        expect(rows[0].description).toContain(owner ? 'confirmați disponibilitatea pentru acces' : 'confirmați participarea');
        expect(await Promise.all(['viewings', 'contacts', 'properties'].map(async source => (await agency.collection(source).orderBy('__name__').get()).docs.map(doc => doc.data())))).toEqual(confirmationBefore);
        for (const source of ['tasks', 'assistantExecutions', 'assistantJobs']) expect((await agency.collection(source).get()).size).toBe(0);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', id).get()).size).toBe(0);
        report = { ...report, executionVerified: true, confirmation: planned.text, cards: planned.cards, verification: 'Complete unsent draft with current appointment/recipient data; no CRM mutation or outbound action.', unchangedRecords: confirmationBefore };
        return;
      }
      if (isAvailability) {
        expect(diagnostics).toEqual([]);
        if (scenarioId === 'master-0192') {
          expect(planned.actions).toEqual([]);
          const rows = (planned.cards || []).filter(card => card.source === 'calendar').flatMap(card => card.rows || []);
          expect(rows.map(row => row.start)).toEqual(['17:00', '18:30'].map(time => resolveDatetime({ dayOffset: 1, time }).iso));
          for (const row of rows) expect(row.title).toBe(`${row.startLocal} – ${row.endLocal} · București`);
          for (const time of ['17:00', '17:30', '18:30']) expect(planned.text).toContain(time);
          expect(planned.text).not.toMatch(/UTC|GMT/);
          expect((await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(availabilityBefore!.viewings);
          report = { ...report, executionVerified: true, confirmation: planned.text, cards: planned.cards };
        } else {
          expect(planned.actions).toHaveLength(1);
          expect(planned.actions[0]).toMatchObject({ kind: 'schedule_viewing', contactId: 'andrei', propertyId: 'titan', duration: 60, viewingDate: resolveDatetime({ dayOffset: 1, time: '19:00' }).iso });
          expect(planned.actions[0].kind === 'schedule_viewing' && planned.actions[0].firstAvailable).toBeTruthy();
          const execution = await executeSafePrefix(ctx, id, planned.actions, prompt); report = { ...report, execution };
          expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
          const receipt = execution.results[0].result as Record<string, unknown>;
          const saved = (await agency.collection('viewings').doc(String(receipt.viewingId)).get()).data();
          expect(saved).toMatchObject({ contactId: 'andrei', propertyId: 'titan', viewingDate: resolveDatetime({ dayOffset: 1, time: '19:00' }).iso, status: 'scheduled', duration: 60, agentId: id });
          expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
          expect((await agency.collection('viewings').get()).size).toBe(availabilityBefore!.viewings.length + 1);
          for (const before of availabilityBefore!.viewings) expect((await agency.collection('viewings').doc(before.id).get()).data()).toEqual(before);
          const confirmation = executionConfirmation(execution.results); expect(confirmation).toContain('19:00'); expect(confirmation).toContain('Vizionare programată');
          report = { ...report, executionVerified: true, confirmation, storedViewing: saved };
        }
        expect((await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(availabilityBefore!.tasks);
        return;
      }
      if (isTaskContext) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toHaveLength(1);
        if (scenarioId === 'master-0191') expect(planned.actions[0]).toMatchObject({ kind: 'update_task', taskId: 'task-selected', propertyId: 'titan' });
        else expect(planned.actions[0]).toMatchObject({ kind: 'create_task', participantSource: scenarioId === 'master-0189' ? 'property_owner' : 'contact', description: 'Discută documentele lipsă', duration: 30 });
        const before = (await agency.collection('tasks').doc('task-selected').get()).data();
        const execution = await executeSafePrefix(ctx, id, planned.actions, prompt);
        report = { ...report, execution };
        expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
        const tasks = await agency.collection('tasks').get(); expect(tasks.size).toBe(1);
        const saved = tasks.docs[0].data();
        if (scenarioId === 'master-0191') expect(saved).toEqual({ ...before, propertyId: 'titan', propertyTitle: 'Apartament Titan', updatedAt: saved.updatedAt });
        else {
          expect(taskInterval(saved)?.start).toBe(date.iso);
          expect(saved.status).toBe('open'); expect(saved.agentId).toBe(id); expect(saved.participantSource).toBeUndefined();
          if (scenarioId === 'master-0189') { expect(saved).toMatchObject({ propertyId: 'titan', propertyTitle: 'Apartament Titan', participantName: 'Proprietar local', participantPhone: '0700000002' }); expect(saved.contactId).toBeUndefined(); }
          else { expect(saved).toMatchObject({ contactId: 'andrei', contactName: 'Andrei', participantName: 'Andrei', participantPhone: '0700000001' }); expect(saved.propertyId).toBeUndefined(); }
        }
        expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
        expect((await agency.collection('tasks').get()).size).toBe(1);
        expect((await agency.collection('contacts').get()).size).toBe(2); expect((await agency.collection('viewings').get()).size).toBe(0);
        const confirmation = executionConfirmation(execution.results);
        expect(confirmation).toContain(scenarioId === 'master-0190' ? 'Client: Andrei.' : 'Proprietate: Apartament Titan.');
        if (scenarioId === 'master-0189') expect(confirmation).toContain('Participant: Proprietar local.');
        report = { ...report, executionVerified: true, confirmation, storedTasks: [saved] };
        return;
      }
      if (isDeferral) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toHaveLength(5);
        expect(planned.actions.every(action => action.kind === 'update_task' && action.deferNonUrgent)).toBe(true);
        const execution = await executeSafePrefix(ctx, id, planned.actions, prompt);
        report = { ...report, execution };
        expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(5);
        const saved = (await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data());
        for (const original of beforeDeferral) {
          const row = saved.find(row => row.id === original.id)!;
          if (original.id.startsWith('move-')) {
            expect(row.dueDate).toBe(date.local.slice(0, 10)); expect(row.duration).toBe(original.duration); expect(row.startTime).toBe(original.startTime);
            expect(row.description).toBe(original.description); expect(row.deferNonUrgent).toBeUndefined();
          } else expect(row).toEqual(original);
        }
        expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
        const confirmation = executionConfirmation(execution.results); expect(confirmation.match(/Task actualizat/g)).toHaveLength(5);
        report = { ...report, executionVerified: true, confirmation, beforeTasks: beforeDeferral, storedTasks: saved };
        return;
      }
      if (isPriority) {
        expect(diagnostics).toEqual([]); expect(planned.actions).toEqual([]);
        const expected = scenarioId === 'master-0185' ? ['overdue', 'today', 'priority'] : ['accepted', 'pending', 'negotiation', 'viewing', 'priority', 'overdue', 'today', 'future'];
        const rows = (planned.cards || []).filter(card => card.source === 'tasks').flatMap(card => card.rows || []);
        expect(rows.map(row => row.id)).toEqual(expected);
        for (const key of expected) expect(planned.text).toContain(priorityNames[key]);
        expect(planned.text).not.toMatch(/UTC|GMT/);
        expect((await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(beforePriorities);
        report = { ...report, executionVerified: true, confirmation: planned.text, cards: planned.cards, storedTasks: beforePriorities };
        return;
      }
      if (isAgenda) {
        expect(diagnostics).toEqual([]);
        if (scenarioId === 'master-0182') {
          expect(planned.actions).toHaveLength(1); expect(planned.actions[0]).toMatchObject({ kind: 'delete_task', taskId: 'task-selected' });
          const execution = await executeSafePrefix(ctx, id, planned.actions, prompt);
          expect(execution.blocked).toBe(false); expect(execution.actions).toEqual([]); expect(execution.results).toHaveLength(1);
          expect((await agency.collection('tasks').doc('task-selected').get()).exists).toBe(false);
          expect((await agency.collection('tasks').doc('task-original').get()).data()).toEqual({ ...seedTask, id: 'task-original' });
          const audit = await agency.collection('assistantDeletedRecords').get(); expect(audit.size).toBe(1); expect(audit.docs[0].data()).toMatchObject({ resource: 'tasks', id: 'task-selected', previous: seedTask });
          expect((await executeSafePrefix(ctx, id, planned.actions, prompt)).results).toEqual(execution.results);
          expect((await agency.collection('assistantDeletedRecords').get()).size).toBe(1);
          const confirmation = executionConfirmation(execution.results); expect(confirmation).toContain('Task șters');
          report = { ...report, executionVerified: true, execution, confirmation, retainedTask: (await agency.collection('tasks').doc('task-original').get()).data() };
        } else {
          expect(planned.actions).toEqual([]); expect(planned.text).not.toMatch(/UTC|GMT/);
          const rows = (planned.cards || []).filter(card => card.source === 'tasks').flatMap(card => card.rows || []);
          expect(rows.map(row => row.id).sort()).toEqual(scenarioId === 'master-0183' ? ['today-clock', 'today-date'] : ['old', 'yesterday']);
          expect((await agency.collection('tasks').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(beforeAgenda);
          report = { ...report, executionVerified: true, confirmation: planned.text, cards: planned.cards, storedTasks: beforeAgenda };
        }
        return;
      }
      if (isFollowup) {
        expect(diagnostics).toEqual([]);
        if (scenarioId === 'master-0176') {
          expect(planned.text).not.toMatch(/UTC|GMT/);
          for (let hour = 10; hour < 15; hour++) expect(planned.text).toContain(`${hour}:00`);
          expect(planned.actions).toEqual([]);
          const cards = JSON.stringify(planned.cards);
          for (let i = 0; i < 5; i++) expect(cards).toContain(`follow-${i}`);
          expect(cards).not.toContain('follow-5'); expect(cards).not.toContain('cancelled');
          expect((await agency.collection('tasks').get()).size).toBe(1);
          report = { ...report, executionVerified: true, cards: planned.cards, confirmation: planned.text };
        } else {
          expect(planned.actions).toHaveLength(5);
          expect(planned.actions.every(action => action.kind === 'create_task' && action.viewingId)).toBe(true);
          const executed = await executeSafePrefix(ctx, id, planned.actions, prompt);
          report = { ...report, execution: executed };
          expect(executed.blocked).toBe(false); expect(executed.actions).toEqual([]); expect(executed.results).toHaveLength(5);
          const tasks = await agency.collection('tasks').get(); expect(tasks.size).toBe(6);
          for (let i = 0; i < 5; i++) {
            const matching = tasks.docs.filter(doc => doc.data().viewingId === `follow-${i}`);
            expect(matching).toHaveLength(1);
            expect(matching[0].data()).toMatchObject({ contactId: 'andrei', propertyId: 'titan', agentId: id, status: 'open', dueDate: resolveDatetime({ dayOffset: 0, time: '12:00' }).local.slice(0, 10) });
          }
          const replay = await executeSafePrefix(ctx, id + '-another-request', planned.actions, prompt);
          expect(replay.blocked).toBe(false); expect(replay.results).toHaveLength(5);
          expect((await agency.collection('tasks').get()).size).toBe(6);
          const confirmation = executionConfirmation(executed.results);
          expect(confirmation.match(/Task creat/g)).toHaveLength(5);
          expect(executionConfirmation(replay.results).match(/deja existent/g)).toHaveLength(5);
          report = { ...report, executionVerified: true, confirmation, replay, storedTasks: tasks.docs.map(doc => doc.data()) };
        }
        return;
      }
      if (isRead) {
        expect(planned.actions).toEqual([]);
        if (isHistory) {
          const output = JSON.stringify(planned.cards || []);
          if (scenarioId === 'master-0172') for (const key of ['viewing-selected', 'colleague', 'last-maria', 'later', 'cancelled']) expect(output).toContain(key);
          if (scenarioId === 'master-0173') { expect(planned.text).toContain('Andrei'); expect(planned.text).toContain('Maria'); }
          if (scenarioId === 'master-0174') expect(planned.text).toMatch(/\b3\b|trei/i);
          if (scenarioId === 'master-0175') { expect(planned.text).toContain('Maria'); expect(output).toContain('last-maria'); }
          expect(output).not.toContain('unrelated');
        }
        const expected = isHistory ? '' : scenarioId === 'master-0168' ? 'Andrei' : scenarioId === 'master-0169' ? 'Apartament Titan' : scenarioId === 'master-0170' ? '0700000001' : '0700000002';
        expect(planned.text.replace(/[\s().-]/g, '')).toContain(expected.replace(/[\s().-]/g, ''));
        expect(planned.text).not.toMatch(/Nume vechi|Titlu vechi/);
        expect(diagnostics).toEqual([]);
        expect((await agency.collection('viewings').orderBy('__name__').get()).docs.map(doc => doc.data())).toEqual(beforeRead);
        expect((await agency.collection('tasks').get()).size).toBe(0);
        report = { ...report, executionVerified: true, confirmation: planned.text, cards: planned.cards, storedViewings: beforeRead, verification: 'Actual model response matches fresh CRM relationship data; no mutations.' };
        return;
      }
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
