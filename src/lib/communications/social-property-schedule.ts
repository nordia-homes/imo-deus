import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Actor } from './model';
import { CommunicationError, nowIso } from './server';
import { connectionToken } from './meta';
import { drainSocial, validateInstagramPost } from './social';
import { socialCrmContentMatches, socialDraftRevision } from './social-content';
export async function schedulePropertySocialDraft(db: Firestore, actor: Actor, body: unknown) {
  const parsed = z.object({ postId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/), scheduledAt: z.string().datetime().optional(), immediate: z.literal(true).optional(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict().refine(value => value.immediate ? value.scheduledAt === undefined : value.scheduledAt !== undefined).parse(body);
  const input = { ...parsed, scheduledAt: parsed.immediate ? nowIso() : parsed.scheduledAt! };
  const agency = db.collection('agencies').doc(actor.agencyId), ref = agency.collection('socialPosts').doc(input.postId), job = db.collection('communicationSocialJobs').doc(input.postId);
  const original = (await ref.get()).data();
  if (!original || original.agencyId !== actor.agencyId || original.deletedAt || original.status !== 'draft' || original.contentSource !== 'crm' || socialDraftRevision(original) !== input.expectedRevision) throw new CommunicationError('Ciorna s-a schimbat; selecteaz-o din nou.', 409);
  const ids = Object.keys(original.destinations || {});
  if (ids.length !== 1) throw new CommunicationError('Selectează o ciornă cu un singur cont social.', 409);
  const { connection } = await connectionToken(db, actor, ids[0], 'publish');
  await db.runTransaction(async tx => {
    const profile = (await tx.get(db.collection('users').doc(actor.uid))).data();
    const post = (await tx.get(ref)).data();
    const previousJob = await tx.get(job);
    if (actor.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== actor.agencyId) throw new CommunicationError('Acces revocat.', 403);
    if (!post || post.deletedAt || post.agencyId !== actor.agencyId || post.status !== 'draft' || socialDraftRevision(post) !== input.expectedRevision || previousJob.exists) throw new CommunicationError('Ciorna sau jobul de publicare s-a schimbat.', 409);
    const property = (await tx.get(agency.collection('properties').doc(post.propertyId))).data();
    const account = (await tx.get(agency.collection('channelConnections').doc(ids[0]))).data();
    if (!property || property.status !== 'Activ' || property.agencyId && property.agencyId !== actor.agencyId || !socialCrmContentMatches(post, property)) throw new CommunicationError('Datele CRM s-au schimbat. Creează o ciornă actualizată.', 409);
    if (!account || account.agencyId !== actor.agencyId || account.deletedAt || account.status !== 'connected' || account.capabilities?.publish?.status !== 'active' || !['messenger', 'instagram'].includes(account.channel) || account.channel !== connection.channel || account.externalId !== connection.externalId || post.destinations[ids[0]].channel !== account.channel) throw new CommunicationError('Contul social nu mai este disponibil.', 409);
    if (!input.immediate && Date.parse(input.scheduledAt) < Date.now() + 60000) throw new CommunicationError('Ora programată nu mai este în viitor.', 409);
    if (account.channel === 'instagram') validateInstagramPost(post.text, post.images);
    tx.update(ref, { status: 'queued', scheduledAt: input.scheduledAt, createdBy: actor.uid, updatedAt: nowIso(), destinations: { [ids[0]]: { ...post.destinations[ids[0]], status: 'queued' } } });
    tx.create(job, { agencyId: actor.agencyId, postId: input.postId, status: 'queued', scheduledAt: input.scheduledAt });
  });
  if (input.immediate) {
    await drainSocial(db, { postId: input.postId, agencyId: actor.agencyId });
    return db.runTransaction(async tx => {
      const saved = (await tx.get(ref)).data(), queued = (await tx.get(job)).data();
      if (!saved || saved.agencyId !== actor.agencyId || queued?.agencyId !== actor.agencyId || queued.postId !== input.postId) throw new CommunicationError('Rezultatul publicării nu poate fi verificat.', 409);
      const destinations = Object.values(saved.destinations || {}) as Record<string, any>[];
      const published = saved.status === 'published' && queued.status === 'completed' && destinations.length === 1 && destinations.every(row => row.status === 'published' && typeof row.externalId === 'string' && /^[0-9]+(?:_[0-9]+)?$/.test(row.externalId));
      return { operation: 'social_publish', postId: input.postId, immediate: true, executionState: published ? 'succeeded' : ['queued', 'processing'].includes(saved.status) ? 'processing' : 'unknown', publicationConfirmed: published, externalIds: published ? destinations.map(row => row.externalId) : [], evidenceSource: 'persisted_worker_result' };
    });
  }
  return db.runTransaction(async tx => {
    const saved = (await tx.get(ref)).data(), queued = (await tx.get(job)).data();
    if (saved?.status !== 'queued' || saved.scheduledAt !== input.scheduledAt || queued?.status !== 'queued' || queued.scheduledAt !== input.scheduledAt || queued.agencyId !== actor.agencyId || queued.postId !== input.postId) throw new CommunicationError('Programarea persistată nu este confirmată.', 409);
    return { operation: 'social_publish', postId: input.postId, scheduledAt: input.scheduledAt, executionState: 'queued', schedulingConfirmed: true, publicationConfirmed: false, evidenceSource: 'persisted_post_and_job' };
  });
}