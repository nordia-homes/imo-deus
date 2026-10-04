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

export async function matchContact(ctx: AssistantContext, contactId: string, limit: number) {
  const contact = await getResource(ctx, 'contacts', contactId);
  const properties = await collectionFor(ctx, 'properties').where('status', '==', 'Activ').get();
  return getDeterministicMatchedProperties(contact as Contact, properties.docs.map(d => ({ ...d.data(), id: d.id })) as Property[], limit).map(p => ({ id: p.id, title: p.title, price: p.price, location: p.location, matchScore: p.matchScore, reasoning: p.reasoning, link: `/properties/${p.id}` }));
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
      if (previous.exists) {
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
    if (prior.exists) return prior.data()?.result;
    const profile = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (profile.data()?.agencyId !== ctx.agencyId || profile.data()?.role !== ctx.role || !['agent', 'admin'].includes(profile.data()?.role)) throw new CommunicationError('Acces revocat.', 403);
    const read = async (resource: string, id: string) => {
      const doc = await tx.get(collectionFor(ctx, resource).doc(id));
      if (!doc.exists) throw new CommunicationError(`${resource}: înregistrarea nu există.`, 404);
      return doc.data()!;
    };
    let result: Record<string, unknown>;
    if (action.kind === 'create_contact') {
      const ref = collectionFor(ctx, 'contacts').doc(key);
      const { kind: _, ...data } = action;
      tx.create(ref, { ...data, id: ref.id, status: 'Nou', source: 'AI Assistant', agentId: ctx.uid, createdAt: now });
      result = { contactId: ref.id, link: `/leads/${ref.id}` };
    } else if (action.kind === 'create_property') {
      const ref = collectionFor(ctx, 'properties').doc(key);
      tx.create(ref, { ...action.property, id: ref.id, status: 'Inactiv', agentId: ctx.uid, createdAt: now });
      result = { propertyId: ref.id, link: `/properties/${ref.id}`, note: 'Proprietatea a fost creată ca Inactiv. Activeaz-o după verificarea datelor.' };
    } else if (action.kind === 'archive_contact') {
      await read('contacts', action.contactId);
      tx.update(collectionFor(ctx, 'contacts').doc(action.contactId), { archivedAt: action.archived ? now : null, archivedByAge: false, updatedAt: now });
      result = { contactId: action.contactId, archived: action.archived, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'assign_record') {
      if (ctx.role !== 'admin') throw new CommunicationError('Reatribuirea înregistrărilor necesită administratorul.', 403);
      await read(action.resource, action.id);
      const agent = await tx.get(ctx.adminDb.collection('users').doc(action.agentId));
      if (agent.data()?.agencyId !== ctx.agencyId || !['admin', 'agent'].includes(agent.data()?.role)) throw new CommunicationError('Agentul nu aparține agenției.');
      tx.update(collectionFor(ctx, action.resource).doc(action.id), { agentId: action.agentId, agentName: agent.data()?.name || '', updatedAt: now });
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
      if (!property.title || !property.address || !(property.price > 0) || !(property.squareFootage > 0) || !Array.isArray(property.images) || !property.images.length) throw new CommunicationError('Completează titlul, adresa, prețul, suprafața și imaginile înainte de activare.');
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), { status: 'Activ', importNeedsReview: false, updatedAt: now });
      result = { propertyId: action.propertyId, link: `/properties/${action.propertyId}` };
    } else if (action.kind === 'update_property_status') {
      const property = await read('properties', action.propertyId);
      if (action.status === 'Vândut' && !action.soldPrice) throw new CommunicationError('Precizează prețul final de vânzare.');
      if (action.reason && !(action.status === 'Rezervat' ? action.reason.startsWith('reservation_') : action.status === 'Vândut' && action.reason.startsWith('sale_'))) throw new CommunicationError('Motivul nu corespunde statusului.');
      const patch = { status: action.status, statusUpdatedAt: now, updatedAt: now, ...(action.status === 'Vândut' ? { soldPrice: action.soldPrice } : {}) };
      const reasonLabels: Record<string, string> = { reservation_offer_accepted: 'Oferta acceptată', reservation_financing_pending: 'Așteaptă finanțare', reservation_documents_pending: 'Așteaptă acte', sale_completed: 'Tranzacție finalizată', sale_cash: 'Vânzare cash', sale_financed: 'Vânzare prin credit' };
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), patch);
      tx.create(collectionFor(ctx, 'propertyStatusEvents').doc(key), { id: key, agencyId: ctx.agencyId, propertyId: action.propertyId, actorId: ctx.uid, changedAt: now, previousStatus: property.status || null, nextStatus: action.status, reason: action.reason || 'agent_instruction', reasonLabel: action.reason ? reasonLabels[action.reason] : 'La solicitarea agentului', agentMessage: action.notes || `Status ${action.status} solicitat de agent prin AI Assistant.`, soldPrice: action.soldPrice || null, marketAnalysisEligible: action.status === 'Vândut', propertySnapshot: { ...property, ...patch, id: action.propertyId } });
      result = { propertyId: action.propertyId, title: property.title || '', previousStatus: property.status, status: action.status, link: `/properties/${action.propertyId}`, note: `Status actualizat: ${action.status}. Sincronizarea portalurilor este separată.` };
    } else if (action.kind === 'add_property_note' || action.kind === 'set_property_featured') {
      const property = await read('properties', action.propertyId);
      const patch = action.kind === 'set_property_featured' ? { featured: action.featured } : { notes: [property.notes || '', action.notes].filter(Boolean).join('\n\n') };
      tx.update(collectionFor(ctx, 'properties').doc(action.propertyId), { ...patch, updatedAt: now });
      result = { propertyId: action.propertyId, title: property.title || '', ...patch, link: `/properties/${action.propertyId}` };
    } else if (action.kind === 'update_property') {
      const property = await read('properties', action.propertyId);
      if (!['Activ', 'Inactiv'].includes(property.status)) throw new CommunicationError('Proprietatea nu poate fi editată în această etapă.');
      const ref = collectionFor(ctx, 'properties').doc(action.propertyId);
      tx.update(ref, { ...action.patch, updatedAt: now });
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
      if (action.kind === 'update_contact') tx.update(ref, { ...action.patch, updatedAt: now });
      else tx.update(ref, { interactionHistory: [...(contact.interactionHistory || []), { id: key, type: action.type, date: now, notes: action.notes, agentId: ctx.uid }] });
      result = { contactId: action.contactId, link: `/leads/${action.contactId}` };
    } else if (action.kind === 'create_task') {
      const contact = action.contactId ? await read('contacts', action.contactId) : null;
      const property = action.propertyId ? await read('properties', action.propertyId) : null;
      const ref = collectionFor(ctx, 'tasks').doc(key);
      tx.create(ref, { id: ref.id, description: action.description, dueDate: action.dueDate, status: 'open', agentId: ctx.uid, createdAt: now, ...(contact ? { contactId: action.contactId, contactName: contact.name } : {}), ...(property ? { propertyId: action.propertyId, propertyTitle: property.title } : {}) });
      result = { taskId: ref.id, link: '/tasks' };
    } else if (action.kind === 'update_task') {
      await read('tasks', action.taskId);
      const {kind: _, taskId: __, ...patch} = action;
      if (!Object.keys(patch).length) throw new CommunicationError('Precizează modificarea sarcinii.');
      tx.update(collectionFor(ctx, 'tasks').doc(action.taskId), { ...patch, updatedAt: now });
      result = { taskId: action.taskId, link: '/tasks' };
    } else if (action.kind === 'delete_task' || action.kind === 'delete_viewing') {
      const resource = action.kind === 'delete_task' ? 'tasks' : 'viewings', id = action.kind === 'delete_task' ? action.taskId : action.viewingId;
      const previous = await read(resource, id);
      tx.delete(collectionFor(ctx, resource).doc(id));
      tx.create(collectionFor(ctx, 'assistantDeletedRecords').doc(key), { resource, id, previous, actorId: ctx.uid, deletedAt: now });
      result = { id, deleted: true, link: action.kind === 'delete_task' ? '/tasks' : '/viewings' };
    } else if (action.kind === 'schedule_viewing' || action.kind === 'update_viewing') {
      const old = action.kind === 'update_viewing' ? await read('viewings', action.viewingId) : null;
      const contactId = action.kind === 'schedule_viewing' ? action.contactId : String(old?.contactId);
      const propertyId = action.kind === 'schedule_viewing' ? action.propertyId : String(old?.propertyId);
      const [contact, property, lock] = await Promise.all([read('contacts', contactId), read('properties', propertyId), tx.get(collectionFor(ctx, 'assistantLocks').doc('calendar'))]);
      const status = action.kind === 'schedule_viewing' ? 'scheduled' : action.status;
      const viewingDate = action.viewingDate || String(old?.viewingDate);
      const duration = action.duration || Number(old?.duration || 60);
      const agentId = String(old?.agentId || ctx.uid);
      if (status === 'scheduled') {
        if (Date.parse(viewingDate) <= Date.now()) throw new CommunicationError('Vizionarea trebuie programată în viitor.');
        if (!['Activ', 'Rezervat'].includes(property.status)) throw new CommunicationError('Proprietatea nu este disponibilă pentru vizionare.');
        const nearby = await tx.get(collectionFor(ctx, 'viewings').where('viewingDate', '>=', new Date(Date.parse(viewingDate) - 4 * 3600000).toISOString()).where('viewingDate', '<', new Date(Date.parse(viewingDate) + duration * 60000).toISOString()));
        if (nearby.docs.some(d => d.id !== (action.kind === 'update_viewing' ? action.viewingId : key) && d.data().status === 'scheduled' && (d.data().agentId === agentId || d.data().contactId === contactId || d.data().propertyId === propertyId) && overlaps(viewingDate, duration, d.data().viewingDate, d.data().duration || 60))) throw new CommunicationError('Intervalul se suprapune cu o vizionare a agentului, clientului sau proprietății.', 409);
      }
      const ref = collectionFor(ctx, 'viewings').doc(action.kind === 'update_viewing' ? action.viewingId : key);
      const record = { contactId, contactName: contact.name, propertyId, propertyTitle: property.title, propertyAddress: property.address || property.location || '', agentId, viewingDate, duration, status, notes: action.notes ?? old?.notes ?? '', updatedAt: now };
      tx.set(ref, { ...record, ...(old ? {} : { id: ref.id, createdAt: now }) }, { merge: true });
      tx.set(collectionFor(ctx, 'assistantLocks').doc('calendar'), { version: Number(lock.data()?.version || 0) + 1 });
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
      const record = await read('assistantAutomations', action.automationId);
      if (record.actorId !== ctx.uid) throw new CommunicationError('Automatizarea aparține altui agent.', 403);
      const job = ctx.adminDb.collection('assistantAutomationJobs').doc(`${ctx.agencyId}-${action.automationId}`);
      const fresh = await tx.get(job);
      if (fresh.data()?.status === 'running') throw new CommunicationError('Automatizarea este în execuție. Așteaptă rezultatul.', 409);
      if (action.status === 'active' && ['completed', 'unknown', 'blocked'].includes(String(fresh.data()?.status))) throw new CommunicationError('Creează o automatizare nouă după verificarea rezultatului.');
      tx.update(collectionFor(ctx, 'assistantAutomations').doc(action.automationId), { status: action.status, updatedAt: now });
      tx.update(job, { status: action.status, updatedAt: now });
      result = { automationId: action.automationId, status: action.status };
    } else throw new CommunicationError('Acțiune necunoscută.');
    tx.create(ledger, { actorId: ctx.uid, action, status: 'completed', result, completedAt: now });
    return safeData(result);
  });
}

export const newAssistantId = randomUUID;
