import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST)('private large video Storage rules', () => {
  let env: RulesTestEnvironment;
  const actor = 'upload-' + randomUUID(), uploadId = randomUUID(), path = `agencies/a/privateCommunications/assistant-uploads/${actor}/${uploadId}`;
  const bytes = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 0, 0, 0, 0]);
  const metadata = { contentType: 'video/mp4', customMetadata: { uploadId } };
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-imodeus-ai-assistant', firestore: { rules: fs.readFileSync('src/firestore.rules', 'utf8') }, storage: { rules: fs.readFileSync('src/storage.rules', 'utf8') } });
    await env.withSecurityRulesDisabled(async c => {
      await setDoc(doc(c.firestore(), 'users', actor), { agencyId: 'a', role: 'agent' });
      await setDoc(doc(c.firestore(), 'users', 'other'), { agencyId: 'a', role: 'agent' });
      await setDoc(doc(c.firestore(), 'agencies', 'a', 'assistantUploads', uploadId), { ownerId: actor, actorRole: 'agent', status: 'uploading', size: bytes.length, mimeType: 'video/mp4', expiresAt: Date.now() + 600000 });
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  it('requires the exact authorized actor, size, format and metadata', async () => {
    const storage = env.authenticatedContext(actor).storage();
    await assertFails(uploadBytes(ref(storage, path), bytes.subarray(0, 4), metadata));
    await assertFails(uploadBytes(ref(storage, path), bytes, { ...metadata, contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage, path), bytes, { ...metadata, customMetadata: { uploadId, extra: 'spoof' } }));
    await assertFails(uploadBytes(ref(env.authenticatedContext('other').storage(), path), bytes, metadata));
    await assertFails(uploadBytes(ref(storage, path + '-forged'), bytes, metadata));
    await assertSucceeds(uploadBytes(ref(storage, path), bytes, metadata));
  }, 30000);
  it('prevents overwriting/deleting bytes after upload and denies another actor read', async () => {
    const storage = env.authenticatedContext(actor).storage();
    await assertFails(uploadBytes(ref(storage, path), bytes, metadata));
    await assertFails(deleteObject(ref(storage, path)));
    await assertFails(getBytes(ref(env.authenticatedContext('other').storage(), path)));
    await assertSucceeds(getBytes(ref(storage, path)));
  }, 30000);
  it('revocation prevents further reads of the private source', async () => {
    await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'users', actor), { agencyId: 'other-agency', role: 'agent' }); });
    await assertFails(getBytes(ref(env.authenticatedContext(actor).storage(), path)));
  }, 30000);
});
