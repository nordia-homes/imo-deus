import { createHash } from 'node:crypto';
import { getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantCard, type AssistantMessage } from './contracts';
import { withinResponseWindow } from '@/lib/communications/model';
import { selectedInboxConversation } from './inbox-read';
import { latestDraftContext, getMessageDraft, createTemplateMessageDraft } from './message-draft';
import { checkWhatsAppTemplates } from './whatsapp-template-check';
export function templateCommand(prompt: string): 'send' | 'fill' | 'policy' | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'trimite un template aprobat' ? 'send' : text === 'completeaza parametrii template-ului' ? 'fill' : text === 'foloseste template-ul corect daca politica o cere' ? 'policy' : null;
}
export function templateReply(prompt: string): { kind: 'choice' | 'parameters'; value: string } | null {
  const colon = prompt.indexOf(':'); if (colon < 0) return null;
  const label = normalized(prompt.slice(0, colon)).trim(), value = prompt.slice(colon + 1).trim();
  return ['sablon', 'template'].includes(label) ? { kind: 'choice', value } : label === 'parametri' ? { kind: 'parameters', value } : null;
}
export function parseTemplateParameters(value: string, count: number): string[] | null {
  if (!Number.isSafeInteger(count) || count < 0 || count > 20) return null;
  let values: unknown;
  if (value.startsWith('[')) { try { values = JSON.parse(value); } catch { return null; } }
  else values = count === 1 ? [value.trim()] : value.split(/\r?\n|;/).map(part => part.trim());
  return Array.isArray(values) && values.length === count && values.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 1000) ? values as string[] : null;
}
export const templateSignature = (row: Record<string, any>) => createHash('sha256').update(JSON.stringify([row.name, row.language, row.category, row.bodyParameterCount, row.bodyText])).digest('hex');
export function templateExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  const pending = latestDraftContext(history, 'templateDraftInput'), reply = templateReply(prompt);
  return pending?.mode === 'send' && reply && (pending.stage === 'choice' && reply.kind === 'choice' || pending.stage === 'parameters' && reply.kind === 'parameters') ? 'Trimite un template aprobat.' : prompt;
}
export async function planTemplateRequest(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const command = templateCommand(prompt), pending = latestDraftContext(history, 'templateDraftInput'), reply = templateReply(prompt);
  const cancelled = /^(anuleaza|renunta|stop|nu trimite raspunsurile inca)[.!?\s]*$/.test(normalized(prompt));
  if (!command && !(pending && (reply || cancelled))) return null;
  const cards: AssistantCard[] = [], actions: AssistantAction[] = [];
  let conversationId = '';
  const finish = (text: string, status = 'success') => ({ text, status, cards, actions, conversationId });
  if (cancelled) return finish('Am oprit completarea șablonului. Nu am inițiat trimiterea.');
  const mode = command || pending?.mode;
  try {
    const selectedDraft = latestDraftContext(history, 'messageDrafts');
    let draft: Awaited<ReturnType<typeof getMessageDraft>> | null = null;
    if (selectedDraft && typeof selectedDraft.sessionId === 'string' && typeof selectedDraft.id === 'string') draft = await getMessageDraft(ctx, selectedDraft.sessionId, selectedDraft.id);
    conversationId = command ? selectedInboxConversation(history) || draft?.row.conversationId || '' : String(pending?.conversationId || '');
    if (!conversationId) return finish('Selectează conversația WhatsApp pentru șablon.', 'clarification');
    const conversation = await getResource(ctx, 'conversations', conversationId);
    if (conversation.channel !== 'whatsapp') return finish('Șabloanele sunt disponibile pentru conversațiile WhatsApp.', 'clarification');
    cards.push({ type: 'data', source: 'conversations', title: 'Destinatar verificat', rows: [{ id: conversationId, name: conversation.name || '' }], complete: true });
    const showDraft = (sessionId: string, draftId: string, row: Record<string, any>) => cards.push({ type: 'data', source: 'messageDrafts', title: 'Șablon pregătit', rows: [{ id: draftId, sessionId, conversationId, text: row.body.sendApproval.renderedText, status: row.status, template: row.body.template || null }], complete: true });
    if (command === 'send' && draft?.row.conversationId === conversationId && draft.row.body.template && selectedDraft) {
      showDraft(String(selectedDraft.sessionId), String(selectedDraft.id), draft.row);
      actions.push({ kind: 'existing_operation', operation: 'message_send', params: { conversationId }, query: {}, body: { assistantDraftId: selectedDraft.id, assistantSessionId: selectedDraft.sessionId } });
      return finish('Trimiterea șablonului selectat este pregătită.');
    }
    if (command === 'policy' && withinResponseWindow(conversation.lastInboundAt)) {
      if (draft && selectedDraft) showDraft(String(selectedDraft.sessionId), String(selectedDraft.id), draft.row);
      return finish('Fereastra de răspuns este deschisă: ea nu impune un șablon în acest moment. Eligibilitatea mesajului concret se verifică separat la trimitere. Nu am trimis mesaje.');
    }
    const catalog = await checkWhatsAppTemplates(ctx, conversationId);
    const eligible = catalog.rows.filter(row => row.approvedAndSupported && catalog.consent[row.category === 'MARKETING' ? 'marketing' : 'service'] === 'granted');
    if (!eligible.length) return finish('Nu există un șablon aprobat, suportat și cu acordul necesar pentru acest destinatar. Nu am pregătit sau trimis mesaje.', 'clarification');
    const clarify = (stage: string, message: string, selected?: Record<string, any>) => {
      cards.push({ type: 'data', source: 'whatsappTemplates', title: 'Șabloane eligibile', rows: eligible, complete: true });
      cards.push({ type: 'data', source: 'templateDraftInput', title: 'Date necesare pentru șablon', rows: [{ mode, stage, conversationId, ...(selected ? { templateId: selected.id, signature: templateSignature(selected) } : {}) }], complete: true });
      return finish(message, 'clarification');
    };
    let selected: (typeof eligible)[number] | undefined;
    if (!command && pending?.stage === 'choice' && reply?.kind === 'choice') selected = eligible.find(row => row.id === reply.value);
    else if (!command && pending?.stage === 'parameters') selected = eligible.find(row => row.id === pending.templateId && templateSignature(row) === pending.signature);
    else {
      const previous = latestDraftContext(history, 'whatsappTemplates');
      if (previous && command === 'fill') selected = eligible.find(row => row.id === previous.id);
    }
    if (!selected) return clarify('choice', 'Alege șablonul potrivit mesajului și răspunde cu „Șablon: nume:limbă”, folosind ID-ul din listă.');
    const count = selected.bodyParameterCount;
    const parameters = count === 0 ? [] : !command && pending?.stage === 'parameters' && reply?.kind === 'parameters' ? parseTemplateParameters(reply.value, count) : null;
    if (!parameters) return clarify('parameters', `Șablonul ${selected.id} necesită ${count} valori, în ordinea {{1}}, {{2}} etc.\n${selected.bodyText}\nRăspunde cu „Parametri: valoare” pentru un câmp sau valori separate prin „;” pentru mai multe.`, selected);
    const prepared = await createTemplateMessageDraft(ctx, conversationId, { name: selected.name, language: selected.language, parameters });
    showDraft(prepared.sessionId, prepared.draftId, prepared.row);
    if (mode === 'send') actions.push({ kind: 'existing_operation', operation: 'message_send', params: { conversationId }, query: {}, body: { assistantDraftId: prepared.draftId, assistantSessionId: prepared.sessionId } });
    return finish(mode === 'send' ? 'Șablonul complet este pregătit pentru trimiterea solicitată.' : `Șablon completat:\n${prepared.row.body.sendApproval.renderedText}\nNu am trimis mesajul. Poți cere trimiterea mesajului aprobat.`);
  } catch { return finish('Șablonul sau destinatarul s-a schimbat ori nu mai este eligibil. Reia alegerea șablonului pe datele actuale. Nu am inițiat trimiterea.', 'unavailable'); }
}