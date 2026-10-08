import { expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { taskParticipant } from '../task-participant';
it('keeps owner and buyer identities distinct and permits an absent phone without invention', () => {
  expect(taskParticipant('property_owner', null, { ownerName: ' Ștefan ', ownerPhone: ' 0700000002 ' })).toEqual({ participantName: 'Ștefan', participantPhone: '0700000002' });
  expect(taskParticipant('contact', { name: 'Alin' }, { ownerName: 'Ștefan' })).toEqual({ participantName: 'Alin', participantPhone: null });
  expect(taskParticipant(undefined, null, null)).toEqual({});
});
it('rejects owner tasks linked to a buyer, missing records and missing identity', () => {
  expect(() => taskParticipant('property_owner', { name: 'Buyer' }, { ownerName: 'Owner' })).toThrow();
  expect(() => taskParticipant('property_owner', null, null)).toThrow();
  expect(() => taskParticipant('contact', null, null)).toThrow();
  expect(() => taskParticipant('property_owner', null, { ownerName: ' ' })).toThrow();
});
