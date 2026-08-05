import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

function emit(type, payload) {
  process.stdout.write(`${JSON.stringify({ type, ...payload })}\n`);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith('--') && value && !value.startsWith('--')) {
      values[key.slice(2)] = value;
      index += 1;
    }
  }
  return values;
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

function safeFileName(value, fallback = 'document') {
  const normalized = String(value || fallback)
    .normalize('NFKD')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, 140) || fallback;
}

async function downloadAttachments(attachments, jobId) {
  const directory = path.join(os.tmpdir(), 'imodeus-gmail-runner', jobId);
  await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  await ensureDir(directory);
  const files = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    if (attachment.path) {
      files.push({ path: attachment.path, name: attachment.name || path.basename(attachment.path) });
      continue;
    }
    if (!attachment.url) continue;
    const response = await fetch(attachment.url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Nu am putut descărca ${attachment.name || 'atașamentul'} (${response.status}).`);
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeFileName(attachment.name)}`;
    const filePath = path.join(directory, fileName);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    files.push({ path: filePath, name: attachment.name || fileName });
  }
  return { directory, files };
}

async function launchContext(profileDir) {
  await ensureDir(profileDir);
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
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Nu am putut porni browserul Gmail. ${errors.join(' | ')}`);
}

function isLoginPage(url) {
  return /accounts\.google\.com|ServiceLogin|signin\/v2/i.test(url);
}

async function getPage(context) {
  const current = context.pages().find((candidate) => /mail\.google\.com|accounts\.google\.com/i.test(candidate.url()));
  return current || context.pages()[0] || context.newPage();
}

async function firstVisible(page, selectors, timeout = 1200) {
  for (const selector of selectors) {
    const locator = page.locator(selector).last();
    try {
      if (await locator.count()) {
        await locator.waitFor({ state: 'visible', timeout });
        return locator;
      }
    } catch {
      // Try the next localized/fallback selector.
    }
  }
  return null;
}

async function retryStep(action, attempts = 3) {
  let result = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await action().catch(() => false);
    if (result) return true;
    await new Promise((resolve) => setTimeout(resolve, attempt * 350));
  }
  return result;
}

async function openComposer(page) {
  const existingSubject = await firstVisible(page, ['input[name="subjectbox"]'], 500);
  if (existingSubject) return true;
  const compose = await firstVisible(page, [
    'div[role="button"]:has-text("Compose")',
    'div[role="button"]:has-text("Scrie")',
    'div[role="button"]:has-text("Redactează")',
    'div[gh="cm"]',
  ], 4000);
  if (!compose) return false;
  await compose.click();
  return Boolean(await firstVisible(page, ['input[name="subjectbox"]'], 6000));
}

async function fillRecipients(page, recipients, kind = 'to') {
  if (!recipients?.length) return true;
  if (kind !== 'to') {
    const toggle = await firstVisible(page, [
      `span:has-text("${kind.toUpperCase()}")`,
      `span:has-text("${kind === 'cc' ? 'Cc' : 'Bcc'}")`,
    ], 800);
    await toggle?.click().catch(() => undefined);
  }
  const selectors = kind === 'to'
    ? ['input[aria-label*="To recipients"]', 'input[aria-label*="Către"]', 'input[role="combobox"]']
    : [`input[name="${kind}"]`, `input[aria-label*="${kind === 'cc' ? 'Cc' : 'Bcc'}"]`];
  const input = await firstVisible(page, selectors, 2500);
  if (!input) return false;
  await input.click();
  for (const recipient of recipients) {
    await input.fill(recipient);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  return true;
}

async function fillSubject(page, subject) {
  const input = await firstVisible(page, ['input[name="subjectbox"]'], 2500);
  if (!input) return false;
  await input.fill(subject);
  return true;
}

async function fillBody(page, bodyText, bodyHtml) {
  const editor = await firstVisible(page, [
    'div[aria-label="Message Body"]',
    'div[aria-label="Corpul mesajului"]',
    'div[role="textbox"][contenteditable="true"]',
  ], 3000);
  if (!editor) return false;
  await editor.click();
  if (bodyHtml) {
    await editor.evaluate((element, html) => {
      element.innerHTML = String(html);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }, bodyHtml);
  } else {
    await editor.fill(bodyText || '');
  }
  return true;
}

async function attachFiles(page, filePaths) {
  if (!filePaths.length) return true;
  const existing = page.locator('input[type="file"]').last();
  try {
    if (await existing.count()) {
      await existing.setInputFiles(filePaths);
    } else {
      const attachButton = await firstVisible(page, [
        'div[command="Files"]',
        'div[aria-label*="Attach files"]',
        'div[aria-label*="Atașați fișiere"]',
        'div[aria-label*="Atașează fișiere"]',
      ], 2500);
      if (!attachButton) return false;
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null);
      await attachButton.click();
      const chooser = await chooserPromise;
      if (chooser) await chooser.setFiles(filePaths);
      else {
        const afterClick = page.locator('input[type="file"]').last();
        if (!(await afterClick.count())) return false;
        await afterClick.setInputFiles(filePaths);
      }
    }
    await page.waitForTimeout(Math.min(12_000, 1200 + filePaths.length * 900));
    return true;
  } catch {
    return false;
  }
}

async function detectSent(page) {
  const selectors = [
    'span:has-text("Message sent")',
    'span:has-text("Mesaj trimis")',
    'div[role="alert"]:has-text("sent")',
    'div[role="alert"]:has-text("trimis")',
  ];
  return Boolean(await firstVisible(page, selectors, 350));
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.session || !args['profile-dir']) throw new Error('Gmail runner necesită sesiune și profil local.');
  const session = JSON.parse(await fs.readFile(args.session, 'utf8'));
  const downloaded = await downloadAttachments(session.attachments || [], session.jobId);
  let context;
  try {
    context = await launchContext(args['profile-dir']);
    const page = await getPage(context);
    await page.goto('https://mail.google.com/mail/u/0/#inbox', { waitUntil: 'domcontentloaded' });
    await page.bringToFront().catch(() => undefined);
    await page.waitForTimeout(2500);
    if (isLoginPage(page.url())) {
      emit('status', {
        status: {
          state: 'needs_login',
          message: 'Conectează-te în Gmail în fereastra deschisă. Runnerul va continua automat.',
          jobId: session.jobId,
          saleId: session.saleId,
          messageRecordId: session.messageRecordId,
        },
      });
      await page.waitForURL(/mail\.google\.com/i, { timeout: 10 * 60_000 });
      await page.waitForTimeout(2500);
    }

    emit('status', {
      status: {
        state: 'preparing',
        message: 'Pregătesc mesajul și atașamentele în Gmail…',
        jobId: session.jobId,
        saleId: session.saleId,
        messageRecordId: session.messageRecordId,
      },
    });

    const completedFields = [];
    const missingFields = [];
    if (await retryStep(() => openComposer(page))) completedFields.push('composer'); else missingFields.push('composer');
    if (await retryStep(() => fillRecipients(page, session.to, 'to'))) completedFields.push('to'); else missingFields.push('to');
    if (await retryStep(() => fillRecipients(page, session.cc || [], 'cc'))) completedFields.push('cc'); else if (session.cc?.length) missingFields.push('cc');
    if (await retryStep(() => fillRecipients(page, session.bcc || [], 'bcc'))) completedFields.push('bcc'); else if (session.bcc?.length) missingFields.push('bcc');
    if (await retryStep(() => fillSubject(page, session.subject))) completedFields.push('subject'); else missingFields.push('subject');
    if (await retryStep(() => fillBody(page, session.bodyText, session.bodyHtml))) completedFields.push('body'); else missingFields.push('body');
    const attached = await retryStep(() => attachFiles(page, downloaded.files.map((file) => file.path)), 2);
    if (attached) completedFields.push('attachments'); else if (downloaded.files.length) missingFields.push('attachments');

    await page.bringToFront().catch(() => undefined);
    emit('status', {
      status: {
        state: missingFields.length ? 'error' : 'waiting_for_send',
        message: missingFields.length
          ? `Mesajul este deschis, dar necesită verificare: ${missingFields.join(', ')}.`
          : 'Mesajul este complet. Verifică-l și apasă Trimite în Gmail.',
        jobId: session.jobId,
        saleId: session.saleId,
        messageRecordId: session.messageRecordId,
        completedFields,
        missingFields,
        attachmentCount: downloaded.files.length,
        preparedAt: new Date().toISOString(),
        attempt: Number(session.attempt || 1),
        selectorProfile: 'gmail-web-2026-v1',
        canRetry: missingFields.length > 0,
        diagnosticCode: missingFields.length ? `MISSING_${missingFields.join('_').toUpperCase()}` : null,
      },
    });

    while (context.pages().length) {
      if (await detectSent(page)) {
        emit('status', {
          status: {
            state: 'sent_ui_confirmed',
            message: 'Gmail a confirmat trimiterea mesajului.',
            jobId: session.jobId,
            saleId: session.saleId,
            messageRecordId: session.messageRecordId,
            attachmentCount: downloaded.files.length,
            sentAt: new Date().toISOString(),
            attempt: Number(session.attempt || 1),
            selectorProfile: 'gmail-web-2026-v1',
            canRetry: false,
          },
        });
        await page.waitForTimeout(1000);
        break;
      }
      await page.waitForTimeout(600);
    }
  } finally {
    await fs.rm(downloaded.directory, { recursive: true, force: true }).catch(() => undefined);
    await context?.close().catch(() => undefined);
  }
}

run().catch((error) => {
  emit('status', {
    status: {
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
});
