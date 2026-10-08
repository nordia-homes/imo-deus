import type { AssistantAction } from './contracts';
export function explicitInstants(prompt: string) {
  return new Set((prompt.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})/g) || []).filter(value => Number.isFinite(Date.parse(value))).map(value => new Date(value).toISOString()));
}
export function validateActionDates(actions: AssistantAction[], verified: Set<string>) {
  function visit(value: unknown, key = '') {
    if (key === 'firstAvailable' && value && typeof value === 'object') for (const date of Object.values(value)) {
      if (typeof date !== 'string' || !verified.has(new Date(date).toISOString())) throw new Error('Fereastra primului interval trebuie verificată prin calendar_availability.');
    }
    if (['dueDate', 'viewingDate', 'nextRunAt', 'stopAfter', 'runAt', 'scheduledAt', 'publishAt'].includes(key) && typeof value === 'string' && !verified.has(new Date(value).toISOString())) throw new Error('Data trebuie confirmată prin resolve_datetime sau ISO explicit din comanda agentului.');
    if (Array.isArray(value)) value.forEach(item => visit(item, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([field, item]) => visit(item, field));
  }
  actions.forEach(action => visit(action));
}
