import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.SALES_E2E_BASE_URL || 'http://127.0.0.1:3000';
const storageState = process.env.SALES_E2E_STORAGE_STATE;

if (!storageState || !fs.existsSync(storageState)) {
  console.log('SKIP sales E2E: configurează SALES_E2E_STORAGE_STATE cu o sesiune autentificată de agent.');
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/sales-management`, { waitUntil: 'networkidle' });
  await page.getByTestId('sales-management-page').waitFor({ state: 'visible', timeout: 20_000 });
  for (const stageLabel of ['Pregătire', 'Rezervare', 'Antecontract', 'Contract', 'Finalizată', 'Blocată']) {
    await page.getByRole('button', { name: stageLabel, exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  }
  if (await page.getByRole('button', { name: 'Documente', exact: true }).count()) {
    throw new Error('Documente nu trebuie să mai fie o etapă a tranzacției.');
  }
  const saleCard = page.locator('[data-testid^="sale-card-"]').first();
  if (!(await saleCard.count())) throw new Error('Datasetul E2E trebuie să conțină cel puțin un dosar vizibil agentului.');

  const setupCta = saleCard.locator('[data-testid^="sale-setup-cta-"]');
  if (!(await setupCta.count())) throw new Error('Dosarul aflat în Pregătire trebuie să afișeze butonul de completare ghidată.');
  const setupLabel = await setupCta.getAttribute('aria-label');
  if (!setupLabel?.includes('Informațiile')) throw new Error('Butonul de completare ghidată trebuie să comunice starea informațiilor.');
  await setupCta.click();
  const setupWizard = page.getByText('Pregătește dosarul de vânzare').first();
  await setupWizard.waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.press('Escape');
  await setupWizard.waitFor({ state: 'hidden', timeout: 10_000 });

  await saleCard.getByRole('button', { name: 'Trimite e-mail' }).click();
  const composer = page.getByTestId('sales-email-composer');
  const wizard = page.getByText('Pregătește dosarul de vânzare').first();
  await Promise.race([composer.waitFor({ state: 'visible', timeout: 10_000 }), wizard.waitFor({ state: 'visible', timeout: 10_000 })]);
  if (await composer.isVisible().catch(() => false)) {
    await page.getByRole('tab', { name: 'Template' }).click();
    await page.getByText('Biblioteca de mesaje').waitFor();
    await page.getByRole('tab', { name: 'Răspunsuri' }).click();
    await page.getByText('Starea infrastructurii').waitFor();
  }
  console.log('PASS sales E2E smoke');
} finally {
  await browser.close();
}
