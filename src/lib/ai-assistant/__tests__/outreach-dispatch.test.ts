import { afterEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai-outreach/vapi', () => ({ createVapiOutboundCall: provider, VapiDispatchError: class extends Error { constructor(message: string, public definitivelyRejected = false) { super(message); } } }));
import { launchAiOutreachCall } from '@/lib/ai-outreach/server';
import { VapiDispatchError } from '@/lib/ai-outreach/vapi';
function fixture(status = 'scheduled') {
  const rows = new Map<string, any>([['agencies/a/aiOutreachCalls/c', { status, ownerListingId: 'l', ownerPhone: '+40722334455' }], ['users/u', { agencyId: 'a', role: 'agent' }]]);
  const ref = (path: string): any => ({ path, doc: (id: string) => ref(path + '/' + id), collection: (id: string) => ref(path + '/' + id), get: async () => ({ exists: rows.has(path), data: () => rows.get(path), docs: [...rows].filter(([key]) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')).map(([key, data]) => ({ id: key.split('/').at(-1), data: () => data })) }), set: async (data: any) => rows.set(path, { ...rows.get(path), ...data }) });
  let serial: Promise<any> = Promise.resolve();
  const db = { collection: ref, runTransaction: (work: any) => {
    const result = serial.then(async () => {
      const writes: (() => void)[] = [];
      const result = await work({ get: (r: any) => { if (writes.length) throw Error('Read after write'); return r.get(); }, update: (r: any, data: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...data })), set: (r: any, data: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...data })) });
      writes.forEach(write => write()); return result;
    }); serial = result.catch(() => {}); return result;
  } };
  return { rows, input: { adminDb: db, callRef: ref('agencies/a/aiOutreachCalls/c'), call: { id: 'c', agencyId: 'a', ownerListingId: 'l', agentId: 'u', status, ownerPhone: '+40722334455' }, settings: {}, agencyName: 'Agency' } as any };
}
afterEach(() => vi.clearAllMocks());
describe('outreach dispatch claims', () => {
  it('dispatches only once under concurrent launches and does not dispatch a canceled call', async () => {
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    const { input } = fixture();
    await Promise.all([launchAiOutreachCall(input), launchAiOutreachCall(input)]);
    expect(provider).toHaveBeenCalledTimes(1);
    await launchAiOutreachCall(fixture('canceled').input);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('serializes launches from different listings sharing the same normalized phone', async () => {
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/other', { status: 'scheduled', ownerListingId: 'other-listing', ownerPhone: '0040 722 334 455' });
    const other = { ...input, callRef: input.adminDb.collection('agencies').doc('a').collection('aiOutreachCalls').doc('other'), call: { ...input.call, id: 'other', ownerListingId: 'other-listing', ownerPhone: '0040 722 334 455' } };
    await Promise.all([launchAiOutreachCall(input), launchAiOutreachCall(other)]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(rows.get('agencies/a/aiOutreachCalls/other')).toMatchObject({ status: 'canceled', providerErrorCode: 'owner_phone_duplicate' });
  });
  it.each(['completed', 'calling'])('blocks legacy %s calls from another listing', async status => {
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/legacy', { status, ownerListingId: 'old-listing', ownerPhone: '0722 334 455' });
    const result = await launchAiOutreachCall(input);
    expect(result.call.status).toBe('canceled'); expect(provider).not.toHaveBeenCalled();
  });
  it('does not retry another listing after a phone-level refusal, even on a failed call', async () => {
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/legacy', { status: 'failed', ownerListingId: 'old-listing', ownerPhone: '0040722334455', result: { doNotCall: true } });
    expect((await launchAiOutreachCall(input)).call.providerErrorCode).toBe('owner_phone_do_not_call');
    expect(provider).not.toHaveBeenCalled();
  });
  it('allows a definitively failed call to be retried and preserves agency isolation', async () => {
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/legacy', { status: 'failed', ownerListingId: 'old-listing', ownerPhone: '0722334455' });
    rows.set('agencies/foreign/aiOutreachCalls/legacy', { status: 'completed', ownerListingId: 'old-listing', ownerPhone: '0722334455' });
    await launchAiOutreachCall(input); expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each(['0733123456', '0722'])('rejects stale or invalid persisted phone %s before provider dispatch', async ownerPhone => {
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/c', { ...rows.get('agencies/a/aiOutreachCalls/c'), ownerPhone });
    await expect(launchAiOutreachCall(input)).rejects.toThrow(/Telefonul|Numărul/);
    expect(provider).not.toHaveBeenCalled();
  });
  it('allows an intentional follow-up on the same listing after a completed call', async () => {
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/legacy', { status: 'completed', ownerListingId: 'l', ownerPhone: '0722334455' });
    await launchAiOutreachCall(input); expect(provider).toHaveBeenCalledTimes(1);
  });
  it('checks opt-out and current membership immediately before dispatch', async () => {
    const optedOut = fixture(); optedOut.rows.set('agencies/a/aiOutreachOwnerListingStatuses/l', { aiDoNotCall: true });
    await expect(launchAiOutreachCall(optedOut.input)).rejects.toThrow('Do Not Call');
    const revoked = fixture(); revoked.rows.set('users/u', { agencyId: 'other', role: 'agent' });
    await expect(launchAiOutreachCall(revoked.input)).rejects.toThrow('acces');
    expect(provider).not.toHaveBeenCalled();
  });
  it('keeps ambiguous provider outcomes blocked from automatic redispatch', async () => {
    provider.mockRejectedValueOnce(new Error('connection reset'));
    const { input, rows } = fixture();
    await launchAiOutreachCall(input); await launchAiOutreachCall(input);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(rows.get('agencies/a/aiOutreachCalls/c')).toMatchObject({ status: 'calling', outcome: 'needs_human_review', providerErrorCode: 'vapi_create_unknown', endedAt: null });
  });
  it('records an explicit provider rejection as failed', async () => {
    provider.mockRejectedValueOnce(new VapiDispatchError('rejected', true));
    const { input, rows } = fixture(); await launchAiOutreachCall(input);
    expect(rows.get('agencies/a/aiOutreachCalls/c')).toMatchObject({ status: 'failed', providerErrorCode: 'vapi_create_failed' });
  });
  it('preserves a terminal webhook that arrives before the provider create response', async () => {
    const { input, rows } = fixture();
    provider.mockImplementationOnce(async () => {
      rows.set('agencies/a/aiOutreachCalls/c', { ...rows.get('agencies/a/aiOutreachCalls/c'), status: 'completed', outcome: 'collaborates' });
      return { mode: 'live', vapiCallId: 'remote', raw: {} };
    });
    expect((await launchAiOutreachCall(input)).call.status).toBe('completed');
    expect(rows.get('agencies/a/aiOutreachCalls/c')?.outcome).toBe('collaborates');
  });
});
