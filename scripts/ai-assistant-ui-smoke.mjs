import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
const require = createRequire(import.meta.url);
const loadConfig = require('tailwindcss/loadConfig');
const root = process.cwd();
const output = path.join(root, '.tmp', 'assistant-ui');
await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './src/app/(dashboard)/ai-assistant/page'; createRoot(document.getElementById('root')).render(<Page/>);", resolveDir: root, loader: 'tsx' }, outfile: path.join(output, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'fixture-auth', setup(builder) {
  builder.onLoad({ filter: /context[\\/]AgencyContext\.tsx$/ }, () => ({ contents: "const user={uid:'agent',getIdToken:async()=> 'fixture-token'}; const profile={name:'Mirela Agent'}; export const useAgency=()=>({user,agencyId:'fixture-agency',userProfile:profile});", loader: 'js' }));
  builder.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"import React from 'react';export default function Image({fill,unoptimized,sizes,...props}){return <img {...props}/>}",loader:'jsx',resolveDir:root}));
} }] });
const config = loadConfig(path.join(root, 'tailwind.config.ts'));
config.content = [path.join(root, 'src/app/(dashboard)/ai-assistant/page.tsx'), path.join(root, 'src/components/ui/*.{ts,tsx}'), path.join(root,'src/components/ai/*.{ts,tsx}')];
const css = await postcss([tailwindcss(config)]).process(await fs.readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
await fs.writeFile(path.join(output, 'style.css'), css.css);
const server = http.createServer(async (request, response) => {
  const file = request.url === '/bundle.js' ? 'bundle.js' : request.url === '/style.css' ? 'style.css' : null;
  response.setHeader('Content-Type', file?.endsWith('.js') ? 'text/javascript' : file ? 'text/css' : 'text/html');
  response.end(file ? await fs.readFile(path.join(output, file)) : '<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const errors = [], requests = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.addInitScript(() => { window.imodeusDesktop = { isDesktop: async () => true, startGmailRunner: async ({ session }) => { window.fixtureGmailSession = session; return { state: 'waiting_for_send', message: 'Email pregătit în Gmail; așteaptă trimiterea.' }; }, onGmailRunnerStatusChanged: callback => { window.fixtureGmailStatus = callback; return () => {}; } }; });
  page.on('pageerror', e => errors.push(e.message));
  const planId = 'fdaf7ed4-6102-4227-a969-47c1317654e8';
  const action = { kind: 'schedule_viewing', contactId: 'contact', propertyId: 'property', viewingDate: '2027-01-01T12:00:00+02:00', duration: 60, notes: '' };
  const pendingPlan = { id: planId, actions: [action], status: 'pending', risks: ['SAFE_WRITE'], externalCostNote: 'Costul canalului trebuie verificat înainte de confirmare.' };
  let background = false, autonomyEnabled = false, outcomeReads = 0, outcomeDenied = false;
  const message = (text, cards = [], extra = {}) => ({ id: crypto.randomUUID(), role: 'assistant', text, cards, createdAt: new Date().toISOString(), ...extra });
  await page.route('**/api/**', async route => {
    const request = route.request();
    assert.equal(request.headers().authorization, 'Bearer fixture-token');
    const body = request.postDataJSON(); requests.push({ path: new URL(request.url()).pathname, body });
    let result;
    const url = new URL(request.url());
    if (url.pathname.endsWith('/automations')) result = url.searchParams.has('id') ? { rows: [{ id: 'run', action: 'run', occurredAt: '2026-10-05T10:00:00Z', status: 'active', result: { handled: 1 } }], nextCursor: null } : { rows: [{ id: 'rule', status: 'active', runCount: 1, automation: { type: 'event_rule', nextRunAt: '2030-10-06T10:00:00.123Z', stopAfter: '2030-10-07T10:00:00.456Z', maxRuns: 48, intervalMinutes: 30, maxEvents: 100, trigger: { resource: 'contacts', change: 'updated', statusTo: 'Contactat', changedFields: ['status', 'budget'] }, effects: [{ kind: 'create_task', description: 'Sarcină existentă', dueAfterMinutes: 60, agentId: 'colleague' }, { kind: 'notify', title: 'Notificare existentă', body: 'Detalii păstrate' }] } }], nextCursor: null };
    else if (url.pathname.endsWith('/gmail-session')) result = { session: { jobId: 'gmail-job', saleId: 'sale', messageRecordId: 'email', trackingCode: 'IMO', to: ['owner@example.com'], cc: [], subject: 'Ofertă', bodyText: 'Textul verificat', attachments: [] } };
    else if (url.pathname.endsWith('/send-evidence')) { assert.equal(body.level, 'ui_observed'); result = { ok: true }; }
    else if (body?.kind === 'read' && ['contacts', 'conversations'].includes(body.query.resource)) result = { rows: body.query.resource === 'contacts' ? [{ id: 'client', name: 'Maria Popescu' }] : [{ id: 'conversation', contactName: 'Proprietar', channel: 'whatsapp' }], nextCursor: null, complete: true };
    else if (url.pathname.endsWith('/plan-outcomes')) { outcomeReads++; if (outcomeDenied) { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Acces revocat.' }) }); return; } const terminal = outcomeReads >= 3; result = { planId, executionStatus: 'completed', pollAfterMs: terminal ? null : 15000, checkedAt: new Date().toISOString(), rows: [{ step: 1, title: 'Pasul 1', executionState: terminal ? 'succeeded' : 'queued', businessStatus: terminal ? 'delivered' : 'queued', note: 'Starea curentă este citită fără retrimitere.' }], note: 'Starea executorului este separată de rezultatul extern.' }; }
    else if (request.method() === 'GET' && url.searchParams.has('planId')) result = { plan: pendingPlan };
    else if (request.method() === 'GET' && url.searchParams.has('jobId')) {
      if (url.searchParams.get('stream') === '1') {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ type: 'PROGRESS_EVENT', text: 'Citesc datele autorizate.' }) + '\n\ndata: ' + JSON.stringify({ type: 'ACTION_RESULT', status: 'completed', message: message('Plan pregătit pe server.', [], { planId, actions: [action] }) }) + '\n\n' }); return;
      }
      result = { jobId: 'plan-job', status: 'completed', plan: { ...pendingPlan, status: 'unknown', results: [], error: 'Verifică starea canalului înainte de repetare.' } };
    }
    else if(request.method()==='GET'&&url.searchParams.has('sessionId')) result={messages:[],nextCursor:null};
    else if (request.method() === 'GET') result = { sessions: [], aiConfigured: true, backgroundConfigured: background, autonomy: { available: true, enabled: autonomyEnabled } };
    else if (new URL(request.url()).pathname.endsWith('owner-consent')) {
      assert.equal(body.confirmedPhoneConsent, true); assert.equal(body.purpose, 'marketing');
      result = { conversationId: 'owner-conversation', recordedAt: new Date().toISOString() };
    } else if (body.kind === 'autonomy') { autonomyEnabled = body.enabled; result = { available: true, enabled: autonomyEnabled }; }
    else if (body.kind === 'start') result = { jobId: 'turn-job', status: 'pending' };
    else if (body.kind === 'execute_background') result = { jobId: 'plan-job', status: 'pending' };
    else if (body.kind === 'chat' && body.prompt?.includes('dosare Sales')) result = { message: message('Un dosar autorizat.', [{ type: 'data', source: 'sales', title: 'Dosare Sales', complete: true, summary: { count: 1, label: 'dosare Sales', scope: 'Dosare autorizate' }, rows: [{ id: 'sale', trackingCode: 'IMO-123', propertyTitle: 'Apartament verificat', stage: 'contract', agreedPrice: 130000, agentName: 'Mirela Agent', nextAction: 'Confirmă programarea notarului' }] }]) };
    else if (body.kind === 'chat') result = { message: message('Vizionarea este pregătită; verifică planul.', [], { planId, actions: [action] }) };
    else if (body.kind === 'prepare') result = { message: message('Plan pregătit pentru confirmare.', [], { planId, actions: body.actions }) };
    else if (body.kind === 'execute') result = { plan: { id: planId, actions: [action], status: 'completed', results: [{ step: 1, result: { viewingId: 'viewing', gmailPrepared: true, saleId: 'sale', messageId: 'email' } }] } };
    else if (body.kind === 'read') result = { rows: body.query.resource === 'ownerListingFavorites' ? [{ id: 'listing', ownerPhone: '0722123456', title: 'Apartament Titan' }] : [{ id: 'connection', name: 'Agenție WhatsApp', channel: 'whatsapp', status: 'connected' }] };
    else if (body.kind === 'search') {
      const rows = [{ id: body.query.source === 'owners' ? 'listing' : 'property', title: body.query.source === 'owners' ? 'Apartament Titan proprietar' : 'Apartament Titan CRM', price: '120.000 €', location: 'Titan', rooms: 2 }];
      const card = { type: 'results', source: body.query.source, title: body.query.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', search: body.query, rows, complete: true };
      result = { rows, complete: true, nextCursor: null, message: message('Rezultate verificate.', [card]) };
    } else throw new Error('Unexpected fixture request: ' + JSON.stringify(body));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.clock.install();
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Programează o vizionare.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByRole('button', { name: 'Execută planul' }).waitFor();
  await page.getByText('Risc pe pași: SAFE_WRITE.').waitFor();
  await page.getByText(pendingPlan.externalCostNote, { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.body?.kind === 'execute').length, 0, 'Planning must not mutate the CRM');
  await page.getByRole('button', { name: 'Execută planul' }).click();
  await page.getByText('Stare: finalizat', { exact: true }).waitFor();
  await page.getByText('În coadă · queued', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Verifică rezultatele actuale', exact: true }).click();
  await page.getByText('În coadă · queued', { exact: true }).waitFor();
  await page.clock.runFor(16000);
  await page.getByText('Finalizat · delivered', { exact: true }).waitFor();
  const terminalReads = outcomeReads;
  await page.clock.runFor(45000);
  assert.equal(outcomeReads, terminalReads, 'Terminal evidence stops automatic tracking');
  outcomeDenied = true;
  await page.getByRole('button', { name: 'Verifică rezultatele actuale', exact: true }).click();
  await page.getByText('Rezultatul nu mai este accesibil.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Finalizat · delivered', { exact: true }).count(), 0, 'Revoked evidence is removed from the visible card');
  const deniedReads = outcomeReads;
  await page.clock.runFor(45000);
  assert.equal(outcomeReads, deniedReads, 'Revocation stops automatic tracking');
  outcomeDenied = false;
  assert.equal(requests.filter(r => r.body?.kind === 'execute').length, 1, 'Inspecting current outcomes must not replay the plan');
  await page.getByRole('button', { name: 'Deschide în Gmail', exact: true }).click();
  await page.getByText('Email pregătit în Gmail; așteaptă trimiterea.', { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.path.endsWith('/send-evidence')).length, 0, 'Preparing Gmail must not fabricate send evidence');
  assert.equal(await page.evaluate(() => window.fixtureGmailSession.bodyText), 'Textul verificat');
  await page.evaluate(() => window.fixtureGmailStatus({ state: 'sent_ui_confirmed', message: 'Altă execuție', jobId: 'unrelated-job', saleId: 'sale', messageRecordId: 'email' }));
  assert.equal(requests.filter(r => r.path.endsWith('/send-evidence')).length, 0, 'An unrelated Gmail runner job must not confirm this email');
  await page.evaluate(() => window.fixtureGmailStatus({ state: 'sent_ui_confirmed', message: 'Trimis', jobId: 'gmail-job', saleId: 'sale', messageRecordId: 'email' }));
  await page.getByText('Trimiterea a fost observată în Gmail și consemnată în CRM.', { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.path.endsWith('/send-evidence')).length, 1);
  await page.getByRole('button', { name: 'Caută proprietăți', exact: true }).click();
  await page.getByText('Apartament Titan proprietar', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Vezi potrivirile din CRM' }).click();
  await page.getByRole('heading',{name:'Apartament Titan CRM',exact:true}).waitFor();
  await page.getByText('Apartament Titan proprietar', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirm acordul WhatsApp', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Înregistrează acordul' }).isDisabled(), true);
  await dialog.getByLabel('Ce a confirmat proprietarul în apel').fill('Proprietarul a acceptat mesaje WhatsApp pentru propunerea de colaborare.');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Înregistrează acordul' }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(requests.filter(r => r.path.endsWith('owner-consent')).length, 1);
  await page.getByRole('button', { name: 'Autorizează pașii safe', exact: true }).click();
  await page.getByRole('button', { name: 'Oprește pașii safe automați', exact: true }).waitFor();
  assert.equal(requests.filter(r => r.body?.kind === 'autonomy')[0].body.enabled, true);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Vezi automatizările', exact: true }).click();
  await page.getByText('1 verificări / 48', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Istoric', exact: true }).click();
  await page.getByText('1 evenimente executate', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Editează', exact: true }).click();
  await page.getByLabel('Sarcină de creat (gol = fără sarcină)').fill('Sarcină revizuită');
  await page.getByRole('button', { name: 'Pregătește regula', exact: true }).click();
  await page.getByText('Planul regulii este pregătit.', { exact: false }).waitFor();
  const editedRule = requests.filter(r => r.body?.kind === 'prepare' && r.body.actions?.[0]?.kind === 'update_automation').at(-1).body.actions[0].automation;
  assert.equal(editedRule.nextRunAt, '2030-10-06T10:00:00.123Z'); assert.equal(editedRule.stopAfter, '2030-10-07T10:00:00.456Z');
  assert.equal(editedRule.effects[0].agentId, 'colleague'); assert.equal(editedRule.effects[1].body, 'Detalii păstrate'); assert.deepEqual(editedRule.trigger.changedFields, ['status', 'budget']);
  await page.getByRole('button', { name: 'Regulă nouă', exact: true }).click();
  await page.getByLabel('Status nou (opțional)').fill('Contactat');
  await page.getByLabel('Sarcină de creat (gol = fără sarcină)').fill('Follow-up după contactare');
  await page.getByRole('checkbox', { name: 'Buget', exact: true }).check();
  await page.getByRole('button', { name: 'Adaugă sarcină suplimentară', exact: true }).click();
  await page.getByLabel('Descriere sarcină suplimentară 1', { exact: true }).fill('Pregătește comparația');
  await page.getByLabel('Termen sarcină suplimentară 1, minute', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Adaugă notificare suplimentară', exact: true }).click();
  await page.getByLabel('Titlu notificare suplimentară 2', { exact: true }).fill('Client pregătit');
  await page.getByLabel('Conținut notificare suplimentară 2', { exact: true }).fill('Verifică documentele');
  await page.getByRole('button', { name: 'Pregătește regula', exact: true }).click();
  await page.getByText('Planul regulii este pregătit.', { exact: false }).waitFor();
  const ruleRequest = requests.filter(r => r.body?.kind === 'prepare' && r.body.actions?.[0]?.kind === 'create_automation').at(-1);
  assert.equal(ruleRequest.body.actions[0].automation.type, 'event_rule');
  assert.equal(ruleRequest.body.actions[0].automation.trigger.statusTo, 'Contactat');
  assert.deepEqual(ruleRequest.body.actions[0].automation.trigger.changedFields, ['budget']);
  assert.equal(ruleRequest.body.actions[0].automation.effects.length, 3);
  assert.equal(ruleRequest.body.actions[0].automation.effects[1].dueAfterMinutes, 120);
  assert.equal(ruleRequest.body.actions[0].automation.effects[2].body, 'Verifică documentele');
  assert.equal(requests.some(r => r.path === '/api/crm/actions' && r.body?.action?.kind === 'create_automation'), false, 'Editor must prepare an approved plan rather than bypass execution approval');
  for (const kind of ['followup_task', 'owner_watch', 'matching_watch', 'insight_report', 'whatsapp_template']) {
    await page.getByRole('button', { name: 'Automatizare nouă', exact: true }).click();
    await page.getByLabel('Tip automatizare', { exact: true }).selectOption(kind);
    if (['followup_task', 'matching_watch'].includes(kind)) {
      await page.getByRole('option', { name: 'Maria Popescu', exact: true }).waitFor({ state: 'attached' });
      await page.getByLabel('Client', { exact: true }).selectOption('client');
      await page.getByLabel('Câștigat', { exact: true }).check();
    }
    if (kind === 'followup_task') await page.getByLabel('Sarcina de follow-up').fill('Recontactează clientul');
    if (kind === 'owner_watch') { await page.getByLabel('Zona căutării').fill('Titan'); await page.getByRole('form', { name: 'Configurare automatizare' }).getByLabel('Buget maxim EUR').fill('130000'); }
    if (kind === 'matching_watch') await page.getByLabel('Scor minim matching').fill('75');
    if (kind === 'whatsapp_template') {
      await page.getByRole('option', { name: 'Proprietar · whatsapp', exact: true }).waitFor({ state: 'attached' });
      await page.getByLabel('Conversație', { exact: true }).selectOption('conversation');
      await page.getByLabel('Numele șablonului WhatsApp').fill('oferta_proprietar');
      await page.getByRole('button', { name: 'Adaugă variabilă', exact: true }).click();
      await page.getByLabel('Variabila 1', { exact: true }).fill('Cristian');
    }
    await page.getByRole('button', { name: 'Pregătește automatizarea', exact: true }).click();
    await page.getByText('Planul automatizării este pregătit pentru confirmare.', { exact: false }).waitFor();
    const prepared = requests.filter(r => r.body?.kind === 'prepare' && r.body.actions?.[0]?.automation?.type === kind).at(-1)?.body.actions[0];
    assert.equal(prepared?.kind, 'create_automation'); assert.equal(prepared.automation.type, kind);
    if (kind === 'owner_watch') { assert.equal(prepared.automation.search.source, 'owners'); assert.equal(prepared.automation.search.priceMax, 130000); }
    if (kind === 'matching_watch') assert.equal(prepared.automation.threshold, 75);
    if (['followup_task', 'matching_watch'].includes(kind)) { assert.equal(prepared.automation.contactId, 'client'); assert.deepEqual(prepared.automation.stopOnContactStatuses, ['Câștigat']); }
    if (kind === 'whatsapp_template') { assert.deepEqual(prepared.automation.template.parameters, ['Cristian']); assert.equal(prepared.automation.stopOnReply, true); }
  }
  await page.reload();
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Arată dosare Sales.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  const saleCard = page.locator('[data-source="sales"]');
  await saleCard.getByText('Contract', { exact: true }).waitFor();
  await saleCard.getByText('Dosar IMO-123', { exact: true }).waitFor();
  assert.equal(await saleCard.getByRole('link', { name: 'Deschide' }).getAttribute('href'), '/sales-management/sale');
  assert.match(await saleCard.innerText(), /130[.\s]000/);
  await saleCard.getByText('Confirmă programarea notarului', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Mobile layout must not overflow horizontally');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  background = true; await page.reload();
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Pregătește o vizionare pe server.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByRole('button', { name: 'Execută planul' }).waitFor();
  await page.getByRole('button', { name: 'Execută planul' }).click();
  await page.getByText('Stare: rezultat de verificat', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Reia pașii rămași' }).count(), 0, 'An uncertain external outcome must not offer replay');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['Sales card stage, price, next action and dossier link', 'event rule editor preserves exact schedule and prepares multiple editable effects', 'all five automation configuration forms prepare saved approval plans', 'automation editor preserves untouched assignments and filters', 'automation editor prepares a saved plan', 'automation history', 'Gmail Desktop handoff', 'send evidence only after runner callback', 'authenticated requests', 'preview before mutation', 'execution status', 'owner-first search', 'separate CRM results', 'explicit phone consent', 'mobile width', 'no browser exceptions', 'risk/cost preview', 'explicit scoped autonomy', 'background turn SSE', 'background execution', 'unknown outcome blocks replay'], screenshots: output }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
