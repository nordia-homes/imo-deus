import { actionSchema, type AssistantAction } from './contracts';

const reference = /^@step:(\d+):([A-Za-z][A-Za-z0-9]*)$/;
const identifierKeys = new Set(['contactId', 'propertyId', 'conversationId', 'viewingId', 'taskId', 'automationId', 'templateId', 'campaignId', 'connectionId', 'draftId', 'jobId', 'portalId']);
export function isStepReference(value: string) { return reference.test(value); }
export function resolveAction(action: AssistantAction, previous: Record<string, unknown>[]): AssistantAction {
  function resolve(value: unknown, key = ''): unknown {
    if (typeof value === 'string' && key === 'aiPresenterScript' && value.startsWith('@step:')) {
      const match = value.match(reference), step = match ? Number(match[1]) : 0;
      const script = step >= 1 && step <= previous.length && match?.[2] === 'script' ? (previous[step - 1].result as Record<string, unknown>)?.script : undefined;
      if (typeof script !== 'string' || !script.trim() || script.length > 12000) throw new Error('Scenariul trebuie generat și confirmat într-un pas anterior.');
      return script;
    }
    if (typeof value === 'string' && identifierKeys.has(key) && value.startsWith('@step:')) {
      const match = value.match(reference);
      const step = match ? Number(match[1]) : 0;
      if (!match || step < 1 || step > previous.length || !identifierKeys.has(match[2])) throw new Error('Referință de pas invalidă sau rezultat încă indisponibil.');
      const result = previous[step - 1].result as Record<string, unknown> | undefined;
      const id = result?.[match[2]];
      if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('Pasul anterior nu a confirmat identificatorul solicitat.');
      return id;
    }
    if (Array.isArray(value)) return value.map(v => resolve(v, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, k)]));
    return value;
  }
  if (action.kind === 'existing_operation' && action.operation === 'message_send' && /@step:\d+:/.test(JSON.stringify({ text: action.body.text, template: action.body.template }))) throw new Error('Mesajul necesită text și parametri concreți pentru previzualizare/aprobare; nu poate trimite referințe la conținut încă negenerat.');
  return actionSchema.parse(resolve(action));
}
