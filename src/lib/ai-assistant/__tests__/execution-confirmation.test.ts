import { expect, it } from 'vitest';
import { viewingConfirmation, executionConfirmation } from '../execution-confirmation';
import { operationResult } from '../operation-result';
it('confirms follow-up stopping only from execution and separately reports ongoing calls', () => {
  expect(executionConfirmation([{ kind: 'stop_prospect_followups', listingId: 'p' }])).toBe('');
  const result = { executionState: 'succeeded', listingId: 'p', refusalVerified: true, canceledCallIds: ['c'], removedTaskIds: ['t'], activeCallIds: ['running'] };
  expect(executionConfirmation([{ kind: 'stop_prospect_followups', result }])).toContain('nu au fost oprite');
  expect(executionConfirmation([{ kind: 'stop_prospect_followups', result: { ...result, refusalVerified: false } }])).toContain('Nu am oprit');
});

it('confirms provider acceptance without claiming a finished conversation', () => {
  const call = { id: 'call-1', status: 'calling', vapiCallId: 'provider-1' };
  const confirm = (patch = {}) => executionConfirmation([{ kind: 'existing_operation', result: operationResult('outreach_start', { call: { ...call, ...patch } }) }]);
  expect(confirm()).toContain('Furnizorul a acceptat apelul AI.');
  expect(confirm()).toContain('Rezultatul conversației este încă în așteptare.');
  expect(confirm({ vapiCallId: '' })).toBe('');
  expect(confirm({ providerErrorCode: 'vapi_create_unknown' })).toContain('incertă');
  expect(confirm({ providerErrorCode: 'vapi_create_unknown' })).not.toContain('a acceptat');
  expect(confirm({ status: 'canceled' })).toContain('anulat');
  expect(confirm({ status: 'failed' })).toContain('eșuat');
});

it('confirms only a future saved schedule in Bucharest time', () => {
  const confirm = (scheduledAt: string) => executionConfirmation([{ kind: 'existing_operation', result: operationResult('outreach_start', { call: { id: 'call-2', status: 'scheduled', scheduledAt } }) }]);
  expect(confirm('2099-01-01T05:30:00Z')).toContain('07:30, ora Bucureștiului');
  expect(confirm('2099-07-01T04:30:00Z')).toContain('07:30, ora Bucureștiului');
  expect(confirm('2099-01-01T05:30:00Z')).toContain('nu a fost încă efectuat');
  expect(confirm('2020-01-01T05:30:00Z')).toBe('');
  expect(confirm('invalid')).toBe('');
  expect(executionConfirmation([{ kind: 'existing_operation', result: { operation: 'outreach_start', callId: 'other', executionState: 'running', call: { id: 'call-2', status: 'calling', vapiCallId: 'provider' } } }])).toBe('');
});
it('confirms settings only after a successful committed receipt', () => {
  const result = { operation: 'outreach_settings_update', settings: { maxDailyCalls: 12, callWindowStart: '10:00', callWindowEnd: '17:30' } };
  for (const executionState of ['accepted_unverified', 'failed', 'unknown']) expect(executionConfirmation([{ kind: 'existing_operation', result: { ...result, executionState } }])).toBe('');
  expect(executionConfirmation([{ kind: 'existing_operation', result: { ...result, executionState: 'succeeded' } }])).toBe('Setările apelurilor AI au fost salvate. Limita zilnică: 12 apeluri. Interval: 10:00–17:30, ora Bucureștiului.');
});
it('confirms prospect takeover only from a successful saved receipt', () => {
  expect(executionConfirmation([{ kind: 'update_prospect', result: { listingId: 'p', executionState: 'succeeded', state: 'taken', takenByAgentId: 'u' } }])).toBe('Prospect preluat. ID: p.');
  expect(executionConfirmation([{ kind: 'update_prospect', result: { listingId: 'p', state: 'taken' } }])).toBe('');
  expect(executionConfirmation([{ kind: 'update_prospect', result: { listingId: 'p', executionState: 'succeeded', state: 'reserved' } }])).not.toContain('preluat');
});
it('confirms task associations only from saved relation receipts', () => {
  const text = executionConfirmation([{ kind: 'update_task', result: { taskId: 't', propertyId: 'p', propertyTitle: 'Cișmigiu' } }]);
  expect(text).toContain('Proprietate: Cișmigiu.');
  expect(text).not.toContain('Client:');
  expect(executionConfirmation([{ kind: 'create_task', result: { taskId: 't', contactId: 'c', contactName: 'Alin', participantName: 'Alin' } }])).toContain('Client: Alin.');
});
it('confirms committed task state and time without confirming proposals', () => {
  expect(executionConfirmation([{ kind: 'create_task', result: { taskId: 't', description: 'Sună-l pe Andrei', status: 'open', dueDate: '2026-10-09T07:00:00Z', startTime: '10:00' } }])).toContain('2026-10-09, 10:00, ora Bucureștiului');
  expect(executionConfirmation([{ kind: 'update_task', result: { taskId: 't', status: 'completed' } }])).toContain('Task finalizat');
  expect(executionConfirmation([{ kind: 'create_task', taskId: 't' }])).toBe('');
});
it('confirms the saved viewing with buyer, property and Bucharest time', () => {
  const result = viewingConfirmation([{ kind: 'schedule_viewing', result: { viewingId: 'v', viewingDate: '2030-01-01T05:30:00Z', propertyTitle: 'Cișmigiu', contactName: 'Matei Alin' } }]);
  expect(result).toContain('07:30'); expect(result).toContain('Cișmigiu'); expect(result).toContain('Matei Alin'); expect(result).toContain('ID: v');
});
it('does not confirm proposals or unrelated receipts', () => {
  expect(viewingConfirmation([{ kind: 'schedule_viewing', viewingDate: '2030-01-01T05:30:00Z' }, { kind: 'create_contact', result: { contactId: 'c' } }])).toBe('');
});

it.each([['scheduled', 'actualizată'], ['completed', 'efectuată'], ['cancelled', 'anulată']])('confirms committed viewing state %s', (status, label) => {
  expect(executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2030-01-01T05:30:00Z', status } }])).toContain(`Vizionare ${label}`);
});

it('confirms deletion only from its committed receipt', () => {
  expect(executionConfirmation([{ kind: 'delete_viewing', result: { id: 'v', deleted: true } }])).toBe('Vizionare ștearsă. ID: v.');
  expect(executionConfirmation([{ kind: 'delete_viewing', result: { id: 'v', deleted: false } }])).toBe('');
});
it('confirms the appended note without claiming a new scheduling', () => {
  const result = executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2026-01-01T10:00:00Z', status: 'scheduled', appendedNote: 'Revine cu familia.' } }]);
  expect(result).toContain('Notă adăugată'); expect(result).toContain('Revine cu familia.'); expect(result).not.toContain('programată');
});

it('confirms both cancellation and the appended reason from the same receipt', () => {
  const result = executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2027-01-01T10:00:00Z', status: 'cancelled', appendedNote: 'Anulată de client.' } }]);
  expect(result).toContain('Vizionare anulată'); expect(result).toContain('Notă adăugată'); expect(result).toContain('Anulată de client.');
});

it('confirms prospecting only from verified active membership receipts', () => {
  const receipt = { operation: 'owner_prospect', listingId: 'listing-1', businessStatus: 'added_to_prospecting', executionState: 'succeeded', active: true };
  expect(executionConfirmation([{ kind: 'existing_operation', result: receipt }])).toContain('Anunț adăugat în lista de prospectare. ID: listing-1.');
  for (const patch of [{ active: false }, { executionState: 'accepted_unverified' }, { businessStatus: 'phone_pending' }, { listingId: '' }]) expect(executionConfirmation([{ kind: 'existing_operation', result: { ...receipt, ...patch } }])).toBe('');
});
