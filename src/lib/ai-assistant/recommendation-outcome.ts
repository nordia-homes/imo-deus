import { getResource, type AssistantContext } from './access';

export async function recommendationOutcome(ctx: AssistantContext, contactId: string, propertyIds: string[], receipt: Record<string, any>) {
  const evidence = (confirmed: boolean, note: string) => ({ executionState: confirmed ? 'succeeded' : 'unknown', businessStatus: confirmed ? 'portal_recommended' : 'portal_unconfirmed', completionSatisfied: confirmed, watchable: false, verifiedAt: new Date().toISOString(), evidenceSource: 'current_domain_state', note });
  const expected = [...new Set(propertyIds)].sort();
  if (typeof receipt.portalId !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(receipt.portalId) || !Array.isArray(receipt.propertyIds) || JSON.stringify([...new Set(receipt.propertyIds)].sort()) !== JSON.stringify(expected)) return evidence(false, 'Receiptul nu confirmă recomandările cerute. Nu se repetă acțiunea.');
  const contact = await getResource(ctx, 'contacts', contactId);
  const portal = await getResource(ctx, 'portals', receipt.portalId);
  if (contact.portalId !== receipt.portalId || portal.contactId !== contactId) return evidence(false, 'Portalul curent nu mai corespunde clientului și recomandării aprobate.');
  const matches = await Promise.all(expected.map(async id => {
    const property = await getResource(ctx, 'properties', id);
    const doc = await ctx.adminDb.collection('portals').doc(receipt.portalId).collection('recommendations').doc(id).get();
    return property.status === 'Activ' && doc.exists && (doc.data()?.propertyId || doc.data()?.id) === id;
  }));
  const currentContact = await getResource(ctx, 'contacts', contactId), currentPortal = await getResource(ctx, 'portals', receipt.portalId);
  if (currentContact.portalId !== receipt.portalId || currentPortal.contactId !== contactId) return evidence(false, 'Portalul a fost schimbat în timpul verificării. Rezultatul anterior nu este confirmat.');
  return evidence(matches.every(Boolean), matches.every(Boolean) ? 'Proprietățile sunt confirmate în portalul clientului. Aceasta nu confirmă trimiterea sau livrarea unui mesaj.' : 'Unele recomandări au fost eliminate sau proprietățile nu mai sunt active. Nu au fost înlocuite automat.');
}
