import fs from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
if (!file) throw new Error('Usage: node scripts/communications-rates.mjs rates.json [--write]');
const rates = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(rates) || !rates.length || rates.length > 400) throw new Error('Expected 1–400 rates.');
for (const rate of rates) {
  if (!/^[a-zA-Z0-9_-]+$/.test(rate.id) || !['service','marketing','utility','authentication'].includes(rate.category) || !/^\d{1,4}$/.test(rate.prefix) || !/^[A-Z]{3}$/.test(rate.currency) || !Number.isSafeInteger(rate.amountMicros) || rate.amountMicros < 0 || !(Date.parse(rate.validFrom) < Date.parse(rate.validUntil)) || !/^https:\/\//.test(rate.sourceUrl)) throw new Error(`Invalid rate: ${rate.id}`);
}
if (!args.includes('--write')) { console.log(`Validated ${rates.length} rates; dry-run only.`); }
else {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore(); const batch = db.batch();
  for (const rate of rates) batch.set(db.collection('communicationRates').doc(rate.id), { ...rate, updatedAt: new Date().toISOString() });
  await batch.commit(); console.log(`Saved ${rates.length} rates.`);
}
