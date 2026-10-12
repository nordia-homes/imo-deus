import { ownerHistoryReply } from '../owner-history-continuation';
import { expect, it } from 'vitest';
import { pendingProspectRequest, prospectExecutionPrompt, prospectClarification, prospectPlanningPrompt } from '../prospect-continuation';
import { prospectPatch } from '@/lib/crm/prospect';
import type { AssistantAction, AssistantMessage } from '../contracts';
const selection: AssistantMessage = { id: 's', role: 'assistant', text: 'Selectat', createdAt: '2026-10-11T07:00:00Z', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Selectat', rows: [{ id: 'p' }] }] };
const prompt = 'Actualizează statusul prospectului selectat.';
const pending = pendingProspectRequest(prompt, 'clarification', [selection]);
const clarification: AssistantMessage = { ...selection, cards: [], prospectContinuation: pending };
const action: AssistantAction = { kind: 'update_prospect', listingId: 'p', patch: { collaborationStatus: 'collaborates' } };
it('retains only a single selected prospect for an unresolved request', () => {
  expect(prospectClarification(prompt, [selection])).toContain('Ce status');
  expect(prospectClarification('Schimbă starea prospectului curent.', [selection])).toContain('Ce status');
  expect(prospectClarification('Adaugă rezultatul apelului de azi.', [selection])).toContain('Care a fost');
  expect(prospectClarification('Adaugă în prospectare condițiile discutate cu proprietarul.', [selection])).toContain('Ce condiții');
  expect(prospectClarification('Actualizează statusul prospectului selectat: colaborează.', [selection])).toBeUndefined();
  expect(pending).toEqual({ listingId: 'p', request: prompt });
  expect(pendingProspectRequest(prompt, 'success', [selection])).toBeUndefined();
  expect(pendingProspectRequest(prompt, 'clarification', [])).toBeUndefined();
  expect(pendingProspectRequest(prompt, 'clarification', [{ ...selection, cards: [{ ...selection.cards![0], rows: [{ id: 'p' }, { id: 'q' }] }] }])).toBeUndefined();
});
it('continues the original request only for the same prospect and immediate answer', () => {
  expect(prospectPlanningPrompt('Colaborează.', [clarification])).toBe(`${prompt}\nColaborează.`);
  expect(prospectPlanningPrompt('Anulează.', [clarification])).toBe('Anulează.');
  expect(prospectExecutionPrompt('Colaborează.', [action], [clarification])).toContain(prompt);
  for (const answer of ['Anulează.', 'Nu vreau.', 'Doar explică.', 'Nu modifica.']) expect(prospectExecutionPrompt(answer, [action], [clarification])).toBe(answer);
  expect(prospectExecutionPrompt('Nu colaborează.', [action], [clarification])).toContain(prompt);
  expect(prospectExecutionPrompt('Vizionările se fac doar după ora 18:00.', [action], [clarification])).toContain(prompt);
  expect(prospectExecutionPrompt('Colaborează.', [{ ...action, listingId: 'q' }], [clarification])).toBe('Colaborează.');
  expect(prospectExecutionPrompt('Colaborează.', [action], [clarification, selection])).toBe('Colaborează.');
});
it('appends call results without replacing notes or silently truncating history', () => {
  expect(prospectPatch({ notes: 'Istoric' }, { appendNote: 'Apel azi: refuz.' }, 'u', 'Agent', 'now').notes).toBe('Istoric\nApel azi: refuz.');
  expect(() => prospectPatch({ notes: 'x'.repeat(10000) }, { appendNote: 'nou' }, 'u', 'Agent', 'now')).toThrow('limita');
  expect(() => prospectPatch({}, { appendNote: 'nou', notes: 'înlocuit' }, 'u', 'Agent', 'now')).toThrow('distincte');
  expect(() => prospectPatch({}, { state: 'taken', contactOutcome: 'negative' }, 'u', 'Agent', 'now')).toThrow('distincte');
});

it('resumes owner history only from an immediate phone answer and the same page selection', () => {
  const history: AssistantMessage[] = [{ ...clarification, ownerHistoryContinuation: { listingId: 'p', request: 'Arată istoricul proprietarului.' } }];
  for (const answer of ['+40 722 123 456', '0040 722 123 456', 'Telefonul proprietarului este 0722123456.']) expect(ownerHistoryReply(answer, history)?.phone).toBe('0722123456');
  expect(ownerHistoryReply('0722', history)?.phone).toBeNull();
  for (const answer of ['Anulează.', 'Nu știu.', 'Programează o vizionare la 0722123456', '0722123456 sau 0733123456']) expect(ownerHistoryReply(answer, history)).toBeUndefined();
  expect(ownerHistoryReply('0722123456', [...history, selection])).toBeUndefined();
  expect(ownerHistoryReply('0722123456', [...history, { ...selection, id: 'current-page-context', cards: [] }])?.phone).toBe('0722123456');
  expect(ownerHistoryReply('0722123456', [...history, { ...selection, id: 'current-page-context', cards: [{ ...selection.cards![0], rows: [{ id: 'q' }] }] }])).toBeUndefined();
  expect(ownerHistoryReply('0722123456', [...history, { ...selection, id: 'current-page-context' }])?.phone).toBe('0722123456');
});

it('distinguishes yes/no association answers from phone answers, cancellation and new requests', () => {
  const pending = { listingId: 'p', request: 'Arată istoricul.', phone: '0722123456', association: { propertyId: 'imported', title: 'Apartament', referenceHash: 'current' } };
  const history: AssistantMessage[] = [{ ...clarification, ownerHistoryContinuation: pending }];
  expect(ownerHistoryReply('Da.', history)).toMatchObject({ associationAnswered: true, phone: '0722123456', associations: [{ propertyId: 'imported', referenceHash: 'current', related: true }] });
  expect(ownerHistoryReply('Nu.', history)?.associations?.[0].related).toBe(false);
  expect(ownerHistoryReply('Nu știu.', history)?.associationAnswered).toBe(false);
  for (const answer of ['Anulează.', '0722123456', 'Programează o vizionare', 'Da, trimite mesaj']) expect(ownerHistoryReply(answer, history)).toBeUndefined();
});

it('freezes the contacted phone with a new outcome and clears it with an explicit outcome reset', () => {
  const saved = prospectPatch({ ownerPhone: '+40 722 123 456' }, { contactOutcome: 'follow_up' }, 'u', 'Agent', '2026-10-12T10:00:00Z');
  expect(saved.contactOutcomePhone).toBe('0722123456');
  expect(prospectPatch(saved, { notes: 'Detalii' }, 'u', 'Agent', 'now')).not.toHaveProperty('contactOutcomePhone');
  expect(prospectPatch(saved, { contactOutcome: null }, 'u', 'Agent', 'now').contactOutcomePhone).toBeNull();
  expect(prospectPatch({}, { contactOutcome: 'negative' }, 'u', 'Agent', 'now').contactOutcomePhone).toBeNull();
});
