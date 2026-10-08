import { bucharestInputFromIso } from '@/lib/bucharest-time';
// Uses committed executor receipts, never the model's proposed actions.
export function executionConfirmation(results: Record<string, unknown>[]): string {
  return results.map(step => {
    if (step.kind === 'schedule_viewing') return viewingConfirmation([step]);
    const receipt = step.result as Record<string, unknown> | undefined;
    if (!['create_task', 'update_task'].includes(String(step.kind)) || !receipt || typeof receipt.taskId !== 'string' || !receipt.taskId) return '';
    const verb = step.kind === 'create_task' ? 'creat' : receipt.status === 'completed' ? 'finalizat' : 'actualizat';
    const date = typeof receipt.dueDate === 'string' ? receipt.dueDate.includes('T') ? bucharestInputFromIso(receipt.dueDate).date : receipt.dueDate : '';
    return `Task ${verb}${typeof receipt.description === 'string' ? `: „${receipt.description}”` : ''}.${date ? ` Data: ${date}${typeof receipt.startTime === 'string' && receipt.startTime ? `, ${receipt.startTime}, ora Bucureștiului` : ''}.` : ''} ID: ${receipt.taskId}.`;
  }).filter(Boolean).join('\n');
}

export function viewingConfirmation(results: Record<string, unknown>[]): string {
  const confirmations: string[] = [];
  for (const step of results) {
    const receipt = step.result as Record<string, unknown> | undefined;
    if (step.kind !== 'schedule_viewing' || !receipt || typeof receipt.viewingId !== 'string' || !receipt.viewingId || typeof receipt.viewingDate !== 'string' || !Number.isFinite(Date.parse(receipt.viewingDate))) continue;
    const when = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(receipt.viewingDate));
    confirmations.push(`Vizionare programată${typeof receipt.propertyTitle === 'string' ? ` pentru „${receipt.propertyTitle}”` : ''}${typeof receipt.contactName === 'string' ? ` cu ${receipt.contactName}` : ''}: ${when}, ora Bucureștiului. ID: ${receipt.viewingId}.`);
  }
  return confirmations.join('\n');
}
