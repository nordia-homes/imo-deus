import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
vi.mock('../message-draft', () => ({ latestDraftContext: (history: any[], source: string) => history.at(-1)?.cards?.find((card: any) => card.source === source)?.rows[0], getMessageDraft: vi.fn(), createTemplateMessageDraft: vi.fn() }));
vi.mock('../whatsapp-template-check', () => ({ checkWhatsAppTemplates: vi.fn() }));
import { parseTemplateParameters, templateCommand, templateExecutionPrompt, templateReply, templateSignature } from '../template-draft';
it.each([['Trimite un template aprobat.', 'send'], ['Completează parametrii template-ului.', 'fill'], ['Folosește template-ul corect dacă politica o cere.', 'policy']])('recognizes %s', (prompt, mode) => expect(templateCommand(prompt)).toBe(mode));
it('does not interpret negation or explanations as a send', () => {
  expect(templateCommand('Nu trimite un template aprobat')).toBeNull(); expect(templateCommand('Explică: trimite un template aprobat')).toBeNull();
});
it('parses only explicitly labelled selection and parameter replies', () => {
  expect(templateReply('Șablon: colaborare:ro')).toEqual({ kind: 'choice', value: 'colaborare:ro' });
  expect(templateReply('Parametri: Alin; mâine')).toEqual({ kind: 'parameters', value: 'Alin; mâine' });
  expect(templateReply('Trimite altceva')).toBeNull();
});
it('requires the exact parameter count without changing literal values', () => {
  expect(parseTemplateParameters('Alin; mâine', 2)).toEqual(['Alin', 'mâine']);
  expect(parseTemplateParameters('Alin; Matei', 1)).toEqual(['Alin; Matei']);
  expect(parseTemplateParameters('["Alin; Matei", "07:30"]', 2)).toEqual(['Alin; Matei', '07:30']);
  for (const value of ['', 'Alin', 'Alin;', '[1, 2]', '["Alin"]']) expect(parseTemplateParameters(value, 2)).toBeNull();
  expect(parseTemplateParameters('[]', 0)).toEqual([]); expect(parseTemplateParameters('x', 21)).toBeNull();
});
it('continues only a pending send and matching stage, never fill, policy or cancellation', () => {
  const history = (mode: string, stage: string): any[] => [{ role: 'assistant', cards: [{ source: 'templateDraftInput', rows: [{ mode, stage }] }] }];
  expect(templateExecutionPrompt('Parametri: Alin', history('send', 'parameters'))).toBe('Trimite un template aprobat.');
  expect(templateExecutionPrompt('Șablon: x:ro', history('send', 'choice'))).toBe('Trimite un template aprobat.');
  for (const mode of ['fill', 'policy']) expect(templateExecutionPrompt('Parametri: Alin', history(mode, 'parameters'))).toBe('Parametri: Alin');
  expect(templateExecutionPrompt('Parametri: Alin', history('send', 'choice'))).toBe('Parametri: Alin');
  expect(templateExecutionPrompt('Anulează', history('send', 'parameters'))).toBe('Anulează');
});
it('pins meaning as well as parameter count while values are requested', () => {
  const row = { name: 'a', language: 'ro', category: 'MARKETING', bodyParameterCount: 1, bodyText: 'Bună {{1}}' };
  for (const patch of [{ category: 'UTILITY' }, { language: 'en_US' }, { bodyParameterCount: 2 }, { bodyText: 'Oferta {{1}} EUR' }]) expect(templateSignature({ ...row, ...patch })).not.toBe(templateSignature(row));
});
import { getResource } from '../access';
import { createTemplateMessageDraft } from '../message-draft';
import { checkWhatsAppTemplates } from '../whatsapp-template-check';
import { planTemplateRequest } from '../template-draft';
it.each(['changed', 'paused', 'revoked', 'invalid', 'cancelled', 'valid'])('rechecks the pending template before preparation: %s', async variant => {
  vi.clearAllMocks();
  const original = { id: 'hello:ro', name: 'hello', language: 'ro', category: 'MARKETING', bodyParameterCount: 1, bodyText: 'Bună {{1}}', approvedAndSupported: true };
  const row = { ...original, ...(variant === 'changed' ? { bodyText: 'Preț {{1}} EUR' } : {}), ...(variant === 'paused' ? { approvedAndSupported: false } : {}) };
  vi.mocked(getResource).mockResolvedValue({ channel: 'whatsapp' } as any);
  vi.mocked(checkWhatsAppTemplates).mockResolvedValue({ rows: [row], consent: { marketing: variant === 'revoked' ? 'revoked' : 'granted' } } as any);
  vi.mocked(createTemplateMessageDraft).mockResolvedValue({ sessionId: 's', draftId: 'd', row: { status: 'prepared', body: { sendApproval: { renderedText: 'Bună Alin' }, template: { name: 'hello' } } } } as any);
  const history: any[] = [{ role: 'assistant', cards: [{ source: 'templateDraftInput', rows: [{ mode: 'send', stage: 'parameters', conversationId: 'c', templateId: original.id, signature: templateSignature(original) }] }] }];
  const result = await planTemplateRequest({} as any, variant === 'cancelled' ? 'Anulează' : variant === 'invalid' ? 'Parametri: ["Alin", "extra"]' : 'Parametri: Alin', history);
  expect(result).not.toBeNull();
  if (variant === 'valid') {
    expect(createTemplateMessageDraft).toHaveBeenCalledWith({}, 'c', { name: 'hello', language: 'ro', parameters: ['Alin'] });
    expect(result!.actions).toHaveLength(1);
  } else {
    expect(createTemplateMessageDraft).not.toHaveBeenCalled();
    expect(result!.actions).toEqual([]);
    if (variant === 'changed') expect(result!.cards.find(card => card.source === 'templateDraftInput')?.rows[0].stage).toBe('choice');
    if (variant === 'cancelled') expect(getResource).not.toHaveBeenCalled();
  }
});