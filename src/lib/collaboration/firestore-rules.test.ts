import fs from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('collaboration Firestore rules', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-imodeus-collaboration', firestore: { rules: fs.readFileSync('src/firestore.rules', 'utf8') } });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'partner'), { name: 'Partener', email: 'partner@example.com' });
      await setDoc(doc(db, 'users', 'admin'), { agencyId: 'agency-a', role: 'admin', email: 'admin@example.com' });
      await setDoc(doc(db, 'collaborationListings', 'listing'), { title: 'Privat' });
      await setDoc(doc(db, 'collaborationLeads', 'lead'), { buyerEmail: 'buyer@example.com' });
      await setDoc(doc(db, 'collaborationCases', 'case'), { buyerEmail: 'buyer@example.com' });
      await setDoc(doc(db, 'invites', 'invitation'), { agencyId: 'agency-a', email: 'partner@example.com' });
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  it('keeps collaboration records server managed for every signed-in account', async () => {
    const db = env.authenticatedContext('partner', { email: 'partner@example.com' }).firestore();
    await assertFails(getDoc(doc(db, 'collaborationListings', 'listing')));
    await assertFails(getDoc(doc(db, 'collaborationLeads', 'lead')));
    await assertFails(getDoc(doc(db, 'collaborationCases', 'case')));
    await assertFails(setDoc(doc(db, 'collaborationLinks', 'fake'), { collaboratorUid: 'partner' }));
  });

  it('does not let a user promote themselves into a collaborator or CRM agency', async () => {
    const db = env.authenticatedContext('partner', { email: 'partner@example.com' }).firestore();
    await assertFails(updateDoc(doc(db, 'users', 'partner'), { accountType: 'collaborator_only' }));
    await assertFails(updateDoc(doc(db, 'users', 'partner'), { collaborationStatus: 'active' }));
    await assertFails(updateDoc(doc(db, 'users', 'partner'), { agencyId: 'agency-a' }));
  });

  it('shows an invitation only to its recipient and prevents client deletion', async () => {
    const recipient = env.authenticatedContext('partner', { email: 'partner@example.com' }).firestore();
    const stranger = env.authenticatedContext('stranger', { email: 'stranger@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(recipient, 'invites', 'invitation')));
    await assertFails(getDoc(doc(stranger, 'invites', 'invitation')));
    await assertFails(getDocs(collection(recipient, 'invites')));
    await assertFails(deleteDoc(doc(recipient, 'invites', 'invitation')));
  });
});
