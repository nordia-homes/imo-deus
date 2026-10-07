import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import { tikTokScheduleRevision } from './tiktok-schedule-revision';
import { confirmedStudioRender } from './tiktok-render-evidence';

/** Reconcile expired work without replaying provider calls or overwriting newer work. */
export async function recoverTikTokStudioJob(db: Firestore, ref: DocumentReference) {
  await db.runTransaction(async tx => {
    const fresh = await tx.get(ref), job = fresh.data();
    if (!job || job.status !== 'running' || Date.parse(job.leaseUntil) > Date.now()) return;
    const agency = db.collection('agencies').doc(job.agencyId);
    if (job.kind === 'publish') {
      const draftRef = agency.collection('tiktokPostDrafts').doc(job.draftId), snapshot = await tx.get(draftRef), draft = snapshot.data();
      tx.update(ref, { status: 'failed', error: 'Execuție întreruptă. Verifică starea TikTok înainte de orice reluare.' });
      // A provider identifier/terminal state is stronger evidence than an expired scheduler lease.
      if (draft && draft.agencyId === job.agencyId && draft.createdByUid === job.uid && draft.scheduleStatus === 'scheduled' && !draft.publishId && !['published', 'processing'].includes(draft.status) && job.draftRevision === tikTokScheduleRevision(draft)) tx.update(draftRef, { scheduleStatus: 'error', lastPublishError: 'Rezultat necunoscut. Verifică starea TikTok înainte de orice reluare.' });
      return;
    }
    const projectRef = agency.collection('tiktokStudioProjects').doc(job.projectId), projectDoc = await tx.get(projectRef), project = projectDoc.data();
    const sameVersion = project && project.agencyId === job.agencyId && project.ownerUid === job.uid && (project.version || 1) === job.version;
    const assetId = sameVersion && project.status === 'ready' && typeof project.outputAssetId === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(project.outputAssetId) ? project.outputAssetId : null;
    const asset = assetId ? (await tx.get(agency.collection('tiktokStudioAssets').doc(assetId))).data() : null;
    if (confirmedStudioRender({ agencyId: job.agencyId, uid: job.uid, projectId: job.projectId, version: job.version }, project, asset || undefined)) {
      tx.update(ref, { status: 'completed', completedAt: new Date().toISOString() }); return;
    }
    tx.update(ref, { status: 'failed', error: 'Randare întreruptă; materialul aceleiași versiuni nu este confirmat. Verifică înainte de reluare.' });
    // Preserve a newer project and a ready project whose asset needs investigation.
    if (sameVersion && project.status !== 'ready') tx.update(projectRef, { status: 'error', renderLeaseUntil: null, errorMessage: 'Randare întreruptă. Poți relua din proiect.' });
  });
}
