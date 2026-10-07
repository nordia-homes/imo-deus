import { createHash } from 'node:crypto';
import { z } from 'zod';
import { validateBriefSettings, quietAt, type BriefSettings } from './daily-brief-contract';
import { zonedParts } from './zoned-time';
import { getInsights } from './insights';
import { collectionFor, type AssistantContext } from './access';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { personalRecipientProof, personalRecipientSchema } from '@/lib/communications/personal-recipient';
import { stableId } from '@/lib/communications/crypto';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { readBriefDelivery, briefDeliverySchema } from './brief-delivery';

export async function deliverDailyBrief(ctx: AssistantContext, settings: BriefSettings, now = new Date(), scheduledFor = now.toISOString()) {
  validateBriefSettings(settings);
  const scheduledAt = Date.parse(scheduledFor);
  if (!z.string().datetime({ offset: true }).safeParse(scheduledFor).success || !Number.isFinite(scheduledAt)) throw new Error('Data programată a brief-ului este invalidă.');
  const local = zonedParts(now, settings.timezone), weekday = new Date(local.date + 'T12:00:00Z').getUTCDay();
  const scheduledDate = zonedParts(new Date(scheduledAt), settings.timezone).date;
  // Missed local days are not replayed after scheduler downtime. Keep the
  // automation active for its next valid slot, without sending a stale brief.
  if (scheduledDate < local.date) return { deferred: true, reasonCode: 'missed_local_day', reason: 'Ziua locală programată a fost ratată; brief-ul nu se recuperează prin trimitere întârziată.', scheduledFor, scheduledDate, currentDate: local.date, timezone: settings.timezone };
  if (scheduledAt > now.getTime()) return { deferred: true, reasonCode: 'not_due', reason: 'Momentul programat nu a fost atins.', scheduledFor };
  if (!settings.daysOfWeek.includes(weekday) || quietAt(local.time, settings.quietStart, settings.quietEnd) || local.time < settings.deliveryTime) return { deferred: true, reason: 'În afara ferestrei de livrare.' };
  const digest = createHash('sha256').update(`${ctx.agencyId}:${ctx.uid}:${local.date}:daily-sales-brief`).digest('hex');
  const receipt = collectionFor(ctx, 'assistantArtifacts').doc(`brief-${digest}`);
  const prior = await receipt.get();
  if (prior.exists) return { deduplicated: true, receiptId: digest, ...await readBriefDelivery(ctx, digest) };
  // Fresh authorized reads immediately before delivery; no memory snapshots.
  const report = await getInsights(ctx, settings.maxItems);
  if (!report.rows.length) return { empty: true, complete: report.complete, sources: report.sources || [] };
  const body = ((report.complete ? '' : 'Analiză parțială; unele date nu au fost parcurse.\n') + report.rows.map((row, index) => `${index + 1}. ${String(row.title)}${row.description ? ': ' + String(row.description).slice(0, 120) : ''}`).join('\n')).slice(0, 900);
  const notification = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(digest);
  const requestId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  let delivery: z.infer<typeof briefDeliverySchema> | undefined;
  let personalRecipient: z.infer<typeof personalRecipientSchema> | undefined;
  if (settings.deliveryChannel === 'whatsapp') {
    if (isDemoAgencyId(ctx.agencyId)) throw new Error('Livrarea externă este indisponibilă în demo.');
    const conversation = await getConversation(ctx.adminDb, ctx, settings.conversationId!);
    const actor = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
    personalRecipient = personalRecipientProof(ctx, { ...conversation, id: settings.conversationId }, actor);
    delivery = briefDeliverySchema.parse({ conversationId: settings.conversationId, requestId, messageId: stableId(ctx.agencyId, requestId), recipientRevision: recipientRevision({ ...conversation, id: settings.conversationId }), template: { name: settings.templateName, language: settings.templateLanguage, parameters: [body] } });
  }
  const claimed = await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [existing, member] = await Promise.all([tx.get(receipt), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Acces revocat.');
    if (existing.exists) return false;
    tx.create(receipt, { actorId: ctx.uid, date: local.date, timezone: settings.timezone, status: settings.deliveryChannel === 'app' ? 'delivered' : 'prepared', channel: settings.deliveryChannel, createdAt: now.toISOString(), complete: report.complete, ...(delivery ? { delivery } : {}) });
    if (settings.deliveryChannel === 'app') tx.set(notification, { eventId: digest, agencyId: ctx.agencyId, recipientId: ctx.uid, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Prioritățile zilei', body, actionUrl: '/ai-assistant', isRead: false, createdAt: now.toISOString() });
    return true;
  });
  if (!claimed) return { deduplicated: true, receiptId: digest, ...await readBriefDelivery(ctx, digest) };
  if (settings.deliveryChannel === 'whatsapp') {
    try {
      const result = await queueMessage(ctx.adminDb, ctx, settings.conversationId!, { requestId, personalRecipient, template: { name: settings.templateName!, language: settings.templateLanguage, parameters: [body] } });
      await receipt.update({ status: result.status || 'queued', updatedAt: new Date().toISOString() });
      return { receiptId: digest, complete: report.complete, ...await readBriefDelivery(ctx, digest) };
    } catch {
      await receipt.update({ status: 'unknown', updatedAt: new Date().toISOString() });
      throw Object.assign(new Error('Livrarea brief-ului necesită verificare; nu se retrimite automat.'), { briefReceiptId: digest });
    }
  }
  return { receiptId: digest, status: 'delivered', complete: report.complete, sources: report.sources || [] };
}
