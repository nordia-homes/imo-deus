import type { Transaction } from 'firebase-admin/firestore';
import { collectionFor, type AssistantContext } from './access';

export async function inspectProspectFollowups(ctx: AssistantContext, listingId: string, tx?: Transaction) {
  const favoriteRef = collectionFor(ctx, 'ownerListingFavorites').doc(listingId);
  const ownerRef = collectionFor(ctx, 'aiOutreachOwnerListingStatuses').doc(listingId);
  const callsQuery = collectionFor(ctx, 'aiOutreachCalls').where('ownerListingId', '==', listingId).limit(101);
  const tasksQuery = collectionFor(ctx, 'tasks').where('ownerListingId', '==', listingId).limit(101);
  const [favorite, owner, calls, tasks] = await Promise.all([
    tx ? tx.get(favoriteRef) : favoriteRef.get(), tx ? tx.get(ownerRef) : ownerRef.get(),
    tx ? tx.get(callsQuery) : callsQuery.get(), tx ? tx.get(tasksQuery) : tasksQuery.get(),
  ]);
  if (!favorite.exists) throw new Error('Prospectul nu există în agenție.');
  if (calls.size > 100 || tasks.size > 100) throw new Error('Istoricul depășește limita acestei operații; nu a fost modificat nimic.');
  const refused = owner.data()?.aiDoNotCall === true || ['do_not_call', 'does_not_collaborate'].includes(owner.data()?.aiOutreachOutcome)
    || favorite.data()?.contactOutcome === 'negative' && typeof favorite.data()?.contactOutcomeAt === 'string' && Number.isFinite(Date.parse(favorite.data()!.contactOutcomeAt));
  const pendingCalls = calls.docs.filter(doc => ['queued', 'scheduled', 'uncalled'].includes(doc.data().status) && !doc.data().providerDispatchStartedAt && !doc.data().vapiCallId);
  const activeCalls = calls.docs.filter(doc => doc.data().status === 'calling' || ['queued', 'scheduled', 'uncalled'].includes(doc.data().status) && (doc.data().providerDispatchStartedAt || doc.data().vapiCallId));
  const pendingTasks = tasks.docs.filter(doc => {
    const row = doc.data();
    const description = String(row.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return row.status === 'open' && (row.agentId === ctx.uid || ctx.role === 'admin') && /\b(apel|suna|sunat|follow[ -]?up)\b/.test(description);
  });
  return { ownerRef, owner, refused, pendingCalls, activeCalls, pendingTasks };
}

export async function readProspectFollowupStop(ctx: AssistantContext, input: { listingId: string }) {
  const scope = await inspectProspectFollowups(ctx, input.listingId);
  return { complete: true, refused: scope.refused, rows: [{ id: input.listingId, refused: scope.refused, pendingCalls: scope.pendingCalls.length, pendingTasks: scope.pendingTasks.length, activeCalls: scope.activeCalls.length }],
    ...(scope.refused ? { suggestedAction: { kind: 'stop_prospect_followups', listingId: input.listingId } } : {}),
    note: 'Fără modificări. Dacă refused=true copiază suggestedAction în propose_actions. Oprește apelurile AI nelansate și elimină taskurile deschise de apel/follow-up ale agentului (administratorul poate opri taskurile agenției), cu arhivă de recuperare. Nu oprește convorbirile în curs. Dacă refused=false explică lipsa refuzului înregistrat, fără acțiuni. Nu înregistra tu un refuz din cererea condițională.' };
}
