import fs from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('assistant server-managed records', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-imodeus-ai-assistant', firestore: { rules: fs.readFileSync('src/firestore.rules', 'utf8') } });
    await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'users', 'agent'), { agencyId: 'a', role: 'agent' }); await setDoc(doc(c.firestore(), 'users', 'admin'), { agencyId: 'a', role: 'admin' }); await setDoc(doc(c.firestore(), 'users', 'other'), { agencyId: 'b', role: 'agent' }); });
  });
  afterAll(async () => { await env?.cleanup(); });
  it.each(['agent', 'admin', 'other'])('refuses direct feedback writes for %s', async actor => {
    await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'users', actor, 'notifications', 'feedback'), { recipientId: actor, agencyId: actor === 'other' ? 'b' : 'a', type: 'ai_assistant', isRead: false }); });
    const db = env.authenticatedContext(actor).firestore();
    await assertFails(updateDoc(doc(db, 'users', actor, 'notifications', 'feedback'), { feedback: { value: 'useful', revision: 1, updatedAt: '2026-10-07T10:00:00Z' } }));
  });
  it.each(['agent', 'admin', 'other'])('blocks forged histories, plans, consent, artifacts and jobs for %s', async actor => {
    const db = env.authenticatedContext(actor).firestore();
    for (const collection of ['assistantSessions', 'assistantPlans', 'assistantExecutions', 'assistantDeletedRecords', 'assistantVoiceUsage', 'assistantVoiceTelemetry', 'assistantLocks', 'assistantAutomations', 'assistantNotificationState', 'assistantArtifacts', 'assistantUploads', 'assistantUploadBudgets', 'crmProjectionCheckpoints', 'crmEvents', 'assistantMemory', 'assistantResultSets', 'assistantTelemetry', 'assistantPolicies', 'communicationConsents']) {
      await assertFails(setDoc(doc(db, 'agencies', 'a', collection, 'fake'), { ownerId: 'agent', status: 'completed' }));
      await assertFails(getDoc(doc(db, 'agencies', 'a', collection, 'fake')));
    }
    await assertFails(setDoc(doc(db, 'assistantAutomationJobs', 'fake'), { status: 'active' }));
    await assertFails(setDoc(doc(db, 'assistantAgentJobs', 'fake'), { status: 'running' }));
  });
});
