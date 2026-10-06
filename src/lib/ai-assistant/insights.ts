import { readResource, type AssistantContext } from './access';
import { overlaps } from './contracts';

async function inspect(ctx: AssistantContext, resource: 'contacts' | 'tasks' | 'viewings') {
  const rows: Record<string, any>[] = [];
  let cursor: string | undefined, complete = false;
  while (rows.length < 5000) {
    const page = await readResource(ctx, { resource, limit: 100, ...(cursor ? { cursor } : {}) });
    rows.push(...page.rows);
    if (page.complete) { complete = true; cursor = undefined; break; }
    if (!page.nextCursor || page.nextCursor === cursor) throw new Error('Citirea insight-urilor nu a avansat. Reîncearcă interogarea.');
    cursor = page.nextCursor;
  }
  return { rows, complete, cursor: cursor || null };
}
export async function getInsights(ctx: AssistantContext, limit = 10) {
  const [contacts, tasks, viewings] = await Promise.all(['contacts', 'tasks', 'viewings'].map(resource => inspect(ctx, resource as 'contacts' | 'tasks' | 'viewings')));
  const now = Date.now(), rows: Record<string, unknown>[] = [];
  let actionableCount = 0;
  const add = (row: Record<string, unknown>) => { actionableCount++; if (rows.length < limit) rows.push(row); };
  for (const contact of contacts.rows) if (contact.status === 'Nou' && !contact.archivedAt && Date.parse(String(contact.createdAt)) <= now - 48 * 3600000 && !contact.interactionHistory?.length) add({ id: `lead-${contact.id}`, type: 'INSIGHT_CARD', title: 'Lead necontactat de peste 48 de ore', contactId: contact.id, name: contact.name, link: `/leads/${contact.id}` });
  for (const task of tasks.rows) if (task.status === 'open' && task.agentId === ctx.uid && Date.parse(String(task.dueDate)) < now) add({ id: `task-${task.id}`, type: 'TASK_CARD', title: 'Sarcină restantă', taskId: task.id, description: task.description, dueDate: task.dueDate, link: '/tasks' });
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
        if (!seen.has(pair) && overlaps(String(a.viewingDate), Number(a.duration || 60), String(b.viewingDate), Number(b.duration || 60))) { seen.add(pair); add({ id: `conflict-${a.id}-${b.id}`, type: 'INSIGHT_CARD', title: 'Vizionări suprapuse', viewingIds: [a.id, b.id], link: '/viewings' }); }
      }
      active.push(b); windows.set(key, active);
    }
  }
  const inspectionComplete = [contacts, tasks, viewings].every(page => page.complete), complete = inspectionComplete && analysisComplete;
  return { rows, complete, inspectionComplete, analysisComplete, actionableCount, resultLimitReached: actionableCount > rows.length,
    inspectedRecords: contacts.rows.length + tasks.rows.length + viewings.rows.length, checkedAt: new Date().toISOString(),
    continuations: { contacts: contacts.cursor, tasks: tasks.cursor, viewings: viewings.cursor },
    note: complete ? 'Analiză din toate paginile citite pe server, independent de paginarea interfeței. Date observate în timpul verificării; nu reprezintă un snapshot tranzacțional al agenției.' : 'Analiză parțială la limita de citire/calcul. Folosește query_records/read cu continuarea pentru raportul complet; numărul afișat nu este totalul agenției.' };
}
