import fs from 'node:fs';
const file = new URL('../firestore.indexes.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const access of [false, true]) for (const channel of [false, true]) for (const status of [false, true]) for (const contact of [false, true]) {
  const fields = [
    ...(access ? [{ fieldPath: 'accessUids', arrayConfig: 'CONTAINS' }] : []),
    ...(channel ? [{ fieldPath: 'channel', order: 'ASCENDING' }] : []),
    ...(status ? [{ fieldPath: 'status', order: 'ASCENDING' }] : []),
    ...(contact ? [{ fieldPath: 'contactId', order: 'ASCENDING' }] : []),
    { fieldPath: 'lastMessageAt', order: 'DESCENDING' }, { fieldPath: '__name__', order: 'DESCENDING' },
  ];
  if (fields.length === 2) continue;
  const index = { collectionGroup: 'conversations', queryScope: 'COLLECTION', fields };
  if (!data.indexes.some(existing => JSON.stringify(existing) === JSON.stringify(index))) data.indexes.push(index);
}
const accounting = { collectionGroup: 'communicationOutboundJobs', queryScope: 'COLLECTION', fields: [{ fieldPath: 'budgetSettled', order: 'ASCENDING' }, { fieldPath: 'status', order: 'ASCENDING' }] };
if (!data.indexes.some(existing => JSON.stringify(existing) === JSON.stringify(accounting))) data.indexes.push(accounting);
const publishing = { collectionGroup: 'communicationSocialJobs', queryScope: 'COLLECTION', fields: [{ fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'scheduledAt', order: 'ASCENDING' }] };
if (!data.indexes.some(existing => JSON.stringify(existing) === JSON.stringify(publishing))) data.indexes.push(publishing);
fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
