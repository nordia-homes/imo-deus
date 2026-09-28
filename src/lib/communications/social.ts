import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { stableId } from './crypto';
import { agencyCollection, CommunicationError, nowIso } from './server';
import { connectionToken, graph, graphDelete, refreshPageToken } from './meta';
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
export async function removePublishedSocialPost(db: Firestore, actor: Actor, postId: string, connectionId: string, remote: boolean) {
  const ref = agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId);
  const snap = await ref.get();
  const post = snap.data();
  const destination = post?.destinations?.[connectionId];
  if (!destination?.externalId || destination.status !== 'published') throw new CommunicationError('Postarea nu mai este marcată ca publicată pe acest cont.', 409);
  if (remote) {
    if (destination.channel !== 'messenger') throw new CommunicationError('Ștergerea directă este disponibilă doar pentru postările Facebook.', 400);
    const { connection, token } = await connectionToken(db, actor, connectionId, 'publish');
    if (connection.channel !== 'messenger' || !new RegExp('^' + connection.externalId + '_\\d+$').test(destination.externalId)) {
      throw new CommunicationError('ID-ul postării nu aparține paginii Facebook conectate.', 409);
    }
    await graphDelete('/' + destination.externalId, token);
  }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    const data = current.data();
    const entry = data?.destinations?.[connectionId];
    if (!entry || entry.externalId !== destination.externalId || entry.status !== 'published') {
      throw new CommunicationError('Starea postării s-a schimbat. Actualizează istoricul.', 409);
    }
    const destinations = { ...data.destinations, [connectionId]: { ...entry, status: 'deleted', deletedAt: nowIso(), deletedBy: actor.uid, removal: remote ? 'meta' : 'confirmed_external' } };
    const statuses = Object.values(destinations).map((value: any) => value.status);
    tx.update(ref, { destinations, status: statuses.every(status => status === 'deleted') ? 'deleted' : statuses.includes('published') ? 'published' : 'needs_review', updatedAt: nowIso() });
  });
  return { deleted: true };
}
async function socialRead<T = Record<string, any>>(
  db: Firestore, actor: Pick<Actor, 'agencyId'>, connection: Awaited<ReturnType<typeof connectionToken>>['connection'],
  token: string, path: string,
): Promise<T> {
  try {
    return await graph<T>(path, token);
  } catch (error) {
    if (!(error instanceof CommunicationError) || !/unsupported get request|missing permissions|does not exist/i.test(error.message)) throw error;
    // A Page token stored before a new permission grant can be stale even when the app has that permission.
    const refreshedToken = await refreshPageToken(db, actor, connection);
    try {
      return await graph<T>(path, refreshedToken);
    } catch (retryError) {
      if (!(retryError instanceof CommunicationError)) throw retryError;
      const channel = connection.channel === 'instagram' ? 'Instagram' : 'Facebook';
      throw new CommunicationError('Meta nu poate citi postarea ' + channel + ' nici după reîmprospătarea tokenului paginii. ' + retryError.message, retryError.status);
    }
  }
}
async function socialGraph<T = Record<string, any>>(path: string, token: string, body?: Record<string, unknown>): Promise<T> {
  return graph<T>(path, token, body);
}
export async function diagnoseSocialPost(db: Firestore, actor: Actor, postId: string, connectionId: string) {
  const snap = await agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId).get();
  const destination = snap.data()?.destinations?.[connectionId];
  if (!destination?.externalId || destination.status !== 'published') throw new CommunicationError('Postarea nu este publicată pe contul ales.', 404);
  const { connection, token } = await connectionToken(db, actor, connectionId, 'comments');
  if (!['messenger', 'instagram'].includes(connection.channel)) throw new CommunicationError('Canal invalid.', 400);
  const instagram = connection.channel === 'instagram';
  const pageId = instagram ? connection.parentId : connection.externalId;
  const required = instagram
    ? ['pages_read_engagement', 'instagram_basic', 'instagram_manage_comments']
    : ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'];
  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
  const probe = async <T>(path: string, accessToken: string) => {
    try { return { data: await graph<T>(path, accessToken), error: null }; }
    catch (cause) { return { data: null, error: cause instanceof Error ? cause.message : 'Cerere Meta eșuată.' }; }
  };
  const [identity, debug, listing, object] = await Promise.all([
    probe<{ id: string }>('/me?fields=id', token),
    appId && appSecret ? probe<{ data: { app_id?: string; is_valid?: boolean; type?: string; scopes?: string[] } }>(
      '/debug_token?input_token=' + encodeURIComponent(token), appId + '|' + appSecret,
    ) : Promise.resolve({ data: null, error: 'Cheile aplicației Meta lipsesc de pe server.' }),
    probe<{ data?: Array<{ id: string }> }>(
      instagram ? '/' + connection.externalId + '/media?fields=id&limit=100' : '/' + connection.externalId + '/posts?fields=id&limit=100', token,
    ),
    probe<{ id: string }>('/' + destination.externalId + '?fields=id', token),
  ]);
  const tokenInfo = debug.data?.data;
  const grantedScopes = tokenInfo?.scopes || [];
  const missingScopes = tokenInfo ? required.filter(scope => !grantedScopes.includes(scope)) : null;
  let conclusion = 'Meta respinge citirea directă a postării; verifică detaliile de mai jos.';
  if (tokenInfo?.is_valid === false) conclusion = 'Tokenul paginii nu mai este valid. Reconectează contul Meta.';
  else if (tokenInfo?.app_id && tokenInfo.app_id !== appId) conclusion = 'Tokenul aparține altei aplicații Meta. Reconectează contul prin ImoDeus.';
  else if (identity.data?.id && pageId && identity.data.id !== pageId) conclusion = 'Tokenul salvat aparține altei pagini Facebook. Reconectează pagina corectă.';
  else if (missingScopes?.length) conclusion = 'Tokenul paginii nu include permisiunile: ' + missingScopes.join(', ') + '. Reautorizează cu Comentarii selectat.';
  else if (listing.error) conclusion = 'Meta refuză și lista postărilor acestui cont: ' + listing.error;
  else if (listing.data?.data && !listing.data.data.some(item => item.id === destination.externalId)) conclusion = 'ID-ul salvat nu apare în primele 100 de postări ale contului. Verifică dacă postarea a fost ștearsă sau publicată în alt cont.';
  else if (object.data?.id) conclusion = 'Postarea este accesibilă, dar cererea pentru comentarii este refuzată de Meta.';
  else if (listing.data?.data?.some(item => item.id === destination.externalId)) conclusion = 'Postarea apare în cont, dar Meta refuză accesul direct la ID-ul ei.';
  return {
    conclusion,
    channel: instagram ? 'Instagram' : 'Facebook',
    savedPostId: destination.externalId as string,
    expectedPageId: pageId || null,
    tokenPageId: identity.data?.id || null,
    tokenIdentityError: identity.error,
    tokenValid: tokenInfo?.is_valid ?? null,
    tokenType: tokenInfo?.type || null,
    appMatches: tokenInfo?.app_id ? tokenInfo.app_id === appId : null,
    missingScopes,
    tokenDebugError: debug.error,
    postInAccountList: listing.data?.data?.some(item => item.id === destination.externalId) ?? null,
    accountListError: listing.error,
    directPostReadable: Boolean(object.data?.id),
    directPostError: object.error,
  };
}
export async function postInteraction(db: Firestore, actor: Actor, postId: string, connectionId: string, action: 'comments' | 'insights', text?: string) {
  const snap = await agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId).get();
  const destination = snap.data()?.destinations?.[connectionId];
  if (!destination?.externalId || destination.status !== 'published') throw new CommunicationError('Postarea nu este publicată pe contul ales.');
  const { connection, token } = await connectionToken(db, actor, connectionId, action);
  const instagram = connection.channel === 'instagram';
  const id = destination.externalId;
  if (action === 'insights') return socialRead(db, actor, connection, token, `/${id}?fields=${instagram ? 'like_count,comments_count,permalink' : 'likes.summary(true),comments.summary(true),shares,permalink_url'}`);
  if (text !== undefined) {
    const message = z.string().trim().min(1).max(2000).parse(text);
    return socialGraph(`/${id}/comments`, token, { message });
  }
  return socialRead(db, actor, connection, token, `/${id}/comments?fields=${instagram ? 'id,text,username,timestamp' : 'id,message,from,created_time'}&limit=50`);
}

export async function commentInteraction(
  db: Firestore, actor: Actor, postId: string, connectionId: string,
  commentId: string, action: 'replies' | 'like', text?: string,
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(commentId)) throw new CommunicationError('Comentariu invalid.', 400);
  const snap = await agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId).get();
  const destination = snap.data()?.destinations?.[connectionId];
  if (!destination?.externalId || destination.status !== 'published') throw new CommunicationError('Postarea nu este publicată pe contul ales.');
  const { connection, token } = await connectionToken(db, actor, connectionId, 'comments');
  const instagram = connection.channel === 'instagram';
  const parent = await socialRead<{ data?: Array<{ id: string }> }>(db, actor, connection, token, `/${destination.externalId}/comments?fields=id&limit=100`);
  if (!parent.data?.some(comment => comment.id === commentId)) throw new CommunicationError('Comentariul nu aparține acestei postări sau nu este disponibil.', 404);
  const activeToken = (await connectionToken(db, actor, connectionId, 'comments')).token;
  if (action === 'like') {
    if (instagram) throw new CommunicationError('Aprecierea comentariilor Instagram nu este disponibilă prin această integrare.', 400);
    return socialGraph(`/${commentId}/likes`, activeToken, {});
  }
  const edge = instagram ? 'replies' : 'comments';
  if (text !== undefined) {
    const message = z.string().trim().min(1).max(2000).parse(text);
    return socialGraph(`/${commentId}/${edge}`, activeToken, { message });
  }
  return socialRead(db, actor, connection, token, `/${commentId}/${edge}?fields=${instagram ? 'id,text,username,timestamp' : 'id,message,from,created_time'}&limit=50`);
}
