import { createHash } from 'node:crypto';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import type { AssistantContext } from './access';
import { readOfficialSource } from './legal-source';
import { officialUrl } from './official-source-contract';

export async function watchOfficialSources(ctx: AssistantContext, automationId: string, urls: string[], previous: Record<string, string> = {}) {
  const versions: Record<string, string> = {}, changes: { sourceUrl: string; previousSnapshotId: string; snapshotId: string }[] = [];
  for (const input of urls) {
    const sourceUrl = officialUrl(input).href;
    const source = await readOfficialSource(ctx, sourceUrl);
    const key = createHash('sha256').update(sourceUrl).digest('hex');
    versions[key] = source.snapshotId;
    if (!previous[key] || previous[key] === source.snapshotId) continue;
    const change = { sourceUrl, previousSnapshotId: previous[key], snapshotId: String(source.snapshotId) };
    const id = createHash('sha256').update(JSON.stringify([automationId, source.snapshotId])).digest('hex');
    const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(`legal-${id}`);
    await ctx.adminDb.runTransaction(async tx => {
      await assertAutomationFence(ctx.adminDb, tx, ctx);
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, { eventId: ref.id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Conținutul unei surse oficiale s-a schimbat', body: `${source.authority}: verifică diferențele și aplicabilitatea. Modificarea textului nu confirmă intrarea în vigoare.`, actionUrl: '/ai-assistant', ...change, isRead: false, createdAt: new Date().toISOString() });
    });
    changes.push(change);
  }
  return { versions, changes, checked: urls.length, temporalValidityVerified: false, note: 'Prima citire stabilește referința. Doar schimbările de conținut produc notificări; analiza juridică necesită revizuire.' };
}
