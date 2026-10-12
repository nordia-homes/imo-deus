import { afterEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai-outreach/vapi', () => ({ createVapiOutboundCall: provider, VapiDispatchError: class extends Error { constructor(message: string, public definitivelyRejected = false) { super(message); } } }));
import { launchAiOutreachCall } from '@/lib/ai-outreach/server';
import { VapiDispatchError } from '@/lib/ai-outreach/vapi';
function fixture(status = 'scheduled') {
  const rows = new Map<string, any>([['agencies/a/aiOutreach/settings', { enabled: true, callWindowStart: '00:00', callWindowEnd: '00:00' }], ['agencies/a/aiOutreachCalls/c', { status, scheduledAt: '2020-01-01T10:00:00Z', ownerListingId: 'l', ownerPhone: '+40722334455' }], ['users/u', { agencyId: 'a', role: 'agent' }]]);
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
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe('outreach dispatch claims', () => {
  it('keeps a future schedule unchanged even when passed an old due snapshot', async () => {
    const { input, rows } = fixture();
    const scheduledAt = new Date(Date.now() + 3600000).toISOString();
    rows.get('agencies/a/aiOutreachCalls/c').scheduledAt = scheduledAt;
    const before = structuredClone(rows.get('agencies/a/aiOutreachCalls/c'));
    const result = await launchAiOutreachCall(input);
    expect(result.call.status).toBe('scheduled'); expect(result.warning).toContain('nu a sosit');
    expect(rows.get('agencies/a/aiOutreachCalls/c')).toEqual(before); expect(provider).not.toHaveBeenCalled();
  });
  it.each([undefined, 'invalid'])('cancels a scheduled call with invalid date %s', async scheduledAt => {
    const { input, rows } = fixture(); rows.get('agencies/a/aiOutreachCalls/c').scheduledAt = scheduledAt;
    expect((await launchAiOutreachCall(input)).call.providerErrorCode).toBe('outreach_invalid_schedule');
    expect(provider).not.toHaveBeenCalled();
  });
  it('rechecks the current Bucharest call window instead of stale unrestricted settings', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T04:30:00Z'));
    const { input, rows } = fixture('queued');
    rows.set('agencies/a/aiOutreach/settings', { enabled: true, callWindowStart: '09:00', callWindowEnd: '18:00' });
    input.settings = { enabled: true, callWindowStart: '00:00', callWindowEnd: '00:00' };
    expect((await launchAiOutreachCall(input)).call.providerErrorCode).toBe('outreach_outside_window');
    expect(provider).not.toHaveBeenCalled();
  });
  it('allows a due call within an overnight Bucharest window', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T20:30:00Z'));
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreach/settings', { enabled: true, callWindowStart: '22:00', callWindowEnd: '02:00' });
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    expect((await launchAiOutreachCall(input)).call.status).toBe('calling'); expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each(['queued', 'scheduled'])('cancels %s when settings were disabled after the initial check', async status => {
    const { input, rows } = fixture(status);
    input.settings = { enabled: true, callWindowStart: '00:00', callWindowEnd: '00:00' };
    rows.set('agencies/a/aiOutreach/settings', { enabled: false });
    const result = await launchAiOutreachCall(input);
    expect(result.call).toMatchObject({ status: 'canceled', outcome: 'uncalled', providerErrorCode: 'outreach_disabled' });
    expect(rows.get('agencies/a/aiOutreachCalls/c').providerDispatchStartedAt).toBeUndefined();
    expect(provider).not.toHaveBeenCalled();
  });
  it('treats missing configuration as disabled and preserves a newer owner status', async () => {
    const { input, rows } = fixture(); rows.delete('agencies/a/aiOutreach/settings');
    rows.set('agencies/a/aiOutreachOwnerListingStatuses/l', { latestAiCallId: 'newer', aiOutreachStatus: 'completed' });
    expect((await launchAiOutreachCall(input)).call.status).toBe('canceled');
    expect(rows.get('agencies/a/aiOutreachOwnerListingStatuses/l').aiOutreachStatus).toBe('completed');
    expect(provider).not.toHaveBeenCalled();
  });
  it('passes the configuration read during the claim to the provider', async () => {
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreach/settings', { enabled: true, desiredCommissionValue: '4', callWindowStart: '00:00', callWindowEnd: '00:00' });
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    await launchAiOutreachCall(input);
    expect(provider.mock.calls[0][0].settings).toMatchObject({ enabled: true, desiredCommissionValue: '4', callWindowStart: '00:00', callWindowEnd: '00:00', timezone: 'Europe/Bucharest' });
  });
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
    rows.set('agencies/a/aiOutreachCalls/other', { status: 'scheduled', scheduledAt: '2020-01-01T10:00:00Z', ownerListingId: 'other-listing', ownerPhone: '0040 722 334 455' });
    const other = { ...input, callRef: input.adminDb.collection('agencies').doc('a').collection('aiOutreachCalls').doc('other'), call: { ...input.call, id: 'other', ownerListingId: 'other-listing', ownerPhone: '0040 722 334 455' } };
    await Promise.all([launchAiOutreachCall(input), launchAiOutreachCall(other)]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(rows.get('agencies/a/aiOutreachCalls/other')).toMatchObject({ status: 'canceled', providerErrorCode: 'owner_phone_duplicate' });
  });
  it.each(['completed', 'calling'])('blocks legacy %s calls from another listing', async status => {
    const { input, rows } = fixture();
    rows.set('agencies/a/aiOutreachCalls/legacy', { status, scheduledAt: '2020-01-01T10:00:00Z', ownerListingId: 'old-listing', ownerPhone: '0722 334 455' });
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
  it.each(['negative', 'follow_up'])('blocks a recorded human %s outcome on another listing, including inactive prospects', async contactOutcome => {
    const { input, rows } = fixture();
    rows.set('agencies/a/ownerListingFavorites/other', { ownerPhone: '0040 722 334 455', contactOutcome, contactOutcomeAt: '2026-01-01T10:00:00Z', isFavoriteActive: false });
    expect((await launchAiOutreachCall(input)).call.status).toBe('canceled');
    expect(provider).not.toHaveBeenCalled();
  });
  it('uses the phone recorded with the outcome instead of a later edited phone', async () => {
    const { input, rows } = fixture();
    const row = { ownerPhone: '0733123456', contactOutcomePhone: '0722334455', contactOutcome: 'follow_up', contactOutcomeAt: '2026-01-01T10:00:00Z' };
    rows.set('agencies/a/ownerListingFavorites/other', row);
    expect((await launchAiOutreachCall(input)).call.status).toBe('canceled'); expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    { contactOutcome: 'follow_up' },
    { contactOutcome: 'negative', contactOutcomeAt: 'invalid' },
    { contactOutcome: 'follow_up', contactOutcomeAt: '2026-01-01T10:00:00Z', contactOutcomePhone: null },
    { contactOutcome: 'follow_up', contactOutcomeAt: '2026-01-01T10:00:00Z', contactOutcomePhone: '0733123456' },
  ])('does not infer a completed contact at this phone from incomplete or mismatched evidence: %j', outcome => {
    provider.mockResolvedValue({ mode: 'live', vapiCallId: 'remote', raw: {} });
    const { input, rows } = fixture();
    rows.set('agencies/a/ownerListingFavorites/other', { ownerPhone: '0722334455', ...outcome });
    return launchAiOutreachCall(input).then(() => expect(provider).toHaveBeenCalledTimes(1));
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
