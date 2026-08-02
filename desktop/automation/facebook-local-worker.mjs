import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function emit(type, payload = {}) {
  process.stdout.write(JSON.stringify({ type, ...payload }) + '\n');
}

function random(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function pause(page, min = 350, max = 900) {
  await page.waitForTimeout(random(min, max));
}

async function humanClick(locator, timeout = 15_000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click({ timeout });
    return;
  }
  const insetX = Math.min(12, box.width * 0.22);
  const insetY = Math.min(10, box.height * 0.25);
  const x = box.x + insetX + Math.random() * Math.max(1, box.width - insetX * 2);
  const y = box.y + insetY + Math.random() * Math.max(1, box.height - insetY * 2);
  await locator.page().mouse.move(x + random(-30, 30), y + random(-20, 20), { steps: random(5, 12) });
  await locator.page().mouse.move(x, y, { steps: random(4, 9) });
  await locator.page().mouse.down();
  await locator.page().waitForTimeout(random(55, 145));
  await locator.page().mouse.up();
}

const composerTriggerName = /Creeaz(?:\u0103|a) (?:o )?postare(?: public(?:\u0103|a))?|Create (?:a )?(?:public )?post|Scrie ceva|Write something|La ce te g(?:\u00e2|a)nde(?:\u0219|s)ti|What(?:'|\u2019)s on your mind/i;
const groupJoinName = /^(?:Al(?:\u0103|a)tur(?:\u0103|a)-te(?: grupului)?|(?:\u00ce|I)nscrie-te (?:\u00een|in) grup|Join group|Join)$/i;
const unavailableGroupText = /(?:Acest )?con(?:\u021b|t)inut(?:ul)? nu este disponibil(?: momentan)?|(?:This )?content isn't available(?: right now)?|Grupul nu este disponibil|This group isn't available/i;
const unavailableGroupActionName = /^(?:Mergi la flux|Go to Feed)$/i;

async function hasVisible(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function textMatches(page, pattern) {
  return page.evaluate(({ source, flags }) => {
    return new RegExp(source, flags).test(document.body?.textContent || '');
  }, { source: pattern.source, flags: pattern.flags }).catch(() => false);
}

async function isLoggedIn(context, page) {
  const cookies = await context.cookies('https://www.facebook.com').catch(() => []);
  return cookies.some((cookie) => cookie.name === 'c_user' && cookie.value)
    && !/\/login|checkpoint|recover/i.test(page.url());
}

async function assertGroupAvailable(page) {
  if (await hasVisible(page.getByRole('button', { name: groupJoinName }))) {
    const error = new Error('Contul Facebook nu este membru al acestui grup.');
    error.code = 'GROUP_MEMBERSHIP_REQUIRED';
    throw error;
  }
  const unavailable = [
    page.getByRole('button', { name: unavailableGroupActionName }),
    page.getByRole('link', { name: unavailableGroupActionName }),
  ];
  if (await Promise.any(unavailable.map(async (locator) => {
    if (await hasVisible(locator)) return true;
    throw new Error('not visible');
  })).catch(() => false) || await textMatches(page, unavailableGroupText)) {
    const error = new Error('Grupul Facebook nu este disponibil pentru acest cont.');
    error.code = 'GROUP_UNAVAILABLE';
    throw error;
  }
}

async function composerOpen(page) {
  return hasVisible(page.locator([
    '[role="dialog"] [contenteditable="true"][role="textbox"]',
    '[role="dialog"] [contenteditable="true"][data-lexical-editor="true"]',
    '[aria-label="Create post"] [contenteditable="true"]',
    '[aria-label="Creeaz\u0103 o postare"] [contenteditable="true"]',
  ].join(', ')));
}

async function tryComposer(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastClick = 0;
  while (Date.now() < deadline) {
    if (await composerOpen(page)) return true;
    await assertGroupAvailable(page);
    if (Date.now() - lastClick > 2_000) {
      const candidates = [
        page.getByRole('button', { name: composerTriggerName }),
        page.locator('button, [role="button"]').filter({ hasText: composerTriggerName }),
      ];
      let clicked = false;
      for (const candidate of candidates) {
        const count = await candidate.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const target = candidate.nth(index);
          const box = await target.boundingBox().catch(() => null);
          if (!box || box.width < 20 || box.height < 16 || !await target.isVisible().catch(() => false)) continue;
          await humanClick(target, 10_000).catch(() => undefined);
          clicked = true;
          break;
        }
        if (clicked) break;
      }
      if (clicked) {
        lastClick = Date.now();
        await pause(page, 700, 1_250);
      }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function openComposer(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })).catch(() => undefined);
  if (await tryComposer(page, 30_000)) return;
  await assertGroupAvailable(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await pause(page, 1_500, 2_500);
  if (await tryComposer(page, 30_000)) return;
  await assertGroupAvailable(page);
  const error = new Error('Composerul Facebook nu a fost gasit dupa reincarcarea grupului.');
  error.code = 'COMPOSER_NOT_FOUND';
  throw error;
}

async function visibleDialog(page) {
  const dialogs = page.locator('[role="dialog"]:visible');
  const count = await dialogs.count().catch(() => 0);
  let largest = null;
  let area = 0;
  for (let index = 0; index < count; index += 1) {
    const item = dialogs.nth(index);
    const box = await item.boundingBox().catch(() => null);
    if (box && box.width * box.height > area) {
      largest = item;
      area = box.width * box.height;
    }
  }
  return largest;
}

async function fillComposer(page, description) {
  const dialog = await visibleDialog(page);
  const scope = dialog || page;
  let editor = scope.locator('[contenteditable="true"][role="textbox"]:visible').last();
  if (!await editor.count().catch(() => 0)) editor = page.locator('[contenteditable="true"][role="textbox"]:visible').last();
  await editor.waitFor({ state: 'visible', timeout: 15_000 });
  await humanClick(editor);
  await pause(page, 150, 350);
  await editor.fill(String(description || ''), { timeout: 20_000 });
  await pause(page, 350, 800);
}

async function attachImages(page, files) {
  if (!files.length) return;
  const dialog = await visibleDialog(page);
  const scope = dialog || page;
  let input = scope.locator('input[type="file"]').last();
  if (!await input.count().catch(() => 0)) {
    const photoButton = scope.getByRole('button', { name: /Foto|Photo|fotograf/i }).last();
    if (await photoButton.count().catch(() => 0)) {
      await humanClick(photoButton, 8_000).catch(() => undefined);
      await pause(page, 400, 750);
      input = scope.locator('input[type="file"]').last();
    }
  }
  if (!await input.count().catch(() => 0)) input = page.locator('input[type="file"]').last();
  if (!await input.count().catch(() => 0)) {
    const error = new Error('Controlul de incarcare a fotografiilor nu a fost gasit.');
    error.code = 'PHOTO_INPUT_NOT_FOUND';
    throw error;
  }
  await input.setInputFiles(files);
  await pause(page, 1_800, 3_200);
}

async function clickPublish(page) {
  const dialog = await visibleDialog(page);
  const scope = dialog || page;
  const dialogBox = dialog ? await dialog.boundingBox().catch(() => null) : null;
  const publishName = /^(Public(?:\u0103|a)|Posteaz(?:\u0103|a)|Post)$/i;
  const candidates = [
    scope.getByRole('button', { name: publishName }),
    scope.locator('button, [role="button"]').filter({ hasText: publishName }),
    page.getByRole('button', { name: publishName }),
  ];
  let button = null;
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = candidate.nth(index);
      if (!await item.isVisible().catch(() => false)) continue;
      const box = await item.boundingBox().catch(() => null);
      if (dialogBox && box) {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        if (x < dialogBox.x || x > dialogBox.x + dialogBox.width || y < dialogBox.y || y > dialogBox.y + dialogBox.height) continue;
      }
      button = item;
      break;
    }
    if (button) break;
  }
  if (!button) {
    const error = new Error('Butonul de publicare Facebook nu a fost gasit.');
    error.code = 'PUBLISH_BUTTON_NOT_FOUND';
    throw error;
  }
  const deadline = Date.now() + 120_000;
  while (!await button.isEnabled().catch(() => false)) {
    if (Date.now() >= deadline) {
      const error = new Error('Fotografiile nu au terminat incarcarea in Facebook.');
      error.code = 'UPLOAD_TIMEOUT';
      throw error;
    }
    await page.waitForTimeout(750);
  }
  emit('submitting');
  await pause(page, 500, 1_100);
  await humanClick(button, 20_000);
  const closed = await (dialog
    ? dialog.waitFor({ state: 'hidden', timeout: 45_000 })
    : button.waitFor({ state: 'hidden', timeout: 45_000 }))
    .then(() => true).catch(() => false);
  if (!closed && (!dialog || await dialog.isVisible().catch(() => false))) {
    const error = new Error('Facebook nu a confirmat publicarea postarii.');
    error.code = 'PUBLISH_NOT_CONFIRMED';
    throw error;
  }
  await pause(page, 1_400, 2_400);
}

function normalizeImageUrl(source, index) {
  const objectUrl = source && typeof source === 'object' ? source.url : null;
  const candidate = (typeof source === 'string' ? source : typeof objectUrl === 'string' ? objectUrl : '').trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('URL invalid pentru imaginea ' + (index + 1) + '.');
  }
  if (parsed.protocol !== 'https:') throw new Error('URL invalid pentru imaginea ' + (index + 1) + '.');
  return parsed;
}

async function downloadImages(claim) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'imodeus-facebook-local-'));
  const files = [];
  for (const [index, source] of (claim.property.images || []).entries()) {
    const response = await fetch(normalizeImageUrl(source, index), { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error('Imaginea ' + (index + 1) + ' nu a putut fi descarcata.');
    const type = response.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 25_000_000) throw new Error('Imaginea ' + (index + 1) + ' este prea mare.');
    const file = path.join(dir, String(index + 1).padStart(2, '0') + '.' + ext);
    await fs.writeFile(file, bytes);
    files.push(file);
  }
  return { dir, files };
}

async function main() {
  const claimPath = argument('--claim-file');
  const profileDir = argument('--profile-dir');
  if (!claimPath || !profileDir) throw new Error('Missing claim or profile path.');
  const claim = JSON.parse(await fs.readFile(claimPath, 'utf8'));
  await fs.mkdir(profileDir, { recursive: true });

  let downloaded = null;
  let context = null;
  try {
    downloaded = await downloadImages(claim);
    context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      locale: 'ro-RO',
      timezoneId: 'Europe/Bucharest',
      viewport: { width: 1280, height: 900 },
      args: ['--disable-blink-features=AutomationControlled', '--disable-notifications'],
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(claim.group.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await pause(page, 1_600, 2_800);
    if (!await isLoggedIn(context, page)) {
      const error = new Error('Facebook solicita reconectarea contului.');
      error.code = 'NEEDS_REAUTHENTICATION';
      throw error;
    }
    await openComposer(page);
    await fillComposer(page, claim.property.description);
    await attachImages(page, downloaded.files);
    await clickPublish(page);
    emit('result', { action: 'submitted', currentUrl: page.url() });
  } catch (error) {
    const code = error?.code || 'AUTOMATION_ERROR';
    if (['GROUP_MEMBERSHIP_REQUIRED', 'GROUP_UNAVAILABLE'].includes(code)) {
      emit('result', { action: 'skipped', code, message: error.message });
    } else if (code === 'NEEDS_REAUTHENTICATION') {
      emit('result', { action: 'needs_reauthentication', code, message: error.message });
    } else {
      emit('result', { action: 'failed', code, message: error instanceof Error ? error.message : String(error) });
    }
    process.exitCode = 1;
  } finally {
    await context?.close().catch(() => undefined);
    if (downloaded?.dir) await fs.rm(downloaded.dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  emit('result', { action: 'failed', code: 'WORKER_FATAL', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});

