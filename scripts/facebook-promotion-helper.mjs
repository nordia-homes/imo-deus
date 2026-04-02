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

async function openComposer(page) {
  const composerSelectors = [
    'div[role="button"]:has-text("Scrie ceva")',
    'div[role="button"]:has-text("Write something")',
    'div[role="button"]:has-text("Creează o postare")',
    'div[role="button"]:has-text("Create post")',
    'span:has-text("Scrie ceva"):visible',
    'span:has-text("Write something"):visible',
  ];

  await page.waitForTimeout(1500);
  await tryClickFirst(page, composerSelectors);
  await page.waitForTimeout(1500);
}

async function fillComposer(page, text) {
  const textboxSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div.notranslate[contenteditable="true"]',
  ];

  for (const selector of textboxSelectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.count()) {
        await locator.click({ timeout: 2500 });
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.insertText(text);
        return true;
      }
    } catch {
      // try next selector
    }
  }

  return false;
}

async function attachImages(page, files) {
  if (!files.length) return false;

  const mediaButtonSelectors = [
    'div[role="button"]:has-text("Foto/video")',
    'div[role="button"]:has-text("Photo/video")',
    'span:has-text("Foto/video")',
    'span:has-text("Photo/video")',
  ];

  await tryClickFirst(page, mediaButtonSelectors);
  await page.waitForTimeout(1500);

  const fileInput = page.locator('input[type="file"]').first();
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
      const filled = await fillComposer(page, session.propertyDescription || '');
      const attached = await attachImages(page, files);
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
        await fillComposer(page, session.propertyDescription || '');
        await attachImages(page, files);
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
