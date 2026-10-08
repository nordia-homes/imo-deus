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
  let watchEdit = null;
  let background = false, autonomyEnabled = false, viewingAutonomy = false, outcomeReads = 0, outcomeDenied = false;
  const message = (text, cards = [], extra = {}) => ({ id: crypto.randomUUID(), role: 'assistant', text, cards, createdAt: new Date().toISOString(), ...extra });
  await page.route('**/api/**', async route => {
    const request = route.request();
    assert.equal(request.headers().authorization, 'Bearer fixture-token');
    const body = request.postDataJSON(); requests.push({ path: new URL(request.url()).pathname, body });
    let result;
    const url = new URL(request.url());
    if (url.pathname.endsWith('/automations')) result = url.searchParams.has('id') ? { rows: [{ id: 'run', action: 'run', occurredAt: '2026-10-05T10:00:00Z', status: 'active', result: { handled: 1, reasonCode: 'quiet_hours', notificationResults: [{ status: 'skipped', reasonCode: 'cooldown' }, { status: 'skipped', reasonCode: 'notification_cap' }, { status: 'skipped', reasonCode: 'state_changed' }] }, deliveryEvidence: { status: 'read', note: 'Canalul confirmă citirea mesajului identificat.' } }], nextCursor: null } : { rows: [{ id: 'rule', status: 'active', runCount: 1, deliveryEvidence: { status: 'accepted', note: 'Livrarea nu este încă verificată.' }, automation: { type: 'event_rule', nextRunAt: '2030-10-06T10:00:00.123Z', stopAfter: '2030-10-07T10:00:00.456Z', maxRuns: 48, intervalMinutes: 30, maxEvents: 100, trigger: { resource: 'contacts', change: 'updated', statusTo: 'Contactat', changedFields: ['status', 'budget'] }, effects: [{ kind: 'create_task', description: 'Sarcină existentă', dueAfterMinutes: 60, agentId: 'colleague' }, { kind: 'notify', title: 'Notificare existentă', body: 'Detalii păstrate' }] } }], nextCursor: null };
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
    else if (request.method() === 'GET') result = { sessions: [], aiConfigured: true, backgroundConfigured: background, autonomy: { available: true, enabled: autonomyEnabled, viewings: viewingAutonomy } };
    else if (new URL(request.url()).pathname.endsWith('owner-consent')) {
      assert.equal(body.confirmedPhoneConsent, true); assert.equal(body.purpose, 'marketing');
      result = { conversationId: 'owner-conversation', recordedAt: new Date().toISOString() };
    } else if (body.kind === 'autonomy') { autonomyEnabled = body.enabled; viewingAutonomy = body.enabled && body.viewings === true; result = { available: true, enabled: autonomyEnabled, viewings: viewingAutonomy }; }
    else if (body.kind === 'start') result = { jobId: 'turn-job', status: 'pending' };
    else if (body.kind === 'execute_background') result = { jobId: 'plan-job', status: 'pending' };
    else if (body.kind === 'chat' && body.prompt === 'Arată alertele evaluate.') result = { message: message('Rezultate actuale.', ['owners', 'crm'].map(source => ({ type: 'results', source, title: source, complete: true, rows: [{ id: source + '-p', title: 'Ofertă ' + source, price: 120000, matchScore: 92, reasoning: 'Scor canonic păstrat.', feedbackNote: `Ai evaluat o alertă anterioară pentru ${source === 'owners' ? 'acest anunț' : 'această pereche client–proprietate'} ca neutilă (2026-10-07T10:00:00Z). Este evaluarea alertei de atunci; nu evaluează oferta actuală și nu schimbă scorul, ordinea rezultatelor sau frecvența alertelor.` }] }))) };
    else if (body.kind === 'chat' && body.prompt === 'Arată prioritățile evaluate.') result = { message: message('Prioritate încă activă.', [{ type: 'data', source: 'insights', title: 'Priorități', complete: true, rows: [{ id: 'task-t', taskId: 't', type: 'TASK_CARD', title: 'Sarcină restantă', priority: 80, previousFeedback: 'not_useful', feedbackOrder: -1, feedbackNote: 'Evaluare anterioară: neutilă. La aceeași urgență, prioritățile evaluate utile apar înaintea celor neevaluate, apoi cele evaluate neutile. Problema rămâne activă.' }] }]) };
    else if (body.kind === 'chat' && body.prompt?.includes('dosare Sales')) result = { message: message('Un dosar autorizat.', [{ type: 'data', source: 'sales', title: 'Dosare Sales', complete: true, summary: { count: 1, label: 'dosare Sales', scope: 'Dosare autorizate' }, rows: [{ id: 'sale', trackingCode: 'IMO-123', propertyTitle: 'Apartament verificat', stage: 'contract', agreedPrice: 130000, agentName: 'Mirela Agent', nextAction: 'Confirmă programarea notarului' }] }]) };
    else if (body.kind === 'prepare') result = { message: message('Plan pregătit pentru confirmare.', [], { planId, actions: body.actions }) };
    else if (body.kind === 'execute') result = { plan: { id: planId, actions: [action], status: 'completed', results: [{ step: 1, result: { viewingId: 'viewing', gmailPrepared: true, saleId: 'sale', messageId: 'email' } }] } };
    else if (body.kind === 'read') result = { rows: body.query.resource === 'ownerListingFavorites' ? [{ id: 'listing', ownerPhone: '0722123456', title: 'Apartament Titan' }] : [{ id: 'connection', name: 'Agenție WhatsApp', channel: 'whatsapp', status: 'connected' }] };
    else if (body.kind === 'chat' && body.prompt === 'Verifică anii declarați.') result = { message: message('Rezultatele păstrează nivelul dovezii.', [{ type: 'results', source: 'owners', title: 'Anunțuri proprietari', complete: true, crmComparison: { mode: 'exact_references', checked: true, excludedOnThisPage: 1, semanticDuplicateDetection: false }, rows: [
      { id: 'exact', title: 'An exact', constructionYearEvidenceKind: 'exact', constructionYear: 1988, yearFilterSatisfied: true },
      { id: 'interval', title: 'Interval', constructionYearEvidenceKind: 'declared_interval', constructionYearLabel: '1977-1990', constructionYear: null, yearFilterSatisfied: false },
      { id: 'unknown', title: 'An necunoscut', constructionYearEvidenceKind: 'unknown', constructionYear: null, yearFilterSatisfied: false },
    ] }]) };
    else if (body.kind === 'chat' && body.prompt === 'Selectează a doua potrivire.') result = { message: message('Datele proprietății au fost recitite.', [{ type: 'results', source: 'crm', title: 'Proprietatea selectată', complete: true, rows: [{ id: 'match-second', title: 'Apartament Titan', status: 'Activ', price: 130000, matchScore: 91, scoreMayBeStale: true }] }]) };
    else if (body.kind === 'chat' && body.prompt === 'Programează draftul TikTok.') result = { message: message('Programare pregătită.', [], { planId, actions: [{ kind: 'existing_operation', operation: 'tiktok_post_schedule', params: { draftId: 'draft' }, query: {}, body: { runAt: '2030-01-01T10:00:00Z', confirm: true, expectedDraftRevision: 'd'.repeat(64), draftPreview: { description: 'Postarea concretă pentru TikTok.', videoTourUrl: 'https://example.test/video.mp4', privacyLevel: 'SELF_ONLY', hashtags: ['imobiliare'] } } }] }) };
    else if (body.kind === 'chat' && body.prompt === 'Pregătește mesajul verificat.') result = { message: message('Mesaj pregătit pentru confirmare.', [], { planId, actions: [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conversation' }, query: {}, body: { text: 'Oferta concretă pentru clientul selectat.', expectedRecipientRevision: 'a'.repeat(64), matchingSelection: { resultSetId: 'selection', propertyId: 'chosen-property', contactId: 'chosen-client', propertyRevision: 'b'.repeat(64), contactRevision: 'c'.repeat(64) }, sendApproval: { amountMicros: 12000, currency: 'EUR', renderedText: 'Oferta concretă pentru clientul selectat.', expiresAt: Date.now() + 3600000 } } }] }) };
    else if (body.kind === 'chat') result = { message: message('Vizionarea este pregătită; verifică planul.', [], { planId, actions: [action] }) };
    else if (body.kind === 'search') {
      const rows = [{ id: body.query.source === 'owners' ? 'listing' : 'property', title: body.query.source === 'owners' ? 'Apartament Titan proprietar' : 'Apartament Titan CRM', price: '120.000 €', location: 'Titan', rooms: 2 }];
      const card = { type: 'results', source: body.query.source, title: body.query.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', search: body.query, rows, complete: true };
      result = { rows, complete: true, nextCursor: null, message: message('Rezultate verificate.', [card]) };
    } else throw new Error('Unexpected fixture request: ' + JSON.stringify(body));
    if (watchEdit && url.pathname.endsWith('/automations')) result = url.searchParams.has('id') ? { rows: [{ id: 'cap-run', action: 'run', occurredAt: '2026-10-07', status: 'active', result: { status: 'deferred', reasonCode: 'notification_cap', notificationResults: [{ status: 'deferred', reasonCode: 'notification_cap' }] } }], nextCursor: null } : { rows: [watchEdit], nextCursor: null };
    if (url.pathname.endsWith('/plan-outcomes')) result.requirements = { status: 'available', rows: [{ id: 'delivery', description: 'Livrarea cerută', state: outcomeReads >= 3 ? 'COMPLETED' : 'WAITING_PROVIDER', steps: [1], total: 1, confirmed: outcomeReads >= 3 ? 1 : 0, note: 'Dovadă verificată pentru cerința curentă.' }], note: 'Rezultate pentru cerințele identificate.' };
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
  await page.getByRole('region', { name: 'Rezultatul fiecărei cerințe' }).getByText('Așteaptă furnizorul', { exact: true }).waitFor();
  await page.getByText('1 / 1 pași cu rezultat înregistrat', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Verifică rezultatele actuale', exact: true }).click();
  await page.getByText('În coadă · queued', { exact: true }).waitFor();
  await page.clock.runFor(16000);
  await page.getByText('Finalizat · delivered', { exact: true }).waitFor();
  await page.getByRole('region', { name: 'Rezultatul fiecărei cerințe' }).getByText('Rezultat confirmat', { exact: true }).waitFor();
  await page.getByRole('region', { name: 'Rezultatul fiecărei cerințe' }).screenshot({ path: path.join(output, 'requirement-outcome.png') });
  const terminalReads = outcomeReads;
  await page.clock.runFor(45000);
  assert.equal(outcomeReads, terminalReads, 'Terminal evidence stops automatic tracking');
  outcomeDenied = true;
  await page.getByRole('button', { name: 'Verifică rezultatele actuale', exact: true }).click();
  await page.getByText('Rezultatul nu mai este accesibil.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Finalizat · delivered', { exact: true }).count(), 0, 'Revoked evidence is removed from the visible card');
  assert.equal(await page.getByRole('region', { name: 'Rezultatul fiecărei cerințe' }).count(), 0, 'Revoked requirement evidence is removed too');
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
  assert.equal(await page.getByRole('button', { name: 'Autorizează cumpărători și vizionări', exact: true }).count(), 0);
  await page.getByText('Acțiunile CRM pentru proprietăți, cumpărători și vizionări se execută la cererea ta, fără activare separată.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'viewing-autonomy.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Vezi automatizările', exact: true }).click();
  await page.getByText('1 verificări / 48', { exact: false }).waitFor();
  assert.ok(await page.getByText('Acceptat de canal · Livrarea nu este încă verificată.', { exact: true }).isVisible());
  await page.getByRole('button', { name: 'Istoric', exact: true }).click();
  await page.getByText(/Citit: Canalul confirmă citirea mesajului identificat/).waitFor();
  await page.getByText(/plafonul comun de 10 alerte în 24 de ore a fost atins/).waitFor();
  await page.getByText(/Alerte omise: datele sursă nu mai confirmă rezultatul/).waitFor();
  await page.getByText(/Alertele repetitive au fost omise în perioada de pauză/).waitFor();
  await page.getByText(/Verificare amânată pentru respectarea intervalului de liniște/).waitFor();
  await page.screenshot({ path: path.join(output, 'brief-delivery.png'), fullPage: true });
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
  for (const kind of ['followup_task', 'owner_watch', 'matching_watch', 'insight_report', 'whatsapp_template', 'legal_source_watch']) {
    await page.getByRole('button', { name: 'Automatizare nouă', exact: true }).click();
    await page.getByLabel('Tip automatizare', { exact: true }).selectOption(kind);
    if (['followup_task', 'matching_watch'].includes(kind)) {
      await page.getByRole('option', { name: 'Maria Popescu', exact: true }).waitFor({ state: 'attached' });
      await page.getByLabel('Client', { exact: true }).selectOption('client');
      await page.getByLabel('Câștigat', { exact: true }).check();
    }
    if (kind === 'followup_task') await page.getByLabel('Sarcina de follow-up').fill('Recontactează clientul');
    if (kind === 'legal_source_watch') await page.getByLabel('Surse oficiale', { exact: false }).fill('https://www.ancpi.ro/fixture.pdf');
    if (kind === 'owner_watch') { await page.getByLabel('Zona căutării').fill('Titan'); await page.getByRole('form', { name: 'Configurare automatizare' }).getByLabel('Buget maxim EUR').fill('130000'); }
    if (kind === 'matching_watch') await page.getByLabel('Scor minim matching').fill('75');
    if (kind === 'insight_report') {
      const cooldown = page.getByLabel('Pauză între alertele aceleiași priorități', { exact: false });
      assert.equal(await cooldown.inputValue(), '1440');
      await cooldown.fill('60');
      assert.equal(await page.getByLabel('Interval de liniște pentru alerte', { exact: true }).isChecked(), true);
      assert.equal(await page.getByLabel('Fus orar pentru alerte', { exact: true }).inputValue(), 'Europe/Bucharest');
      assert.equal(await page.getByLabel('Fus orar pentru alerte', { exact: true }).getAttribute('readonly'), '');
      await page.getByRole('form', { name: 'Configurare automatizare' }).getByLabel('Liniște de la', { exact: true }).fill('12:00');
      await page.getByRole('form', { name: 'Configurare automatizare' }).getByLabel('Până la', { exact: true }).fill('13:00');
      await page.screenshot({ path: path.join(output, 'insight-cooldown.png'), fullPage: true });
    }
    if (['owner_watch', 'matching_watch'].includes(kind)) {
      const pause = page.getByLabel('Pauză între alertele monitorizărilor, minute', { exact: true });
      assert.equal(await pause.inputValue(), '1440');
      await pause.fill('90');
      const repeat = page.getByLabel('Repetă alertele dacă rezultatul rămâne relevant', { exact: false });
      assert.equal(await repeat.isChecked(), false); await repeat.check();
    }
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
    if (kind === 'legal_source_watch') { assert.deepEqual(prepared.automation.sourceUrls, ['https://www.ancpi.ro/fixture.pdf']); assert.equal(prepared.automation.intervalMinutes, 1440); }
    if (kind === 'owner_watch') { assert.equal(prepared.automation.search.source, 'owners'); assert.equal(prepared.automation.search.priceMax, 130000); }
    if (kind === 'matching_watch') assert.equal(prepared.automation.threshold, 75);
    if (['owner_watch', 'matching_watch'].includes(kind)) {
      assert.equal(prepared.automation.cooldownMinutes, 90);
      assert.equal(prepared.automation.repeatAlerts, true);
      await page.getByText('Repetă alertele pentru rezultate încă relevante', { exact: true }).last().waitFor();
      await page.getByText('Maximum 10 alerte din rapoarte și monitorizări', { exact: false }).last().waitFor();
      await page.getByText('omisiunile nu prelungesc pauza', { exact: false }).last().waitFor();
    }
    if (['owner_watch', 'matching_watch'].includes(kind)) { assert.deepEqual(prepared.automation.quietHours, { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' }); await page.getByText('Interval de liniște', { exact: true }).last().waitFor(); }
    if (kind === 'insight_report') { await page.getByText('Plafon alerte', { exact: true }).last().waitFor(); assert.equal(prepared.automation.cooldownMinutes, 60); assert.deepEqual(prepared.automation.quietHours, { timezone: 'Europe/Bucharest', start: '12:00', end: '13:00' }); await page.getByText('Pauză între alerte (minute)', { exact: true }).last().waitFor(); await page.getByText('Interval de liniște', { exact: true }).last().waitFor(); }
    if (['followup_task', 'matching_watch'].includes(kind)) { assert.equal(prepared.automation.contactId, 'client'); assert.deepEqual(prepared.automation.stopOnContactStatuses, ['Câștigat']); }
    if (kind === 'whatsapp_template') { assert.deepEqual(prepared.automation.template.parameters, ['Cristian']); assert.equal(prepared.automation.stopOnReply, true); }
  }
  await page.getByRole('button', { name: 'Automatizare nouă', exact: true }).click();
  await page.getByLabel('Tip automatizare', { exact: true }).selectOption('daily_sales_brief');
  const briefForm = page.getByRole('form', { name: 'Prioritățile zilei', exact: true });
  await briefForm.getByLabel('Ora livrării', { exact: true }).fill('09:15');
  await briefForm.getByLabel('Maximum priorități', { exact: true }).fill('3');
  await page.screenshot({ path: path.join(output, 'daily-brief.png'), fullPage: true });
  await briefForm.getByRole('button', { name: 'Pregătește brief-ul', exact: true }).click();
  await briefForm.waitFor({ state: 'detached' });
  const briefRequest = requests.filter(r => r.body?.kind === 'prepare' && r.body.actions?.[0]?.automation?.type === 'daily_sales_brief').at(-1);
  assert.equal(briefRequest.body.actions[0].automation.deliveryTime, '09:15');
  assert.equal(briefRequest.body.actions[0].automation.maxItems, 3);
  assert.equal(briefRequest.body.actions[0].automation.timezone, 'Europe/Bucharest');
  assert.equal(briefRequest.body.actions[0].automation.deliveryChannel, 'app');
  assert.equal(requests.some(r => r.path === '/api/crm/actions' && r.body?.action?.automation?.type === 'daily_sales_brief'), false);
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
  await page.getByLabel('Comandă pentru AI Assistant').fill('Verifică anii declarați.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  const yearCard = page.locator('[data-source="owners"]').last();
  await yearCard.getByText('An construcție declarat: 1988', { exact: true }).waitFor();
  await yearCard.getByText('Interval declarat: 1977-1990 · anul exact nu este precizat · nu confirmă filtrul de an', { exact: true }).waitFor();
  await yearCard.getByText('An construcție necunoscut · nu confirmă filtrul de an', { exact: true }).waitFor();
  await yearCard.getByText('Importurile CRM cu același ID sau URL au fost excluse. Anunțurile duplicate fără această legătură necesită verificare.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: path.join(output, 'year-evidence-mobile.png'), fullPage: true });
  await page.getByLabel('Comandă pentru AI Assistant').fill('Selectează a doua potrivire.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByText('91% · calcul anterior', { exact: true }).waitFor();
  await page.getByText('Datele s-au schimbat. Refă matchingul pentru un scor actualizat.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: path.join(output, 'matching-stale-mobile.png'), fullPage: true });
  await page.getByLabel('Comandă pentru AI Assistant').fill('Pregătește mesajul verificat.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByText('Oferta concretă pentru clientul selectat.', { exact: true }).waitFor();
  await page.getByText('Cost maxim: 0.012 EUR', { exact: true }).waitFor();
  await page.getByText('Datele vor fi reverificate înainte de trimitere.', { exact: true }).waitFor();
  if ((await page.locator('body').innerText()).includes('b'.repeat(64))) throw new Error('Matching revision exposed in approval preview');
  await page.getByText('Mesaj: Oferta concretă pentru clientul selectat.', { exact: true }).waitFor();
  assert.equal(await page.getByText('expectedRecipientRevision', { exact: true }).count(), 0);
  assert.equal(await page.getByText('a'.repeat(64), { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.getByLabel('Comandă pentru AI Assistant').fill('Programează draftul TikTok.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByText('Postarea concretă pentru TikTok.', { exact: true }).waitFor();
  await page.getByText('SELF_ONLY', { exact: true }).waitFor();
  assert.equal(await page.getByText('d'.repeat(64), { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  background = true; await page.reload();
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Pregătește o vizionare pe server.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByRole('button', { name: 'Execută planul' }).waitFor();
  await page.getByRole('button', { name: 'Execută planul' }).click();
  await page.getByText('Stare: rezultat de verificat', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Reia pașii rămași' }).count(), 0, 'An uncertain external outcome must not offer replay');
  assert.deepEqual(errors, []);
  background = false; await page.reload();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Arată prioritățile evaluate.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByText('Evaluare anterioară: neutilă. La aceeași urgență, prioritățile evaluate utile apar înaintea celor neevaluate, apoi cele evaluate neutile. Problema rămâne activă.', { exact: true }).waitFor();
  await page.getByText('Scor de urgență', { exact: true }).waitFor();
  assert.equal(await page.getByText('feedbackOrder', { exact: true }).count(), 0);
  await page.screenshot({ path: path.join(output, 'insight-feedback.png'), fullPage: true });
  await page.getByLabel('Comandă pentru AI Assistant').fill('Arată alertele evaluate.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  for (const entity of ['acest anunț', 'această pereche client–proprietate']) {
    await page.getByText(`Ai evaluat o alertă anterioară pentru ${entity} ca neutilă (2026-10-07T10:00:00Z). Este evaluarea alertei de atunci; nu evaluează oferta actuală și nu schimbă scorul, ordinea rezultatelor sau frecvența alertelor.`, { exact: true }).waitFor();
  }
  assert.equal(await page.getByText('Scor canonic păstrat.', { exact: true }).count(), 2);
  await page.screenshot({ path: path.join(output, 'watch-feedback-results.png'), fullPage: true });
  for (const [type, repeatAlerts] of ['owner_watch', 'matching_watch'].flatMap(type => [undefined, true].map(repeat => [type, repeat]))) {
    watchEdit = { id: 'watch-edit', status: 'active', runCount: 0, automation: { type, ...(repeatAlerts === undefined ? {} : { repeatAlerts }), nextRunAt: '2030-10-06T10:00:00.123Z', maxRuns: 3, intervalMinutes: 60, ...(type === 'owner_watch' ? { search: { source: 'owners', scopeKey: 'brasov', transactionType: 'sale', limit: 5, yearMin: 1980, unknownYear: 'exclude', excludeImported: true, roomsAny: [2, 3] } } : { contactId: 'client', threshold: 75, limit: 5 }) } };
    await page.reload();
    await page.getByRole('button', { name: 'Vezi automatizările', exact: true }).click();
    await page.getByRole('button', { name: 'Editează', exact: true }).click();
    if (type === 'matching_watch') await page.getByRole('option', { name: 'Maria Popescu', exact: true }).waitFor({ state: 'attached' });
    const toggle = page.getByLabel('Interval de liniște pentru alerte', { exact: true });
    assert.equal(await toggle.isChecked(), false, 'Legacy watches must not gain quiet hours silently');
    assert.equal(await page.getByLabel('Repetă alertele dacă rezultatul rămâne relevant', { exact: false }).isChecked(), repeatAlerts === true);
    await toggle.check();
    assert.equal(await page.getByLabel('Fus orar pentru alerte', { exact: true }).inputValue(), 'Europe/Bucharest');
      assert.equal(await page.getByLabel('Fus orar pentru alerte', { exact: true }).getAttribute('readonly'), '');
    await page.getByRole('button', { name: 'Pregătește automatizarea', exact: true }).click();
    await page.getByRole('form', { name: 'Configurare automatizare' }).waitFor({ state: 'detached' });
    const edited = requests.filter(r => r.body?.kind === 'prepare' && r.body.actions?.[0]?.kind === 'update_automation' && r.body.actions[0].automationId === 'watch-edit').at(-1).body.actions[0].automation;
    assert.deepEqual(edited.quietHours, { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' });
    assert.equal(edited.nextRunAt, watchEdit.automation.nextRunAt);
    assert.equal(edited.repeatAlerts, repeatAlerts === true);
    await page.getByRole('button', { name: 'Istoric', exact: true }).click();
    await page.getByText(/Monitorizare amânată: plafonul comun de 10 alerte/).waitFor();
    assert.equal(await page.getByText(/Unele alerte au fost omise: plafonul comun/).count(), 0);
    if (type === 'owner_watch') for (const key of ['scopeKey', 'yearMin', 'unknownYear', 'excludeImported', 'roomsAny']) assert.deepEqual(edited.search[key], watchEdit.automation.search[key]);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['Sales card stage, price, next action and dossier link', 'event rule editor preserves exact schedule and prepares multiple editable effects', 'all five automation configuration forms prepare saved approval plans', 'automation editor preserves untouched assignments and filters', 'automation editor prepares a saved plan', 'automation history', 'verified delivery labels remain distinct from automation status', 'Gmail Desktop handoff', 'send evidence only after runner callback', 'authenticated requests', 'preview before mutation', 'execution status', 'owner-first search', 'separate CRM results', 'explicit phone consent', 'mobile width', 'no browser exceptions', 'risk/cost preview', 'CRM commands need no opt-in; optional task policy remains', 'background turn SSE', 'background execution', 'unknown outcome blocks replay'], screenshots: output }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
