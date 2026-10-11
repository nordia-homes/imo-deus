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
