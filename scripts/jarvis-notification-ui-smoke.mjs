import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const root = process.cwd(), output = path.join(root, '.tmp', 'notification-ui');
await fs.mkdir(output, { recursive: true });
const config = createRequire(import.meta.url)('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
config.content = [path.join(root, 'src/app/(dashboard)/notifications/page.tsx'), path.join(root, 'src/components/notifications/*.tsx'), path.join(root, 'src/components/layout/NotificationBell.tsx'), path.join(root, 'src/components/ui/*.tsx')];
const css = await postcss([tailwindcss(config)]).process(await fs.readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
await fs.writeFile(path.join(output, 'style.css'), css.css);
const fixtures = {
  '@/firebase': `import {useSyncExternalStore} from 'react'; const user={uid:'fixture',getIdToken:async()=> 'fixture-token'}; const subscribe=fn=>{window.addEventListener('fixture-data',fn);return ()=>window.removeEventListener('fixture-data',fn)}; export const useUser=()=>({user});export const useFirestore=()=>({});export const useMemoFirebase=fn=>fn();export const useCollection=()=>({data:useSyncExternalStore(subscribe,()=>window.fixtureNotifications),isLoading:false});`,
  'firebase/firestore': 'export const collection=()=>({});export const query=()=>({});export const orderBy=()=>({});export const limit=()=>({});',
  'next/navigation': 'export const useRouter=()=>({push:()=>{}});',
  '@/hooks/use-toast': 'export const useToast=()=>({toast:()=>{}});',
  '@/lib/crm/client-actions': 'export const executeCrmAction=async()=>({});',
};
await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Page from './src/app/(dashboard)/notifications/page';import {NotificationBell} from './src/components/layout/NotificationBell';createRoot(document.getElementById('root')).render(<><NotificationBell/><Page/></>);`, resolveDir: root, loader: 'tsx' }, outfile: path.join(output, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', plugins: [{ name: 'fixtures', setup(builder) {
  builder.onResolve({ filter: /.*/ }, args => fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path], loader: 'js', resolveDir: root }));
} }] });
const server = http.createServer(async (request, response) => {
  const file = request.url === '/bundle.js' ? 'bundle.js' : request.url === '/style.css' ? 'style.css' : null;
  response.setHeader('Content-Type', file?.endsWith('.js') ? 'text/javascript' : file ? 'text/css' : 'text/html');
  response.end(file ? await fs.readFile(path.join(output, file)) : '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const base = { eventId: 'e', recipientId: 'fixture', agencyId: 'a', type: 'ai_assistant', automationId: 'r', category: 'propertyAssignments', priority: 'action_required', body: 'Fixture', actionUrl: '/ai-assistant', entityId: 'c', createdAt: '2026-10-07T09:00:00Z', isRead: false };
    window.fixtureNotifications = ['Stale', 'Active', 'Legacy', 'Withdrawn'].map(title => ({ ...base, id: title, title, ...(title === 'Stale' ? { insightCondition: { kind: 'task', id: 't' } } : title === 'Active' ? { ownerWatchCondition: { listingId: 'p', search: { source: 'owners', transactionType: 'sale' } } } : title !== 'Legacy' ? { ruleCondition: { resource: 'contacts', id: 'c', status: 'Contactat' } } : {}), ...(title === 'Withdrawn' ? { withdrawnAt: '2026-10-07T09:01:00Z' } : {}) }));
  });
  let fail = true;
  const feedbackRequests = [];
  let feedbackStatus = 503;
  await page.route('**/api/notifications/feedback', async route => {
    const body = route.request().postDataJSON();
    assert.equal(route.request().headers().authorization, 'Bearer fixture-token');
    feedbackRequests.push(body);
    await route.fulfill({ status: feedbackStatus, contentType: 'application/json', body: JSON.stringify(feedbackStatus === 200 ? { notificationId: body.notificationId, feedback: { value: body.value, revision: body.expectedRevision + 1, updatedAt: '2026-10-07T10:00:00Z' } } : { error: 'fixture failure' }) });
  });
  await page.route('**/api/notifications/reconcile', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'fixture failure' } : { checked: 2, withdrawn: 1 }) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText('Starea alertelor nu a putut fi verificată.', { exact: false }).waitFor();
  assert.equal(await page.getByText('Withdrawn', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Notificari', exact: true }).innerText(), '3');
  assert.deepEqual(requests[0].ids.sort(), ['Active', 'Stale']);
  const feedback = page.getByRole('group', { name: 'Feedback pentru Stale', exact: true });
  await feedback.getByRole('button', { name: 'Utilă', exact: true }).click();
  await feedback.getByRole('alert').waitFor();
  assert.equal(await feedback.getByRole('button', { name: 'Utilă', exact: true }).getAttribute('aria-pressed'), 'false');
  feedbackStatus = 200;
  await feedback.getByRole('button', { name: 'Utilă', exact: true }).click();
  await feedback.getByText('Feedback salvat.', { exact: true }).waitFor();
  assert.equal(await feedback.getByRole('button', { name: 'Utilă', exact: true }).getAttribute('aria-pressed'), 'true');
  await feedback.getByRole('button', { name: 'Neutilă', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]')?.textContent === 'Neutilă');
  assert.deepEqual(feedbackRequests.map(row => row.expectedRevision), [0, 0, 1]);
  assert.equal(feedbackRequests.every(row => row.notificationId === 'Stale'), true);
  feedbackStatus = 409;
  await feedback.getByRole('button', { name: 'Utilă', exact: true }).click();
  await feedback.getByText('Feedbackul s-a schimbat. Reîncarcă notificările.', { exact: true }).waitFor();
  assert.equal(await feedback.getByRole('button', { name: 'Neutilă', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Notificari', exact: true }).innerText(), '3');
  assert.equal(await page.getByRole('group', { name: 'Feedback pentru Legacy', exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(output, 'feedback-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  fail = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.body.textContent.includes('Starea alertelor nu a putut fi verificată.'));
  // Simulate the committed Firestore snapshot from reconciliation, as the live subscription would deliver it.
  await page.evaluate(() => { window.fixtureNotifications = window.fixtureNotifications.map(row => row.id === 'Stale' ? { ...row, withdrawnAt: '2026-10-07T09:02:00Z', isRead: true } : row); window.dispatchEvent(new Event('fixture-data')); });
  await page.waitForFunction(() => ![...document.querySelectorAll('p')].some(node => node.textContent === 'Stale'));
  assert.equal(await page.getByText('Stale', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Legacy', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Notificari', exact: true }).innerText(), '2');
  await page.getByRole('button', { name: 'Notificari', exact: true }).click();
  assert.equal(await page.getByText('Stale', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Active', { exact: true }).count(), 2);
  // A fresh server snapshot restores the saved vote in both surfaces, independently of local response state.
  await page.evaluate(() => { window.fixtureNotifications = window.fixtureNotifications.map(row => row.id === 'Active' ? { ...row, feedback: { value: 'not_useful', revision: 4, updatedAt: '2026-10-07T11:00:00Z' } } : row); window.dispatchEvent(new Event('fixture-data')); });
  const restored = page.getByRole('group', { name: 'Feedback pentru Active', exact: true });
  await restored.first().waitFor();
  assert.equal(await restored.count(), 2);
  for (const group of await restored.all()) assert.equal(await group.getByRole('button', { name: 'Neutilă', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.match(await restored.first().innerText(), /Deocamdată nu schimbă ordinea rezultatelor/);
  feedbackStatus = 200;
  await restored.last().getByRole('button', { name: 'Utilă', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="group"]')].some(group => group.getAttribute('aria-label') === 'Feedback pentru Active' && group.querySelector('button[aria-pressed="true"]')?.textContent === 'Utilă'));
  assert.deepEqual(feedbackRequests.at(-1), { notificationId: 'Active', value: 'useful', expectedRevision: 4 });
  // Reuse the active alert to exercise the matching binding on both surfaces.
  await page.evaluate(() => { window.fixtureNotifications = window.fixtureNotifications.map(row => row.id === 'Active' ? { ...row, ownerWatchCondition: undefined, matchingCondition: { contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) }, feedback: { value: 'useful', revision: 6, updatedAt: '2026-10-07T11:01:00Z' } } : row); window.dispatchEvent(new Event('fixture-data')); });
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Feedback pentru Active"] button[aria-pressed="true"]')].every(button => button.textContent === 'Utilă'));
  await restored.last().getByRole('button', { name: 'Neutilă', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Feedback pentru Active"] button[aria-pressed="true"]')].some(button => button.textContent === 'Neutilă'));
  assert.deepEqual(feedbackRequests.at(-1), { notificationId: 'Active', value: 'not_useful', expectedRevision: 6 });
  assert.deepEqual(errors, []);
  console.log('Notification UI: reconciliation and feedback checks passed (synthetic auth, API and Firestore snapshots).');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
