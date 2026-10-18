import { z } from 'zod';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { stableId } from './crypto';
import { CommunicationError } from './server';
import { canReadResource } from '@/lib/ai-assistant/access';
const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/);
export const portalBatchSchema = z.object({ portalId: id, batchId: z.string().regex(/^[a-f0-9]{64}$/), contactId: id }).strict();
export async function validatePortalBatch(db: Firestore, actor: any, conversation: Record<string, any>, input: { portalBatch?: unknown; template?: { parameters?: string[] }; matchingSelection?: unknown }, tx?: Transaction, messageId?: string) {
 if (!input.portalBatch) return [];
 if (input.matchingSelection) throw new CommunicationError('Alege lotul portalului, nu două selecții diferite.',400);
 const binding = portalBatchSchema.parse(input.portalBatch);
 if (conversation.channel !== 'whatsapp' || conversation.contactId !== binding.contactId || !input.template) throw new CommunicationError('Lotul necesită șablon WhatsApp și conversația exactă a clientului.',409);
 const read = (ref: any): Promise<any> => tx ? tx.get(ref) : ref.get();
 const agency = db.collection('agencies').doc(actor.agencyId);
 const [contact, portal, batch] = await Promise.all([read(agency.collection('contacts').doc(binding.contactId)), read(db.collection('portals').doc(binding.portalId)), read(db.collection('portals').doc(binding.portalId).collection('deliveryBatches').doc(binding.batchId))]);
 if (!contact.exists || !portal.exists || !batch.exists || portal.data().agencyId !== actor.agencyId || portal.data().contactId !== binding.contactId || contact.data().portalId !== binding.portalId || !canReadResource(actor, 'contacts', contact.data())) throw new CommunicationError('Portalul clientului nu mai este accesibil.',403);
 const data = batch.data();
 if (!Array.isArray(data.propertyIds) || !data.propertyIds.length || data.propertyIds.length > 30 || !input.template.parameters?.includes(data.url)) throw new CommunicationError('Șablonul trebuie să includă linkul exact al lotului din portalul clientului.',409);
 const refs = [];
 for (const propertyId of data.propertyIds) {
   const property = await read(agency.collection('properties').doc(propertyId));
   const recommendation = await read(db.collection('portals').doc(binding.portalId).collection('recommendations').doc(propertyId));
   if (!property.exists || property.data().status !== 'Activ' || !canReadResource(actor,'properties',property.data()) || !recommendation.exists) throw new CommunicationError('Oferta nu mai este disponibilă în portal.',409);
   const ref = agency.collection('communicationPropertyShares').doc(stableId(binding.contactId, propertyId));
   const ledger = await read(ref);
   const history = await read(db.collection('communicationOutboundJobs').where('agencyId','==',actor.agencyId).where('input.matchingSelection.contactId','==',binding.contactId).where('input.matchingSelection.propertyId','==',propertyId).limit(1));
   if (ledger.exists && ledger.data().messageId !== messageId || !history.empty && history.docs[0].id !== messageId) throw new CommunicationError('O ofertă din lot are deja o trimitere. Recalculează ofertele noi; nu retrimite lotul.',409);
   if (!ledger.exists) refs.push({ ref, propertyId, contactId: binding.contactId, portalId: binding.portalId, batchId: binding.batchId });
 }
 return refs;
}
