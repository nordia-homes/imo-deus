import { describe, expect, it } from 'vitest';
import { advanceStatus, budgetReservation, canReadConversation, normalizeSearch, withinResponseWindow } from '../model';
import { stableId, validSignature } from '../crypto';
import { createHmac } from 'crypto';
import { isExternalSocialEcho, normalizeWebhook } from '../normalize';

describe('communications isolation and policy', () => {
  it('never grants cross-agency access, including administrators', () => {
    const conversation = { agencyId: 'a', assigneeId: 'user', collaboratorIds: [] };
    expect(canReadConversation({ uid: 'user', agencyId: 'b', role: 'admin' }, conversation)).toBe(false);
    expect(canReadConversation({ uid: 'user', agencyId: 'a', role: 'agent' }, conversation)).toBe(true);
    expect(canReadConversation({ uid: 'other', agencyId: 'a', role: 'agent' }, conversation)).toBe(false);
  });
  it('closes the response window at exactly 24 hours and rejects future/invalid dates', () => {
    const now = Date.parse('2026-09-27T12:00:00Z');
    expect(withinResponseWindow('2026-09-26T12:00:00Z', now)).toBe(false);
    expect(withinResponseWindow('2026-09-26T12:00:01Z', now)).toBe(true);
    expect(withinResponseWindow('2026-09-28T12:00:00Z', now)).toBe(false);
    expect(withinResponseWindow('invalid', now)).toBe(false);
  });
  it('does not regress delivery state on reordered webhooks', () => {
    expect(advanceStatus('read', 'accepted')).toBe('read');
    expect(advanceStatus('delivered', 'failed')).toBe('delivered');
    expect(advanceStatus('unknown', 'delivered')).toBe('delivered');
  });
  it('reserves integer micros and rejects overspend or malformed amounts', () => {
    expect(budgetReservation(100, 20, 30, 50)).toBe(80);
    expect(() => budgetReservation(100, 20, 30, 51)).toThrow();
    expect(() => budgetReservation(100, 0, 0, -1)).toThrow();
    expect(() => budgetReservation(100, 0, 0, 0.5)).toThrow();
  });
  it('normalizes Romanian diacritics', () => expect(normalizeSearch(' Șoseaua Ștefan Țepeș ')).toBe('soseaua stefan tepes'));
  it('uses unambiguous tenant-scoped message identifiers', () => {
    expect(stableId('a', 'bc')).not.toBe(stableId('ab', 'c'));
    expect(stableId('tenant-a', '123')).not.toBe(stableId('tenant-b', '123'));
  });
  it('authenticates the exact original webhook bytes', () => {
    const raw = '{ "entry": [] }'; const secret = 'test-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(validSignature(raw, signature, secret)).toBe(true);
    expect(validSignature('{"entry":[]}', signature, secret)).toBe(false);
    expect(validSignature(raw, signature, '')).toBe(false);
  });
});

describe('provider normalization', () => {
  it('distinguishes native WhatsApp replies from customer messages', () => {
    const events = normalizeWebhook({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: 'phone-id' }, message_echoes: [{ id: 'wamid.1', from: '40700000000', to: '40711111111', type: 'text', timestamp: '1760000000', text: { body: 'Oferta' } }] } }] }] });
    expect(events[0]).toMatchObject({ accountId: 'phone-id', participantId: '40711111111', direction: 'sent', text: 'Oferta', nativeEcho: true });
  });
  it('keeps delivery notifications separate from new message bodies', () => {
    const events = normalizeWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1' }, statuses: [{ id: 'm', recipient_id: '2', timestamp: '1760000000', status: 'read' }] } }] }] });
    expect(events[0]).toMatchObject({ status: 'read', externalId: 'm', participantId: '2' });
  });
  it('marks imported WhatsApp history so it cannot create fresh notifications', () => {
    const events = normalizeWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1' }, history: [{ threads: [{ id: 'customer', messages: [{ id: 'm', from: 'business', type: 'text', text: { body: 'Past' }, timestamp: '1760000000' }] }] }] } }] }] });
    expect(events[0]).toMatchObject({ imported: true, direction: 'sent', participantId: 'customer' });
  });
  it('normalizes Instagram echo without confusing the business for the customer', () => {
    const events = normalizeWebhook({ object: 'instagram', entry: [{ id: 'business', messaging: [{ sender: { id: 'business' }, recipient: { id: 'customer' }, timestamp: 1760000000000, message: { mid: 'm', is_echo: true, text: 'Răspuns' } }] }] });
    expect(events[0]).toMatchObject({ channel: 'instagram', direction: 'sent', participantId: 'customer' });
  });
});

describe('external Meta replies', () => {
  const echo = { channel: 'messenger' as const, accountId: 'page', participantId: 'customer', externalId: 'mid', text: 'Răspuns', direction: 'sent' as const, createdAt: '2026-09-28T08:00:00Z', attachments: [], socialEcho: true };
  it('confirms a native or other app reply', () => {
    expect(isExternalSocialEcho({ ...echo, sourceAppId: 'meta-inbox' }, 'imodeus-app', null, false)).toBe(true);
    expect(isExternalSocialEcho(echo, 'imodeus-app', null, false)).toBe(true);
  });
  it('does not confirm an ImoDeus reply or a send still being reconciled', () => {
    expect(isExternalSocialEcho({ ...echo, sourceAppId: 'imodeus-app' }, 'imodeus-app', null, false)).toBe(false);
    expect(isExternalSocialEcho(echo, 'imodeus-app', 'imodeus', false)).toBe(false);
    expect(isExternalSocialEcho(echo, 'imodeus-app', 'native', true)).toBe(false);
    expect(isExternalSocialEcho({ ...echo, socialEcho: false }, 'imodeus-app', null, false)).toBe(false);
  });
});
