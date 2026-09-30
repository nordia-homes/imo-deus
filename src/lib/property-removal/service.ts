import { createHash, randomUUID } from 'node:crypto';
import { listingIdFor } from '@/lib/collaboration/id';
import type { Property, PropertyDeletionEvent, PropertyStatusEvent } from '@/lib/types';
import { lifecycleRef, PropertyLifecycleError, withPropertyOperation, type PropertyContext } from './lifecycle';
import type { RemovalInput, RemovalResult, PortalRemovalResult } from './schema';

export type RemovalContext = PropertyContext & { uid: string; role: string; demo: boolean };
type Withdraw = (portal: string, ctx: RemovalContext, property: Property) => Promise<boolean>;
const labels: Record<string, string> = { imobiliare: 'Imobiliare.ro', storia: 'Storia', publi24: 'Publi24 / Romimo' };

export function requiredPortals(property: Property, attempts: Record<string, boolean>, romimoSubmitted: boolean) {
  const portals = new Set<string>();
  for (const [portal, promotion] of Object.entries(property.promotions || {})) {
    if (promotion && (promotion.status !== 'unpublished' || promotion.remoteId || promotion.link)) portals.add(portal);
  }
  for (const [portal, attempted] of Object.entries(attempts)) if (attempted) portals.add(portal);
  const imobiliare = property.portalProfiles?.imobiliare;
  if (imobiliare?.lastPublishedAt || imobiliare?.lastPublishAuditHistory?.length) portals.add('imobiliare');
  const storia = property.portalProfiles?.storia;
  if (storia?.remoteUuid || storia?.lastPublishedAt || storia?.lastPublishAuditHistory?.length) portals.add('storia');
  if (romimoSubmitted) portals.add('publi24');
  return [...portals].sort();
}

// Detect a changed mapping before using a previous successful withdrawal.
function identity(property: Property, portal: string) {
  if (portal === 'imobiliare') return property.portalProfiles?.imobiliare?.customReference || property.id;
  if (portal === 'storia') return property.portalProfiles?.storia?.remoteUuid || String(property.promotions?.storia?.remoteId || '');
  if (portal === 'publi24') return property.id; // Romimo external ID is deterministic.
  return String(property.promotions?.[portal]?.remoteId || property.promotions?.[portal]?.link || '');
}

export async function removeProperty(ctx: RemovalContext, input: RemovalInput, withdraw?: Withdraw): Promise<RemovalResult> {
  if (!['admin', 'agent'].includes(ctx.role)) throw new PropertyLifecycleError('Acces nepermis.', 403);
  const agency = ctx.db.collection('agencies').doc(ctx.agencyId);
  const propertyRef = agency.collection('properties').doc(ctx.propertyId);
  const operationRef = lifecycleRef(ctx);
  const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return withPropertyOperation(ctx, 'remove', async () => {
    const [snapshot, operation, romimo] = await Promise.all([
      propertyRef.get(), operationRef.get(),
      ctx.db.collection('agencyPrivateIntegrations').doc(`${ctx.agencyId}__romimo`).collection('operations').doc(ctx.propertyId).get(),
    ]);
    const state = operation.data() || {};
    if (state.result?.complete && (!snapshot.exists || state.completedInputHash === inputHash)) return state.result as RemovalResult;
    if (!snapshot.exists) throw new PropertyLifecycleError('Proprietatea nu există în agenția ta.', 404);
    const property = { ...snapshot.data(), id: snapshot.id } as Property;
    const portals = ctx.demo ? [] : requiredPortals(property, state.attemptedPortals || {}, romimo.data()?.submitted === true);
    // Match the existing Storia withdrawal permission, before any external call.
    if (portals.includes('storia') && ctx.role !== 'admin') throw new PropertyLifecycleError('Retragerea de pe Storia trebuie finalizată de administratorul agenției.', 403);
    await operationRef.set({ removalRequested: true, requestedByUid: ctx.uid, inputHash }, { merge: true });
    const runWithdrawal = withdraw || (await import('./portals')).withdrawPortal;
    const results: PortalRemovalResult[] = await Promise.all(portals.map(async portal => {
      const name = labels[portal] || portal;
      const previous = state.withdrawals?.[portal];
      if (previous?.confirmed && previous.identity === identity(property, portal)) {
        return { portal, state: 'withdrawn', message: `${name}: retragere confirmată.` };
      }
      if (!labels[portal]) return { portal, state: 'error', message: `${name}: retragerea automată nu este disponibilă. Retrage anunțul manual și actualizează asocierea înainte de ștergere.` };
      try {
        const confirmed = await runWithdrawal(portal, ctx, property);
        await operationRef.set({ withdrawals: { [portal]: { confirmed, identity: identity(property, portal), checkedAt: new Date().toISOString() } } }, { merge: true });
        return { portal, state: confirmed ? 'withdrawn' : 'pending', message: confirmed ? `${name}: retragere confirmată.` : `${name}: retragerea nu este încă confirmată. Reîncearcă pentru verificare.` };
      } catch {
        return { portal, state: 'error', message: `${name}: retragerea nu a putut fi confirmată. Verifică integrarea și asocierea anunțului, apoi reîncearcă.` };
      }
    }));
    const pending: RemovalResult = { complete: false, portals: results };
    if (results.some(result => result.state !== 'withdrawn')) {
      await operationRef.set({ result: pending }, { merge: true });
      return pending;
    }

    const soldByAgency = input.reason === 'sold' && input.soldDisposition === 'agency';
    const result: RemovalResult = { complete: true, outcome: soldByAgency ? 'sold' : 'deleted', portals: results };
    const eventId = randomUUID();
    await ctx.db.runTransaction(async tx => {
      const [currentSnapshot, currentOperation] = await Promise.all([tx.get(propertyRef), tx.get(operationRef)]);
      if (currentOperation.data()?.owner !== state.owner) throw new PropertyLifecycleError('Operațiunea trebuie reluată.');
      if (!currentSnapshot.exists) throw new PropertyLifecycleError('Proprietatea nu mai există.', 409);
      const current = { ...currentSnapshot.data(), id: ctx.propertyId } as Property;
      const currentPortals = ctx.demo ? [] : requiredPortals(current, state.attemptedPortals || {}, romimo.data()?.submitted === true);
      if (currentPortals.some(portal => !portals.includes(portal) || identity(current, portal) !== identity(property, portal))) {
        throw new PropertyLifecycleError('Asocierile cu portalurile s-au schimbat. Reîncearcă retragerea.');
      }
      const now = new Date().toISOString();
      const promotions = { ...current.promotions };
      for (const portal of portals) promotions[portal] = { ...promotions[portal], status: 'unpublished', lastSync: now, link: '', errorMessage: '' };
      const propertySnapshot: Property = {
        ...current, promotions, price: input.reason === 'sold' ? input.soldPrice! : current.price,
        status: input.reason === 'sold' ? 'Vândut' : current.status ?? 'Inactiv', statusUpdatedAt: now,
        ...(soldByAgency ? { soldPrice: input.soldPrice! } : {}),
      };
      if (soldByAgency) {
        const event: PropertyStatusEvent = {
          id: eventId, agencyId: ctx.agencyId, propertyId: ctx.propertyId, changedAt: now,
          previousStatus: current.status ?? null, nextStatus: 'Vândut', reason: 'sale_completed',
          reasonLabel: 'Vandut de agentia mea', agentMessage: input.agentMessage, soldPrice: input.soldPrice!,
          marketAnalysisEligible: true, propertySnapshot,
        };
        tx.update(propertyRef, { price: propertySnapshot.price, soldPrice: input.soldPrice!, status: 'Vândut', statusUpdatedAt: now, promotions });
        tx.set(agency.collection('propertyStatusEvents').doc(eventId), event);
      } else {
        const event: PropertyDeletionEvent = {
          id: eventId, agencyId: ctx.agencyId, propertyId: ctx.propertyId, deletedAt: now, reason: input.reason,
          reasonLabel: input.reason === 'sold' ? input.soldDisposition === 'other_agency' ? 'Vandut de alta agentie' : 'Vandut de proprietar' : input.reason === 'collaboration_ended' ? 'Colaborare incetata' : 'Nu prezinta interes',
          agentMessage: input.agentMessage, soldPrice: input.reason === 'sold' ? input.soldPrice! : null,
          listingPriceAtDeletion: current.price, marketAnalysisEligible: input.reason === 'sold', propertySnapshot,
        };
        tx.set(agency.collection('propertyDeletionEvents').doc(eventId), event);
        tx.delete(propertyRef);
      }
      tx.set(ctx.db.collection('collaborationListings').doc(listingIdFor(ctx.agencyId, ctx.propertyId)), { status: 'closed', updatedAt: now }, { merge: true });
      tx.set(operationRef, { result, inputHash, completedInputHash: inputHash, completedAt: now, eventId }, { merge: true });
    });
    return result;
  });
}
