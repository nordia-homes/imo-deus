import { randomUUID } from 'node:crypto';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import type { AssistantContext } from './access';
import { reconcileRuleNotifications } from './notification-relevance';

// A bounded, recurring scan also reaches alerts outside the browser's loaded page.
// Relevance writes are idempotent and revalidate membership and sources in their own transaction.
export async function sweepAssistantNotifications(db: Firestore, limit = 25, timeBudgetMs = 10000) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(timeBudgetMs) || timeBudgetMs < 1 || timeBudgetMs > 10000) throw new Error('Invalid notification scan budget');
  const state = db.collection('assistantWorkerState').doc('notificationSweep');
  const token = randomUUID(), started = Date.now();
  const claim = await db.runTransaction(async tx => {
    const row = (await tx.get(state)).data();
    if (row?.leaseUntil > Date.now()) return null;
    const cursor = row?.cursor ?? null;
    if (cursor !== null && (typeof cursor !== 'string' || !/^(?:[^/]+\/)+notifications\/[^/]+$/.test(cursor) || cursor.split('/').length % 2 !== 0)) throw new Error('Invalid notification scan cursor');
    const priorStart = typeof row?.cycleStartedAt === 'string' ? Date.parse(row.cycleStartedAt) : NaN;
    const knownCycle = Number.isFinite(priorStart) && priorStart <= started && typeof row?.cycleHadFailures === 'boolean' && row?.cycleCoverageKnown === true;
    tx.set(state, { token, leaseUntil: Date.now() + 60000, lastAttemptAt: new Date().toISOString(),
      cycleStartedAt: cursor === null || !Number.isFinite(priorStart) || priorStart > started ? new Date(started).toISOString() : row!.cycleStartedAt,
      cycleCoverageKnown: cursor === null || knownCycle,
      cycleHadFailures: cursor === null ? false : row?.cycleHadFailures === true,
    }, { merge: true });
    return { cursor };
  });
  if (!claim) return { status: 'busy', scanned: 0, checked: 0, withdrawn: 0, failed: 0 };
  let cursor = claim.cursor, scanned = 0, checked = 0, withdrawn = 0, failed = 0, cycleComplete = false;
  try {
    let query = db.collectionGroup('notifications').orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(db.doc(cursor));
    const page = await query.get();
    for (const doc of page.docs) {
      if (Date.now() - started >= timeBudgetMs) break;
      const parts = doc.ref.path.split('/'), row = doc.data();
      try {
        if (parts.length === 4 && parts[0] === 'users' && row.type === 'ai_assistant' && row.recipientId === parts[1] && row.automationId && !row.withdrawnAt) {
          const member = (await db.collection('users').doc(parts[1]).get()).data();
          if (member && member.agencyId === row.agencyId && typeof member.agencyId === 'string' && member.agencyId && ['agent', 'admin'].includes(member.role)) {
            const ctx = { uid: parts[1], agencyId: member.agencyId, role: member.role, adminDb: db, authorization: '', runtimeMode: 'real' } as AssistantContext;
            const result = await reconcileRuleNotifications(ctx, { ids: [doc.id] });
            checked += result.checked; withdrawn += result.withdrawn;
          }
        }
      } catch {
        // A bad binding or transient failure must not starve all later inboxes.
        // The next full cycle retries it; no exception content or CRM data is persisted.
        failed++;
      }
      cursor = doc.ref.path; scanned++;
    }
    cycleComplete = scanned === page.size && page.size < limit;
    if (cycleComplete) cursor = null;
    const committed = await db.runTransaction(async tx => {
      const row = (await tx.get(state)).data();
      if (row?.token !== token || row.leaseUntil <= Date.now()) return false;
      const finishedAt = new Date().toISOString(), hadFailures = row.cycleHadFailures === true || failed > 0;
      tx.update(state, { cursor, leaseUntil: 0, scanned, checked, withdrawn, failed, cycleComplete, lastFinishedAt: finishedAt,
        cycleHadFailures: hadFailures,
        ...(cycleComplete ? { lastCycle: { startedAt: row.cycleStartedAt, finishedAt, coverageKnown: row.cycleCoverageKnown === true, hadFailures } } : {}),
      });
      return true;
    });
    return { status: committed ? 'completed' : 'lease_lost', scanned, checked, withdrawn, failed, cycleComplete };
  } catch (error) {
    await db.runTransaction(async tx => {
      if ((await tx.get(state)).data()?.token === token) tx.update(state, { leaseUntil: 0, lastFailedAt: new Date().toISOString(), cycleHadFailures: true });
    });
    throw error;
  }
}
