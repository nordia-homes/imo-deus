import { randomUUID, createHash } from 'node:crypto';
import { CommunicationError } from '@/lib/communications/server';
import { getConversation } from '@/lib/communications/server';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { getDeterministicMatchedProperties, getDeterministicMatchedBuyers } from '@/lib/matching-engine';
import type { Contact, Property } from '@/lib/types';
import { collectionFor, getResource, type AssistantContext } from './access';
import { overlaps, safeData, type AssistantAction } from './contracts';
import { invokeOperation, operations, isReadOperation } from './operations';
import { toPropertySeed } from '@/lib/owner-listings/utils';
import { ownerPriceCurrency } from '@/lib/owner-listings/search-index';
import type { OwnerListingDetail } from '@/lib/owner-listings/types';
import { OperationFailure, unconfirmedOperationResult } from './operation-error';
import { assertPropertyActivation, initialContactPreferences, propertyLifecyclePatch, propertyStatusReasonLabels, type propertyLifecycleSchema } from '@/lib/crm/action-fields';
import { z } from 'zod';
import { createSaleFromProperty } from '@/lib/sales';
import { payloadHash } from './approval';
import { prospectOwner, prospectPatch } from '@/lib/crm/prospect';
import { prepareContactIdentity } from '@/lib/crm/contact-identity-server';
import { contactIdentityKeys, normalizedContactFields } from '@/lib/crm/contact-identity';
import { shouldAutoArchiveContact } from '@/lib/contact-aging';
import { matchingRevision } from './matching-revision';
import { assertCalendarSlot } from '@/lib/crm/calendar';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications/types';

export async function matchContact(ctx: AssistantContext, contactId: string, limit: number) {
  const contact = await getResource(ctx, 'contacts', contactId);
  const properties = await collectionFor(ctx, 'properties').where('status', '==', 'Activ').get();
  const source = properties.docs.map(d => ({ ...d.data(), id: d.id })) as Property[];
  return getDeterministicMatchedProperties(contact as Contact, source, limit).map(p => ({ id: p.id, title: p.title, price: p.price, location: p.location, imageUrl: p.images?.[0]?.url || null, matchScore: p.matchScore, reasoning: p.reasoning, sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(source.find(row => row.id === p.id)! as unknown as Record<string, unknown>), link: `/properties/${p.id}` }));
}
export async function matchProperty(ctx: AssistantContext, propertyId: string, limit: number) {
  const property = await getResource(ctx, 'properties', propertyId);
  const contacts = await collectionFor(ctx, 'contacts').get();
  return getDeterministicMatchedBuyers(property as Property, contacts.docs.map(d => ({ ...d.data(), id: d.id })) as Contact[], limit).map(c => ({ id: c.id, name: c.name, matchScore: c.matchScore, reasoning: c.reasoning, zoneReasoning: c.zoneReasoning, link: `/leads/${c.id}` }));
}

// Only internal mutations below are retried automatically in Firestore transactions.
// External effects go through their own domain ledger; ambiguous outcomes stop the plan.
export async function executeAction(ctx: AssistantContext, action: AssistantAction, key: string) {
  if ((process.env.JARVIS_DISABLED_TOOLS || '').split(',').map(value => value.trim()).includes(action.kind)) throw new CommunicationError('Această acțiune este dezactivată de administrator.', 403);
  const ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  if (action.kind === 'existing_operation') {
    const { requireTool } = await import('./registry'); requireTool(action.operation, ctx.role || '');
    const op = Object.hasOwn(operations, action.operation) ? operations[action.operation] : undefined;
    if (!op || isReadOperation(action.operation)) throw new CommunicationError('Folosește citirea pentru această operație.');
    const claim = await ctx.adminDb.runTransaction(async tx => {
      const previous = await tx.get(ledger);
      const profile = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
      if (profile.data()?.agencyId !== ctx.agencyId || profile.data()?.role !== ctx.role || !['agent', 'admin'].includes(profile.data()?.role)) throw new CommunicationError('Acces revocat.', 403);
      if (previous.exists) {
        if (previous.data()?.actorId !== ctx.uid || payloadHash([previous.data()?.action]) !== payloadHash([action])) throw new CommunicationError('Identificatorul execuției aparține altei comenzi.', 409);
        if (previous.data()?.status === 'completed') return previous.data()?.result;
        throw new CommunicationError('Execuția anterioară trebuie verificată înainte de repetare.', 409);
      }
      tx.create(ledger, { actorId: ctx.uid, action, status: 'running', startedAt: new Date().toISOString() });
      return null;
    });
    if (claim) return claim;
    try {
      // A deterministic UUID survives replays; do not accept model-generated request ids.
      const hex = createHash('sha256').update(`${ctx.agencyId}:${key}`).digest('hex');
      const requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      const body = action.operation === 'message_send' || action.operation === 'message_preview' ? { ...action.body, requestId } : action.body;
      const result = await invokeOperation(ctx, { ...action, body });
      if (unconfirmedOperationResult(result)) throw new OperationFailure('Handlerul raportează un rezultat parțial, eșuat sau incert. Verifică starea în modulul corespunzător; nu retrimite automat.', 409, result);
      await ledger.update({ status: 'completed', result: safeData(result), completedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      await ledger.update({ status: 'unknown', error: error instanceof Error ? error.message : 'Rezultat neconfirmat.', ...(error instanceof OperationFailure ? { result: error.result } : {}) });
      throw error;
    }
  }
  const now = new Date().toISOString();
  return ctx.adminDb.runTransaction(async tx => {
    const prior = await tx.get(ledger);
    const profile = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (profile.data()?.agencyId !== ctx.agencyId || profile.data()?.role !== ctx.role || !['agent', 'admin'].includes(profile.data()?.role)) throw new CommunicationError('Acces revocat.', 403);
    if (prior.exists) {
      if (prior.data()?.actorId !== ctx.uid || payloadHash([prior.data()?.action]) !== payloadHash([action])) throw new CommunicationError('Identificatorul execuției aparține altei comenzi.', 409);
      return prior.data()?.result;
    }
    const read = async (resource: string, id: string) => {
      const doc = await tx.get(collectionFor(ctx, resource).doc(id));
      if (!doc.exists) throw new CommunicationError(`${resource}: înregistrarea nu există.`, 404);
      return doc.data()!;
    };
    let result: Record<string, unknown>;
    const propertyAssignment = async (agentId: string | null | undefined, row?: Record<string, any>) => {
      if (agentId === undefined || (row && row.agentId === agentId)) return {};
      const agent = agentId ? await tx.get(ctx.adminDb.collection('users').doc(agentId)) : null;
      if (agent && (agent.data()?.agencyId !== ctx.agencyId || !['admin', 'agent'].includes(agent.data()?.role))) throw new CommunicationError('Agent invalid.', 403);
      return { agentId, agentName: agent?.data()?.name || null, agent: agent ? { name: agent.data()?.name || '', avatarUrl: agent.data()?.photoUrl || '' } : null };
    };
    const statusEvent = (propertyId: string, previous: Record<string, any>, next: Record<string, any>, change: z.infer<typeof propertyLifecycleSchema>) => {
      tx.create(collectionFor(ctx, 'propertyStatusEvents').doc(key), { id: key, agencyId: ctx.agencyId, propertyId, actorId: ctx.uid, changedAt: now, previousStatus: previous.status || null, nextStatus: change.status, reason: change.reason || 'agent_instruction', reasonLabel: change.reason ? propertyStatusReasonLabels[change.reason] : 'La solicitarea agentului', agentMessage: change.notes || `Status ${change.status} solicitat de agent.`, soldPrice: change.soldPrice || null, marketAnalysisEligible: change.status === 'Vândut', propertySnapshot: { ...next, id: propertyId } });
    };
    if (action.kind === 'update_profile') {
      if (!Object.keys(action.patch).length) throw new CommunicationError('Precizează modificarea profilului.');
      if (action.patch.email && action.patch.email.toLowerCase() !== String(profile.data()?.email || '').toLowerCase()) {
        const { getAuth } = await import('firebase-admin/auth');
        const account = await getAuth().getUser(ctx.uid);
        if (account.email?.toLowerCase() !== action.patch.email.toLowerCase()) throw new CommunicationError('Schimbarea emailului necesită reautentificare din Setări. Finalizează pasul uman înainte de sincronizarea profilului.', 409);
      }
      const next = { ...profile.data(), ...action.patch };
      tx.update(ctx.adminDb.collection('users').doc(ctx.uid), { ...action.patch, updatedAt: now });
      tx.set(ctx.adminDb.collection('publicAgentProfiles').doc(ctx.uid), { agencyId: ctx.agencyId, name: next.name || '', email: next.email || '', phone: next.phone || '', photoUrl: next.photoUrl || '', updatedAt: now }, { merge: true });
      result = { userId: ctx.uid, changedFields: Object.keys(action.patch), link: '/settings' };
    } else if (action.kind === 'update_agency') {
      if (ctx.role !== 'admin') throw new CommunicationError('Doar administratorul poate modifica agenția.', 403);
      if (!Object.keys(action.patch).length) throw new CommunicationError('Precizează modificarea agenției.');
      const ref = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
      if (!(await tx.get(ref)).exists) throw new CommunicationError('Agenția nu există.', 404);
      tx.update(ref, { ...action.patch, updatedAt: now });
      result = { agencyId: ctx.agencyId, changedFields: Object.keys(action.patch), link: '/settings' };
    } else if (action.kind === 'update_notification_preferences') {
      if (!Object.keys(action.patch).length) throw new CommunicationError('Precizează preferințele notificărilor.');
      const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notificationPreferences').doc('default');
      const old = (await tx.get(ref)).data() || {};
      const next = { pushEnabled: action.patch.pushEnabled ?? old.pushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled, categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, ...(old.categories || {}), ...(action.patch.categories || {}) }, updatedAt: now };
      tx.set(ref, next, { merge: true });
      result = { userId: ctx.uid, preferences: next, link: '/settings', note: 'Preferințele au fost salvate. Permisiunea push pentru dispozitiv se acordă din Setări.' };
    } else if (action.kind === 'storia_lead_action') {
      const lead = await read('storiaInboxLeads', action.leadId);
      const leadRef = collectionFor(ctx, 'storiaInboxLeads').doc(action.leadId);
      if (action.action === 'update') {
        if (!action.patch || !Object.keys(action.patch).length) throw new CommunicationError('Precizează statusul sau starea de citire.');
        tx.update(leadRef, { ...action.patch, updatedAt: now });
        result = { leadId: action.leadId, ...action.patch, link: '/inbox/storia' };
      } else {
        let contactId = typeof lead.convertedContactId === 'string' ? lead.convertedContactId : null;
        const data = { phone: lead.senderPhone ? String(lead.senderPhone) : '', email: typeof lead.senderEmail === 'string' && z.string().email().safeParse(lead.senderEmail).success ? lead.senderEmail : '' };
        const candidates = new Set<string>();
        for (const identity of contactIdentityKeys(data)) {
          const lock = await tx.get(collectionFor(ctx, 'assistantLocks').doc(identity.key));
          if (lock.data()?.contactId) {
            const owner = await tx.get(collectionFor(ctx, 'contacts').doc(lock.data()!.contactId));
            if (owner.exists && normalizedContactFields(owner.data()!)[identity.field as 'normalizedPhone' | 'normalizedEmail'] === identity.value) candidates.add(owner.id);
          }
          const matches = await tx.get(collectionFor(ctx, 'contacts').where(identity.field, '==', identity.value));
          matches.docs.forEach(doc => { if (normalizedContactFields(doc.data())[identity.field as 'normalizedPhone' | 'normalizedEmail'] === identity.value) candidates.add(doc.id); });
        }
        for (const field of ['phone', 'email'] as const) if (data[field]) {
          const matches = await tx.get(collectionFor(ctx, 'contacts').where(field, '==', data[field]));
          matches.docs.forEach(doc => candidates.add(doc.id));
        }
        if (!contactId && candidates.size > 1) throw new CommunicationError('Telefonul și emailul corespund mai multor contacte. Verifică duplicatele înainte de conversie.', 409);
        contactId ||= [...candidates][0] || null;
        const reused = Boolean(contactId);
        if (contactId) await read('contacts', contactId);
        else {
          contactId = key;
          const propertySnap = lead.propertyId ? await tx.get(collectionFor(ctx, 'properties').doc(lead.propertyId)) : null;
          const property = propertySnap?.data();
          const city = property?.city || '', zone = property?.zone || '';
          const identity = await prepareContactIdentity(ctx, tx, contactId, data);
          identity.write();
          tx.create(collectionFor(ctx, 'contacts').doc(contactId), { id: contactId, ...data, ...identity.fields, name: String(lead.senderName || 'Lead Storia').slice(0, 200), source: 'Storia', sourceLeadId: action.leadId, sourcePropertyId: propertySnap?.exists ? lead.propertyId : null, sourceMetadata: { conversationId: lead.conversationId || null, remoteAdId: lead.remoteAdId || null, sourceEmailRaw: lead.senderEmail || null }, status: 'Nou', priority: 'Medie', contactType: 'Cumparator', tags: ['Storia'], description: [`Mesaj Storia: ${lead.latestMessage || ''}`, lead.propertyTitle ? `Proprietate: ${lead.propertyTitle}` : '', `Conversatie Storia: ${lead.conversationId || ''}`].filter(Boolean).join('\n').slice(0, 10000), city, zones: zone ? [zone] : [], preferences: initialContactPreferences(0, city), interactionHistory: [], agentId: ctx.uid, agentName: profile.data()?.name || '', createdAt: now });
        }
        tx.update(leadRef, { convertedContactId: contactId, convertedAt: lead.convertedAt || now, convertedBy: lead.convertedBy || ctx.uid, unread: false, status: 'in_lucru', updatedAt: now });
        result = { leadId: action.leadId, contactId, reused, link: `/leads/${contactId}`, note: reused ? 'Lead asociat contactului existent; datele lui au fost păstrate.' : 'Contact creat din mesajul Storia.' };
      }
    } else if (action.kind === 'preferences_link_action') {
      const contact = await read('contacts', action.contactId);
      const oldRef = contact.preferencesLinkId ? ctx.adminDb.collection('buyer-preferences-links').doc(contact.preferencesLinkId) : null;
      const old = oldRef ? await tx.get(oldRef) : null;
      if (old?.exists && (old.data()?.agencyId !== ctx.agencyId || old.data()?.contactId !== action.contactId)) throw new CommunicationError('Link inaccesibil.', 403);
      let linkId: string | null = null;
      if (action.action === 'create' && old?.exists) linkId = contact.preferencesLinkId;
      else {
        if (oldRef && old?.exists) tx.delete(oldRef);
        if (action.action !== 'deactivate') {
          linkId = randomUUID();
          tx.create(ctx.adminDb.collection('buyer-preferences-links').doc(linkId), { contactId: action.contactId, agencyId: ctx.agencyId, createdAt: now });
        }
        tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { preferencesLinkId: linkId, updatedAt: now });
      }
      result = { contactId: action.contactId, preferencesLinkId: linkId, link: linkId ? `/preferences/${linkId}` : `/leads/${action.contactId}` };
    } else if (action.kind === 'update_recommendation') {
      const contact = await read('contacts', action.contactId);
      if (!contact.portalId) throw new CommunicationError('Portalul nu este activ.');
      const portalRef = ctx.adminDb.collection('portals').doc(contact.portalId);
      const [portal, recommendation] = await Promise.all([tx.get(portalRef), tx.get(portalRef.collection('recommendations').doc(action.propertyId))]);
      if (!portal.exists || portal.data()?.agencyId !== ctx.agencyId || portal.data()?.contactId !== action.contactId || !recommendation.exists) throw new CommunicationError('Recomandare inaccesibilă.', 403);
      const updated = { ...recommendation.data(), ...action.patch, id: action.propertyId, feedbackRecordedBy: ctx.uid, feedbackSource: 'agent_attestation', updatedAt: now };
      tx.update(recommendation.ref, updated);
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { recommendationHistory: { ...(contact.recommendationHistory || {}), [action.propertyId]: updated }, updatedAt: now });
      result = { contactId: action.contactId, propertyId: action.propertyId, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'contract_template_action') {
      if (ctx.role !== 'admin') throw new CommunicationError('Administrarea șabloanelor necesită administratorul.', 403);
      const templateId = action.action === 'create' ? key : action.templateId;
      if (!templateId) throw new CommunicationError('Precizează șablonul.');
      const ref = collectionFor(ctx, 'contractTemplates').doc(templateId);
      if (action.action !== 'create') await read('contractTemplates', templateId);
      if (action.action === 'delete') tx.delete(ref);
      else {
        if (!action.data || !Object.keys(action.data).length) throw new CommunicationError('Precizează conținutul sau modificările șablonului.');
        if (action.action === 'create' && (!action.data.name || !action.data.category || !action.data.content)) throw new CommunicationError('Numele, categoria și conținutul sunt obligatorii.');
        const patch = { ...action.data, sourceType: 'document', headerMode: 'crm_prefilled', updatedAt: now, updatedBy: ctx.uid };
        if (action.action === 'create') tx.create(ref, { status: 'draft', fields: [], description: '', sourceFormat: 'manual', sourcePdfUrl: '', sourcePdfPath: '', fileName: '', pageCount: 0, ...patch, id: templateId, agencyId: ctx.agencyId, createdAt: now, createdBy: ctx.uid });
        else tx.update(ref, patch);
      }
      result = { templateId, deleted: action.action === 'delete', link: action.action === 'delete' ? '/contracts' : `/contracts/${templateId}/edit` };
    } else if (action.kind === 'create_contact') {
      const ref = collectionFor(ctx, 'contacts').doc(key);
      const { kind: _, ...data } = action;
      const agent = action.agentId ? await tx.get(ctx.adminDb.collection('users').doc(action.agentId)) : null;
      if (agent && (agent.data()?.agencyId !== ctx.agencyId || !['admin', 'agent'].includes(agent.data()?.role))) throw new CommunicationError('Agent invalid.', 403);
      if (action.sourcePropertyId) await read('properties', action.sourcePropertyId);
      const identity = await prepareContactIdentity(ctx, tx, ref.id, action);
      identity.write();
      tx.create(ref, { ...data, ...identity.fields, id: ref.id, status: action.status || 'Nou', priority: action.priority || 'Medie', tags: action.tags || [], source: action.source || 'AI Assistant', agentId: action.agentId === undefined ? ctx.uid : action.agentId,
        agentName: action.agentId === null ? null : agent?.data()?.name || profile.data()?.name || '', interactionHistory: [],
        preferences: initialContactPreferences(action.budget, action.city), createdAt: now });
      result = { contactId: ref.id, link: `/leads/${ref.id}` };
    } else if (action.kind === 'create_sale') {
      const property = await read('properties', action.propertyId);
      const ref = collectionFor(ctx, 'sales').doc(action.propertyId);
      const previous = await tx.get(ref);
      if (ctx.role !== 'admin' && property.agentId && property.agentId !== ctx.uid) throw new CommunicationError('Proprietatea este atribuită altui agent.', 403);
      if (previous.exists) throw new CommunicationError('Dosarul de vânzare există deja.', 409);
      tx.create(ref, { ...createSaleFromProperty({ ...property, id: action.propertyId } as Property, ctx.agencyId, { id: ctx.uid, name: profile.data()?.name || 'Agent' }), id: ref.id });
      result = { saleId: ref.id, propertyId: action.propertyId, link: '/sales-management' };
    } else if (action.kind === 'update_offer' || action.kind === 'delete_offer') {
      const contact = await read('contacts', action.contactId);
      const offers = Array.isArray(contact.offers) ? contact.offers : [];
      if (!offers.some((offer: any) => offer.id === action.offerId)) throw new CommunicationError('Oferta nu există.', 404);
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { offers: action.kind === 'delete_offer' ? offers.filter((offer: any) => offer.id !== action.offerId) : offers.map((offer: any) => offer.id === action.offerId ? { ...offer, ...action.patch } : offer), updatedAt: now });
      result = { contactId: action.contactId, offerId: action.offerId, deleted: action.kind === 'delete_offer', link: `/leads/${action.contactId}` };
    } else if (action.kind === 'update_prospect') {
      const ref = collectionFor(ctx, 'ownerListingFavorites').doc(action.listingId);
      const snapshot = await tx.get(ref);
      const favorite = snapshot.data() || {};
      if (!snapshot.exists) {
        if (!action.patch.state && !action.patch.contactOutcome) throw new CommunicationError('Adaugă anunțul în prospectare înainte de editarea detaliilor.', 409);
        const listing = await tx.get(ctx.adminDb.collection('ownerListings').doc(action.listingId));
        if (!listing.exists || listing.data()?.publicationStatus !== 'ready' || listing.data()?.isCanonical !== true) throw new CommunicationError('Anunțul nu mai este disponibil pentru prospectare.', 409);
      }
      const owner = prospectOwner(favorite, Date.parse(now));
      if ((favorite.isFavoriteActive === false && !action.patch.state) || (ctx.role !== 'admin' && owner && owner !== ctx.uid)) throw new CommunicationError('Anunțul este lucrat de alt agent sau nu este activ.', 403);
      const patch = prospectPatch(favorite, action.patch, ctx.uid, profile.data()?.name || '', now);
      if (snapshot.exists) tx.update(ref, patch);
      else tx.create(ref, { ownerListingId: action.listingId, isFavoriteActive: true, collaborationStatus: null, commissionValue: '', propertyAddress: '', notes: '', createdAt: now, createdBy: ctx.uid, ...patch });
      result = { listingId: action.listingId, link: '/owner-listings/favorite' };
    } else if (action.kind === 'portal_action') {
      const contact = await read('contacts', action.contactId);
      const oldId = contact.portalId;
      const oldRef = oldId ? ctx.adminDb.collection('portals').doc(oldId) : null;
      const previous = oldRef ? await tx.get(oldRef) : null;
      if (previous?.exists && (previous.data()?.agencyId !== ctx.agencyId || previous.data()?.contactId !== action.contactId)) throw new CommunicationError('Portal inaccesibil.', 403);
      if (action.action === 'remove_recommendation') {
        if (!oldRef || !previous?.exists || !action.propertyId) throw new CommunicationError('Precizează portalul și proprietatea.');
        const history = { ...(contact.recommendationHistory || {}) }; delete history[action.propertyId];
        tx.delete(oldRef.collection('recommendations').doc(action.propertyId));
        tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { recommendationHistory: history, updatedAt: now });
      } else if (action.action === 'deactivate') {
        if (oldRef && previous?.exists) tx.delete(oldRef);
        tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { portalId: null, recommendationHistory: {}, updatedAt: now });
      } else if (action.action === 'activate' && previous?.exists) {
        result = { portalId: oldId, link: `/portal/${oldId}` };
      } else {
        if (oldRef && previous?.exists) tx.delete(oldRef);
        const portalId = key;
        tx.create(ctx.adminDb.collection('portals').doc(portalId), { id: portalId, agencyId: ctx.agencyId, contactId: action.contactId, contactName: contact.name, agentName: profile.data()?.name || '', createdAt: now });
        tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { portalId, recommendationHistory: {}, updatedAt: now });
        result = { portalId, link: `/portal/${portalId}` };
      }
      result ||= { contactId: action.contactId, action: action.action, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'notification_action') {
      const notifications = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications');
      if (action.action === 'read_all') {
        const unread = await tx.get(notifications.where('isRead', '==', false).limit(400));
        if (unread.size === 400) throw new CommunicationError('Folosește operația read-all pentru lista completă.', 409);
        unread.docs.forEach(doc => tx.update(doc.ref, { isRead: true }));
        result = { count: unread.size, link: '/notifications' };
      } else {
        if (!action.notificationId) throw new CommunicationError('Precizează notificarea.');
        const notification = notifications.doc(action.notificationId);
        if (!(await tx.get(notification)).exists) throw new CommunicationError('Notificarea nu există.', 404);
        tx.update(notification, { isRead: action.action === 'read' });
        result = { notificationId: action.notificationId, link: '/notifications' };
      }
    } else if (action.kind === 'create_property') {
      const ref = collectionFor(ctx, 'properties').doc(action.propertyId || key);
      const assignment = await propertyAssignment(action.agentId === undefined ? ctx.uid : action.agentId);
      const lifecycle = action.statusChange ? propertyLifecyclePatch(action.property, action.statusChange, now) : { status: 'Inactiv' };
      const next = { ...action.property, ...assignment, ...lifecycle, id: ref.id, createdAt: now, updatedAt: now };
      tx.create(ref, next);
      if (action.statusChange) statusEvent(ref.id, {}, next, action.statusChange);
      result = { propertyId: ref.id, status: next.status, link: `/properties/${ref.id}`, note: `Proprietate creată: ${next.status}.` };
    } else if (action.kind === 'archive_contact') {
      const contact = await read('contacts', action.contactId);
      if (action.byAge && (!action.archived || !shouldAutoArchiveContact(contact as Contact))) throw new CommunicationError('Contactul nu îndeplinește condițiile arhivării automate.', 409);
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { archivedAt: action.archived ? now : null, archivedByAge: Boolean(action.archived && action.byAge), updatedAt: now });
      result = { contactId: action.contactId, archived: action.archived, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'assign_record') {
      const previousRecord = await read(action.resource, action.id);
      const agent = action.agentId ? await tx.get(ctx.adminDb.collection('users').doc(action.agentId)) : null;
      if (agent && (agent.data()?.agencyId !== ctx.agencyId || !['admin', 'agent'].includes(agent.data()?.role))) throw new CommunicationError('Agentul nu aparține agenției.');
      if (action.resource === 'tasks') await assertCalendarSlot(ctx, tx, 'tasks', action.id, { ...previousRecord, agentId: action.agentId });
      tx.update(collectionFor(ctx, action.resource).doc(action.id), { agentId: action.agentId, agentName: agent?.data()?.name || null, updatedAt: now });
      result = { id: action.id, agentId: action.agentId };
    } else if (action.kind === 'import_owner_listing') {
      const favorite = await read('ownerListingFavorites', action.listingId);
      if (favorite.isFavoriteActive === false || (ctx.role !== 'admin' && favorite.reservedByAgentId !== ctx.uid)) throw new CommunicationError('Anunțul trebuie să fie în prospectarea ta.', 403);
      const listing = await tx.get(ctx.adminDb.collection('ownerListings').doc(action.listingId));
      const row = listing.data();
      if (!row || row.publicationStatus !== 'ready' || row.isCanonical !== true) throw new CommunicationError('Anunțul nu mai este eligibil pentru import.', 409);
      if (ownerPriceCurrency(row.price) !== 'EUR') throw new CommunicationError('Importul necesită un preț verificat în EUR; moneda nu se convertește implicit.');
      const duplicate = await tx.get(collectionFor(ctx, 'properties').where('ownerListingId', '==', action.listingId).limit(1));
      if (!duplicate.empty) throw new CommunicationError('Anunțul a fost deja importat în CRM.', 409);
      const lock = collectionFor(ctx, 'assistantLocks').doc(`import-${action.listingId}`);
      if ((await tx.get(lock)).data()?.propertyId) throw new CommunicationError('Anunțul a fost deja importat.', 409);
      const seed = toPropertySeed({ ...row, images: Array.isArray(row.images) ? row.images : row.imageUrl || row.image ? [row.imageUrl || row.image] : [], contactPhone: favorite.ownerPhone || '', propertyType: ({ apartment: 'Apartament', house: 'Casa', land: 'Teren', commercial: 'Spatiu comercial' } as Record<string, string>)[row.propertyType] || 'Apartament', transactionType: row.transactionType === 'rent' ? 'Inchiriere' : 'Vanzare' } as OwnerListingDetail);
      const ref = collectionFor(ctx, 'properties').doc(key);
      const { constructionYear, ...data } = seed;
      tx.create(ref, { ...data, ...(constructionYear ? { constructionYear } : {}), id: ref.id, status: 'Inactiv', importNeedsReview: true, ownerListingId: action.listingId, ownerListingUrl: row.link, agentId: ctx.uid, createdAt: now });
      tx.set(lock, { propertyId: ref.id, actorId: ctx.uid, createdAt: now });
      result = { propertyId: ref.id, link: `/properties/${ref.id}`, note: 'Import salvat ca Inactiv. Verifică datele și activează proprietatea înainte de ofertare/publicare.' };
    } else if (action.kind === 'activate_property') {
      const property = await read('properties', action.propertyId);
      if (property.status !== 'Inactiv') throw new CommunicationError('Doar proprietățile inactive pot fi activate.');
      assertPropertyActivation(property);
      const patch = propertyLifecyclePatch(property, { status: 'Activ', notes: '' }, now);
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), { ...patch, importNeedsReview: false });
      statusEvent(action.propertyId, property, { ...property, ...patch }, { status: 'Activ', notes: '' });
      result = { propertyId: action.propertyId, link: `/properties/${action.propertyId}` };
    } else if (action.kind === 'update_property_status') {
      const property = await read('properties', action.propertyId);
      const patch = propertyLifecyclePatch(property, action, now);
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), patch);
      statusEvent(action.propertyId, property, { ...property, ...patch }, action);
      result = { propertyId: action.propertyId, title: property.title || '', previousStatus: property.status, status: action.status, link: `/properties/${action.propertyId}`, note: `Status actualizat: ${action.status}. Sincronizarea portalurilor este separată.` };
    } else if (action.kind === 'add_property_note' || action.kind === 'set_property_featured') {
      const property = await read('properties', action.propertyId);
      const patch = action.kind === 'set_property_featured' ? { featured: action.featured } : { notes: [property.notes || '', action.notes].filter(Boolean).join('\n\n') };
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), { ...patch, updatedAt: now });
      result = { propertyId: action.propertyId, title: property.title || '', ...patch, link: `/properties/${action.propertyId}` };
    } else if (action.kind === 'update_property') {
      const property = await read('properties', action.propertyId);
      if (action.expectedUpdatedAt !== undefined && (property.updatedAt || null) !== action.expectedUpdatedAt) throw new CommunicationError('Proprietatea s-a modificat între timp. Reîncarcă datele înainte de salvare.', 409);
      const assignment = await propertyAssignment(action.agentId, property);
      const patch = { ...action.patch, ...(action.patch.portalProfiles ? { portalProfiles: { ...(property.portalProfiles || {}), imobiliare: { ...(property.portalProfiles?.imobiliare || {}), ...action.patch.portalProfiles.imobiliare } } } : {}), ...assignment };
      const lifecycle = action.statusChange ? propertyLifecyclePatch({ ...property, ...patch }, action.statusChange, now) : {};
      const ref = collectionFor(ctx, 'properties').doc(action.propertyId);
      tx.update(ref, { ...patch, ...lifecycle, updatedAt: now });
      if (action.statusChange) statusEvent(action.propertyId, property, { ...property, ...patch, ...lifecycle }, action.statusChange);
      tx.create(ref.collection('assistantChanges').doc(key), { before: Object.fromEntries(Object.keys(action.patch).map(field => [field, property[field] ?? null])), after: action.patch, actorId: ctx.uid, createdAt: now });
      result = { propertyId: action.propertyId, link: `/properties/${action.propertyId}`, note: 'Modificarea este salvată în CRM. Sincronizarea portalurilor este o acțiune separată.' };
    } else if (action.kind === 'record_offer') {
      const [contact, property] = await Promise.all([read('contacts', action.contactId), read('properties', action.propertyId)]);
      if (property.status !== 'Activ') throw new CommunicationError('Proprietatea nu mai este activă.');
      const offer = { id: key, propertyId: action.propertyId, propertyTitle: property.title, price: action.price, date: now, status: 'În așteptare' };
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { offers: [...(contact.offers || []), offer] });
      result = { offerId: key, contactId: action.contactId, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'update_preferences') {
      const contact = await read('contacts', action.contactId);
      const preferences = { ...(contact.preferences || {}), ...action.preferences };
      if (preferences.desiredPriceRangeMin > preferences.desiredPriceRangeMax || preferences.desiredSquareFootageMin > preferences.desiredSquareFootageMax) throw new CommunicationError('Intervalul minim nu poate depăși maximul.');
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { preferences, updatedAt: now });
      result = { contactId: action.contactId, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'update_contact' || action.kind === 'add_interaction') {
      const contact = await read('contacts', action.contactId);
      const ref = collectionFor(ctx, 'contacts').doc(action.contactId);
      if (action.kind === 'update_contact') {
        if (action.expectedUpdatedAt !== undefined && (contact.updatedAt || null) !== action.expectedUpdatedAt) throw new CommunicationError('Contactul a fost modificat între timp. Reîncarcă datele înainte de editare.', 409);
        if (action.patch.sourcePropertyId) await read('properties', action.patch.sourcePropertyId);
        const identity = action.patch.phone !== undefined || action.patch.email !== undefined ? await prepareContactIdentity(ctx, tx, action.contactId, { ...contact, ...action.patch }, contact) : null;
        identity?.write();
        tx.update(ref, { ...action.patch, ...(identity?.fields || {}), updatedAt: now });
      }
      else tx.update(ref, { interactionHistory: [...(contact.interactionHistory || []), { id: key, type: action.type, date: now, notes: action.notes, agentId: ctx.uid, agent: { name: profile.data()?.name || 'Agent' } }] });
      result = { contactId: action.contactId, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'create_task') {
      const contact = action.contactId ? await read('contacts', action.contactId) : null;
      const property = action.propertyId ? await read('properties', action.propertyId) : null;
      const ref = collectionFor(ctx, 'tasks').doc(key);
      const { kind: _, ...taskData } = action;
      const agentId = action.agentId === undefined ? ctx.uid : action.agentId;
      const assignment = await propertyAssignment(agentId);
      await assertCalendarSlot(ctx, tx, 'tasks', ref.id, { ...taskData, status: 'open', agentId });
      tx.create(ref, { ...taskData, id: ref.id, status: 'open', agentId, agentName: assignment.agentName, createdAt: now, ...(contact ? { contactId: action.contactId, contactName: contact.name } : {}), ...(property ? { propertyId: action.propertyId, propertyTitle: property.title } : {}) });
      result = { taskId: ref.id, link: '/tasks' };
    } else if (action.kind === 'update_task') {
      const oldTask = await read('tasks', action.taskId);
      const {kind: _, taskId: __, ...patch} = action;
      if (!Object.keys(patch).length) throw new CommunicationError('Precizează modificarea sarcinii.');
      const contact = action.contactId ? await read('contacts', action.contactId) : null;
      const property = action.propertyId ? await read('properties', action.propertyId) : null;
      await assertCalendarSlot(ctx, tx, 'tasks', action.taskId, { ...oldTask, ...patch });
      tx.update(collectionFor(ctx, 'tasks').doc(action.taskId), { ...patch, updatedAt: now,
        ...(action.contactId !== undefined ? { contactName: contact?.name || null } : {}),
        ...(action.propertyId !== undefined ? { propertyTitle: property?.title || null } : {}) });
      result = { taskId: action.taskId, link: '/tasks' };
    } else if (action.kind === 'delete_task' || action.kind === 'delete_viewing') {
      const resource = action.kind === 'delete_task' ? 'tasks' : 'viewings', id = action.kind === 'delete_task' ? action.taskId : action.viewingId;
      const previous = await read(resource, id);
      tx.delete(collectionFor(ctx, resource).doc(id));
      tx.create(collectionFor(ctx, 'assistantDeletedRecords').doc(key), { resource, id, previous, actorId: ctx.uid, deletedAt: now });
      result = { id, deleted: true, link: action.kind === 'delete_task' ? '/tasks' : '/viewings' };
    } else if (action.kind === 'schedule_viewing' || action.kind === 'update_viewing') {
      const old = action.kind === 'update_viewing' ? await read('viewings', action.viewingId) : null;
      const contactId = action.contactId || String(old?.contactId);
      const propertyId = action.propertyId || String(old?.propertyId);
      const [contact, property] = await Promise.all([read('contacts', contactId), read('properties', propertyId)]);
      const status = action.kind === 'schedule_viewing' ? 'scheduled' : action.status;
      const viewingDate = action.viewingDate || String(old?.viewingDate);
      const duration = action.duration || Number(old?.duration || 60);
      const agentId = action.agentId || String(old?.agentId || ctx.uid);
      const assignment = action.agentId ? await propertyAssignment(action.agentId) : null;
      if (status === 'scheduled') {
        if (Date.parse(viewingDate) <= Date.now()) throw new CommunicationError('Vizionarea trebuie programată în viitor.');
        if (!['Activ', 'Rezervat'].includes(property.status)) throw new CommunicationError('Proprietatea nu este disponibilă pentru vizionare.');

      }
      const ref = collectionFor(ctx, 'viewings').doc(action.kind === 'update_viewing' ? action.viewingId : key);
      const record = { contactId, contactName: contact.name, propertyId, propertyTitle: property.title, propertyAddress: property.address || property.location || '', agentId, agentName: assignment?.agentName || old?.agentName || profile.data()?.name || '', viewingDate, duration, status, notes: action.notes ?? old?.notes ?? '', updatedAt: now };
      await assertCalendarSlot(ctx, tx, 'viewings', ref.id, record);
      tx.set(ref, { ...record, ...(old ? {} : { id: ref.id, createdAt: now }) }, { merge: true });
      result = { viewingId: ref.id, viewingDate, link: '/viewings' };
    } else if (action.kind === 'recommend_properties') {
      const contact = await read('contacts', action.contactId);
      const ids = [...new Set(action.propertyIds)];
      const properties = await Promise.all(ids.map(id => read('properties', id)));
      if (properties.some(p => p.status !== 'Activ')) throw new CommunicationError('Unele proprietăți nu mai sunt active.', 409);
      const portalId = contact.portalId || key;
      const portal = ctx.adminDb.collection('portals').doc(portalId);
      const portalSnap = await tx.get(portal);
      if (portalSnap.exists && (portalSnap.data()?.agencyId !== ctx.agencyId || portalSnap.data()?.contactId !== action.contactId)) throw new CommunicationError('Portalul nu aparține acestui contact.', 403);
      const previous = await Promise.all(ids.map(id => tx.get(portal.collection('recommendations').doc(id))));
      if (!portalSnap.exists) tx.create(portal, { id: portalId, agencyId: ctx.agencyId, contactId: action.contactId, contactName: contact.name, agentName: '', createdAt: now });
      const history = { ...(contact.recommendationHistory || {}) };
      ids.forEach((id, index) => {
        const recommendation = previous[index].exists ? previous[index].data()! : { id, propertyId: id, addedAt: now, clientFeedback: 'none' };
        if (!previous[index].exists) tx.create(portal.collection('recommendations').doc(id), recommendation);
        history[id] = recommendation;
      });
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { portalId, recommendationHistory: history });
      result = { portalId, propertyIds: ids, link: `/portal/${portalId}`, note: 'Ofertele au fost adăugate în portal. Mesajul către client este o acțiune separată.' };
    } else if (action.kind === 'create_automation') {
      if (!process.env.AI_ASSISTANT_WORKER_SECRET) throw new CommunicationError('Worker-ul de automatizări nu este configurat. Configurează secretul și scheduler-ul înainte de activare.', 503);
      const heartbeat = await tx.get(ctx.adminDb.collection('assistantWorkerState').doc('global'));
      const heartbeatAge = Date.now() - Date.parse(heartbeat.data()?.lastSuccessAt || '');
      if (!Number.isFinite(heartbeatAge) || heartbeatAge < 0 || heartbeatAge >= 15 * 60000) throw new CommunicationError('Automatizările programate nu sunt active. Administratorul trebuie să verifice serviciul de execuție.', 503);
      const automation = action.automation;
      if (Date.parse(automation.nextRunAt) <= Date.now()) throw new CommunicationError('Prima execuție trebuie să fie în viitor.');
      if (automation.maxRuns > 1 && !automation.intervalMinutes) throw new CommunicationError('Precizează intervalul pentru execuții repetate.');
      if (automation.type === 'followup_task' || automation.type === 'matching_watch') await read('contacts', automation.contactId);
      if (process.env.JARVIS_AUTOMATIONS === 'false') throw new CommunicationError('Automatizările sunt dezactivate.', 403);
      if (automation.type === 'whatsapp_template') {
        if (isDemoAgencyId(ctx.agencyId)) throw new CommunicationError('Mesajele externe sunt indisponibile în demo.', 403);
        await getConversation(ctx.adminDb, ctx, automation.conversationId);
      }
      const record = { id: key, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: ctx.role, automation, status: 'active', nextRunAt: automation.nextRunAt, createdAt: now, runCount: 0 };
      tx.create(collectionFor(ctx, 'assistantAutomations').doc(key), record);
      tx.create(ctx.adminDb.collection('assistantAutomationJobs').doc(`${ctx.agencyId}-${key}`), record);
      result = { automationId: key, nextRunAt: automation.nextRunAt, link: '/ai-assistant' };
    } else if (action.kind === 'update_automation') {
      if (action.status === undefined && action.automation === undefined) throw new CommunicationError('Precizează modificarea automatizării.');
      const record = await read('assistantAutomations', action.automationId);
      if (record.actorId !== ctx.uid) throw new CommunicationError('Automatizarea aparține altui agent.', 403);
      const job = ctx.adminDb.collection('assistantAutomationJobs').doc(`${ctx.agencyId}-${action.automationId}`);
      const fresh = await tx.get(job);
      if (fresh.data()?.status === 'running') throw new CommunicationError('Automatizarea este în execuție. Așteaptă rezultatul.', 409);
      if (action.status === 'active' && ['completed', 'unknown', 'blocked'].includes(String(fresh.data()?.status))) throw new CommunicationError('Creează o automatizare nouă după verificarea rezultatului.');
      if (action.automation && ['completed', 'unknown', 'blocked'].includes(String(fresh.data()?.status))) throw new CommunicationError('Rezultatul automatizării trebuie verificat înainte de înlocuire. Creează una nouă.', 409);
      if (action.automation) {
        if (Date.parse(action.automation.nextRunAt) <= Date.now()) throw new CommunicationError('Următoarea execuție trebuie să fie în viitor.');
        if (action.automation.maxRuns <= Number(record.runCount || 0)) throw new CommunicationError('Limita de execuții trebuie să depășească execuțiile deja efectuate.');
        if (action.automation.maxRuns > 1 && !action.automation.intervalMinutes) throw new CommunicationError('Precizează intervalul execuțiilor repetate.');
        if ('contactId' in action.automation) await read('contacts', action.automation.contactId);
        if (action.automation.type === 'whatsapp_template') await getConversation(ctx.adminDb, ctx, action.automation.conversationId);
      }
      const patch = { ...(action.status ? { status: action.status } : {}), ...(action.automation ? { automation: action.automation, nextRunAt: action.automation.nextRunAt, scanCursor: null, requestId: null } : {}), updatedAt: now };
      tx.update(collectionFor(ctx, 'assistantAutomations').doc(action.automationId), patch);
      tx.update(job, patch);
      tx.create(collectionFor(ctx, 'assistantAutomations').doc(action.automationId).collection('audit').doc(key), { id: key, actorId: ctx.uid, occurredAt: now, action: 'updated', previous: { status: record.status, automation: record.automation }, changes: patch });
      result = { automationId: action.automationId, status: action.status || record.status, nextRunAt: action.automation?.nextRunAt || record.nextRunAt };
    } else throw new CommunicationError('Acțiune necunoscută.');
    tx.create(collectionFor(ctx, 'crmEvents').doc(key), { id: key, actorId: ctx.uid, agencyId: ctx.agencyId,
      source: key.startsWith('manual-') ? 'manual' : 'ai_assistant', capability: action.kind,
      occurredAt: now, recordedAt: now, result: safeData(result),
      entities: Object.fromEntries(Object.entries({ ...action, ...result }).filter(([field, value]) => /Id$/.test(field) && typeof value === 'string')) });
    tx.create(ledger, { actorId: ctx.uid, action, status: 'completed', result, completedAt: now });
    return safeData(result);
  });
}

export const newAssistantId = randomUUID;
