import { readResource, type AssistantContext } from './access';
import { overlaps } from './contracts';
export async function getInsights(ctx: AssistantContext, limit = 10) {
  const [contacts, tasks, viewings] = await Promise.all(['contacts', 'tasks', 'viewings'].map(resource => readResource(ctx, { resource: resource as 'contacts' | 'tasks' | 'viewings', limit: 100 })));
  const now = Date.now(), rows: Record<string, unknown>[] = [];
  for (const contact of contacts.rows) if (contact.status === 'Nou' && !contact.archivedAt && Date.parse(String(contact.createdAt)) <= now - 48 * 3600000 && !(contact.interactionHistory as unknown[])?.length) rows.push({ id: `lead-${contact.id}`, type: 'INSIGHT_CARD', title: 'Lead necontactat de peste 48 de ore', contactId: contact.id, name: contact.name, link: `/leads/${contact.id}` });
  for (const task of tasks.rows) if (task.status === 'open' && task.agentId === ctx.uid && Date.parse(String(task.dueDate)) < now) rows.push({ id: `task-${task.id}`, type: 'TASK_CARD', title: 'Sarcină restantă', taskId: task.id, description: task.description, dueDate: task.dueDate, link: '/tasks' });
  const upcoming = viewings.rows.filter(row => row.status === 'scheduled' && Date.parse(String(row.viewingDate)) > now);
  for (let i = 0; i < upcoming.length; i++) for (let j = i + 1; j < upcoming.length; j++) { const a = upcoming[i], b = upcoming[j]; if ((a.agentId === b.agentId || a.contactId === b.contactId || a.propertyId === b.propertyId) && overlaps(String(a.viewingDate), Number(a.duration || 60), String(b.viewingDate), Number(b.duration || 60))) rows.push({ id: `conflict-${a.id}-${b.id}`, type: 'INSIGHT_CARD', title: 'Vizionări suprapuse', viewingIds: [a.id, b.id], link: '/viewings' }); }
  return { rows: rows.slice(0, limit), complete: [contacts, tasks, viewings].every(page => page.complete), inspectedRecords: contacts.rows.length + tasks.rows.length + viewings.rows.length, note: [contacts, tasks, viewings].every(page => page.complete) ? 'Verificat din date reale.' : 'Analiză parțială; continuă citirea pentru întregul corpus.' };
}
