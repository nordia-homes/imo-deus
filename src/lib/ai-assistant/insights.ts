import { readResource, type AssistantContext } from './access';
import { insightStillRelevant } from './insight-relevance';
import { annotateInsightFeedback } from './insight-feedback';

export const insightSources = ['contacts', 'tasks', 'viewings', 'sales', 'conversations', 'metaCampaignDrafts', 'tiktokPostDrafts', 'aiOutreachCalls'] as const;
async function inspect(ctx: AssistantContext, resource: typeof insightSources[number], deadline: number) {
  const rows: Record<string, any>[] = [];
  let cursor: string | undefined, complete = false;
  while (rows.length < 5000 && Date.now() < deadline) {
    const page = await readResource(ctx, { resource, limit: 100, ...(cursor ? { cursor } : {}) });
    rows.push(...page.rows);
    if (page.complete) { complete = true; cursor = undefined; break; }
    if (!page.nextCursor || page.nextCursor === cursor) throw new Error('Citirea insight-urilor nu a avansat. Reîncearcă interogarea.');
    cursor = page.nextCursor;
  }
  return { rows, complete, cursor: cursor || null };
}
export async function getInsights(ctx: AssistantContext, limit = 10) {
  const pages = new Map<string, Awaited<ReturnType<typeof inspect>>>(), deadline = Date.now() + 12000;
  for (let i = 0; i < insightSources.length; i += 3) {
    await Promise.all(insightSources.slice(i, i + 3).map(async resource => { pages.set(resource, await inspect(ctx, resource, deadline)); }));
  }
  const contacts = pages.get('contacts')!, tasks = pages.get('tasks')!, viewings = pages.get('viewings')!;
  const now = Date.now(), rows: Record<string, unknown>[] = [];
  let actionableCount = 0;
  const add = (row: Record<string, unknown>) => { actionableCount++; rows.push(row); };
  for (const contact of contacts.rows) if (insightStillRelevant('lead', [contact], ctx.uid, now)) add({ id: `lead-${contact.id}`, type: 'INSIGHT_CARD', title: 'Lead necontactat de peste 48 de ore', contactId: contact.id, name: contact.name, link: `/leads/${contact.id}` });
  for (const task of tasks.rows) if (insightStillRelevant('task', [task], ctx.uid, now)) add({ id: `task-${task.id}`, type: 'TASK_CARD', title: 'Sarcină restantă', taskId: task.id, description: task.description, dueDate: task.dueDate, link: '/tasks' });
  const upcoming = viewings.rows.filter(row => row.status === 'scheduled' && Date.parse(String(row.viewingDate)) > now).sort((a, b) => Date.parse(String(a.viewingDate)) - Date.parse(String(b.viewingDate)));
  const windows = new Map<string, Record<string, any>[]>(), seen = new Set<string>();
  let comparisons = 0, analysisComplete = true;
  outer: for (const b of upcoming) {
    for (const field of ['agentId', 'contactId', 'propertyId']) {
      if (!b[field]) continue;
      const key = `${field}:${b[field]}`, start = Date.parse(String(b.viewingDate));
      const active = (windows.get(key) || []).filter(a => Date.parse(String(a.viewingDate)) + Number(a.duration || 60) * 60000 > start);
      for (const a of active) {
        if (++comparisons > 50000) { analysisComplete = false; break outer; }
        const pair = JSON.stringify([String(a.id), String(b.id)].sort());
        if (!seen.has(pair) && insightStillRelevant('conflict', [a, b], ctx.uid, now)) { seen.add(pair); add({ id: `conflict-${a.id}-${b.id}`, type: 'INSIGHT_CARD', title: 'Vizionări suprapuse', viewingIds: [a.id, b.id], link: '/viewings' }); }
      }
      active.push(b); windows.set(key, active);
    }
  }
  for (const sale of pages.get('sales')!.rows) {
    if (insightStillRelevant('sale', [sale], ctx.uid, now)) add({ id: `sale-${sale.id}`, type: 'INSIGHT_CARD', title: sale.stage === 'blocked' ? 'Dosar Sales blocat' : 'Pas Sales restant', description: sale.nextAction || 'Verifică blocajul din dosar.', saleId: sale.id, priority: 95, reason: 'Etapa sau termenul următoarei acțiuni din dosarul autorizat.', link: `/sales-management/${sale.id}` });
  }
  for (const conversation of pages.get('conversations')!.rows) {
    if (insightStillRelevant('reply', [conversation], ctx.uid, now)) add({ id: `reply-${conversation.id}`, type: 'INSIGHT_CARD', title: 'Conversație fără răspuns de peste 24 de ore', conversationId: conversation.id, priority: 85, reason: 'Ultimul mesaj primit este mai nou decât ultimul răspuns trimis.', link: '/inbox' });
  }
  for (const source of ['metaCampaignDrafts', 'tiktokPostDrafts'] as const) for (const draft of pages.get(source)!.rows) {
    if (insightStillRelevant(source === 'metaCampaignDrafts' ? 'meta' : 'tiktok', [draft], ctx.uid, now)) add({ id: `${source}-${draft.id}`, type: 'INSIGHT_CARD', title: 'Promovare care necesită verificare', draftId: draft.id, source, priority: 90, reason: 'Eroare sau rezultat extern incert; verifică înainte de orice retrimitere.', link: source === 'metaCampaignDrafts' ? '/marketing/meta-advertising' : '/marketing/tiktok-studio' });
  }
  for (const call of pages.get('aiOutreachCalls')!.rows) if (insightStillRelevant('call', [call], ctx.uid, now)) add({ id: `call-${call.id}`, type: 'INSIGHT_CARD', title: 'Apel cu rezultat extern incert', callId: call.id, priority: 90, reason: 'Furnizorul nu a confirmat crearea; verifică fără reapelare automată.', link: '/ai-calls' });
  for (const row of rows) {
    row.priority ||= String(row.id).startsWith('conflict-') ? 100 : String(row.id).startsWith('task-') ? 80 : 70;
    row.reason ||= String(row.id).startsWith('conflict-') ? 'Intervale suprapuse pentru aceeași persoană sau proprietate.' : String(row.id).startsWith('task-') ? 'Sarcină deschisă, atribuită ție, cu termen depășit.' : 'Lead nou, fără interacțiuni înregistrate, mai vechi de 48 de ore.';
  }
  rows.sort((a, b) => Number(b.priority) - Number(a.priority) || String(a.id).localeCompare(String(b.id)));
  const selected = await annotateInsightFeedback(ctx, rows.slice(0, limit));
  const inspectionComplete = [...pages.values()].every(page => page.complete), complete = inspectionComplete && analysisComplete;
  return { rows: selected, complete, inspectionComplete, analysisComplete, actionableCount, resultLimitReached: actionableCount > selected.length,
    sources: [...insightSources], coverage: Object.fromEntries([...pages].map(([source, page]) => [source, { complete: page.complete, inspected: page.rows.length }])),
    ranking: 'Reguli deterministe de urgență operațională; nu scoruri de matching sau impact financiar estimat.',
    inspectedRecords: [...pages.values()].reduce((sum, page) => sum + page.rows.length, 0), checkedAt: new Date().toISOString(),
    continuations: Object.fromEntries([...pages].map(([source, page]) => [source, page.cursor])),
    note: complete ? 'Analiză din toate paginile citite pe server, independent de paginarea interfeței. Date observate în timpul verificării; nu reprezintă un snapshot tranzacțional al agenției.' : 'Analiză parțială la limita de citire/calcul. Folosește query_records/read cu continuarea pentru raportul complet; numărul afișat nu este totalul agenției.' };
}
