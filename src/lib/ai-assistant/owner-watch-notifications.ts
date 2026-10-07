import { notificationTransactionReads } from './notification-transaction';
import { z } from 'zod';
import type { Transaction } from 'firebase-admin/firestore';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { getOwnerListingScope, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type { Agency } from '@/lib/types';
import type { AssistantContext } from './access';
import { idSchema, searchSchema, type AssistantSearch } from './contracts';
import { searchMatches } from './search';
import { importedListingIds } from './imported-listings';
import { insightQuietDeferral, type InsightQuietHours } from './insight-notification-policy';
import { readNotificationBudget } from './notification-budget';
import { readWatchCooldown } from './watch-notification-cooldown';
import { priorWatchNotification } from './watch-notification-id';

export const ownerWatchConditionSchema = z.object({ listingId: idSchema, search: searchSchema.omit({ cursor: true, limit: true }).extend({ source: z.literal('owners') }) }).strict();

export async function readOwnerWatchRelevance(ctx: AssistantContext, tx: Transaction, condition: z.infer<typeof ownerWatchConditionSchema>) {
  const listing = await tx.get(ctx.adminDb.collection('ownerListings').doc(condition.listingId));
  if (!listing.exists) return { reason: 'entity_deleted' as const };
  const row = listing.data()!;
  const agency = await tx.get(ctx.adminDb.collection('agencies').doc(ctx.agencyId));
  const scope = condition.search.scopeKey ? getOwnerListingScope(condition.search.scopeKey) : resolveAgencyOwnerListingScope(agency.data() as Agency);
  if (!scope || row.scopeKey !== scope.key || !searchMatches(row, { ...condition.search, limit: 1 })) return { reason: 'state_changed' as const };
  if (condition.search.excludeImported && (await importedListingIds(ctx, [{ id: condition.listingId, row }], tx)).has(condition.listingId)) return { reason: 'state_changed' as const };
  return { reason: null, row };
}

export async function createOwnerWatchNotification(ctx: AssistantContext, automationId: string, id: string, listingId: string, search: AssistantSearch, quietHours?: InsightQuietHours, cooldownMinutes = 1440, repeatAlerts?: boolean) {
  const { cursor: _cursor, limit: _limit, ...criteria } = search;
  const condition = ownerWatchConditionSchema.parse({ listingId, search: { ...criteria, source: 'owners' } });
  const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(id);
  return ctx.adminDb.runTransaction(async rawTx => {
    const tx = notificationTransactionReads(rawTx);
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Permisiunile automatizării s-au schimbat.');
    if ((await tx.get(ref)).exists) return { status: 'existing', notificationId: id };
    const priorId = await priorWatchNotification(ctx, tx, automationId, listingId, repeatAlerts);
    if (priorId) return { status: 'existing', notificationId: priorId };
    const quiet = insightQuietDeferral(quietHours);
    if (quiet) return quiet;
    const fresh = await readOwnerWatchRelevance(ctx, tx, condition);
    if (fresh.reason) return { status: 'skipped', reasonCode: fresh.reason };
    const cooldown = await readWatchCooldown(ctx, tx, ['owner', listingId], cooldownMinutes);
    if (cooldown.skipped) return cooldown.skipped;
    const budget = await readNotificationBudget(ctx, tx);
    const quietAfterReads = insightQuietDeferral(quietHours, budget.now);
    if (quietAfterReads) return quietAfterReads;
    if (budget.deferred) return budget.deferred;
    budget.consume();
    cooldown.consume();
    tx.create(ref, { eventId: id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Anunț potrivit căutării salvate', body: String(fresh.row!.title || ''), actionUrl: '/owner-listings', entityType: 'ownerListing', entityId: listingId, isRead: false, createdAt: new Date().toISOString(), automationId, ownerWatchCondition: condition });
    return { status: 'created', notificationId: id };
  });
}
