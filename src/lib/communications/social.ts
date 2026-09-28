import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { stableId } from './crypto';
import { agencyCollection, CommunicationError, nowIso } from './server';
import { connectionToken, graph } from './meta';
import type { Actor } from './model';

export function propertyImageUrls(images: Array<{ url?: string }> = []) {
  return [...new Set(images.map(image => image?.url).filter((url): url is string => typeof url === 'string' && /^https:\/\//.test(url)))];
}
export function selectPostImages(available: string[], selected?: string[]) {
  if (selected === undefined) return available;
  if (new Set(selected).size !== selected.length || selected.some(url => !available.includes(url))) {
    throw new CommunicationError('Selectează doar fotografii distincte care aparțin proprietății.');
  }
  return selected;
}
export function validateInstagramPost(text: string, images: string[]) {
  if (!images.length) throw new CommunicationError('Instagram necesită cel puțin o fotografie.');
  if (text.length > 2200 || images.length > 10) throw new CommunicationError('Instagram acceptă prin API cel mult 2.200 de caractere și 10 fotografii. Editează postarea sau publică doar pe Facebook.');
}
export async function createSocialPost(db: Firestore, actor: Actor, body: unknown) {
  const input = z.object({ requestId: z.string().uuid(), connectionIds: z.array(z.string()).min(1).max(10), propertyId: z.string().min(1), text: z.string().trim().min(1), scheduledAt: z.string().datetime().optional(), draft: z.boolean().default(false), imageUrls: z.array(z.string().url()).optional() }).parse(body);
  const property = await agencyCollection(db, actor.agencyId, 'properties').doc(input.propertyId).get();
  if (!property.exists || property.data()?.status !== 'Activ') throw new CommunicationError('Publicarea necesită o proprietate activă.');
  const p = property.data()!;
  const images = selectPostImages(propertyImageUrls(p.images || []), input.imageUrls);
  const scheduledAt = input.scheduledAt || nowIso();
  if (Date.parse(scheduledAt) < Date.now() - 60000) throw new CommunicationError('Alege o dată viitoare.');
  const destinations: Record<string, unknown> = {};
  for (const id of [...new Set(input.connectionIds)]) {
    const { connection } = await connectionToken(db, actor, id, 'publish');
    if (!['messenger', 'instagram'].includes(connection.channel)) throw new CommunicationError('Destinație de publicare invalidă.');
    if (connection.channel === 'instagram') validateInstagramPost(input.text, images);
    destinations[id] = { connectionId: id, channel: connection.channel, status: input.draft ? 'draft' : 'queued', attempts: 0 };
  }
  const id = stableId(actor.agencyId, input.requestId);
  const ref = agencyCollection(db, actor.agencyId, 'socialPosts').doc(id);
  const data = { agencyId: actor.agencyId, propertyId: input.propertyId, text: input.text, images, propertyPrice: p.price ?? null, propertyTitle: p.title || '',
    createdBy: actor.uid, createdAt: nowIso(), scheduledAt, status: input.draft ? 'draft' : 'queued', destinations };
  await db.runTransaction(async tx => {
    const previous = await tx.get(ref); if (previous.exists) return;
    tx.create(ref, data);
    if (!input.draft) tx.create(db.collection('communicationSocialJobs').doc(id), { agencyId: actor.agencyId, postId: id, status: 'queued', scheduledAt });
  });
  return { id };
}
export async function drainSocial(db: Firestore) {
  const jobs = await db.collection('communicationSocialJobs').where('status', '==', 'queued').where('scheduledAt', '<=', nowIso()).orderBy('scheduledAt').limit(3).get();
  for (const job of jobs.docs) {
    if (job.data().scheduledAt > nowIso()) continue;
    const ref = agencyCollection(db, job.data().agencyId, 'socialPosts').doc(job.id);
    const claim = await db.runTransaction(async tx => {
      const [fresh, post] = await Promise.all([tx.get(job.ref), tx.get(ref)]);
      if (post.data()?.status === 'cancelled' && fresh.data()?.status === 'queued') { tx.update(job.ref, { status: 'cancelled' }); return false; }
      if (fresh.data()?.status !== 'queued' || !['queued', 'processing'].includes(post.data()?.status)) return false;
      tx.update(job.ref, { status: 'processing', startedAt: nowIso() });
      tx.update(ref, { status: 'processing' });
      return true;
    });
    if (!claim) continue;
    const post = (await ref.get()).data()!;
    const property = await agencyCollection(db, post.agencyId, 'properties').doc(post.propertyId).get();
    const author = await db.collection('users').doc(post.createdBy).get();
    if (post.status === 'cancelled' || !property.exists || property.data()?.status !== 'Activ' || (property.data()?.price ?? null) !== post.propertyPrice || post.images.some((url: string) => !propertyImageUrls(property.data()?.images || []).includes(url)) || author.data()?.agencyId !== post.agencyId || author.data()?.role !== 'admin') {
      await ref.update({ status: 'needs_review', error: 'Proprietatea, aprobarea sau accesul s-a schimbat.' }); await job.ref.update({ status: 'blocked' }); continue;
    }
    let pending = false; let failed = false;
    for (const [id, destination] of Object.entries(post.destinations) as Array<[string, any]>) {
      if (destination.status === 'published') continue;
      let attempted = false;
      try {
        const { connection, token } = await connectionToken(db, { agencyId: post.agencyId }, id, 'publish');
        if (connection.channel === 'instagram') {
          if (!destination.containerId) {
            const children = [];
            if (post.images.length > 1) for (const url of post.images) { const child = await graph(`/${connection.externalId}/media`, token, { image_url: url, is_carousel_item: true }); children.push(child.id); }
            const container = await graph(`/${connection.externalId}/media`, token, post.images.length > 1 ? { media_type: 'CAROUSEL', children, caption: post.text } : { image_url: post.images[0], caption: post.text });
            await ref.update({ [`destinations.${id}.containerId`]: container.id, [`destinations.${id}.status`]: 'processing' }); pending = true; continue;
          }
          const container = await graph(`/${destination.containerId}?fields=status_code`, token);
          if (container.status_code === 'IN_PROGRESS') { pending = true; continue; }
          if (container.status_code !== 'FINISHED') throw new CommunicationError('Instagram nu a procesat materialul.');
          attempted = true;
          const published = await graph(`/${connection.externalId}/media_publish`, token, { creation_id: destination.containerId });
          await ref.update({ [`destinations.${id}.status`]: 'published', [`destinations.${id}.externalId`]: published.id, [`destinations.${id}.publishedAt`]: nowIso() });
        } else {
          const photoIds = [];
          for (const url of post.images) { const photo = await graph(`/${connection.externalId}/photos`, token, { url, published: false }); photoIds.push({ media_fbid: photo.id }); }
          attempted = true;
          const published = await graph(`/${connection.externalId}/feed`, token, { message: post.text, ...(photoIds.length ? { attached_media: photoIds } : {}) });
          await ref.update({ [`destinations.${id}.status`]: 'published', [`destinations.${id}.externalId`]: published.id, [`destinations.${id}.publishedAt`]: nowIso() });
        }
      } catch (error) {
        failed = true;
        await ref.update({ [`destinations.${id}.status`]: attempted ? 'unknown' : 'failed', [`destinations.${id}.error`]: error instanceof Error ? error.message : 'Publicarea a eșuat.' });
      }
    }
    await ref.update({ status: failed ? 'needs_review' : pending ? 'processing' : 'published' });
    await job.ref.update({ status: failed ? 'blocked' : pending ? 'queued' : 'completed' });
  }
  return jobs.size;
}

export async function publishDraft(db: Firestore, actor: Actor, id: string) {
  const ref = agencyCollection(db, actor.agencyId, 'socialPosts').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const post = snap.data();
    if (!post || post.status !== 'draft') throw new CommunicationError('Numai drafturile pot fi publicate prin această acțiune.');
    const property = await tx.get(agencyCollection(db, actor.agencyId, 'properties').doc(post.propertyId));
    if (property.data()?.status !== 'Activ' || (property.data()?.price ?? null) !== post.propertyPrice || post.images.some((url: string) => !propertyImageUrls(property.data()?.images || []).includes(url))) throw new CommunicationError('Proprietatea s-a modificat; creează o postare actualizată.');
    if (Object.values(post.destinations).some((value: any) => value.channel === 'instagram')) validateInstagramPost(post.text, post.images);
    const scheduledAt = post.scheduledAt > nowIso() ? post.scheduledAt : nowIso();
    tx.update(ref, { status: 'queued', scheduledAt, createdBy: actor.uid, destinations: Object.fromEntries(Object.entries(post.destinations).map(([key, value]) => [key, { ...(value as object), status: 'queued' }])) });
    tx.set(db.collection('communicationSocialJobs').doc(id), { agencyId: actor.agencyId, postId: id, status: 'queued', scheduledAt });
  });
  return { queued: true };
}
export async function postInteraction(db: Firestore, actor: Actor, postId: string, connectionId: string, action: 'comments' | 'insights', text?: string) {
  const snap = await agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId).get();
  const destination = snap.data()?.destinations?.[connectionId];
  if (!destination?.externalId || destination.status !== 'published') throw new CommunicationError('Postarea nu este publicată pe contul ales.');
  const { connection, token } = await connectionToken(db, actor, connectionId, action);
  const instagram = connection.channel === 'instagram';
  const id = destination.externalId;
  if (action === 'insights') return graph(`/${id}?fields=${instagram ? 'like_count,comments_count,permalink' : 'likes.summary(true),comments.summary(true),shares,permalink_url'}`, token);
  if (text !== undefined) {
    const message = z.string().trim().min(1).max(2000).parse(text);
    return graph(`/${id}/comments`, token, { message });
  }
  return graph(`/${id}/comments?fields=${instagram ? 'id,text,username,timestamp' : 'id,message,from,created_time'}&limit=50`, token);
}
