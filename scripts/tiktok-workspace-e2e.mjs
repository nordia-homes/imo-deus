// Offline UI acceptance test. All APIs are fixtures; never uses a real account.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';

const root = process.cwd();
const fixtures = {
  role: 'admin', status: { configured: true, connected: true, writesEnabled: true, spendMutationsEnabled: true, requiresReconnect: false },
  advertisers: ['adv-1', 'adv-2'].map((advertiserId, index) => ({ advertiserId, name: `Cont agenție ${index + 1}`, currency: 'EUR', timezone: 'Europe/Bucharest', authorized: true, selected: index === 0, billingReadiness: 'ready', version: 1 })),
  advertiserId: 'adv-1', properties: [{ id: 'home-1', title: 'Apartament test', location: 'București', price: 120000 }],
  assets: [{ id: 'video-1', propertyId: 'home-1', name: 'Tur apartament', url: '/fixture.mp4', thumbnailUrl: null, durationSeconds: 30 }],
  permissions: [{ advertiserId: 'adv-1', tiktokAccountId: 'profile-1', username: 'agentie', deliverAds: true, existingPosts: true, publishAndManageNewVideos: true, onlyShowAsAds: true, verificationStatus: 'verified', lastVerifiedAt: new Date().toISOString() }],
  operations: [], capabilities: ['AD_CREATE', 'TIKTOK_PERMISSION_READ', 'SPARK_NEW_VIDEO_AD_ONLY', 'CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'CREATIVE_UPLOAD', 'TARGETING_READ', 'SPARK_EXISTING_POST'].map(capability => ({ capability, executionAllowed: true })),
  schemas: Object.fromEntries(['AD_CREATE', 'CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'CREATIVE_UPLOAD'].map(key => [key, { type: 'object', properties: {} }])),
};
const result = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Workspace from '@/components/marketing/tiktok-ads/TikTokWorkspace'; createRoot(document.getElementById('root')).render(<Workspace/>);`, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, outfile: path.join(root, '.tmp/tiktok-workspace/app.js'), platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' },
  alias: { '@': path.join(root, 'src') },
  plugins: [{ name: 'fixture-context', setup(build) {
    build.onResolve({ filter: /^(@\/firebase|next\/navigation|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === '@/firebase' ? `const user={uid:'fixture-user',getIdToken:async()=>'fixture'}; export const useUser=()=>({user}); export const useStorage=()=>null;` : args.path === 'next/navigation' ? `export const useSearchParams=()=>new URLSearchParams();` : `import React from 'react'; export default function Image({unoptimized,...props}){return <img {...props}/>}` }));
  } }],
});
const tailwindConfig = loadConfig(path.join(root, 'tailwind.config.ts'));
tailwindConfig.content = ['./src/components/marketing/tiktok-ads/**/*.tsx', './src/components/ui/**/*.tsx'];
const css = await postcss([tailwindcss(tailwindConfig)]).process(await readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(result.outputFiles.find(file => file.path.endsWith('.js')).text); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css + '\n' + result.outputFiles.find(file => file.path.endsWith('.css')).text); }
  else if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html lang="ro"><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
  else { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; const writes = []; const drafts = new Map();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const body = request.postDataJSON();
    let data = {};
    if (request.method() !== 'GET') writes.push({ path: url.pathname, body });
    if (url.pathname.endsWith('/workspace')) data = { ...fixtures, advertiserId: url.searchParams.get('advertiserId') || 'adv-1' };
    else if (url.pathname.endsWith('/drafts') && request.method() === 'PUT') { const previous = drafts.get(body.id); assert.equal(body.expectedVersion, previous?.version || 0); data = { ...body, version: body.expectedVersion + 1 }; drafts.set(body.id, data); }
    else if (url.pathname.endsWith('/drafts')) data = { drafts: [...drafts.values()].filter(draft => draft.advertiserId === url.searchParams.get('advertiserId')) };
    else if (url.pathname.endsWith('/manager')) data = { rows: url.searchParams.get('kind') === 'report' ? [{ spend: '12.50', impressions: '1000', clicks: '20', conversion: '2' }] : [{ id: 'campaign-1', name: 'Campanie test', propertyId: 'home-1', status: 'DISABLE', budget: '50' }] };
    else if (url.pathname.endsWith('/operations')) data = { operationId: 'fixture-op', status: 'succeeded', createdResourceIds: [{ resourceType: 'ad', resourceId: 'fixture-ad' }] };
    else if (url.pathname.endsWith('/resources')) data = body.confirm ? { verified: true, message: 'Modificare confirmată în TikTok.' } : { current: { id: 'campaign-1', name: 'Campanie test', status: 'DISABLE', budget: '50' } };
    else if (url.pathname.endsWith('/dashboard')) data = { portfolioProperties: [{ ...fixtures.properties[0], images: [] }], studioAssets: [], studioProjects: [], drafts: [], status: { connected: true } };
    else if (url.pathname.endsWith('/voices')) data = { voices: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(() => document.documentElement.setAttribute('data-app-theme', 'agentfinder'));
  await mkdir(path.join(root, '.tmp/tiktok-workspace'), { recursive: true });
  await page.getByRole('heading', { name: 'Performanța campaniilor' }).waitFor();
  await page.screenshot({ path: path.join(root, '.tmp/tiktok-workspace/overview-redesign.png'), fullPage: true });
  await page.getByRole('button', { name: 'Încarcă raportul', exact: true }).click();
  await page.getByText('12,5', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Creează reclamă', exact: true }).click();
  const composer = page.getByRole('dialog', { name: 'Creează reclamă', exact: true });
  await composer.locator('select').nth(0).selectOption('home-1');
  await composer.locator('select').nth(1).selectOption('profile-1');
  await page.screenshot({ path: path.join(root, '.tmp/tiktok-workspace/composer-redesign.png'), fullPage: true });
  assert.equal(await composer.evaluate(element => element.contains(document.activeElement)), true, 'Dialog must trap focus');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await composer.evaluate(element => element.scrollWidth > element.clientWidth), false, 'Composer must fit mobile viewport');
  await page.screenshot({ path: path.join(root, '.tmp/tiktok-workspace/composer-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await composer.getByRole('button', { name: 'Salvează și închide', exact: true }).click();
  await composer.waitFor({ state: 'hidden' });
  assert.equal(drafts.size, 1, 'Closing immediately must save the draft');
  assert.equal([...drafts.values()][0].data.propertyId, 'home-1');
  await page.getByRole('navigation', { name: 'Secțiuni TikTok' }).getByRole('button', { name: 'Reclame', exact: true }).click();
  await page.getByRole('button', { name: /Apartament test.*Versiunea/ }).click();
  await composer.getByRole('button', { name: '2. Conținut', exact: true }).click();
  await composer.locator('select').nth(0).selectOption('post');
  await composer.getByRole('button', { name: 'Încarcă postările autorizate' }).click();
  await composer.getByLabel('Postare', { exact: true }).selectOption('campaign-1');
  await composer.getByRole('button', { name: 'Încarcă grupurile de reclame' }).click();
  await composer.getByLabel('Grup de reclame', { exact: true }).selectOption('campaign-1');
  await composer.getByLabel('Textul reclamei', { exact: true }).fill('Apartament test, programează o vizionare.');
  await composer.getByLabel('Pagina proprietății (HTTPS)', { exact: true }).fill('https://example.com/property');
  await composer.getByRole('button', { name: '4. Verificare', exact: true }).click();
  await composer.getByRole('button', { name: 'Creează reclama oprită', exact: true }).click();
  await composer.getByText('Reclama a fost creată oprită.', { exact: false }).waitFor();
  const creation = writes.find(item => item.path.endsWith('/operations'));
  assert.equal(creation.body.capability, 'SPARK_EXISTING_POST');
  assert.equal(creation.body.propertyId, 'home-1');
  assert.equal(creation.body.idempotencyKey, `draft-${[...drafts.keys()][0]}`);
  await composer.getByRole('button', { name: 'Salvează și închide', exact: true }).click();
  await composer.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Actualizează', exact: true }).click();
  await page.getByRole('button', { name: 'Activează', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmă modificarea în TikTok' }).waitFor();
  assert.equal(writes.filter(item => item.path.endsWith('/resources') && item.body.confirm).length, 0, 'Activation must wait for confirmation');
  await page.getByRole('button', { name: 'Anulează', exact: true }).click();
  await page.getByLabel('Cont publicitar', { exact: true }).selectOption('adv-2');
  await page.getByText('Alege nivelul sau apasă Actualizează', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Campanie test', exact: true }).count(), 0, 'Switching accounts must clear the old list');
  await page.getByRole('navigation', { name: 'Secțiuni TikTok' }).getByRole('button', { name: 'Videoclipuri', exact: true }).click();
  await page.getByRole('button', { name: 'Creează videoclip', exact: true }).click();
  await page.getByRole('dialog', { name: 'Editor videoclip', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Salvează și închide', exact: true }).click();
  await page.getByRole('navigation', { name: 'Secțiuni TikTok' }).getByRole('button', { name: 'Conturi', exact: true }).click();
  await page.getByRole('heading', { name: 'Cont publicitar', exact: true }).waitFor();
  await mkdir(path.join(root, '.tmp/tiktok-workspace'), { recursive: true });
  await page.screenshot({ path: path.join(root, '.tmp/tiktok-workspace/accounts.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, '.tmp/tiktok-workspace/mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Mobile layout must not overflow');
  assert.deepEqual(errors, [], 'No uncaught React errors');
  console.log('PASS: overview/report, draft save-on-close, ad composer submission with stable key, activation confirmation, account isolation, video editor, accounts, mobile layout. Fixture APIs only.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
