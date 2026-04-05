import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import process from 'node:process';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]+/g, '-').trim();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readSession(sessionPath) {
  const raw = await fs.readFile(sessionPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.groups) || typeof parsed.propertyDescription !== 'string') {
    throw new Error('Fișierul de sesiune nu are formatul așteptat.');
  }

  return parsed;
}

async function writeSession(sessionPath, session) {
  await fs.writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

async function downloadImages(images, downloadDir) {
  const files = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const imageUrl = image?.url;
    if (!imageUrl) continue;

    const extension = (() => {
      try {
        const pathname = new URL(imageUrl).pathname;
        const ext = path.extname(pathname);
        return ext || '.jpg';
      } catch {
        return '.jpg';
      }
    })();

    const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(image?.alt || 'property-image')}${extension}`;
    const filePath = path.join(downloadDir, fileName);

    try {
      await fs.access(filePath);
      files.push(filePath);
      continue;
    } catch {
      // File does not exist yet, continue with download.
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Nu am putut descărca poza ${imageUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    files.push(filePath);
  }

  return files;
}

async function tryClickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.count()) {
        await locator.click({ timeout: 2500 });
        return true;
      }
    } catch {
      // try next selector
    }
  }

  return false;
}

async function isVisibleLocator(locator) {
  try {
    const box = await locator.boundingBox();
    return Boolean(box && box.width > 80 && box.height > 80);
  } catch {
    return false;
  }
}

async function getActiveComposerRoot(page) {
  const dialogs = page.locator('div[role="dialog"], div[aria-label="Create post"], div[aria-label="Creează o postare"]');
  const count = await dialogs.count().catch(() => 0);
  let bestIndex = -1;
  let bestScore = -1;

  for (let index = 0; index < count; index += 1) {
    const candidate = dialogs.nth(index);
    const box = await candidate.boundingBox().catch(() => null);
    if (!box || box.width < 320 || box.height < 220) continue;

    const textboxCount = await candidate.locator('[contenteditable="true"]').count().catch(() => 0);
    const publishCount = await candidate.locator('div[role="button"]:has-text("Publică"), div[role="button"]:has-text("Post"), span:has-text("Publică"), span:has-text("Postează"), span:has-text("Post")').count().catch(() => 0);
    const mediaCount = await candidate.locator('input[type="file"], div[aria-label*="fot"], div[aria-label*="photo"], div[role="button"][aria-label*="Foto"], div[role="button"][aria-label*="Photo"]').count().catch(() => 0);
    const score = (textboxCount ? 1000 : 0) + (publishCount ? 300 : 0) + (mediaCount ? 120 : 0) + Math.round(box.width * box.height);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex >= 0 ? dialogs.nth(bestIndex) : null;
}

async function closeExtraComposerRoots(page) {
  const dialogs = page.locator('div[role="dialog"], div[aria-label="Create post"], div[aria-label="Creează o postare"]');
  const count = await dialogs.count().catch(() => 0);
  if (count <= 1) return;

  const activeDialog = await getActiveComposerRoot(page);
  const activeHandle = activeDialog ? await activeDialog.elementHandle().catch(() => null) : null;

  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    const dialogHandle = await dialog.elementHandle().catch(() => null);
    if (activeHandle && dialogHandle && dialogHandle === activeHandle) {
      continue;
    }
    if (!(await isVisibleLocator(dialog))) {
      continue;
    }

    for (const selector of [
      'div[aria-label="Închide"]',
      'div[aria-label="Close"]',
      'div[role="button"][aria-label="Închide"]',
      'div[role="button"][aria-label="Close"]',
    ]) {
      const closeButton = dialog.locator(selector).first();
      try {
        if (await closeButton.count()) {
          await closeButton.click({ timeout: 1500, force: true });
          await page.waitForTimeout(250);
          break;
        }
      } catch {
        // try next close button
      }
    }
  }
}

async function openComposer(page) {
  const existingComposer = await getActiveComposerRoot(page);
  if (existingComposer) {
    await closeExtraComposerRoots(page);
    return true;
  }

  const composerSelectors = [
    'div[role="button"]:has-text("Scrie ceva")',
    'div[role="button"]:has-text("Write something")',
    'div[role="button"]:has-text("Creează o postare")',
    'div[role="button"]:has-text("Create post")',
    'span:has-text("Scrie ceva"):visible',
    'span:has-text("Write something"):visible',
  ];

  await page.waitForTimeout(1500);
  const clicked = await tryClickFirst(page, composerSelectors);
  await page.waitForTimeout(1500);
  if (!clicked) {
    return false;
  }

  await closeExtraComposerRoots(page);
  return Boolean(await getActiveComposerRoot(page));
}

function normalizeComposerText(value) {
  return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

async function composerContainsText(locator, text) {
  const expected = normalizeComposerText(text);
  if (!expected) return true;

  try {
    const actual = await locator.evaluate((node) => node.textContent || node.innerText || '');
    return normalizeComposerText(actual).includes(expected);
  } catch {
    return false;
  }
}

async function findBestTextbox(scope, selectors) {
  for (const selector of selectors) {
    const locator = scope.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const box = await candidate.boundingBox().catch(() => null);
      if (!box) continue;
      if (box.width <= 40 || box.height <= 18) continue;

      const debug = await candidate.evaluate((node) => {
        if (!(node instanceof HTMLElement)) return '';
        return [
          node.getAttribute('aria-label') || '',
          node.getAttribute('data-lexical-editor') || '',
          node.className || '',
          node.textContent || '',
        ].join(' ').toLowerCase();
      }).catch(() => '');

      const area = box.width * box.height;
      const yBonus = Math.max(0, 1200 - box.y);
      const intentBonus = /(creeaz|public|mind|lexical|textbox|post)/.test(debug) ? 500000 : 0;
      const score = intentBonus + yBonus * 100 + area;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      return locator.nth(bestIndex);
    }
  }

  return null;
}

async function getComposerTextbox(scope) {
  const preferredSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[aria-label*="Creează o postare publică"][contenteditable="true"]',
    'div[aria-label*="What\'s on your mind"][contenteditable="true"]',
    'div.notranslate[contenteditable="true"]',
    '[contenteditable="true"]',
  ];

  return findBestTextbox(scope, preferredSelectors);
}

async function clearComposerTarget(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
}

async function injectComposerText(locator, text) {
  return locator.evaluate((node, value) => {
    if (!(node instanceof HTMLElement)) return false;

    const html = value
      .split(/\r?\n/)
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<div>${escaped || '<br>'}</div>`;
      })
      .join('');

    node.focus();
    node.innerHTML = html || '<div><br></div>';

    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.addRange(range);

    node.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: 'insertFromPaste',
    }));

    node.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: 'insertFromPaste',
    }));

    node.dispatchEvent(new Event('change', { bubbles: true }));
    node.dispatchEvent(new Event('blur', { bubbles: true }));
    node.dispatchEvent(new Event('focus', { bubbles: true }));

    return true;
  }, text).catch(() => false);
}

async function dispatchPasteEvent(locator, text) {
  return locator.evaluate((node, value) => {
    if (!(node instanceof HTMLElement)) return false;

    node.focus();

    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.addRange(range);

    let dataTransfer = null;
    try {
      dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', value);
      dataTransfer.setData('text', value);
    } catch {
      dataTransfer = null;
    }

    try {
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer || undefined,
      });
      node.dispatchEvent(pasteEvent);
    } catch {
      // Ignore clipboard event construction failures.
    }

    if (dataTransfer) {
      try {
        const beforeInput = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          data: value,
          inputType: 'insertFromPaste',
          dataTransfer,
        });
        node.dispatchEvent(beforeInput);
      } catch {
        // Ignore beforeinput failures.
      }
    }

    return true;
  }, text).catch(() => false);
}

async function fillComposerTarget(page, locator, text) {
  await locator.click({ timeout: 2500, force: true });
  await page.waitForTimeout(200);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await clearComposerTarget(page);
    await page.keyboard.insertText(text).catch(() => {});
    await page.waitForTimeout(250);

    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return true;
      }
    }

    await locator.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(250);
  }

  if (await injectComposerText(locator, text)) {
    await page.waitForTimeout(500);
    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return true;
      }
    }
  }

  if (await dispatchPasteEvent(locator, text)) {
    await page.waitForTimeout(500);
    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return true;
      }
    }
  }

  await locator.evaluate((node, value) => {
    if (!(node instanceof HTMLElement)) return;

    node.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    node.textContent = value;
    node.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: 'insertText',
    }));
  }, text).catch(() => {});

  await page.waitForTimeout(400);
  if (await composerContainsText(locator, text)) {
    await page.waitForTimeout(1500);
    if (await composerContainsText(locator, text)) {
      return true;
    }
  }

  return false;
}

async function fillComposer(page, text) {
  await closeExtraComposerRoots(page);
  await page.waitForTimeout(1200);
  const composerRoot = await getActiveComposerRoot(page);
  if (!composerRoot) {
    return false;
  }

  const activeTextbox = await getComposerTextbox(composerRoot);
  if (activeTextbox && await fillComposerTarget(page, activeTextbox, text)) {
    return true;
  }

  return false;
}

async function attachImages(page, files) {
  if (!files.length) return false;
  await closeExtraComposerRoots(page);
  const composerRoot = await getActiveComposerRoot(page);
  if (!composerRoot) return false;

  const mediaButtonSelectors = [
    'div[aria-label*="Adaugă fotografii"]',
    'div[aria-label*="Add photos"]',
    'div[role="button"]:has-text("Foto/video")',
    'div[role="button"]:has-text("Photo/video")',
    'span:has-text("Foto/video")',
    'span:has-text("Photo/video")',
  ];

  const existingInput = composerRoot.locator('input[type="file"]').last();
  try {
    if (await existingInput.count()) {
      await existingInput.setInputFiles(files);
      await page.waitForTimeout(2500);
      return true;
    }
  } catch {
    // continue with click-based flow
  }

  await tryClickFirst(composerRoot, mediaButtonSelectors);
  await page.waitForTimeout(1500);

  const fileInput = composerRoot.locator('input[type="file"]').last();
  if (!(await fileInput.count())) {
    return false;
  }

  await fileInput.setInputFiles(files);
  await page.waitForTimeout(2500);
  return true;
}

async function waitForPublishButton(page) {
  const publishSelectors = [
    'div[role="button"]:has-text("Publică")',
    'div[role="button"]:has-text("Post")',
    'span:has-text("Publică")',
    'span:has-text("Post")',
  ];

  for (const selector of publishSelectors) {
    try {
      await page.locator(selector).first().waitFor({ timeout: 8000 });
      return true;
    } catch {
      // try next selector
    }
  }

  return false;
}

async function askAction(rl, groupName) {
  const answer = (await rl.question(`\n[${groupName}] Alege acțiunea: (p) publicat, (s) skip, (r) retry, (q) quit > `))
    .trim()
    .toLowerCase();

  if (['p', 's', 'r', 'q'].includes(answer)) {
    return answer;
  }

  return askAction(rl, groupName);
}

async function launchContext(profileDir) {
  try {
    return await chromium.launchPersistentContext(profileDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
    });
  } catch {
    return chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null,
    });
  }
}

async function run() {
  const args = parseArgs(process.argv);
  const sessionPath = args.session;

  if (!sessionPath) {
    console.error('Folosește: npm run facebook:helper -- --session C:\\cale\\facebook-promotion-session.json');
    process.exit(1);
  }

  const absoluteSessionPath = path.resolve(process.cwd(), sessionPath);
  const session = await readSession(absoluteSessionPath);
  const downloadDir = path.join(os.tmpdir(), 'imodeus-facebook-helper', session.jobId || 'default');
  const profileDir = path.resolve(process.cwd(), args['profile-dir'] || '.local-facebook-profile');

  await ensureDir(downloadDir);
  await ensureDir(profileDir);

  console.log(`\nSe descarcă pozele în: ${downloadDir}`);
  const files = await downloadImages(session.propertyImages || [], downloadDir);
  console.log(`S-au pregătit ${files.length} poze pentru upload.`);

  const context = await launchContext(profileDir);
  const page = await context.newPage();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('\nDacă Facebook nu este deja autentificat în profilul local Playwright, conectează-te acum în fereastra deschisă.');

    for (let index = session.currentGroupIndex || 0; index < session.groups.length; index += 1) {
      const group = session.groups[index];
      if (group.status === 'posted' || group.status === 'skipped') {
        continue;
      }

      console.log(`\n=== Grup ${index + 1}/${session.groups.length}: ${group.name} ===`);
      session.currentGroupIndex = index;
      group.status = 'opened';
      await writeSession(absoluteSessionPath, session);

      await page.goto(group.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      await openComposer(page);
      const attached = await attachImages(page, files);
      const filled = await fillComposer(page, session.propertyDescription || '');
      const publishDetected = await waitForPublishButton(page);

      console.log(`Text completat: ${filled ? 'da' : 'nu'}`);
      console.log(`Poze atașate: ${attached ? 'da' : 'nu'}`);
      console.log(`Buton Publică detectat: ${publishDetected ? 'da' : 'nu'}`);
      console.log('Helperul se oprește înainte de click pe Publică.');

      let action = await askAction(rl, group.name);
      while (action === 'r') {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await openComposer(page);
        await attachImages(page, files);
        await fillComposer(page, session.propertyDescription || '');
        await waitForPublishButton(page);
        action = await askAction(rl, group.name);
      }

      if (action === 'q') {
        console.log('\nSesiunea a fost oprită manual.');
        await writeSession(absoluteSessionPath, session);
        break;
      }

      group.status = action === 'p' ? 'posted' : 'skipped';
      await writeSession(absoluteSessionPath, session);
    }

    const allDone = session.groups.every((group) => group.status === 'posted' || group.status === 'skipped');
    if (allDone) {
      console.log('\nToate grupurile din sesiune au fost parcurse.');
    }
  } finally {
    rl.close();
    await context.close();
  }
}

run().catch((error) => {
  console.error('\nHelperul Playwright a eșuat:');
  console.error(error);
  process.exit(1);
});
