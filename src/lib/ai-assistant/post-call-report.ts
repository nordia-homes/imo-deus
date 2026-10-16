import { collectionFor, readResource, getResource, type AssistantContext } from './access';
import { prospectOwner } from '@/lib/crm/prospect';
import { bucharestDay } from './owners-to-call-today';
import type { AssistantMessage } from './contracts';
type Row = Record<string, any>;
const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const outcomes = new Set(['collaborates', 'does_not_collaborate', 'call_later', 'no_answer', 'busy', 'wrong_number', 'invalid_number', 'already_sold', 'already_has_agency', 'do_not_call', 'verbal_agreement', 'negotiation_success', 'negotiation_blocked', 'needs_human_review', 'failed']);
export function prospectingReport(favorites: Row[], calls: Row[], uid: string, at: number, tasks: Row[] = []) {
  const accessible = new Map(favorites.filter(row => { const owner = prospectOwner(row, at); return !owner || owner === uid; }).map(row => [row.id, row]));
  const day = bucharestDay(at);
  const visibleCalls = calls.filter(row => accessible.has(row.ownerListingId) && (!row.agentId || row.agentId === uid));
  const todayCalls = visibleCalls.filter(row => { const date = instant(row.startedAt) ?? instant(row.endedAt); return date !== null && bucharestDay(date) === day; });
  const humanCalls = tasks.filter(row => row.status === 'completed' && accessible.has(row.ownerListingId) && (!row.agentId || row.agentId === uid) && /\b(apel|suna|sunat|follow[ -]?up)\b/.test(String(row.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())).map((row): Row => ({ ...row, endedAt: row.completedAt, channel: 'human_task' }));
  const missing = [...visibleCalls.map((row): Row => ({ ...row, channel: 'ai' })), ...humanCalls].filter(row => row.status === 'completed' && !outcomes.has(row.outcome)).filter(row => {
    const prospect = accessible.get(row.ownerListingId)!;
    const resultAt = instant(prospect.contactOutcomeAt), endedAt = instant(row.endedAt);
    return !(prospect.contactOutcome && resultAt !== null && endedAt !== null && resultAt >= endedAt && (!prospect.contactOutcomeByAgentId || prospect.contactOutcomeByAgentId === uid));
  }).map(row => ({ id: row.id, ownerListingId: row.ownerListingId, title: String(accessible.get(row.ownerListingId)!.title || row.ownerListingId), endedAt: typeof row.endedAt === 'string' ? row.endedAt : null, status: 'missing_result', channel: row.channel }));
  const manual = [...accessible.values()].filter(row => row.contactOutcome && (!row.contactOutcomeByAgentId || row.contactOutcomeByAgentId === uid) && instant(row.contactOutcomeAt) !== null && bucharestDay(instant(row.contactOutcomeAt)!) === day);
  return { day, missing, summary: { aiCallsToday: todayCalls.length, aiCompletedToday: todayCalls.filter(row => row.status === 'completed').length, aiFailedToday: todayCalls.filter(row => row.status === 'failed').length, aiMissingResultToday: missing.filter(row => row.channel === 'ai' && todayCalls.some(call => call.id === row.id)).length, humanTasksMissingResult: missing.filter(row => row.channel === 'human_task').length, manualResultsRecordedToday: manual.length, manualRefusalsToday: manual.filter(row => row.contactOutcome === 'negative').length, manualFollowupsToday: manual.filter(row => row.contactOutcome === 'follow_up').length } };
}
export async function readProspectingReport(ctx: AssistantContext) {
  const favorites: Row[] = []; let cursor: string | undefined;
  do {
    const page = await readResource(ctx, { resource: 'ownerListingFavorites', limit: 50, ...(cursor ? { cursor } : {}) }); favorites.push(...page.rows);
    if (page.complete) break;
    if (!page.nextCursor || page.nextCursor === cursor) throw new Error('Citire incompletă'); cursor = page.nextCursor;
  } while (true);
  const [calls, tasks] = await Promise.all([collectionFor(ctx, 'aiOutreachCalls').get(), collectionFor(ctx, 'tasks').get()]);
  return prospectingReport(favorites, calls.docs.map(doc => ({ ...doc.data(), id: doc.id })), ctx.uid, Date.now(), tasks.docs.map(doc => ({ ...doc.data(), id: doc.id })));
}
export function selectedPostCallProspect(history: AssistantMessage[]) {
  const message = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const cards = message?.cards?.filter(card => card.source === 'ownerListingFavorites') || [];
  const rows = cards.flatMap(card => card.rows);
  return rows.length === 1 && typeof rows[0].id === 'string' ? rows[0].id : null;
}
export async function collaborationNextSteps(ctx: AssistantContext, listingId: string) {
  const row = await getResource(ctx, 'ownerListingFavorites', listingId);
  const owner = prospectOwner(row, Date.now());
  if (owner && owner !== ctx.uid) return null;
  const status = (await collectionFor(ctx, 'aiOutreachOwnerListingStatuses').doc(listingId).get()).data();
  const refused = row.contactOutcome === 'negative' || row.collaborationStatus === 'does_not_collaborate' || status?.aiDoNotCall || ['do_not_call', 'does_not_collaborate'].includes(status?.aiOutreachOutcome);
  return { id: listingId, title: String(row.title || listingId), accepted: !refused && (row.collaborationStatus === 'collaborates' || ['collaborates', 'verbal_agreement', 'negotiation_success'].includes(status?.aiOutreachOutcome)), refused: !!refused };
}
