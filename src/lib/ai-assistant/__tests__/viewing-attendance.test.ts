import { expect, it } from 'vitest';
import { attendanceState, appointmentSignature, participantSignature, interpretViewingReply } from '@/lib/crm/viewing-attendance';
function recordAttendance(change: any, row: any, contact: any, property: any, _actor: string, now: string) {
  return { ...change, source: 'whatsapp_reply', recordedAt: now, replyAt: now, replyId: 'fixture-' + change.participant, templateMessageId: 'fixture-template', appointment: appointmentSignature(row), recipient: participantSignature(change.participant, contact, property), text: change.status === 'confirmed' ? 'Confirm' : 'Nu vin' };
}

const now = '2030-01-01T08:00:00Z', later = new Date('2030-01-01T09:00:00Z');
const row = { viewingDate: '2030-01-02T10:00:00Z', duration: 60, contactId: 'c', propertyId: 'p', agentId: 'a', status: 'scheduled' };
const contact = { name: 'Alin', phone: '0700000001' }, property = { ownerName: 'Ștefan', ownerPhone: '0700000002', status: 'Activ' };
const confirmed = recordAttendance({ participant: 'client', status: 'confirmed' }, row, contact, property, 'a', now);
it('separates participant evidence and treats legacy notes as unknown', () => {
  expect(attendanceState({ ...row, notes: 'Confirmat' }, 'client', contact, property, later).status).toBe('unknown');
  const current = { ...row, confirmations: { client: confirmed } };
  expect(attendanceState(current, 'client', contact, property, later).status).toBe('confirmed');
  expect(attendanceState(current, 'owner', contact, property, later).status).toBe('unknown');
});
it.each([{ viewingDate: '2030-01-02T11:00:00Z' }, { duration: 30 }, { contactId: 'other' }, { propertyId: 'other' }, { agentId: 'other' }])('invalidates changed appointment %j', patch => {
  expect(attendanceState({ ...row, ...patch, confirmations: { client: confirmed } }, 'client', contact, property, later).status).toBe('unknown');
});
it('invalidates a changed recipient but not an unrelated field or equivalent timestamp', () => {
  const current = { ...row, viewingDate: '2030-01-02T12:00:00+02:00', notes: 'Actualizat', confirmations: { client: confirmed } };
  expect(attendanceState(current, 'client', contact, property, later).status).toBe('confirmed');
  expect(attendanceState(current, 'client', { ...contact, phone: 'changed' }, property, later).status).toBe('unknown');
  expect(attendanceState(current, 'client', null, property, later).status).toBe('unknown');
});
it('rejects invalid or future-dated evidence', () => {
  for (const patch of [{ recordedAt: 'invalid' }, { recordedAt: '2031-01-01T00:00:00Z' }, { source: 'agent' }, { participant: 'owner' }, { status: 'sent' }]) {
    expect(attendanceState({ ...row, confirmations: { client: { ...confirmed, ...patch } } }, 'client', contact, property, later).status).toBe('unknown');
  }
});
it('records refusal or reset without inventing participant contact', () => {
  for (const status of ['declined', 'unknown'] as const) {
    const evidence = recordAttendance({ participant: 'owner', status }, row, contact, property, 'a', now);
    expect(attendanceState({ ...row, confirmations: { owner: evidence } }, 'owner', contact, property, later).status).toBe(status);
  }

});

it.each([['Da, confirm!', 'confirmed'], ['Confirm vizionarea', 'confirmed'], ['Nu pot veni', 'declined'], ['Reprogramează', 'reschedule_requested'], ['Da, dar numai dacă termin', 'unknown'], ['Nu vreau altă oră', 'unknown'], ['Proprietarul a confirmat', 'unknown'], ['Confirm?', 'unknown']])('interprets whole reply %s', (text, status) => { expect(interpretViewingReply(text)).toBe(status); });
