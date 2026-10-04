import dotenv from 'dotenv';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ownerSearchFields, parseOwnerPrice } from '../src/lib/owner-listings/search-index.ts';

// Node >=22.17 with --experimental-strip-types; no extra dependency.
if (process.argv.includes('--help')) {
  console.log('node --experimental-strip-types scripts/backfill-owner-search-index.mjs [--scope bucuresti-ilfov] [--apply]. Default: dry-run. Concurrently changed documents are skipped.');
  process.exit(0);
}
dotenv.config({ path: '.env.local', quiet: true });
const apply = process.argv.includes('--apply');
const scopePos = process.argv.indexOf('--scope');
const scope = scopePos >= 0 ? process.argv[scopePos + 1] : undefined;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('Configurează FIREBASE_PROJECT_ID pentru proiectul vizat.');
const credentials = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY ? cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) : applicationDefault();
const db = getFirestore(initializeApp({ projectId, credential: credentials }, 'owner-search-backfill'));
let cursor, scanned = 0, changed = 0, conflicted = 0;
while (true) {
  let query = db.collection('ownerListings').orderBy('__name__').limit(300);
  if (scope) query = query.where('scopeKey', '==', scope);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  for (const doc of page.docs) {
    const row = doc.data(); scanned++;
    const patch = { ...ownerSearchFields(row), priceValue: parseOwnerPrice(row.price) };
    if (Object.entries(patch).every(([key, value]) => row[key] === value)) continue;
    changed++;
    if (apply) {
      try { await doc.ref.update(patch, { lastUpdateTime: doc.updateTime }); }
      catch (error) { if (Number(error.code) === 9) conflicted++; else throw error; }
    }
  }
  cursor = page.docs.at(-1).id;
  if (page.size < 300) break;
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', projectId, scope: scope || 'all', scanned, changed, conflicted, note: 'Repetă dacă există conflicte. Publicarea indexurilor și starea READY se verifică separat.' }));
