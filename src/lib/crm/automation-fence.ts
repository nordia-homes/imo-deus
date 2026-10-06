import type { Firestore, Transaction } from 'firebase-admin/firestore';
export type AutomationFence = { jobId: string; claimId: string };
export async function assertAutomationFence(db: Firestore, tx: Transaction, actor: { uid: string; agencyId: string; role?: string; automationFence?: AutomationFence; agentJobFence?: AutomationFence }) {
  if (actor.agentJobFence) {
    const [job, member] = await Promise.all([tx.get(db.collection('assistantAgentJobs').doc(actor.agentJobFence.jobId)), tx.get(db.collection('users').doc(actor.uid))]);
    const row = job.data();
    if (!row || row.claimId !== actor.agentJobFence.claimId || row.status !== 'running' || row.leaseUntil <= Date.now() || row.userId !== actor.uid || row.agencyId !== actor.agencyId || row.role !== actor.role || member.data()?.agencyId !== actor.agencyId || member.data()?.role !== actor.role) throw Object.assign(new Error('Execuția workerului a fost înlocuită sau accesul a fost revocat.'), { status: 409 });
  }
  if (!actor.automationFence) return;
  const [job, member] = await Promise.all([tx.get(db.collection('assistantAutomationJobs').doc(actor.automationFence.jobId)), tx.get(db.collection('users').doc(actor.uid))]);
  const row = job.data();
  if (!row || row.claimId !== actor.automationFence.claimId || row.status !== 'running' || row.leaseUntil <= Date.now() || row.actorId !== actor.uid || row.agencyId !== actor.agencyId || row.actorRole !== actor.role || member.data()?.agencyId !== actor.agencyId || member.data()?.role !== actor.role) {
    throw Object.assign(new Error('Execuția automatizării a fost oprită, înlocuită sau accesul a fost revocat.'), { status: 409 });
  }
}
