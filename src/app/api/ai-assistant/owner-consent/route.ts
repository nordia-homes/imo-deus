import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext, collectionFor } from '@/lib/ai-assistant/access';
import { idSchema } from '@/lib/ai-assistant/contracts';
import { stableId } from '@/lib/communications/crypto';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { CommunicationError } from '@/lib/communications/server';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';

export const runtime = 'nodejs';
const schema = z.object({ listingId: idSchema, connectionId: idSchema, confirmedPhoneConsent: z.literal(true), purpose: z.enum(['marketing', 'service']), calledAt: z.string().datetime({ offset: true }), evidence: z.string().trim().min(10).max(2000) }).strict();
// Intentionally absent from model tools. Only explicit agent attestation may grant consent.
export async function POST(request: Request) {
  try {
    const ctx = await assistantContext(request);
    if (isDemoAgencyId(ctx.agencyId)) throw new CommunicationError('Comunicarea externă este indisponibilă în demo.', 403);
    const input = schema.parse(JSON.parse(await readBoundedText(request.body, 16000)));
    if (Date.parse(input.calledAt) > Date.now()) throw new CommunicationError('Apelul nu poate fi în viitor.');
    const result = await ctx.adminDb.runTransaction(async tx => {
      const [favorite, connection] = await Promise.all([tx.get(collectionFor(ctx, 'ownerListingFavorites').doc(input.listingId)), tx.get(collectionFor(ctx, 'channelConnections').doc(input.connectionId))]);
      const row = favorite.data();
      if (!row || row.isFavoriteActive === false || (ctx.role !== 'admin' && row.reservedByAgentId !== ctx.uid)) throw new CommunicationError('Anunțul trebuie să fie în prospectarea ta.', 403);
      if (connection.data()?.channel !== 'whatsapp' || connection.data()?.status !== 'connected') throw new CommunicationError('Alege un număr WhatsApp conectat.');
      const local = normalizeRomanianPhone(row.ownerPhone);
      if (!/^0[237]\d{8}$/.test(local)) throw new CommunicationError('Telefonul proprietarului nu este disponibil sau valid.');
      const phone = `40${local.slice(1)}`;
      const conversationId = stableId(input.connectionId, phone);
      const conversation = collectionFor(ctx, 'conversations').doc(conversationId);
      const consent = collectionFor(ctx, 'communicationConsents').doc(stableId(input.connectionId, phone, input.purpose));
      const [previous, global] = await Promise.all([tx.get(conversation), tx.get(collectionFor(ctx, 'communicationConsents').doc(stableId(input.connectionId, phone, 'all')))]);
      if (previous.exists && !canReadConversation(ctx, previous.data() as Conversation)) throw new CommunicationError('Conversația este atribuită altui agent.', 403);
      if (global.data()?.status === 'revoked') throw new CommunicationError('Proprietarul a oprit comunicările. Este necesară verificarea reabonării de către administrator.', 409);
      const now = new Date().toISOString();
      if (!previous.exists) tx.create(conversation, { id: conversationId, agencyId: ctx.agencyId, channel: 'whatsapp', connectionId: input.connectionId, externalParticipantId: phone, name: row.ownerName || row.title || phone, phone, contactId: null, propertyIds: [], assigneeId: ctx.uid, collaboratorIds: [], accessUids: [ctx.uid], status: 'new', lastMessageAt: now, latestMessage: '', lastInboundAt: null, lastOutboundAt: null, needsReply: false, readBy: {}, version: 1, createdAt: now, ownerListingId: input.listingId });
      const record = { conversationId, connectionId: input.connectionId, phone, ownerListingId: input.listingId, purpose: input.purpose, status: 'granted', source: 'agent_phone_attestation', calledAt: new Date(input.calledAt).toISOString(), evidence: input.evidence, recordedBy: ctx.uid, recordedAt: now };
      tx.set(consent, record);
      tx.create(consent.collection('history').doc(), record);
      return { conversationId, recordedAt: now, purpose: input.purpose };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
