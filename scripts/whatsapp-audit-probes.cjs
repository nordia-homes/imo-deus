// Offline regression probes for the audit findings, using synthetic records only.
// Never loads live Firebase admin or provider credentials.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(root, 'src/lib/communications', `${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  cache.set(name, module.exports);
  const localRequire = specifier => {
    if (specifier === '@/lib/firebase-app-hosting') return { requireAgencyUserFromBearerToken() { throw Error('No live authentication allowed'); } };
    if (specifier === '@/lib/demo/guards') return { isDemoAgencyId: () => false };
    if (specifier === './media') return { attachmentForSend() { throw Error('No media requests allowed'); } };
    if (specifier === './meta') return { graph() { throw Error('No Graph calls allowed'); }, connectionToken() { throw Error('No credentials allowed'); }, MetaGraphError: class extends Error {} };
    if (specifier.startsWith('./')) return load(specifier.slice(2));
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(localRequire, module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}
function memoryDb() {
  const values = new Map();
  const snapshot = p => ({ id: p.split('/').at(-1), exists: values.has(p), data: () => values.get(p), ref: doc(p) });
  const doc = p => ({ id: p.split('/').at(-1), path: p, get: async () => snapshot(p),
    collection: name => collection(`${p}/${name}`), update: async value => values.set(p, { ...values.get(p), ...value }) });
  const collection = (p, filters = [], cap = Infinity) => ({
    doc: id => doc(`${p}/${id}`),
    where: (field, operator, expected) => collection(p, [...filters, [field, operator, expected]], cap),
    limit: n => collection(p, filters, n),
    get: async () => {
      const docs = [...values.keys()].filter(k => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'))
        .filter(k => filters.every(([f, op, v]) => op === 'in' ? v.includes(values.get(k)[f]) : values.get(k)[f] === v))
        .slice(0, cap).map(snapshot);
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const db = { collection, runTransaction: async fn => {
    const writes = [];
    const result = await fn({ get: async ref => { assert.equal(writes.length, 0, 'Firestore reads must precede writes'); return snapshot(ref.path); },
      set: (ref, value, options) => writes.push(() => values.set(ref.path, options?.merge ? { ...values.get(ref.path), ...value } : value)),
      create: (ref, value) => writes.push(() => { assert(!values.has(ref.path)); values.set(ref.path, value); }),
      update: (ref, value) => writes.push(() => values.set(ref.path, { ...values.get(ref.path), ...value })),
    });
    writes.forEach(fn => fn()); return result;
  } };
  return { db, values };
}
async function main() {
  process.env.META_TOKEN_ENCRYPTION_KEY = 'synthetic-regression-key';
  const { normalizeWebhookSafely } = load('normalize');
  const { receiptCorrelation } = load('receipt-correlation');
  const { bodyParameterCount } = load('templates');
  const { ingestMessage } = load('server');
  const { stableId } = load('crypto');
  const { drainOutbound } = load('outbound');
  const connection = { id: 'audit-connection', agencyId: 'audit-agency', channel: 'whatsapp', externalId: '100', status: 'connected', capabilities: {} };
  const event = { channel: 'whatsapp', accountId: '100', participantId: '40700000000', externalId: 'audit-wamid', text: '', direction: 'sent', attachments: [], createdAt: '2026-09-30T10:00:00Z' };
  const conversationId = stableId(connection.id, event.participantId);
  const base = `agencies/audit-agency/conversations/${conversationId}`;
  const check = (label, fn) => Promise.resolve().then(fn).then(() => console.log(`PASS: ${label}`));
  await check('Signed receipt reconciles an unknown send without a provider-ID mapping', async () => {
    const { db, values } = memoryDb();
    const jobId = stableId('local-job');
    values.set(`${base}/messages/${jobId}`, { origin: 'imodeus', status: 'unknown', externalId: null });
    values.set(`communicationOutboundJobs/${jobId}`, { agencyId:connection.agencyId,connectionId:connection.id,conversationId,status: 'unknown', budgetSettled: false });
    await ingestMessage(db, connection, { ...event, status: 'delivered',correlation:receiptCorrelation(jobId,connection.id) });
    assert.equal(values.get(`communicationOutboundJobs/${jobId}`).status, 'delivered');
    assert.equal(values.get(`${base}/messages/${jobId}`).status, 'delivered');
    assert.equal(values.get(`communicationMessageMappings/${stableId(connection.id, event.externalId)}`).messageId, jobId);
  });
  await check('Failed receipt before echo preserves the displayed error', async () => {
    const { db, values } = memoryDb();
    await ingestMessage(db, connection, { ...event, status: 'failed', error: '131026: synthetic delivery failure' });
    await ingestMessage(db, connection, { ...event, text: 'Synthetic echo' });
    const message = values.get(`${base}/messages/${stableId(connection.id, event.externalId)}`);
    assert.equal(message.status, 'failed');
    assert.equal(message.error, '131026: synthetic delivery failure');
  });
  await check('Named template parameters are rejected by the positional editor', () => {
    assert.equal(bodyParameterCount({ components: [{ type: 'BODY', text: 'Salut {{first_name}}' }] }), null);
  });
  await check('A malformed timestamp cannot hide a later STOP message', () => {
    const result = normalizeWebhookSafely({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '100' }, messages: [
      { id: 'audit-bad', from: '40700000000', timestamp: '99999999999999', text: { body: 'Synthetic' } },
      { id: 'audit-good', from: '40700000000', timestamp: '1790762400', text: { body: 'STOP' } },
    ] } }] }] });
    assert.equal(result.errors.length,1);
    assert.equal(result.events[0].text,'STOP');
  });
  await check('Delivered receipt after failed settlement restores the charge exactly once', async () => {
    const { db, values } = memoryDb();
    await ingestMessage(db, connection, { ...event, text: 'Synthetic echo' });
    const messageId = stableId(connection.id, event.externalId);
    const messagePath = `${base}/messages/${messageId}`;
    values.set(messagePath, { ...values.get(messagePath), origin: 'imodeus', status: 'failed' });
    values.set(`communicationOutboundJobs/${messageId}`, { agencyId: 'audit-agency', status: 'failed', budgetSettled: false, estimate: { amount: 100 }, budgetId: 'audit-budget' });
    const budgetPath = 'agencies/audit-agency/communicationBudgets/audit-budget';
    values.set(budgetPath, { reservedMicros: 100, spentMicros: 0 });
    await drainOutbound(db);
    await ingestMessage(db, connection, { ...event, status: 'delivered' });
    await drainOutbound(db);
    assert.equal(values.get(`communicationOutboundJobs/${messageId}`).status, 'delivered');
    assert.equal(values.get(budgetPath).spentMicros, 100);
    assert.equal(values.get(budgetPath).reservedMicros, 0);
    await ingestMessage(db, connection, { ...event, status: 'delivered' });
    await drainOutbound(db);
    assert.equal(values.get(budgetPath).spentMicros, 100);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
