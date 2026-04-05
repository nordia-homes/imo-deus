import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import process from 'node:process';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function emit(type, payload) {
  process.stdout.write(`${JSON.stringify({ type, ...payload })}\n`);
}

async function readSession(sessionPath) {
  const raw = await fs.readFile(sessionPath, 'utf8');
  return JSON.parse(raw);
}

async function writeSession(sessionPath, session) {
  await fs.writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  emit('session', {});
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]+/g, '-').trim();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function downloadImages(images, downloadDir) {
  const files = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const imageUrl = image?.url;
    if (!imageUrl) continue;

    const ext = (() => {
      try {
        const pathname = new URL(imageUrl).pathname;
        return path.extname(pathname) || '.jpg';
      } catch {
        return '.jpg';
      }
    })();

    const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(image.alt || 'property-image')}${ext}`;
    const filePath = path.join(downloadDir, fileName);
    try {
      await fs.access(filePath);
      files.push(filePath);
      continue;
    } catch {
      // continue to fetch
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

  await page.waitForTimeout(1200);
  const clicked = await tryClickFirst(page, composerSelectors);
  await page.waitForTimeout(1200);

  if (!clicked) {
    return false;
  }

  await closeExtraComposerRoots(page);
  return Boolean(await getActiveComposerRoot(page));
}

async function getActiveComposerRoot(page) {
  const dialogSelectors = [
    'div[role="dialog"]',
    'div[aria-label="Create post"]',
    'div[aria-label="Creează o postare"]',
  ];

  let bestDialog = null;
  let bestScore = -1;

  for (const selector of dialogSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const box = await candidate.boundingBox().catch(() => null);
      if (!box || box.width < 320 || box.height < 220) continue;

      const textboxCount = await candidate.locator('[contenteditable="true"]').count().catch(() => 0);
      const publishCount = await candidate.locator('div[role="button"]:has-text("Publică"), div[role="button"]:has-text("Post"), span:has-text("Publică"), span:has-text("Postează"), span:has-text("Post")').count().catch(() => 0);
      const mediaCount = await candidate.locator('input[type="file"], div[aria-label*="fot"], div[aria-label*="photo"], div[role="button"][aria-label*="Foto"], div[role="button"][aria-label*="Photo"]').count().catch(() => 0);
      const score = (textboxCount ? 1000 : 0) + (publishCount ? 300 : 0) + (mediaCount ? 120 : 0) + Math.round(box.width * box.height);

      if (score > bestScore) {
        bestScore = score;
        bestDialog = candidate;
      }
    }
  }

  return bestDialog;
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

    const closeSelectors = [
      'div[aria-label="Închide"]',
      'div[aria-label="Close"]',
      'div[role="button"][aria-label="Închide"]',
      'div[role="button"][aria-label="Close"]',
    ];

    for (const selector of closeSelectors) {
      const closeButton = dialog.locator(selector).first();
      try {
        if (await closeButton.count()) {
          await closeButton.click({ timeout: 1500, force: true });
          await page.waitForTimeout(250);
          break;
        }
      } catch {
        // try next selector
      }
    }
  }
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

async function getLocatorDebug(locator) {
  try {
    return await locator.evaluate((node) => {
      if (!(node instanceof HTMLElement)) {
        return 'non-html-node';
      }

      const rect = node.getBoundingClientRect();
      const attrs = [
        node.getAttribute('role'),
        node.getAttribute('aria-label'),
        node.getAttribute('data-lexical-editor'),
        node.className || '',
      ]
        .filter(Boolean)
        .join('|');

      return `${node.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)} ${attrs}`.trim();
    });
  } catch {
    return 'locator-debug-unavailable';
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

async function getComposerTextbox(composerRoot) {
  const preferredSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[aria-label*="Creează o postare publică"][contenteditable="true"]',
    'div[aria-label*="What\'s on your mind"][contenteditable="true"]',
    'div.notranslate[contenteditable="true"]',
    '[contenteditable="true"]',
  ];

  return findBestTextbox(composerRoot, preferredSelectors);
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
  const targetDebug = await getLocatorDebug(locator);
  await locator.click({ timeout: 2500, force: true });
  await page.waitForTimeout(200);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await clearComposerTarget(page);
    await page.keyboard.insertText(text).catch(() => {});
    await page.waitForTimeout(250);

    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return { ok: true, strategy: `insertText#${attempt + 1}`, targetDebug };
      }
    }

    // Facebook sometimes remounts the Lexical editor right after text appears.
    // Re-focus the target and write again on the fresh editor instance.
    await locator.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(250);
  }

  if (await injectComposerText(locator, text)) {
    await page.waitForTimeout(500);
    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return { ok: true, strategy: 'injectComposerText', targetDebug };
      }
    }
  }

  if (await dispatchPasteEvent(locator, text)) {
    await page.waitForTimeout(500);
    if (await composerContainsText(locator, text)) {
      await page.waitForTimeout(1500);
      if (await composerContainsText(locator, text)) {
        return { ok: true, strategy: 'dispatchPasteEvent', targetDebug };
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
      return { ok: true, strategy: 'textContent', targetDebug };
    }
  }

  return { ok: false, strategy: 'all_failed', targetDebug };
}

async function fillComposer(page, text) {
  await closeExtraComposerRoots(page);
  const composerRoot = await getActiveComposerRoot(page);
  if (!composerRoot) {
    return { ok: false, strategy: 'no_composer_root', targetDebug: 'composer-root-missing' };
  }

  await page.waitForTimeout(1200);
  const placeholderSelectors = [
    'span:has-text("Creează o postare publică")',
    'div:has-text("Creează o postare publică")',
    'span:has-text("Ce ai în minte")',
    'span:has-text("What\'s on your mind")',
  ];

  const directTextbox = await getComposerTextbox(composerRoot);
  if (directTextbox) {
    const directResult = await fillComposerTarget(page, directTextbox, text);
    if (directResult.ok) {
      return directResult;
    }
  }

  for (const selector of placeholderSelectors) {
    const locator = composerRoot.locator(selector).first();
    try {
      if (await locator.count()) {
        await locator.click({ timeout: 2500, force: true });
        await page.waitForTimeout(300);
        const activeTextbox = await getComposerTextbox(composerRoot);
        if (activeTextbox) {
          const activeResult = await fillComposerTarget(page, activeTextbox, text);
          if (activeResult.ok) {
            return activeResult;
          }
        }
      }
    } catch {
      // try next selector
    }
  }

  return { ok: false, strategy: 'no_textbox_matched', targetDebug: 'textbox-not-found' };
}

async function attachImages(page, files) {
  if (!files.length) return false;
  await closeExtraComposerRoots(page);
  const composerRoot = await getActiveComposerRoot(page);
  if (!composerRoot) return false;
  const mediaButtonSelectors = [
    'div[aria-label*="Adaugă fotografii"]',
    'div[aria-label*="Add photos"]',
    'div[role="button"][aria-label*="Foto"]',
    'div[role="button"][aria-label*="Photo"]',
    'div[role="button"]:has-text("Foto/video")',
    'div[role="button"]:has-text("Photo/video")',
    'span[aria-label*="Foto"]',
    'span[aria-label*="Photo"]',
    'div[aria-label*="Foto/video"]',
    'div[aria-label*="Photo/video"]',
    'div[role="button"] svg[aria-label*="Foto"]',
    'div[role="button"] svg[aria-label*="Photo"]',
  ];

  const scopes = [composerRoot];

  for (const scope of scopes) {
    const existingInput = scope.locator('input[type="file"]').last();
    try {
      if (await existingInput.count()) {
        await existingInput.setInputFiles(files);
        await page.waitForTimeout(2500);
        return true;
      }
    } catch {
      // continue to click-based flow
    }

    for (const selector of mediaButtonSelectors) {
      const trigger = scope.locator(selector).first();
      try {
        if (!(await trigger.count())) {
          continue;
        }

        const chooserPromise = page.waitForEvent('filechooser', { timeout: 2500 }).catch(() => null);
        await trigger.click({ timeout: 2500 });
        const chooser = await chooserPromise;

        if (chooser) {
          await chooser.setFiles(files);
          await page.waitForTimeout(2500);
          return true;
        }

        const inputAfterClick = scope.locator('input[type="file"]').last();
        if (await inputAfterClick.count()) {
          await inputAfterClick.setInputFiles(files);
          await page.waitForTimeout(2500);
          return true;
        }
      } catch {
        // try next selector
      }
    }
  }

  return false;
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
      // try next
    }
  }
  return false;
}

function isFacebookLoginUrl(url) {
  return /facebook\.com\/(login|checkpoint|recover|two_step_verification|auth)/i.test(url);
}

async function launchContext(profileDir) {
  const cacheDir = path.join(profileDir, 'playwright-cache');

  await ensureDir(cacheDir);

  const sharedOptions = {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--disable-features=Translate,OptimizationHints,MediaRouter',
      '--disable-gpu-shader-disk-cache',
      '--disable-application-cache',
      '--disable-features=MediaRouter,OptimizationHints,Translate',
      `--disk-cache-dir=${cacheDir}`,
      '--start-maximized',
    ],
  };

  const attempts = [
    { label: 'chrome', options: { ...sharedOptions, channel: 'chrome' } },
    { label: 'msedge', options: { ...sharedOptions, channel: 'msedge' } },
    { label: 'bundled-chromium', options: sharedOptions },
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      return await chromium.launchPersistentContext(profileDir, attempt.options);
    } catch (error) {
      errors.push(
        `${attempt.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(`Nu am putut porni browserul pentru runner. ${errors.join(' | ')}`);
}

function buildStatus(session, state, message) {
  const completedCount = session.groups.filter((group) => group.status === 'posted' || group.status === 'skipped').length;
  const currentGroup = session.groups[session.currentGroupIndex] || null;
  return {
    status: {
      state,
      message,
      currentGroupIndex: session.currentGroupIndex,
      currentGroupName: currentGroup?.name || null,
      completedCount,
      totalCount: session.groups.length,
    },
  };
}

async function run() {
  const args = parseArgs(process.argv);
  const sessionPath = args.session;
  const profileDir = args['profile-dir'];

  if (!sessionPath || !profileDir) {
    throw new Error('Worker-ul are nevoie de --session și --profile-dir.');
  }

  let session = await readSession(sessionPath);
  const downloadDir = path.join(os.tmpdir(), 'imodeus-facebook-helper', session.jobId || 'default');
  await ensureDir(downloadDir);
  await ensureDir(profileDir);
  const files = await downloadImages(session.propertyImages || [], downloadDir);

  const context = await launchContext(profileDir);
  const page = await getRunnerPage(context);
  await page.bringToFront().catch(() => {});
  let isStopped = false;
  let isBusy = false;

  const prepareCurrentGroup = async () => {
    if (isBusy || isStopped) return;
    isBusy = true;

    try {
      session = await readSession(sessionPath);
      const nextIndex = session.groups.findIndex((group, index) => index >= session.currentGroupIndex && group.status === 'pending');
      if (nextIndex >= 0) {
        session.currentGroupIndex = nextIndex;
      }

      const group = session.groups[session.currentGroupIndex];
      if (!group || group.status === 'posted' || group.status === 'skipped') {
        emit('status', buildStatus(session, 'completed', 'Toate grupurile au fost parcurse.').status);
        return;
      }

      group.status = 'opened';
      await writeSession(sessionPath, session);
      emit('status', buildStatus(session, 'running', `Pregătesc grupul ${group.name}...`).status);

      await page.goto(group.url, { waitUntil: 'domcontentloaded' });
      await page.bringToFront().catch(() => {});
      await page.waitForTimeout(3000);

      if (isFacebookLoginUrl(page.url())) {
        emit('status', buildStatus(session, 'waiting_for_publish', 'Facebook cere autentificare. Conectează-te în fereastra deschisă, apoi apasă `Reia grupul curent`.').status);
        return;
      }

      await openComposer(page);
      if (isFacebookLoginUrl(page.url())) {
        emit('status', buildStatus(session, 'waiting_for_publish', 'Autentificarea Facebook nu este completă. Finalizează login-ul și apoi apasă `Reia grupul curent`.').status);
        return;
      }

      const attached = await attachImages(page, files);
      const fillResult = await fillComposer(page, session.propertyDescription || '');
      const publishDetected = await waitForPublishButton(page);

      const message = [
        `Text: ${fillResult.ok ? 'completat' : 'necompletat'}`,
        `Strategie text: ${fillResult.strategy}`,
        `Editor: ${fillResult.targetDebug}`,
        `Poze: ${attached ? 'atașate' : 'neatașate'}`,
        `Publică: ${publishDetected ? 'detectat' : 'nedetectat'}`,
      ].join(' • ');

      emit('status', buildStatus(session, 'waiting_for_publish', message).status);
    } catch (error) {
      emit('status', buildStatus(session, 'error', error instanceof Error ? error.message : 'Runner error').status);
    } finally {
      isBusy = false;
    }
  };

  const commandReader = readline.createInterface({ input: process.stdin });
  commandReader.on('line', async (line) => {
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      return;
    }

    if (!payload?.command) return;
    session = await readSession(sessionPath);
    const group = session.groups[session.currentGroupIndex];

    if (payload.command === 'stop') {
      isStopped = true;
      emit('status', buildStatus(session, 'stopped', 'Runner-ul desktop a fost oprit.').status);
      await context.close();
      process.exit(0);
    }

    if (!group) {
      emit('status', buildStatus(session, 'completed', 'Nu mai există grupuri de procesat.').status);
      return;
    }

    if (payload.command === 'mark-posted') {
      group.status = 'posted';
      const nextIndex = session.groups.findIndex((item, index) => index > session.currentGroupIndex && item.status === 'pending');
      if (nextIndex >= 0) {
        session.currentGroupIndex = nextIndex;
      }
      await writeSession(sessionPath, session);
      await prepareCurrentGroup();
      return;
    }

    if (payload.command === 'retry-current-group') {
      await prepareCurrentGroup();
      return;
    }

    if (payload.command === 'skip-group') {
      group.status = 'skipped';
      const nextIndex = session.groups.findIndex((item, index) => index > session.currentGroupIndex && item.status === 'pending');
      if (nextIndex >= 0) {
        session.currentGroupIndex = nextIndex;
      }
      await writeSession(sessionPath, session);
      await prepareCurrentGroup();
    }
  });

  await prepareCurrentGroup();
}

async function getRunnerPage(context) {
  const existingPages = context.pages().filter((page) => !page.isClosed());
  const page = existingPages[0] || (await context.newPage());

  const extraPages = existingPages.slice(1);
  await Promise.all(
    extraPages.map((existingPage) =>
      existingPage.close().catch(() => {
        // Ignore close failures for stray startup or restored tabs.
      }),
    ),
  );

  try {
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  } catch {
    // If about:blank fails, we'll still try to reuse the page for Facebook.
  }

  return page;
}

run().catch((error) => {
  emit('status', {
    status: {
      state: 'error',
      message: error instanceof Error ? error.message : 'Worker failed unexpectedly.',
      currentGroupIndex: 0,
      currentGroupName: null,
      completedCount: 0,
      totalCount: 0,
    },
  });
  process.exit(1);
});
