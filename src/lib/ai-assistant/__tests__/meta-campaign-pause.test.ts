import { describe, expect, it, vi } from 'vitest';
import { verifyMetaCampaignPause } from '../../meta-campaign-pause';

const row = (status = 'ACTIVE', effective_status = status) => ({ id: '123', account_id: '456', status, effective_status });
function fixture() {
  return { campaignId: '123', accountId: 'act_456', assertCurrent: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValueOnce(row()).mockResolvedValue(row('PAUSED')), pause: vi.fn().mockResolvedValue({ success: true }) };
}
describe('verified Meta pause', () => {
  it('reads the exact campaign before and after the write', async () => {
    const f = fixture(); expect(await verifyMetaCampaignPause(f)).toEqual({ id: '123', accountId: '456', status: 'PAUSED', effectiveStatus: 'PAUSED' });
    expect(f.pause).toHaveBeenCalledTimes(1); expect(f.read).toHaveBeenCalledTimes(2); expect(f.assertCurrent).toHaveBeenCalledTimes(3);
  });
  it('reconciles an already paused campaign without another write', async () => {
    const f = fixture(); f.read.mockReset().mockResolvedValue(row('PAUSED'));
    await verifyMetaCampaignPause(f); expect(f.pause).not.toHaveBeenCalled();
  });
  it.each([null, {}, { success: false }, { success: true }])('requires readback regardless of acknowledgement %j', async ack => {
    const f = fixture(); f.pause.mockResolvedValue(ack); await verifyMetaCampaignPause(f); expect(f.read).toHaveBeenCalledTimes(2);
  });
  it('recovers a lost POST response using a read, without repeating the POST', async () => {
    const f = fixture(); f.pause.mockRejectedValue(new Error('network timeout')); await verifyMetaCampaignPause(f); expect(f.pause).toHaveBeenCalledTimes(1);
  });
  it.each(['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES'])('does not claim effective pause while provider reports %s', async status => {
    const f = fixture(); f.read.mockReset().mockResolvedValueOnce(row()).mockResolvedValue(row('PAUSED', status));
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow('nu a confirmat'); expect(f.pause).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { ...row(), id: '999' }, { ...row(), account_id: '999' }, { ...row(), effective_status: null }, { ...row(), status: null }])('rejects invalid preflight without mutation: %j', async payload => {
    const f = fixture(); f.read.mockReset().mockResolvedValue(payload);
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow(); expect(f.pause).not.toHaveBeenCalled();
  });
  it.each(['DELETED', 'ARCHIVED', 'UNKNOWN'])('never changes a campaign in state %s', async status => {
    const f = fixture(); f.read.mockReset().mockResolvedValue(row(status));
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow(); expect(f.pause).not.toHaveBeenCalled();
  });
  it.each(['', '../123', '123?fields=token'])('rejects unsafe IDs: %s', async campaignId => {
    const f = { ...fixture(), campaignId }; await expect(verifyMetaCampaignPause(f)).rejects.toThrow(); expect(f.read).not.toHaveBeenCalled();
  });
  it('does not repeat a POST when both its response and readback are lost', async () => {
    const f = fixture(); f.pause.mockRejectedValue(new Error('token=secret')); f.read.mockReset().mockResolvedValueOnce(row()).mockRejectedValue(new Error('token=secret'));
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow('neclar'); expect(f.pause).toHaveBeenCalledTimes(1);
  });
  it('rejects a different campaign in readback', async () => {
    const f = fixture(); f.read.mockReset().mockResolvedValueOnce(row()).mockResolvedValue({ ...row('PAUSED'), id: '999' });
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow('neclar');
  });
  it.each([1, 2, 3])('rechecks current scope at boundary %s', async boundary => {
    const f = fixture(); f.assertCurrent.mockReset();
    for (let i = 1; i < boundary; i++) f.assertCurrent.mockResolvedValueOnce(undefined);
    f.assertCurrent.mockRejectedValue(new Error('changed'));
    await expect(verifyMetaCampaignPause(f)).rejects.toThrow('changed'); expect(f.pause).toHaveBeenCalledTimes(boundary === 3 ? 1 : 0);
  });
});
import { operationResult } from '../operation-result';
import { executionConfirmation } from '../execution-confirmation';

describe('Jarvis pause completion', () => {
  const at = '2026-10-17T12:00:00.000Z';
  const campaign = { id: 'local', metaCampaignId: '123', status: 'paused', updatedAt: at,
    providerPauseVerification: { id: '123', accountId: '456', status: 'PAUSED', effectiveStatus: 'PAUSED', checkedAt: at } };
  it('finishes the action and confirms the exact campaign only with provider evidence', () => {
    const result = operationResult('meta_campaign_pause', { campaign });
    expect(result).toMatchObject({ executionState: 'succeeded', completionSatisfied: true, campaignId: 'local', pauseConfirmed: true });
    expect(executionConfirmation([{ kind: 'existing_operation', result }])).toContain('local');
  });
  it.each([
    { providerPauseVerification: undefined }, { status: 'published' }, { metaCampaignId: 'other' }, { updatedAt: 'later' },
    ...['id', 'accountId', 'status', 'effectiveStatus', 'checkedAt'].map(key => ({ providerPauseVerification: { ...campaign.providerPauseVerification, [key]: '' } })),
  ])('does not certify stale or invalid evidence %j', patch => {
    const result = operationResult('meta_campaign_pause', { campaign: { ...campaign, ...patch } });
    expect(result.executionState).toBe('unknown'); expect(result.completionSatisfied).toBe(false);
    expect(executionConfirmation([{ kind: 'existing_operation', result }])).not.toContain('a confirmat pauza');
  });
});
