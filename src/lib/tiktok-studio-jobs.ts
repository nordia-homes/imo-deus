import { randomUUID } from 'node:crypto';
import { adminDb } from '@/firebase/admin';
import { renderTikTokStudioProject, publishTikTokPostDraft } from './tiktok-marketing';

const jobs = () => adminDb.collection('tiktokStudioJobs');

export async function enqueueStudioRender(agencyId: string, uid: string, projectId: string) {
  const projectRef = adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioProjects').doc(projectId);
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(projectRef);
    const project = snapshot.data();
    if (!project || project.agencyId !== agencyId || project.ownerUid !== uid) throw new Error('Proiectul nu aparține utilizatorului curent.');
    if (!project.propertyId || !project.script?.trim() || project.sourceAssetIds?.length < 2) throw new Error('Completează proprietatea, scenariul și minimum două fotografii.');
    const id = `${agencyId}_${projectId}_v${project.version || 1}`;
    const ref = jobs().doc(id);
    const previous = await tx.get(ref);
    if (previous.exists && ['queued', 'running', 'completed'].includes(previous.data()?.status)) return { jobId: id, status: previous.data()!.status };
    tx.set(ref, { kind: 'render', agencyId, projectId, version: project.version || 1, uid, status: 'queued', runAt: new Date().toISOString(), createdAt: new Date().toISOString(), leaseUntil: null });
    tx.update(projectRef, { status: 'queued', renderProgress: 'În așteptare', errorMessage: null, updatedAt: new Date().toISOString() });
    return { jobId: id, status: 'queued' };
  });
}

// Durable work is picked up by the existing shared TikTok scheduler. Failed
// renders require an explicit retry; an unknown TTS outcome is never retried silently.
export async function drainStudioRenders() {
  const expired = await jobs().where('status', '==', 'running').limit(20).get();
  for (const doc of expired.docs) {
    if (Date.parse(doc.data().leaseUntil || '') > Date.now()) continue;
    await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const job = fresh.data();
      if (!job || job.status !== 'running' || Date.parse(job.leaseUntil) > Date.now()) return;
      if (job.kind !== 'publish') {
        const project = await tx.get(adminDb.collection('agencies').doc(job.agencyId).collection('tiktokStudioProjects').doc(job.projectId));
        if (project.data()?.status === 'ready') { tx.update(doc.ref, { status: 'completed', completedAt: new Date().toISOString() }); return; }
      }
      tx.update(doc.ref, { status: 'failed', error: 'Randare întreruptă. Verifică rezultatele și reîncearcă.' });
      if (job.kind !== 'publish') tx.update(adminDb.collection('agencies').doc(job.agencyId).collection('tiktokStudioProjects').doc(job.projectId), { status: 'error', renderLeaseUntil: null, errorMessage: 'Randare întreruptă. Poți relua din proiect.' });
      else tx.update(adminDb.collection('agencies').doc(job.agencyId).collection('tiktokPostDrafts').doc(job.draftId), { scheduleStatus: 'error', lastPublishError: 'Rezultat necunoscut. Verifică starea TikTok înainte de orice reluare.' });
    });
  }
  const pending = await jobs().where('status', '==', 'queued').where('runAt', '<=', new Date().toISOString()).orderBy('runAt').limit(1).get();
  for (const doc of pending.docs) {
    const owner = randomUUID();
    const job = await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(doc.ref);
      if (current.data()?.status !== 'queued') return null;
      tx.update(doc.ref, { status: 'running', owner, leaseUntil: new Date(Date.now() + 15 * 60_000).toISOString() });
      return current.data()!;
    });
    if (!job) continue;
    try {
      let complete = true;
      const actor = await adminDb.collection('users').doc(job.uid).get();
      if (actor.data()?.agencyId !== job.agencyId) throw new Error('Autorul nu mai este membru al agenției.');
      if (job.kind === 'publish') {
        await publishTikTokPostDraft({ agencyId: job.agencyId, draftId: job.draftId, requestedByUid: job.uid });
        await adminDb.collection('agencies').doc(job.agencyId).collection('tiktokPostDrafts').doc(job.draftId).update({ scheduleStatus: 'sent' });
      } else {
        const rendered = await renderTikTokStudioProject({ agencyId: job.agencyId, projectId: job.projectId, requestedByUid: job.uid, expectedVersion: job.version, maxVariants: 1 });
        complete = rendered.project.status === 'ready';
      }
      await adminDb.runTransaction(async tx => {
        const current = await tx.get(doc.ref);
        if (current.data()?.owner !== owner || current.data()?.status !== 'running') return;
        tx.update(doc.ref, { status: complete ? 'completed' : 'queued', completedAt: complete ? new Date().toISOString() : null, runAt: new Date().toISOString(), leaseUntil: null });
      });
    } catch (error) {
      await adminDb.runTransaction(async tx => {
        const current = await tx.get(doc.ref);
        if (current.data()?.owner !== owner || current.data()?.status !== 'running') return;
        const projectRef = job.kind !== 'publish' ? adminDb.collection('agencies').doc(job.agencyId).collection('tiktokStudioProjects').doc(job.projectId) : null;
        const project = projectRef ? await tx.get(projectRef) : null;
        const message = error instanceof Error ? error.message : 'Randare eșuată';
        tx.update(doc.ref, { status: 'failed', error: message });
        if (projectRef && project?.exists && project.data()?.status !== 'ready') tx.update(projectRef, { status: 'error', renderLeaseUntil: null, errorMessage: message });
      });
      if (job.kind === 'publish') await adminDb.collection('agencies').doc(job.agencyId).collection('tiktokPostDrafts').doc(job.draftId).update({ scheduleStatus: 'error' });
    }
  }
  return { processed: pending.size };
}

export async function scheduleTikTokPost(agencyId: string, uid: string, draftId: string, runAt: string) {
  if (!Number.isFinite(Date.parse(runAt)) || Date.parse(runAt) < Date.now() + 60000) throw new Error('Alege o dată viitoare pentru publicare.');
  const ref = adminDb.collection('agencies').doc(agencyId).collection('tiktokPostDrafts').doc(draftId);
  await adminDb.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const draft = snapshot.data();
    if (!draft || draft.createdByUid !== uid || draft.agencyId !== agencyId || draft.status !== 'draft' || draft.publishId || draft.publishOutcomeUnknown) throw new Error('Postarea nu poate fi programată de acest utilizator.');
    const jobRef = jobs().doc(`publish_${agencyId}_${draftId}`);
    const previous = await tx.get(jobRef);
    if (previous.exists && !['queued', 'canceled'].includes(previous.data()?.status)) throw new Error('Publicarea a pornit deja. Verifică starea ei.');
    tx.set(jobRef, { kind: 'publish', agencyId, uid, draftId, runAt: new Date(runAt).toISOString(), status: 'queued', createdAt: new Date().toISOString() });
    tx.update(ref, { scheduledAt: new Date(runAt).toISOString(), scheduleStatus: 'scheduled' });
  });
  return { scheduled: true };
}

export async function cancelScheduledTikTokPost(agencyId: string, uid: string, draftId: string) {
  const draftRef = adminDb.collection('agencies').doc(agencyId).collection('tiktokPostDrafts').doc(draftId);
  const jobRef = jobs().doc(`publish_${agencyId}_${draftId}`);
  await adminDb.runTransaction(async tx => {
    const draft = await tx.get(draftRef);
    const job = await tx.get(jobRef);
    if (draft.data()?.createdByUid !== uid || draft.data()?.agencyId !== agencyId || job.data()?.status !== 'queued') throw new Error('Programarea nu mai poate fi anulată. Verifică dacă publicarea a pornit.');
    tx.update(jobRef, { status: 'canceled', canceledAt: new Date().toISOString() });
    tx.update(draftRef, { scheduledAt: null, scheduleStatus: 'none', updatedAt: new Date().toISOString() });
  });
  return { canceled: true };
}
