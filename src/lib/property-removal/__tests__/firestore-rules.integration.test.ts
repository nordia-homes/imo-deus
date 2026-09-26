import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

const withEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
for (const [index, rulesFile] of ['src/firestore.rules', 'firestore.rules'].entries()) {
  withEmulator(`property deletion rules: ${rulesFile}`, () => {
    let environment: RulesTestEnvironment;
    beforeAll(async () => {
      environment = await initializeTestEnvironment({ projectId: `demo-property-removal-${index}`, firestore: { rules: readFileSync(resolve(rulesFile), 'utf8') } });
      await environment.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'users/member'), { agencyId: 'a', role: 'agent' });
        await setDoc(doc(db, 'users/other'), { agencyId: 'b', role: 'agent' });
        await setDoc(doc(db, 'agencies/a/properties/p1'), { title: 'Property', status: 'Activ' });
        await setDoc(doc(db, 'agencyPrivateIntegrations/a__property_lifecycle/operations/p1'), { removalRequested: true });
      });
    });
    afterAll(async () => { await environment?.cleanup(); });
    it('denies client deletion despite the generic agency collection rule', async () => {
      const db = environment.authenticatedContext('member').firestore();
      await assertFails(deleteDoc(doc(db, 'agencies/a/properties/p1')));
      await assertSucceeds(getDoc(doc(db, 'agencies/a/properties/p1')));
    });
    it('preserves ordinary member create/update operations', async () => {
      const db = environment.authenticatedContext('member').firestore();
      await assertSucceeds(setDoc(doc(db, 'agencies/a/properties/new'), { title: 'New' }));
      await assertSucceeds(updateDoc(doc(db, 'agencies/a/properties/p1'), { title: 'Edited' }));
    });
    it('denies cross-agency writes and private lifecycle access', async () => {
      const foreign = environment.authenticatedContext('other').firestore();
      await assertFails(updateDoc(doc(foreign, 'agencies/a/properties/p1'), { title: 'Foreign' }));
      const db = environment.authenticatedContext('member').firestore();
      const ledger = doc(db, 'agencyPrivateIntegrations/a__property_lifecycle/operations/p1');
      await assertFails(getDoc(ledger)); await assertFails(setDoc(ledger, { removalRequested: false }));
    });
  });
}
