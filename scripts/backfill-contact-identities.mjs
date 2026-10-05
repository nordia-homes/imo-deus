import dotenv from 'dotenv';
import { createRequire } from 'node:module';
import { contactIdentityKeys, normalizedContactFields } from '../src/lib/crm/contact-identity.ts';
dotenv.config({ path: '.env.local', quiet: true });
const projectIndex = process.argv.indexOf('--project');
const projectId = projectIndex >= 0 ? process.argv[projectIndex + 1] : process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Precizează proiectul Firebase cu --project.');
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== projectId) throw new Error('Proiectul diferă de configurația locală.');
const apply = process.argv.includes('--apply');
const auth = createRequire(import.meta.url)('firebase-tools/lib/auth');
const account = auth.getProjectDefaultAccount(process.cwd()) || auth.getGlobalDefaultAccount();
if (!account?.tokens?.refresh_token) throw new Error('Autentificare Firebase necesară.');
const token = await auth.getAccessToken(account.tokens.refresh_token, []);
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
async function request(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw Object.assign(new Error(`Firestore HTTP ${response.status}: ${String(error.error?.message || '').slice(0, 800)}`), { status: response.status }); }
  return response.json();
}
const strings = fields => Object.fromEntries(Object.entries(fields || {}).map(([field, value]) => [field, value.stringValue || '']));
const lockRows = await request(base + ':runQuery', { structuredQuery: { from: [{ collectionId: 'assistantLocks', allDescendants: true }], select: { fields: [{ fieldPath: 'contactId' }, { fieldPath: 'kind' }] } } });
const locks = new Map(lockRows.filter(row => row.document?.fields?.kind?.stringValue === 'contact_identity').map(row => [row.document.name, row.document.fields?.contactId?.stringValue]));
let cursor, scanned = 0, changed = 0, duplicates = 0, conflicts = 0, written = 0;
const agencies = new Set(), seen = new Set();
for (;;) {
  const page = (await request(base + ':runQuery', { structuredQuery: { from: [{ collectionId: 'contacts', allDescendants: true }], select: { fields: ['phone', 'email', 'normalizedPhone', 'normalizedEmail'].map(fieldPath => ({ fieldPath })) }, orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 300, ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}) } })).filter(row => row.document).map(row => row.document);
  if (!page.length) break;
  for (const doc of page) {
    const match = doc.name.match(/\/agencies\/([^/]+)\/contacts\/([^/]+)$/);
    if (!match) continue;
    const [, agencyId, contactId] = match, row = strings(doc.fields), normalized = normalizedContactFields(row);
    scanned++; agencies.add(agencyId);
    const needsUpdate = Object.entries(normalized).some(([field, value]) => row[field] !== value);
    if (needsUpdate) changed++;
    const writes = needsUpdate ? [{ update: { name: doc.name, fields: Object.fromEntries(Object.entries(normalized).map(([field, value]) => [field, { stringValue: value }])) }, updateMask: { fieldPaths: Object.keys(normalized) }, currentDocument: { updateTime: doc.updateTime } }] : [];
    const newLocks = [];
    for (const identity of contactIdentityKeys(row)) {
      const name = doc.name.replace(/\/contacts\/[^/]+$/, '/assistantLocks/' + identity.key);
      if (seen.has(name)) duplicates++;
      seen.add(name);
      if (!locks.has(name)) { newLocks.push(name); writes.push({ update: { name, fields: { contactId: { stringValue: contactId }, kind: { stringValue: 'contact_identity' }, source: { stringValue: 'migration' }, updatedAt: { stringValue: new Date().toISOString() } } }, currentDocument: { exists: false } }); }
    }
    if (apply && writes.length) {
      try { await request(base + ':commit', { writes }); written++; newLocks.forEach(name => locks.set(name, contactId)); }
      catch (error) { if ([409, 412].includes(error.status)) conflicts++; else throw error; }
    } else if (!apply) newLocks.forEach(name => locks.set(name, contactId));
  }
  cursor = page.at(-1).name;
  if (page.length < 300) break;
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', projectId, agencies: agencies.size, scanned, changed, written, conflicts, duplicateIdentities: duplicates, note: 'Duplicatele existente sunt păstrate pentru revizuire. Repetă migrarea dacă există conflicte concurente.' }));
