import { createHash, randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { defaultFacebookGroups, filterFacebookGroupsForProperty } from './facebook-groups';
import { facebookControlError, assertFacebookPropertyAvailable } from './facebook-job-control';
import type { FacebookCloudPublishingJob, FacebookGroup, Property } from './types';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
export const facebookCreateSchema = z.object({ propertyId: id, connectionId: id, groupUrls: z.array(z.string().url()).min(1).max(200), scheduledAt: z.string().datetime({ offset: true }).nullable().optional(), requestId: z.string().uuid().optional() }).strict();
type Runner = (path: string, options: { method: string; body: string }) => Promise<{ job: FacebookCloudPublishingJob }>;
// Retry only an aborted database reservation, never the external runner call.
export async function reserveFacebookTransaction<T>(db: Firestore, work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.runTransaction(work); }
    catch (error) {
      const closed = error && typeof error === 'object' && 'code' in error && error.code === 3 && 'message' in error && /Transaction is invalid or closed/.test(String(error.message));
      if (!closed || attempt >= 2) throw error;
    }
  }
}
export async function createFacebookJob(db: Firestore, agencyId: string, uid: string, raw: unknown, runner: Runner) {
  const parsed = facebookCreateSchema.safeParse(raw);
  if (!parsed.success) facebookControlError('Datele jobului Facebook nu sunt valide.', 400);
  const input = parsed.data, groupUrls = [...new Set(input.groupUrls)].sort();
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
  const hash = createHash('sha256').update(JSON.stringify({ propertyId: input.propertyId, connectionId: input.connectionId, groupUrls, scheduledAt })).digest('hex');
  const agency = db.collection('agencies').doc(agencyId), jobs = agency.collection('facebookCloudPublishingJobs');
  const ref = jobs.doc(input.requestId ? createHash('sha256').update(uid + ':' + input.requestId).digest('hex') : randomUUID());
  const reserved = await reserveFacebookTransaction(db, async tx => {
    const profile = (await tx.get(db.collection('users').doc(uid))).data();
    if (!profile || profile.agencyId !== agencyId || !['agent', 'admin'].includes(profile.role)) facebookControlError('Acces revocat.', 403);
    const existing = await tx.get(ref);
    if (existing.exists) {
      const row = existing.data()!;
      if (row.ownerUid !== uid || row.agencyId !== agencyId || row.creationHash !== hash) facebookControlError('Identificatorul cererii aparține altei comenzi.');
      return { job: { ...row, id: ref.id } as FacebookCloudPublishingJob, property: null, created: false };
    }
    if (scheduledAt && (Date.parse(scheduledAt) < Date.now() + 60_000 || Date.parse(scheduledAt) > Date.now() + 366 * 86400000)) facebookControlError('Programarea trebuie să fie între un minut și un an în viitor.', 400);
    const connection = (await tx.get(agency.collection('facebookCloudConnections').doc(input.connectionId))).data();
    if (!connection || connection.ownerUid !== uid || connection.agencyId !== agencyId || connection.deletedAt) facebookControlError('Contul Facebook nu este accesibil.', 403);
    if (connection.status !== 'connected') facebookControlError('Contul Facebook trebuie reconectat înainte de programare.');
    if (connection.runnerMode === 'local') {
      if (typeof connection.deviceId !== 'string' || !id.safeParse(connection.deviceId).success) facebookControlError('Laptopul asociat lipsește.');
      const device = (await tx.get(agency.collection('facebookLocalRunnerDevices').doc(connection.deviceId))).data();
      if (!device || device.ownerUid !== uid || device.revokedAt) facebookControlError('Laptopul asociat nu mai este disponibil pentru cont.');
    }
    const propertySnapshot = await tx.get(agency.collection('properties').doc(input.propertyId)), agencySnapshot = await tx.get(agency);
    if (!propertySnapshot.exists || !agencySnapshot.exists) facebookControlError('Proprietatea sau agenția nu există.', 404);
    const property = { ...propertySnapshot.data(), id: propertySnapshot.id } as Property;
    assertFacebookPropertyAvailable(propertySnapshot.data(), agencyId);
    const stored = agencySnapshot.data()!.facebookGroups;
    const eligible = filterFacebookGroupsForProperty(Array.isArray(stored) && stored.length ? stored as FacebookGroup[] : defaultFacebookGroups, property.transactionType);
    const groups = groupUrls.map(url => eligible.find(group => group.url === url));
    if (groups.some(group => !group)) facebookControlError('Un grup nu mai este eligibil pentru proprietate.', 400);
    const active = await tx.get(jobs.where('ownerUid', '==', uid));
    if (active.docs.some(doc => { const job = doc.data(); return job.propertyId === input.propertyId && job.connectionId === input.connectionId && (['scheduled', 'queued', 'running', 'cooldown', 'error', 'needs_reauthentication'].includes(job.status) || ['pending', 'unknown'].includes(job.dispatchState)); })) facebookControlError('Există deja un job activ sau cu expediere neconfirmată pentru această proprietate și acest cont.');
    const timestamp = new Date().toISOString();
    const job = { id: ref.id, agencyId, ownerUid: uid, connectionId: input.connectionId, connectionLabel: connection.label || connection.displayName || 'Cont Facebook', runnerMode: connection.runnerMode === 'local' ? 'local' : 'cloud', deviceId: connection.runnerMode === 'local' ? connection.deviceId : null, propertyId: input.propertyId, propertyTitle: property.title || 'Proprietate', status: scheduledAt ? 'scheduled' : 'queued', groups: groups.map(group => ({ ...group!, status: 'queued' })), currentGroupIndex: 0, scheduledAt, nextRunAt: null, createdAt: timestamp, updatedAt: timestamp, creationHash: hash, dispatchState: connection.runnerMode === 'local' ? 'local' : 'pending' };
    tx.create(ref, job);
    return { job: job as FacebookCloudPublishingJob, property, created: true };
  });
  if (!reserved.created && ['pending', 'unknown'].includes(String((reserved.job as any).dispatchState))) facebookControlError('Expedierea acestui job nu este confirmată; verifică runnerul fără retrimitere.');
  if (!reserved.created || reserved.job.runnerMode === 'local') return { job: reserved.job, created: reserved.created };
  // A cloud POST is made once, outside transaction retries. Pending/unknown remains a duplicate fence.
  try {
    const job = reserved.job, property = reserved.property!;
    const result = await runner('/v1/jobs', { method: 'POST', body: JSON.stringify({ id: job.id, agencyId, ownerUid: uid, connectionId: job.connectionId, propertyId: property.id, propertyTitle: property.title || '', propertyDescription: property.description || '', propertyImages: property.images || [], groups: job.groups.map(({ name, url }) => ({ name, url })), scheduledAt }) });
    const received = result?.job;
    if (!received || received.id !== job.id || received.agencyId !== agencyId || received.ownerUid !== uid || received.propertyId !== job.propertyId || received.connectionId !== job.connectionId || (received.scheduledAt || null) !== scheduledAt || !Array.isArray(received.groups) || received.groups.map(group => group.url).sort().join('\n') !== groupUrls.join('\n') || !['scheduled', 'queued', 'running', 'cooldown', 'completed', 'error', 'needs_reauthentication'].includes(received.status)) facebookControlError('Runnerul nu a confirmat jobul cerut.');
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref), current = snapshot.data();
      if (!current || current.creationHash !== hash || current.dispatchState !== 'pending' || current.status !== job.status || current.updatedAt !== job.updatedAt) facebookControlError('Jobul s-a schimbat în timpul expedierii; verifică starea.');
      // Keep group evidence for reconciliation; do not trust arbitrary provider fields.
      const allowed = ['queued', 'publishing', 'submitted', 'pending_approval', 'needs_reauthentication', 'error', 'skipped', 'uncertain'];
      if (received.groups.some(group => !allowed.includes(group.status))) facebookControlError('Stare de grup neconfirmată.');
      tx.update(ref, { status: received.status, groups: job.groups.map(group => ({ ...group, status: received.groups.find(row => row.url === group.url)!.status })), dispatchState: 'accepted', updatedAt: new Date().toISOString() });
    });
    return { job: { ...(await ref.get()).data(), id: ref.id } as FacebookCloudPublishingJob, created: true };
  } catch {
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.dispatchState === 'pending') tx.update(ref, { dispatchState: 'unknown', ...(current.status === reserved.job.status ? { status: 'error' } : {}), errorMessage: 'Expediere cloud neconfirmată. Verifică runnerul înainte de o nouă publicare.', updatedAt: new Date().toISOString() });
    });
    facebookControlError('Crearea jobului cloud nu este confirmată. Nu retrimite automat; verifică jobul ' + ref.id + '.', 409);
  }
}
