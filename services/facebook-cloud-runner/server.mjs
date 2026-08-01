import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.env.PORT || 8080);
const runnerToken = String(process.env.FACEBOOK_CLOUD_RUNNER_TOKEN || '');
const callbackToken = String(process.env.FACEBOOK_CLOUD_RUNNER_CALLBACK_TOKEN || '');
const appUrl = String(process.env.IMODEUS_APP_URL || '').replace(/\/+$/, '');
const profileRoot = path.resolve(process.env.FACEBOOK_PROFILE_ROOT || path.join(os.tmpdir(), 'imodeus-facebook-cloud-profiles'));
const statePath = path.resolve(process.env.FACEBOOK_RUNNER_STATE_PATH || path.join(profileRoot, '..', 'runner-state.json'));
const cooldownMinSeconds = Math.max(30, Number(process.env.FACEBOOK_COOLDOWN_MIN_SECONDS || 90));
const cooldownMaxSeconds = Math.max(cooldownMinSeconds, Number(process.env.FACEBOOK_COOLDOWN_MAX_SECONDS || 120));
const contextIdleMs = Math.max(60_000, Number(process.env.FACEBOOK_CONTEXT_IDLE_SECONDS || 300) * 1000);
const viewport = { width: 1280, height: 800 };

if (!runnerToken) {
  throw new Error('FACEBOOK_CLOUD_RUNNER_TOKEN is required.');
}

const contexts = new Map();
const contextLastUsed = new Map();
const connectionWorkers = new Set();
let state = {
  connections: {},
  jobs: {},
};
let stateWriteTail = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function safeId(value) {
  const normalized = String(value || '');
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(normalized)) {
    throw new Error('Invalid identifier.');
  }
  return normalized;
}

function safeProfileDir(connectionId) {
  return path.join(profileRoot, safeId(connectionId));
}

function normalizeFacebookGroupUrl(value) {
  const url = new URL(String(value || ''));
  const allowedHosts = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error('Only HTTPS Facebook group URLs are allowed.');
  }
  if (!/^\/groups\/[^/?#]+(?:\/|$)/i.test(url.pathname)) {
    throw new Error('Invalid Facebook group URL.');
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  return url.toString();
}

function randomBetween(min, max) {
  return crypto.randomInt(min, max + 1);
}

async function humanPause(page, minMs, maxMs) {
  await page.waitForTimeout(randomBetween(minMs, maxMs));
}

async function humanClick(locator, timeout = 15_000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.scrollIntoViewIfNeeded({ timeout });
  const box = await locator.boundingBox();
  if (!box || box.width < 2 || box.height < 2) {
    await locator.click({ timeout });
    return;
  }
  const page = locator.page();
  const x = box.x + box.width * (randomBetween(30, 70) / 100);
  const y = box.y + box.height * (randomBetween(30, 70) / 100);
  await page.mouse.move(x, y, { steps: randomBetween(7, 16) });
  await humanPause(page, 80, 240);
  await page.mouse.click(x, y, { delay: randomBetween(45, 130) });
}

function constantTimeTokenEquals(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function ensureDirectories() {
  await fs.mkdir(profileRoot, { recursive: true });
  await fs.mkdir(path.dirname(statePath), { recursive: true });
}

async function loadState() {
  await ensureDirectories();
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    state = {
      connections: parsed?.connections && typeof parsed.connections === 'object' ? parsed.connections : {},
      jobs: parsed?.jobs && typeof parsed.jobs === 'object' ? parsed.jobs : {},
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('Could not load runner state. Starting with an empty state.', error);
    }
  }
}

async function persistState() {
  stateWriteTail = stateWriteTail.then(async () => {
    await ensureDirectories();
    const tempPath = `${statePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, statePath);
  });
  return stateWriteTail;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendPng(response, bytes) {
  response.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': String(bytes.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  response.end(bytes);
}

async function readJson(request, maxBytes = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Payload too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function authorized(request) {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return constantTimeTokenEquals(token, runnerToken);
}

async function postEvent(event) {
  if (!appUrl || !callbackToken) {
    console.warn('Runner callback is not configured.', { type: event.type });
    return;
  }
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`${appUrl}/api/marketing/facebook-cloud/internal/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${callbackToken}`,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return;
      const payload = await response.text().catch(() => '');
      lastError = new Error(`Callback failed with ${response.status}: ${payload.slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, (2 ** attempt) * 1_000 + randomBetween(100, 500)));
    }
  }
  throw lastError || new Error('Runner callback failed.');
}

async function getContext(connectionId) {
  const id = safeId(connectionId);
  const existing = contexts.get(id);
  if (existing) {
    contextLastUsed.set(id, Date.now());
    return existing;
  }

  const profileDir = safeProfileDir(id);
  await fs.mkdir(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    viewport,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--disable-features=Translate,MediaRouter',
    ],
  });
  context.on('close', () => {
    if (contexts.get(id) === context) contexts.delete(id);
    contextLastUsed.delete(id);
  });
  contexts.set(id, context);
  contextLastUsed.set(id, Date.now());
  return context;
}

async function getPage(connectionId) {
  const context = await getContext(connectionId);
  const pages = context.pages().filter((page) => !page.isClosed());
  const page = pages[0] || await context.newPage();
  for (const extraPage of pages.slice(1)) {
    await extraPage.close().catch(() => undefined);
  }
  return page;
}

function isFacebookLoginUrl(url) {
  return /facebook\.com\/(?:login|checkpoint|recover|two_step_verification|auth)/i.test(String(url || ''));
}

async function inspectConnection(connectionId) {
  const id = safeId(connectionId);
  const context = await getContext(id);
  const page = await getPage(id);
  const cookies = await context.cookies('https://www.facebook.com').catch(() => []);
  const facebookUserCookie = cookies.find((cookie) => cookie.name === 'c_user')?.value || null;
  const url = page.url();
  const connected = Boolean(facebookUserCookie && !isFacebookLoginUrl(url));
  let displayName = state.connections[id]?.displayName || null;

  if (connected) {
    displayName = await page
      .locator('a[aria-label*="profile" i] span, [role="banner"] a[href*="/me"] span')
      .first()
      .textContent({ timeout: 1500 })
      .catch(() => displayName);
  }

  const result = {
    connectionId: id,
    status: connected ? 'connected' : isFacebookLoginUrl(url) ? 'connecting' : 'connecting',
    facebookUserId: facebookUserCookie,
    displayName: displayName?.trim() || null,
    currentUrl: url,
    updatedAt: nowIso(),
  };
  state.connections[id] = {
    ...(state.connections[id] || {}),
    ...result,
  };
  await persistState();
  return result;
}

async function openConnection(connectionId, payload) {
  const id = safeId(connectionId);
  state.connections[id] = {
    ...(state.connections[id] || {}),
    connectionId: id,
    agencyId: String(payload.agencyId || ''),
    ownerUid: String(payload.ownerUid || ''),
    label: String(payload.label || ''),
    status: 'connecting',
    updatedAt: nowIso(),
  };
  await persistState();
  const page = await getPage(id);
  if (!/facebook\.com/i.test(page.url()) || page.url() === 'about:blank') {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  return inspectConnection(id);
}

async function closeConnection(connectionId, removeProfile = false) {
  const id = safeId(connectionId);
  const context = contexts.get(id);
  contexts.delete(id);
  contextLastUsed.delete(id);
  await context?.close().catch(() => undefined);
  if (removeProfile) {
    const profileDir = safeProfileDir(id);
    const resolvedRoot = path.resolve(profileRoot);
    const resolvedProfile = path.resolve(profileDir);
    if (!resolvedProfile.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error('Refusing to remove a profile outside the configured root.');
    }
    await fs.rm(resolvedProfile, { recursive: true, force: true });
    delete state.connections[id];
    const cancelledJobs = [];
    Object.values(state.jobs).forEach((job) => {
      if (job.connectionId === id && !['completed', 'cancelled'].includes(job.status)) {
        job.status = 'cancelled';
        job.cancelRequested = true;
        job.updatedAt = nowIso();
        cancelledJobs.push(job);
      }
    });
    await persistState();
    await Promise.allSettled(cancelledJobs.map((job) => reportJob(job)));
  }
}

async function applyRemoteInput(connectionId, input) {
  const page = await getPage(connectionId);
  const type = String(input.type || '');
  if (type === 'click') {
    const x = Math.max(0, Math.min(viewport.width, Number(input.x || 0)));
    const y = Math.max(0, Math.min(viewport.height, Number(input.y || 0)));
    await page.mouse.click(x, y);
  } else if (type === 'text') {
    const text = String(input.text || '').slice(0, 4096);
    await page.keyboard.insertText(text);
  } else if (type === 'key') {
    const allowedKeys = new Set(['Enter', 'Tab', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    const key = String(input.key || '');
    if (!allowedKeys.has(key)) throw new Error('Unsupported key.');
    await page.keyboard.press(key);
  } else if (type === 'wheel') {
    await page.mouse.wheel(0, Math.max(-2000, Math.min(2000, Number(input.deltaY || 0))));
  } else if (type === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  } else {
    throw new Error('Unsupported input type.');
  }
  await page.waitForTimeout(250);
  const result = await inspectConnection(connectionId);
  if (result.status === 'connected') {
    await postEvent({
      type: 'connection.updated',
      ...state.connections[connectionId],
      ...result,
    }).catch((error) => console.warn('Could not report connected session.', error));
  }
  return result;
}

async function downloadImages(job) {
  const downloadDir = path.join(os.tmpdir(), 'imodeus-facebook-cloud', safeId(job.id));
  await fs.mkdir(downloadDir, { recursive: true });
  const files = [];
  try {
    for (let index = 0; index < Math.min(16, job.propertyImages.length); index += 1) {
      const source = job.propertyImages[index];
      const imageUrl = new URL(String(source?.url || ''));
      if (imageUrl.protocol !== 'https:') throw new Error(`URL invalid pentru imaginea ${index + 1}.`);
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Imaginea ${index + 1} nu a putut fi descărcată.`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 25_000_000) throw new Error(`Imaginea ${index + 1} este prea mare.`);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 25_000_000) throw new Error(`Imaginea ${index + 1} este prea mare.`);
      const filePath = path.join(downloadDir, `${String(index + 1).padStart(2, '0')}.${extension}`);
      await fs.writeFile(filePath, bytes);
      files.push(filePath);
    }
    return { downloadDir, files };
  } catch (error) {
    await fs.rm(downloadDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

const composerTriggerName = /Creeaz(?:\u0103|a) (?:o )?postare(?: public(?:\u0103|a))?|Create (?:a )?(?:public )?post|Scrie ceva|Write something|La ce te g(?:\u00e2|a)nde(?:\u0219|s)ti|What(?:'|\u2019)s on your mind/i;
const groupJoinName = /^(?:Al(?:\u0103|a)tur(?:\u0103|a)-te(?: grupului)?|(?:\u00ce|I)nscrie-te (?:\u00een|in) grup|Join group|Join)$/i;
const unavailableGroupText = /Acest con(?:\u021b|t)inut nu este disponibil|This content isn't available|Grupul nu este disponibil|This group isn't available/i;

async function hasVisibleMatch(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function composerIsOpen(page) {
  const editors = page.locator([
    '[role="dialog"] [contenteditable="true"][role="textbox"]',
    '[role="dialog"] [contenteditable="true"][data-lexical-editor="true"]',
    '[aria-label="Create post"] [contenteditable="true"]',
    '[aria-label="Creeaz\u0103 o postare"] [contenteditable="true"]',
  ].join(', '));
  return hasVisibleMatch(editors);
}

async function clickVisibleComposerTrigger(page) {
  const candidates = [
    page.getByRole('button', { name: composerTriggerName }),
    page.locator('button, [role="button"]').filter({ hasText: composerTriggerName }),
  ];
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const target = candidate.nth(index);
      if (!await target.isVisible().catch(() => false)) continue;
      const box = await target.boundingBox().catch(() => null);
      if (!box || box.width < 20 || box.height < 16) continue;
      try {
        await humanClick(target, 10_000);
        return true;
      } catch {
        // Facebook can replace the node while the feed is hydrating; try the next visible match.
      }
    }
  }
  return false;
}

async function assertGroupCanBePostedTo(page) {
  if (await hasVisibleMatch(page.getByRole('button', { name: groupJoinName }))) {
    const error = new Error('Contul Facebook nu este membru al acestui grup. \u00censcrie contul \u00een grup \u0219i reia publicarea.');
    error.code = 'GROUP_MEMBERSHIP_REQUIRED';
    throw error;
  }
  if (await hasVisibleMatch(page.getByText(unavailableGroupText, { exact: false }))) {
    const error = new Error('Grupul Facebook nu este disponibil pentru acest cont.');
    error.code = 'GROUP_UNAVAILABLE';
    throw error;
  }
}

async function tryOpenComposer(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastClickAt = 0;
  while (Date.now() < deadline) {
    if (await composerIsOpen(page)) return true;
    await assertGroupCanBePostedTo(page);

    if (Date.now() - lastClickAt > 2_000 && await clickVisibleComposerTrigger(page)) {
      lastClickAt = Date.now();
      await humanPause(page, 700, 1_250);
      if (await composerIsOpen(page)) return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function openComposer(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })).catch(() => undefined);
  if (await tryOpenComposer(page, 30_000)) return;

  await assertGroupCanBePostedTo(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await humanPause(page, 1_500, 2_500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })).catch(() => undefined);
  if (await tryOpenComposer(page, 30_000)) return;

  await assertGroupCanBePostedTo(page);
  const visibleButtons = await page.locator('button:visible, [role="button"]:visible')
    .evaluateAll((elements) => elements
      .map((element) => element.getAttribute('aria-label') || element.textContent || '')
      .map((label) => label.trim())
      .filter(Boolean)
      .slice(0, 20))
    .catch(() => []);
  console.warn('Facebook composer not found after retry.', {
    url: page.url(),
    title: await page.title().catch(() => ''),
    visibleButtons,
  });
  const error = new Error('Composerul Facebook nu a fost g\u0103sit dup\u0103 re\u00eenc\u0103rcarea grupului.');
  error.code = 'COMPOSER_NOT_FOUND';
  throw error;
}


async function getVisibleComposerDialog(page) {
  const dialogs = page.locator('[role="dialog"]:visible');
  const count = await dialogs.count().catch(() => 0);
  let largest = null;
  let largestArea = 0;
  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    const box = await dialog.boundingBox().catch(() => null);
    const area = box ? box.width * box.height : 0;
    if (area > largestArea) {
      largest = dialog;
      largestArea = area;
    }
  }
  return largest;
}

async function fillComposer(page, description) {
  const dialog = await getVisibleComposerDialog(page);
  const scope = dialog || page;
  let editor = scope.locator('[contenteditable="true"][role="textbox"]:visible').last();
  if (!await editor.count().catch(() => 0)) {
    editor = page.locator('[contenteditable="true"][role="textbox"]:visible').last();
  }
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await humanClick(editor);
  await humanPause(page, 180, 420);
  const text = String(description || '');
  await editor.fill(text, { timeout: 20_000 });
  if (text.trim()) {
    const insertedText = await editor.innerText().catch(() => '');
    if (!insertedText.trim()) throw new Error('Descrierea proprietății nu a fost introdusă în composerul Facebook.');
  }
  await humanPause(page, 350, 850);
}

async function attachImages(page, files) {
  if (!files.length) return;
  const dialog = await getVisibleComposerDialog(page);
  const scope = dialog || page;
  let input = scope.locator('input[type="file"]').last();
  if (!await input.count().catch(() => 0)) {
    const photoButton = scope.getByRole('button', { name: /Foto|Photo|fotograf/i }).last();
    if (await photoButton.count().catch(() => 0)) {
      await humanClick(photoButton, 8_000).catch(() => undefined);
      await humanPause(page, 400, 750);
      input = scope.locator('input[type="file"]').last();
    }
  }
  if (!await input.count().catch(() => 0)) {
    input = page.locator('input[type="file"]').last();
  }
  if (!await input.count().catch(() => 0)) {
    throw new Error('Controlul de încărcare a fotografiilor nu a fost găsit.');
  }
  await input.setInputFiles(files);
  await humanPause(page, 1_800, 3_200);
}

async function clickPublish(page) {
  const dialog = await getVisibleComposerDialog(page);
  const scope = dialog || page;
  const composerBox = dialog ? await dialog.boundingBox().catch(() => null) : null;
  const publishName = /^(Public[ăa]|Posteaz[ăa]|Post)$/i;
  const labelledPublishButtons = [
    '[role="button"][aria-label="Post"]',
    'button[aria-label="Post"]',
    '[role="button"][aria-label="Publică"]',
    'button[aria-label="Publică"]',
    '[role="button"][aria-label="Postează"]',
    'button[aria-label="Postează"]',
  ].join(', ');
  const candidates = [
    page.getByRole('button', { name: publishName }),
    page.locator(labelledPublishButtons),
    page.locator('button, [role="button"]').filter({ hasText: publishName }),
    scope.getByRole('button', { name: publishName }),
    scope.locator(labelledPublishButtons),
    scope.locator('button, [role="button"]').filter({ hasText: publishName }),
  ];
  let publishButton = null;
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = candidate.nth(index);
      if (!await item.isVisible().catch(() => false)) continue;
      const itemBox = await item.boundingBox().catch(() => null);
      if (composerBox && itemBox) {
        const centerX = itemBox.x + itemBox.width / 2;
        const centerY = itemBox.y + itemBox.height / 2;
        const insideComposer = centerX >= composerBox.x
          && centerX <= composerBox.x + composerBox.width
          && centerY >= composerBox.y
          && centerY <= composerBox.y + composerBox.height;
        if (!insideComposer) continue;
      }
      publishButton = item;
      break;
    }
    if (publishButton) break;
  }
  if (!publishButton) {
    const visibleLabels = await page.locator('button:visible, [role="button"]:visible')
      .evaluateAll((elements) => elements
        .map((element) => element.getAttribute('aria-label') || element.textContent || '')
        .map((label) => label.trim())
        .filter(Boolean)
        .slice(-20))
      .catch(() => []);
    throw new Error(`Butonul de publicare Facebook nu a fost găsit. Butoane vizibile: ${visibleLabels.join(' | ')}`);
  }
  const uploadDeadline = Date.now() + 120_000;
  while (!await publishButton.isEnabled().catch(() => false)) {
    if (Date.now() >= uploadDeadline) throw new Error('Fotografiile nu au terminat încărcarea în Facebook.');
    await page.waitForTimeout(750);
  }
  await humanPause(page, 500, 1_100);
  await humanClick(publishButton, 20_000);
  const composerClosed = await (dialog
    ? dialog.waitFor({ state: 'hidden', timeout: 45_000 })
    : publishButton.waitFor({ state: 'hidden', timeout: 45_000 }))
    .then(() => true)
    .catch(() => false);
  if (!composerClosed && (!dialog || await dialog.isVisible().catch(() => false))) {
    const alertText = await scope.locator('[role="alert"]').last().textContent().catch(() => '');
    throw new Error(alertText?.trim() || 'Facebook nu a confirmat publicarea postării.');
  }
  await humanPause(page, 1_400, 2_400);
}

async function publishGroup(job, group, files) {
  const page = await getPage(job.connectionId);
  await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await humanPause(page, 1_600, 2_800);
  const connection = await inspectConnection(job.connectionId);
  if (connection.status !== 'connected' || isFacebookLoginUrl(page.url())) {
    const error = new Error('Facebook solicită reconectarea contului.');
    error.code = 'NEEDS_REAUTHENTICATION';
    throw error;
  }
  await openComposer(page);
  await fillComposer(page, job.propertyDescription);
  await attachImages(page, files);
  await clickPublish(page);
  return {
    status: 'submitted',
    submittedAt: nowIso(),
    currentUrl: page.url(),
  };
}

function cooldownMs() {
  const range = cooldownMaxSeconds - cooldownMinSeconds;
  const seconds = cooldownMinSeconds + (range > 0 ? crypto.randomInt(range + 1) : 0);
  return seconds * 1000;
}

function publicJob(job) {
  return {
    id: job.id,
    agencyId: job.agencyId,
    ownerUid: job.ownerUid,
    connectionId: job.connectionId,
    propertyId: job.propertyId,
    status: job.status,
    groups: job.groups,
    currentGroupIndex: job.currentGroupIndex,
    nextRunAt: job.nextRunAt || null,
    errorMessage: job.errorMessage || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || null,
  };
}

async function reportJob(job) {
  await postEvent({
    type: 'job.updated',
    job: publicJob(job),
  }).catch((error) => console.warn('Could not report job progress.', error));
}

async function processJob(job) {
  job.status = 'running';
  job.updatedAt = nowIso();
  await persistState();
  await reportJob(job);

  let downloaded;
  try {
    downloaded = await downloadImages(job);
    for (let index = job.currentGroupIndex || 0; index < job.groups.length; index += 1) {
      if (job.cancelRequested) {
        job.status = 'cancelled';
        job.updatedAt = nowIso();
        await persistState();
        await reportJob(job);
        return;
      }
      const group = job.groups[index];
      job.currentGroupIndex = index;
      if (['submitted', 'pending_approval', 'skipped'].includes(group.status)) continue;

      if (job.nextRunAt) {
        const waitMs = new Date(job.nextRunAt).getTime() - Date.now();
        if (waitMs > 0) {
          job.status = 'cooldown';
          job.updatedAt = nowIso();
          await persistState();
          await reportJob(job);
          let remainingMs = waitMs;
          while (remainingMs > 0 && !job.cancelRequested) {
            const sliceMs = Math.min(1000, remainingMs);
            await new Promise((resolve) => setTimeout(resolve, sliceMs));
            remainingMs -= sliceMs;
          }
          if (job.cancelRequested) {
            job.status = 'cancelled';
            job.updatedAt = nowIso();
            await persistState();
            await reportJob(job);
            return;
          }
        }
      }

      group.status = 'publishing';
      group.startedAt = nowIso();
      job.status = 'running';
      job.updatedAt = nowIso();
      await persistState();
      await reportJob(job);

      try {
        Object.assign(group, await publishGroup(job, group, downloaded.files));
      } catch (error) {
        if (job.cancelRequested) {
          group.status = 'skipped';
          group.errorMessage = null;
          job.status = 'cancelled';
          job.updatedAt = nowIso();
          await persistState();
          await reportJob(job);
          return;
        }
        group.status = error?.code === 'NEEDS_REAUTHENTICATION' ? 'needs_reauthentication' : 'error';
        group.errorMessage = error instanceof Error ? error.message : String(error);
        group.failedAt = nowIso();
        job.errorMessage = group.errorMessage;
        job.status = group.status === 'needs_reauthentication' ? 'needs_reauthentication' : 'error';
        job.updatedAt = nowIso();
        await persistState();
        await reportJob(job);
        return;
      }

      job.nextRunAt = index < job.groups.length - 1 ? new Date(Date.now() + cooldownMs()).toISOString() : null;
      job.updatedAt = nowIso();
      await persistState();
      await reportJob(job);
    }

    job.status = 'completed';
    job.completedAt = nowIso();
    job.updatedAt = job.completedAt;
    job.nextRunAt = null;
    await persistState();
    await reportJob(job);
  } catch (error) {
    if (!['completed', 'cancelled', 'needs_reauthentication', 'error'].includes(job.status)) {
      job.status = 'error';
      job.errorMessage = error instanceof Error ? error.message : String(error);
      job.updatedAt = nowIso();
      await persistState();
      await reportJob(job);
    }
  } finally {
    if (downloaded?.downloadDir) {
      await fs.rm(downloaded.downloadDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function scheduleConnection(connectionId) {
  const id = safeId(connectionId);
  if (connectionWorkers.has(id)) return;
  connectionWorkers.add(id);
  void (async () => {
    try {
      while (true) {
        const nextJob = Object.values(state.jobs)
          .filter((job) => job.connectionId === id && ['queued', 'running', 'cooldown'].includes(job.status))
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
        if (!nextJob) return;
        await processJob(nextJob);
      }
    } catch (error) {
      console.error('Connection worker failed.', { connectionId: id, error });
    } finally {
      connectionWorkers.delete(id);
      const hasMore = Object.values(state.jobs).some(
        (job) => job.connectionId === id && ['queued', 'running', 'cooldown'].includes(job.status)
      );
      if (hasMore) setTimeout(() => scheduleConnection(id), 1000);
    }
  })();
}

async function enqueueJob(payload) {
  const id = safeId(payload.id);
  const connectionId = safeId(payload.connectionId);
  const existing = state.jobs[id];
  if (existing) {
    scheduleConnection(existing.connectionId);
    return publicJob(existing);
  }
  const job = {
    id,
    agencyId: String(payload.agencyId || ''),
    ownerUid: String(payload.ownerUid || ''),
    connectionId,
    propertyId: String(payload.propertyId || ''),
    propertyTitle: String(payload.propertyTitle || ''),
    propertyDescription: String(payload.propertyDescription || ''),
    propertyImages: Array.isArray(payload.propertyImages) ? payload.propertyImages.slice(0, 16) : [],
    groups: Array.isArray(payload.groups)
      ? payload.groups.map((group) => ({
          name: String(group.name || ''),
          url: normalizeFacebookGroupUrl(group.url),
          status: 'queued',
        }))
      : [],
    currentGroupIndex: 0,
    status: 'queued',
    cancelRequested: false,
    nextRunAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (!job.groups.length) throw new Error('At least one Facebook group is required.');
  state.jobs[id] = job;
  await persistState();
  scheduleConnection(connectionId);
  return publicJob(job);
}

async function cancelJob(jobId) {
  const id = safeId(jobId);
  const job = state.jobs[id];
  if (!job) return null;
  job.cancelRequested = true;
  if (job.status === 'queued') job.status = 'cancelled';
  job.updatedAt = nowIso();
  await persistState();
  await reportJob(job);
  return publicJob(job);
}

async function resumeJob(jobId) {
  const id = safeId(jobId);
  const job = state.jobs[id];
  if (!job) return null;
  if (!['needs_reauthentication', 'error'].includes(job.status)) {
    scheduleConnection(job.connectionId);
    return publicJob(job);
  }
  const currentGroup = job.groups[job.currentGroupIndex];
  if (currentGroup && ['needs_reauthentication', 'error'].includes(currentGroup.status)) {
    currentGroup.status = 'queued';
    currentGroup.errorMessage = null;
    currentGroup.failedAt = null;
  }
  job.status = 'queued';
  job.errorMessage = null;
  job.nextRunAt = null;
  job.updatedAt = nowIso();
  await persistState();
  await reportJob(job);
  scheduleConnection(job.connectionId);
  return publicJob(job);
}

function matchPath(url, regex) {
  return new URL(url, 'http://localhost').pathname.match(regex);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        connections: Object.keys(state.connections).length,
        activeContexts: contexts.size,
        queuedJobs: Object.values(state.jobs).filter((job) => ['queued', 'running', 'cooldown'].includes(job.status)).length,
      });
      return;
    }

    if (!authorized(request)) {
      sendJson(response, 401, { message: 'Unauthorized.' });
      return;
    }

    let match = matchPath(request.url, /^\/v1\/connections\/([^/]+)\/open$/);
    if (match && request.method === 'POST') {
      sendJson(response, 200, await openConnection(match[1], await readJson(request)));
      return;
    }

    match = matchPath(request.url, /^\/v1\/connections\/([^/]+)\/status$/);
    if (match && request.method === 'GET') {
      sendJson(response, 200, await inspectConnection(match[1]));
      return;
    }

    match = matchPath(request.url, /^\/v1\/connections\/([^/]+)\/snapshot$/);
    if (match && request.method === 'GET') {
      const page = await getPage(match[1]);
      sendPng(response, await page.screenshot({ type: 'png' }));
      return;
    }

    match = matchPath(request.url, /^\/v1\/connections\/([^/]+)\/input$/);
    if (match && request.method === 'POST') {
      sendJson(response, 200, await applyRemoteInput(match[1], await readJson(request, 32_000)));
      return;
    }

    match = matchPath(request.url, /^\/v1\/connections\/([^/]+)$/);
    if (match && request.method === 'DELETE') {
      await closeConnection(match[1], true);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && new URL(request.url, 'http://localhost').pathname === '/v1/jobs') {
      sendJson(response, 202, { job: await enqueueJob(await readJson(request)) });
      return;
    }

    match = matchPath(request.url, /^\/v1\/jobs\/([^/]+)\/cancel$/);
    if (match && request.method === 'POST') {
      const job = await cancelJob(match[1]);
      sendJson(response, job ? 200 : 404, job ? { job } : { message: 'Job not found.' });
      return;
    }

    match = matchPath(request.url, /^\/v1\/jobs\/([^/]+)$/);
    if (match && request.method === 'GET') {
      const job = state.jobs[safeId(match[1])];
      sendJson(response, job ? 200 : 404, job ? { job: publicJob(job) } : { message: 'Job not found.' });
      return;
    }

    match = matchPath(request.url, /^\/v1\/jobs\/([^/]+)\/resume$/);
    if (match && request.method === 'POST') {
      const job = await resumeJob(match[1]);
      sendJson(response, job ? 200 : 404, job ? { job } : { message: 'Job not found.' });
      return;
    }

    sendJson(response, 404, { message: 'Not found.' });
  } catch (error) {
    console.error('Runner request failed.', error);
    sendJson(response, 500, {
      message: error instanceof Error ? error.message : 'Unexpected runner error.',
    });
  }
});

await loadState();
const recoveredJobs = [];
Object.values(state.jobs)
  .filter((job) => ['queued', 'running', 'cooldown'].includes(job.status))
  .forEach((job) => {
    const currentGroup = job.groups?.[job.currentGroupIndex || 0];
    if (job.status === 'running' && currentGroup?.status === 'publishing') {
      const recoveryMessage = 'Rezultat incert după restartul runnerului; grupul nu este republicat automat pentru a evita un duplicat.';
      currentGroup.status = 'error';
      currentGroup.errorMessage = recoveryMessage;
      currentGroup.failedAt = nowIso();
      job.status = 'error';
      job.errorMessage = recoveryMessage;
      job.updatedAt = nowIso();
      recoveredJobs.push(job);
      return;
    }
    if (job.status === 'running') job.status = 'queued';
    job.updatedAt = nowIso();
    recoveredJobs.push(job);
    scheduleConnection(job.connectionId);
  });
if (recoveredJobs.length) {
  await persistState();
  await Promise.allSettled(recoveredJobs.map((job) => reportJob(job)));
}

setInterval(() => {
  const cutoff = Date.now() - contextIdleMs;
  for (const [connectionId, lastUsedAt] of contextLastUsed.entries()) {
    if (lastUsedAt >= cutoff || connectionWorkers.has(connectionId)) continue;
    void closeConnection(connectionId, false).catch((error) => {
      console.warn('Could not close an idle browser context.', { connectionId, error });
    });
  }
}, 60_000).unref();

server.listen(port, '0.0.0.0', () => {
  console.log(`ImoDeus Facebook cloud runner listening on ${port}.`);
});

async function shutdown() {
  server.close();
  await Promise.allSettled(Array.from(contexts.values()).map((context) => context.close()));
  await persistState().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
