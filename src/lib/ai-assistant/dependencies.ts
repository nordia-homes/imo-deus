import { actionSchema, type AssistantAction } from './contracts';
import { verifiedOutput } from './verified-outputs';

const reference = /^@step:(\d+):([A-Za-z][A-Za-z0-9]*)$/;
const identifierKeys = new Set(['saleId', 'messageId', 'contactId', 'propertyId', 'conversationId', 'viewingId', 'taskId', 'automationId', 'templateId', 'campaignId', 'connectionId', 'draftId', 'jobId', 'portalId', 'projectId', 'assetId']);
export function isStepReference(value: string) { return reference.test(value); }
export function resolveAction(action: AssistantAction, previous: Record<string, unknown>[]): AssistantAction {
  function resolve(value: unknown, key = '', path = ''): unknown {
    if (typeof value === 'string' && value.startsWith('@step:') && path === 'body.url' && action.kind === 'existing_operation' && action.operation === 'tiktok_studio_asset_create') {
      const match = value.match(reference), step = match ? Number(match[1]) : 0;
      const url = step >= 1 && step <= previous.length && match?.[2] === 'videoUrl' ? verifiedOutput(previous[step - 1], 'videoUrl') : undefined;
      if (!url) throw new Error('Materialul video trebuie verificat înainte de import.');
      return url;
    }
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
      const verified = match[2] === 'assetId' ? verifiedOutput(previous[step - 1], 'assetId') : undefined;
      if (verified && result?.assetId != null && result.assetId !== verified) throw new Error('Identificatorul materialului diferă de rezultatul verificat. Continuarea necesită reconciliere.');
      const id = verified ?? result?.[match[2]];
      if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('Pasul anterior nu a confirmat identificatorul solicitat.');
      return id;
    }
    if (Array.isArray(value)) return value.map(v => resolve(v, key === 'sourceAssetIds' ? 'assetId' : key, path));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, k, path ? `${path}.${k}` : k)]));
    return value;
  }
  if (action.kind === 'existing_operation' && action.operation === 'message_send' && /@step:\d+:/.test(JSON.stringify({ text: action.body.text, template: action.body.template }))) throw new Error('Mesajul necesită text și parametri concreți pentru previzualizare/aprobare; nu poate trimite referințe la conținut încă negenerat.');
  if (action.kind === 'prepare_sale_email' && /@step:\d+:/.test(JSON.stringify({ to: action.to, cc: action.cc, bcc: action.bcc, subject: action.subject, bodyText: action.bodyText, bodyHtml: action.bodyHtml, questions: action.questions }))) throw new Error('Emailul necesită destinatari și conținut concret pentru previzualizare.');
  return actionSchema.parse(resolve(action));
}
