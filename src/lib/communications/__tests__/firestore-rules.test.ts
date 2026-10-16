import fs from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('communications Firestore rules', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-imodeus-communications', firestore: { rules: fs.readFileSync('src/firestore.rules','utf8') } });
    await env.withSecurityRulesDisabled(async c => {
      for (const [uid, agencyId, role] of [['agent','a','agent'],['admin','a','admin'],['foreign','b','admin']]) await setDoc(doc(c.firestore(),'users',uid),{agencyId,role});
      await setDoc(doc(c.firestore(),'agencies','a','conversations','c'), { agencyId:'a',assigneeId:'agent',accessUids:['agent'] });
      await setDoc(doc(c.firestore(),'agencies','a','conversations','c','messages','m'), {text:'Private'});
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  it('allows unassigned conversations while denying other agents, foreign agencies and direct takeover writes', async () => {
    await env.withSecurityRulesDisabled(async c => {
      await setDoc(doc(c.firestore(),'agencies','a','conversations','free'), { agencyId:'a', assigneeId:null, accessUids:[] });
      await setDoc(doc(c.firestore(),'agencies','a','conversations','other'), { agencyId:'a', assigneeId:'someone-else', collaboratorIds:['agent'], accessUids:['someone-else','agent'] });
      await setDoc(doc(c.firestore(),'agencies','a','conversations','free','messages','m'), {text:'Unassigned'});
    });
    const own = env.authenticatedContext('agent').firestore();
    await assertSucceeds(getDoc(doc(own,'agencies','a','conversations','free')));
    await assertSucceeds(getDoc(doc(own,'agencies','a','conversations','free','messages','m')));
    await assertFails(getDoc(doc(own,'agencies','a','conversations','other')));
    await assertSucceeds(getDocs(query(collection(own,'agencies','a','conversations'), where('assigneeId','==','agent'))));
    await assertSucceeds(getDocs(query(collection(own,'agencies','a','conversations'), where('assigneeId','==',null))));
    await assertFails(getDocs(collection(own,'agencies','a','conversations')));
    await assertFails(getDoc(doc(env.authenticatedContext('foreign').firestore(),'agencies','a','conversations','free')));
    await assertFails(updateDoc(doc(own,'agencies','a','conversations','free'), {assigneeId:'agent',accessUids:['agent']}));
  });  it('prevents changing agency or escalating role', async () => {
    const db = env.authenticatedContext('agent').firestore();
    await assertFails(updateDoc(doc(db,'users','agent'), {role:'admin'}));
    await assertFails(updateDoc(doc(db,'users','agent'), {agencyId:'b'}));
    await assertSucceeds(updateDoc(doc(db,'users','agent'), {name:'Agent Name'}));
  });
  it('enforces server-managed messages and tenant boundaries', async () => {
    const own = env.authenticatedContext('agent').firestore(); const foreign = env.authenticatedContext('foreign').firestore();
    await assertSucceeds(getDoc(doc(own,'agencies','a','conversations','c','messages','m')));
    await assertFails(setDoc(doc(own,'agencies','a','conversations','c','messages','fake'), {text:'Forged'}));
    await assertFails(getDoc(doc(foreign,'agencies','a','conversations','c','messages','m')));
    await assertFails(setDoc(doc(own,'agencies','a','communicationBudgets','2026-09-EUR'), {limitMicros:999999}));
    await assertFails(getDoc(doc(own,'communicationSecrets','any')));
    await assertFails(setDoc(doc(own,'agencies','a','communicationPropertyShares','share'), {messageId:'fake'}));
    await assertFails(getDoc(doc(own,'agencies','a','communicationPropertyShares','share')));
  });
});
