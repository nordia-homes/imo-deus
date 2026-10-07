import { describe, expect, it } from 'vitest';
import { personalRecipientProof, assertPersonalRecipient } from '../personal-recipient';
const actor = { uid: 'u', agencyId: 'a', role: 'agent' };
const profile = { agencyId: 'a', role: 'agent', phone: '+40 722 123 456' };
const conversation = { id: 'c', agencyId: 'a', channel: 'whatsapp', connectionId: 'link', externalParticipantId: '40722123456', phone: '+40722999999' };
describe('personal brief recipient', () => {
  it('pins the actual provider address and normalizes the actor phone', () => {
    expect(personalRecipientProof(actor, conversation, profile)).toEqual(personalRecipientProof(actor, conversation, { ...profile, phone: '0722123456' }));
    expect(JSON.stringify(personalRecipientProof(actor, conversation, profile))).not.toContain('40722123456');
  });
  it.each(['route', 'phone', 'agency', 'role', 'missing', 'channel'])('rejects changed %s despite a matching display phone', change => {
    const p = { ...profile }, c = { ...conversation, phone: profile.phone };
    if (change === 'route') c.externalParticipantId = '40722999999';
    if (change === 'phone') p.phone = '+40722999999';
    if (change === 'agency') p.agencyId = 'other';
    if (change === 'role') p.role = 'admin';
    if (change === 'channel') c.channel = 'messenger';
    expect(() => personalRecipientProof(actor, c, change === 'missing' ? undefined : p)).toThrow('numărul tău');
  });
  it('recites the profile through the supplied transaction and rejects a replaced own number', async () => {
    const proof = personalRecipientProof(actor, conversation, profile);
    const db = { collection: () => ({ doc: () => ({}) }) } as any;
    let reads = 0;
    const tx = { get: async () => { reads++; return { data: () => ({ ...profile, phone: '+40722999999' }) }; } } as any;
    await expect(assertPersonalRecipient(db, actor, { ...conversation, externalParticipantId: '40722999999' }, proof, tx)).rejects.toThrow('s-a modificat');
    expect(reads).toBe(1);
  });
});
