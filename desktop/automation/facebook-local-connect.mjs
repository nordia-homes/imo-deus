import fs from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function emit(type, payload = {}) {
  process.stdout.write(JSON.stringify({ type, ...payload }) + '\n');
}

async function inspect(context, page) {
  const cookies = await context.cookies('https://www.facebook.com').catch(() => []);
  const userCookie = cookies.find((cookie) => cookie.name === 'c_user' && cookie.value);
  const blocked = /\/login|checkpoint|recover/i.test(page.url());
  if (!userCookie || blocked) return null;
  const displayName = await page.evaluate(() => {
    const candidates = [
      document.querySelector('a[aria-label*="Profile"]'),
      document.querySelector('a[aria-label*="Profil"]'),
      document.querySelector('[role="banner"] a[href*="/me/"]'),
    ].filter(Boolean);
    for (const element of candidates) {
      const value = element.getAttribute('aria-label') || element.textContent || '';
      if (value.trim()) return value.trim().replace(/^(Profile|Profil)[: ]*/i, '');
    }
    return '';
  }).catch(() => '');
  return {
    facebookUserId: userCookie.value,
    displayName: displayName || null,
    currentUrl: page.url(),
  };
}

async function main() {
  const profileDir = argument('--profile-dir');
  if (!profileDir) throw new Error('Missing profile directory.');
  await fs.mkdir(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    viewport: { width: 1280, height: 860 },
    args: ['--disable-blink-features=AutomationControlled', '--disable-notifications'],
  });
  let closed = false;
  context.on('close', () => { closed = true; });
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
  emit('opened', { currentUrl: page.url() });

  const deadline = Date.now() + 30 * 60_000;
  while (!closed && Date.now() < deadline) {
    const connected = await inspect(context, page);
    if (connected) {
      emit('connected', connected);
      await page.waitForTimeout(1_000);
      await context.close().catch(() => undefined);
      return;
    }
    await page.waitForTimeout(1_500);
  }
  if (!closed) await context.close().catch(() => undefined);
  emit('cancelled', { message: 'Fereastra Facebook a fost inchisa inainte de finalizarea conectarii.' });
  process.exitCode = 1;
}

main().catch((error) => {
  emit('error', { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});

