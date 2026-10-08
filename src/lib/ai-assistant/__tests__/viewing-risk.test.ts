import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { viewingRisk, viewingRiskSchema } from '../viewing-risk';
import { appointmentSignature, participantSignature } from '@/lib/crm/viewing-attendance';
const now = new Date('2026-10-08T10:00:00Z'), ctx: any = {};
const contact = { name: 'Alin', phone: '0700000001' }, property = { title: 'Cișmigiu', status: 'Activ', ownerName: 'Ana', ownerPhone: '0700000002' };
const base = { contactId: 'c', propertyId: 'p', status: 'scheduled', viewingDate: '2026-10-09T10:00:00Z', duration: 60 };
let records: Record<string, any>;
function viewing(client: string, owner: string) {
  const record = (participant: 'client' | 'owner', status: string) => ({ participant, status, source: 'whatsapp_reply', recordedAt: now.toISOString(), replyAt: now.toISOString(), replyId: 'r', templateMessageId: 't', appointment: appointmentSignature(base), recipient: participantSignature(participant, contact, property) });
  return { ...base, confirmations: { client: record('client', client), owner: record('owner', owner) } };
}
beforeEach(() => {
  records = { 'contacts/c': contact, 'properties/p': property };
  vi.mocked(getResource).mockReset().mockImplementation(async (_ctx, source, id) => {
    const row = records[`${source}/${id}`];
    if (!row) throw Object.assign(new Error('missing'), { status: 404 });
    return { ...row, id };
  });
});
it('ranks explicit replies ahead of unknowns, without predicting attendance or writing', async () => {
  records['viewings/confirmed'] = viewing('confirmed', 'confirmed');
  records['viewings/unknown'] = { ...base, notes: 'Clientul sigur vine, mesaj citit' };
  records['viewings/declined'] = viewing('declined', 'confirmed');
  records['viewings/access'] = viewing('confirmed', 'declined');
  records['viewings/change'] = viewing('reschedule_requested', 'confirmed');
  const result = await viewingRisk(ctx, ['unknown', 'confirmed', 'declined', 'access', 'change'], now);
  expect(result.rows.map(row => row.id)).toEqual(['access', 'change', 'declined', 'unknown', 'confirmed']);
  expect(result.rows[0].description).toContain('accesul');
  expect(result.rows[3]).toMatchObject({ priority: 'verification_needed', clientConfirmation: { status: 'unknown' } });
  expect(result.rows[4].description).toContain('nu este garantată');
  expect(result.rows.every(row => row.viewingLocal.includes('13:00 (ora București)'))).toBe(true);
  expect(result.complete).toBe(true);
});
it('does not use stale WhatsApp evidence after a changed appointment', async () => {
  records['viewings/v'] = { ...viewing('declined', 'declined'), viewingDate: '2026-10-09T11:00:00Z' };
  expect((await viewingRisk(ctx, ['v'], now)).rows[0]).toMatchObject({ priority: 'verification_needed', clientConfirmation: { status: 'unknown', reason: 'stale_or_invalid' } });
});
it('reports unavailable, cancelled and past appointments instead of replacing the list', async () => {
  records['viewings/cancelled'] = { ...base, status: 'cancelled' };
  records['viewings/past'] = { ...base, viewingDate: '2026-10-07T10:00:00Z' };
  const result = await viewingRisk(ctx, ['missing', 'cancelled', 'past'], now);
  expect(result).toMatchObject({ rows: [], complete: false, status: 'partial' });
  expect(result.excluded.map(row => row.id)).toEqual(['missing', 'cancelled', 'past']);
});
it('does not conceal infrastructure failures as missing confirmations', async () => {
  vi.mocked(getResource).mockRejectedValue(new Error('unavailable'));
  await expect(viewingRisk(ctx, ['v'], now)).rejects.toThrow('unavailable');
});
it('rejects model-selected IDs and asks for context without reading CRM', async () => {
  expect(viewingRiskSchema.safeParse({ ids: ['v'] }).success).toBe(false);
  expect(await viewingRisk(ctx, [], now)).toMatchObject({ status: 'needs_clarification', rows: [] });
  expect(getResource).not.toHaveBeenCalled();
});
it('treats missing relationships and inactive properties as data/access issues', async () => {
  records['viewings/v'] = { ...base, contactId: 'missing' };
  records['properties/p'] = { ...property, status: 'Inactiv' };
  const result = await viewingRisk(ctx, ['v'], now);
  expect(result.rows[0].description).toContain('Fișa cumpărătorului');
  expect(result.rows[0].description).toContain('nu este activă');
  expect(result.rows[0].priority).toBe('verification_needed');
});
