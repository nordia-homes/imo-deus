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
  page.on('pageerror', e => errors.push(e.message));
  const planId = 'fdaf7ed4-6102-4227-a969-47c1317654e8';
  const action = { kind: 'schedule_viewing', contactId: 'contact', propertyId: 'property', viewingDate: '2027-01-01T12:00:00+02:00', duration: 60, notes: '' };
  const pendingPlan = { id: planId, actions: [action], status: 'pending', risks: ['SAFE_WRITE'], externalCostNote: 'Costul canalului trebuie verificat înainte de confirmare.' };
  let background = false, autonomyEnabled = false;
  const message = (text, cards = [], extra = {}) => ({ id: crypto.randomUUID(), role: 'assistant', text, cards, createdAt: new Date().toISOString(), ...extra });
  await page.route('**/api/**', async route => {
    const request = route.request();
    assert.equal(request.headers().authorization, 'Bearer fixture-token');
    const body = request.postDataJSON(); requests.push({ path: new URL(request.url()).pathname, body });
    let result;
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.searchParams.has('planId')) result = { plan: pendingPlan };
    else if (request.method() === 'GET' && url.searchParams.has('jobId')) {
      if (url.searchParams.get('stream') === '1') {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ type: 'PROGRESS_EVENT', text: 'Citesc datele autorizate.' }) + '\n\ndata: ' + JSON.stringify({ type: 'ACTION_RESULT', status: 'completed', message: message('Plan pregătit pe server.', [], { planId, actions: [action] }) }) + '\n\n' }); return;
      }
      result = { jobId: 'plan-job', status: 'completed', plan: { ...pendingPlan, status: 'unknown', results: [], error: 'Verifică starea canalului înainte de repetare.' } };
    }
    else if (request.method() === 'GET') result = { sessions: [], aiConfigured: true, backgroundConfigured: background, autonomy: { available: true, enabled: autonomyEnabled } };
    else if (new URL(request.url()).pathname.endsWith('owner-consent')) {
      assert.equal(body.confirmedPhoneConsent, true); assert.equal(body.purpose, 'marketing');
      result = { conversationId: 'owner-conversation', recordedAt: new Date().toISOString() };
    } else if (body.kind === 'autonomy') { autonomyEnabled = body.enabled; result = { available: true, enabled: autonomyEnabled }; }
    else if (body.kind === 'start') result = { jobId: 'turn-job', status: 'pending' };
    else if (body.kind === 'execute_background') result = { jobId: 'plan-job', status: 'pending' };
    else if (body.kind === 'chat') result = { message: message('Vizionarea este pregătită; verifică planul.', [], { planId, actions: [action] }) };
    else if (body.kind === 'execute') result = { plan: { id: planId, actions: [action], status: 'completed', results: [{ step: 1, result: { viewingId: 'viewing' } }] } };
    else if (body.kind === 'read') result = { rows: body.query.resource === 'ownerListingFavorites' ? [{ id: 'listing', ownerPhone: '0722123456', title: 'Apartament Titan' }] : [{ id: 'connection', name: 'Agenție WhatsApp', channel: 'whatsapp', status: 'connected' }] };
    else if (body.kind === 'search') {
      const rows = [{ id: body.query.source === 'owners' ? 'listing' : 'property', title: body.query.source === 'owners' ? 'Apartament Titan proprietar' : 'Apartament Titan CRM', price: '120.000 €', location: 'Titan', rooms: 2 }];
      const card = { type: 'results', source: body.query.source, title: body.query.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', search: body.query, rows, complete: true };
      result = { rows, complete: true, nextCursor: null, message: message('Rezultate verificate.', [card]) };
    } else throw new Error('Unexpected fixture request: ' + JSON.stringify(body));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('heading', { name: 'AI Assistant', exact: true }).waitFor();
  await page.getByLabel('Comandă pentru AI Assistant').fill('Programează o vizionare.');
  await page.getByRole('button', { name: 'Trimite comanda' }).click();
  await page.getByRole('button', { name: 'Execută planul' }).waitFor();
  await page.getByText('Risc pe pași: SAFE_WRITE.').waitFor();
  await page.getByText(pendingPlan.externalCostNote, { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.body?.kind === 'execute').length, 0, 'Planning must not mutate the CRM');
  await page.getByRole('button', { name: 'Execută planul' }).click();
  await page.getByText('Stare: finalizat', { exact: true }).waitFor();
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
  console.log(JSON.stringify({ passed: true, checks: ['authenticated requests', 'preview before mutation', 'execution status', 'owner-first search', 'separate CRM results', 'explicit phone consent', 'mobile width', 'no browser exceptions', 'risk/cost preview', 'explicit scoped autonomy', 'background turn SSE', 'background execution', 'unknown outcome blocks replay'], screenshots: output }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
