import { createHash } from 'node:crypto';
import { validateBriefSettings, quietAt, type BriefSettings } from './daily-brief-contract';
import { zonedParts } from './zoned-time';
import { getInsights } from './insights';
import { collectionFor, type AssistantContext } from './access';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { normalizedContactFields } from '@/lib/crm/contact-identity';

export async function deliverDailyBrief(ctx: AssistantContext, settings: BriefSettings, now = new Date()) {
  validateBriefSettings(settings);
  const local = zonedParts(now, settings.timezone), weekday = new Date(local.date + 'T12:00:00Z').getUTCDay();
  if (!settings.daysOfWeek.includes(weekday) || quietAt(local.time, settings.quietStart, settings.quietEnd) || local.time < settings.deliveryTime) return { deferred: true, reason: 'În afara ferestrei de livrare.' };
  const digest = createHash('sha256').update(`${ctx.agencyId}:${ctx.uid}:${local.date}:daily-sales-brief`).digest('hex');
  const receipt = collectionFor(ctx, 'assistantArtifacts').doc(`brief-${digest}`);
  const prior = await receipt.get();
  if (prior.exists) return { deduplicated: true, status: prior.data()?.status === 'prepared' ? 'unknown' : prior.data()?.status || 'unknown', receiptId: digest };
  // Fresh authorized reads immediately before delivery; no memory snapshots.
  const report = await getInsights(ctx, settings.maxItems);
  if (!report.rows.length) return { empty: true, complete: report.complete, sources: report.sources || [] };
  const body = ((report.complete ? '' : 'Analiză parțială; unele date nu au fost parcurse.\n') + report.rows.map((row, index) => `${index + 1}. ${String(row.title)}${row.description ? ': ' + String(row.description).slice(0, 120) : ''}`).join('\n')).slice(0, 900);
  const notification = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(digest);
  if (settings.deliveryChannel === 'whatsapp') {
    if (isDemoAgencyId(ctx.agencyId)) throw new Error('Livrarea externă este indisponibilă în demo.');
    const conversation = await getConversation(ctx.adminDb, ctx, settings.conversationId!);
    const actor = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
    const ownPhone = normalizedContactFields({ phone: actor?.phone }).normalizedPhone;
    if (conversation.channel !== 'whatsapp' || !ownPhone || ownPhone !== normalizedContactFields({ phone: conversation.phone || conversation.externalParticipantId }).normalizedPhone) throw new Error('Brief-ul poate fi trimis numai la numărul tău configurat în profil. Alege conversația corespunzătoare.');
  }
  const claimed = await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [existing, member] = await Promise.all([tx.get(receipt), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Acces revocat.');
    if (existing.exists) return false;
    tx.create(receipt, { actorId: ctx.uid, date: local.date, timezone: settings.timezone, status: settings.deliveryChannel === 'app' ? 'delivered' : 'prepared', channel: settings.deliveryChannel, createdAt: now.toISOString(), complete: report.complete });
    if (settings.deliveryChannel === 'app') tx.set(notification, { eventId: digest, agencyId: ctx.agencyId, recipientId: ctx.uid, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Prioritățile zilei', body, actionUrl: '/ai-assistant', isRead: false, createdAt: now.toISOString() });
    return true;
  });
  if (!claimed) return { deduplicated: true, receiptId: digest };
  if (settings.deliveryChannel === 'whatsapp') {
    const requestId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    try {
      const result = await queueMessage(ctx.adminDb, ctx, settings.conversationId!, { requestId, template: { name: settings.templateName!, language: settings.templateLanguage, parameters: [body] } });
      await receipt.update({ status: result.status || 'queued', updatedAt: new Date().toISOString() });
      return { receiptId: digest, status: result.status || 'queued', complete: report.complete };
    } catch {
      await receipt.update({ status: 'unknown', updatedAt: new Date().toISOString() });
      throw new Error('Livrarea brief-ului necesită verificare; nu se retrimite automat.');
    }
  }
  return { receiptId: digest, status: 'delivered', complete: report.complete, sources: report.sources || [] };
}
