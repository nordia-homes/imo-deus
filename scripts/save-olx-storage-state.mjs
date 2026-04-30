import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputPath = path.resolve('tmp', 'olx-storage-state.json');

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  const context = await browser.newContext({
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
  });

  const page = await context.newPage();
  await page.goto('https://www.olx.ro/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  // Dismiss the OneTrust consent modal so the page stays clickable for manual login.
  const acceptCookies = page.locator('#onetrust-accept-btn-handler');
  if (await acceptCookies.count()) {
    await acceptCookies.click().catch(() => undefined);
    await page.waitForTimeout(500);
  }

  console.log('');
  console.log('Logheaza-te manual in OLX in fereastra deschisa.');
  console.log('Sesiunea se autosalveaza in fundal la fiecare cateva secunde.');
  console.log('Cand ai terminat, inchide fereastra browserului.');
  console.log('');

  const autosave = setInterval(async () => {
    await context.storageState({ path: outputPath }).catch(() => undefined);
  }, 5000);

  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });
  clearInterval(autosave);
  await context.storageState({ path: outputPath }).catch(() => undefined);
  console.log(`Sesiunea OLX a fost salvata in: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
