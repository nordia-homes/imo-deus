import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Actor } from './model';
import { stableId } from './crypto';
import { connectionToken } from './meta';
import { CommunicationError, agencyCollection, nowIso } from './server';
import { propertyImageUrls, validateInstagramPost } from './social';

export async function createPropertySocialDraft(db: Firestore, actor: Actor, body: unknown) {
  const input = z.object({ requestId: z.string().uuid(), propertyId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/), connectionId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/) }).strict().parse(body);
  const { connection } = await connectionToken(db, actor, input.connectionId, 'publish');
  const agency = db.collection('agencies').doc(actor.agencyId);
  const postId = stableId(actor.agencyId, input.requestId);
  const ref = agencyCollection(db, actor.agencyId, 'socialPosts').doc(postId);
  await db.runTransaction(async tx => {
    const profile = (await tx.get(db.collection('users').doc(actor.uid))).data();
    if (actor.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== actor.agencyId) throw new CommunicationError('Acces revocat.', 403);
    const previous = (await tx.get(ref)).data();
    if (previous) {
      if (previous.agencyId !== actor.agencyId || previous.createdBy !== actor.uid || previous.propertyId !== input.propertyId || previous.contentSource !== 'crm' || Object.keys(previous.destinations || {}).join() !== input.connectionId) throw new CommunicationError('Identificator folosit pentru altă postare.', 409);
      return;
    }
    const property = (await tx.get(agency.collection('properties').doc(input.propertyId))).data();
    const account = (await tx.get(agency.collection('channelConnections').doc(input.connectionId))).data();
    if (!property || property.deletedAt || property.agencyId && property.agencyId !== actor.agencyId || property.status !== 'Activ') throw new CommunicationError('Este necesară o proprietate activă din agenție.', 409);
    if (!account || account.agencyId !== actor.agencyId || account.deletedAt || account.status !== 'connected' || account.capabilities?.publish?.status !== 'active' || !['messenger', 'instagram'].includes(account.channel) || account.channel !== connection.channel || account.externalId !== connection.externalId) throw new CommunicationError('Contul social nu mai este disponibil.', 409);
    const text = property.description;
    if (typeof text !== 'string' || !text.trim()) throw new CommunicationError('Completează descrierea proprietății în CRM.', 409);
    const images = propertyImageUrls(Array.isArray(property.images) ? property.images : []);
    if (account.channel === 'instagram') validateInstagramPost(text, images);
    const timestamp = nowIso();
    tx.create(ref, { agencyId: actor.agencyId, propertyId: input.propertyId, text, images, propertyPrice: property.price ?? null, propertyTitle: property.title || '', createdBy: actor.uid, createdAt: timestamp, scheduledAt: timestamp, status: 'draft', contentSource: 'crm', destinations: { [input.connectionId]: { connectionId: input.connectionId, channel: account.channel, status: 'draft', attempts: 0 } } });
  });
  const saved = (await ref.get()).data();
  if (saved?.status !== 'draft' || saved.destinations?.[input.connectionId]?.status !== 'draft') throw new CommunicationError('Starea ciornei s-a schimbat; verifică istoricul social.', 409);
  return { operation: 'social_create', postId, propertyId: input.propertyId, connectionId: input.connectionId, executionState: 'succeeded', businessStatus: 'draft', publicationConfirmed: false, evidenceSource: 'persisted_social_post' };
}