import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = process.cwd(), output = path.join(root, '.tmp', 'notification-ui');
await fs.mkdir(output, { recursive: true });
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
  response.setHeader('Content-Type', request.url === '/bundle.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/bundle.js' ? await fs.readFile(path.join(output, 'bundle.js')) : '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const base = { eventId: 'e', recipientId: 'fixture', agencyId: 'a', type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', body: 'Fixture', actionUrl: '/ai-assistant', entityId: 'c', createdAt: '2026-10-07T09:00:00Z', isRead: false };
    window.fixtureNotifications = ['Stale', 'Active', 'Legacy', 'Withdrawn'].map(title => ({ ...base, id: title, title, ...(title !== 'Legacy' ? { ruleCondition: { resource: 'contacts', id: 'c', status: 'Contactat' } } : {}), ...(title === 'Withdrawn' ? { withdrawnAt: '2026-10-07T09:01:00Z' } : {}) }));
  });
  let fail = true;
  await page.route('**/api/notifications/reconcile', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'fixture failure' } : { checked: 2, withdrawn: 1 }) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText('Starea alertelor nu a putut fi verificată.', { exact: false }).waitFor();
  assert.equal(await page.getByText('Withdrawn', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Notificari', exact: true }).innerText(), '3');
  assert.deepEqual(requests[0].ids.sort(), ['Active', 'Stale']);
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
  assert.deepEqual(errors, []);
  console.log('Notification UI: 10 checks passed (synthetic auth, API and Firestore snapshots).');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
