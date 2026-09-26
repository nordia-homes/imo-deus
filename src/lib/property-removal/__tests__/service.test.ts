import { describe, expect, it, vi } from 'vitest';
import { lifecycleRef, mergeExistingProperty, propertyUpdateFields, withPropertyOperation } from '../lifecycle';
import { removeProperty } from '../service';
import { removalSchema, type RemovalInput } from '../schema';
import { memoryDb } from './memory';

const input: RemovalInput = { propertyId: 'p1', reason: 'collaboration_ended', agentMessage: 'Colaborare încheiată' };
const propertyPath = 'agencies/a/properties/p1';
function fixture(portals: string[] = []) {
  const { db, docs } = memoryDb();
  const property = { id: 'p1', title: 'Apartament', price: 100000, status: 'Activ', promotions: Object.fromEntries(portals.map(p => [p, { status: 'published', remoteId: `remote-${p}` }])) };
  docs.set(propertyPath, property);
  return { ctx: { db, agencyId: 'a', uid: 'admin', role: 'admin', demo: false, propertyId: 'p1' }, docs };
}
const events = (docs: ReturnType<typeof fixture>['docs'], kind = 'propertyDeletionEvents') => [...docs.entries()].filter(([path]) => path.includes(`/${kind}/`));

describe('withdraw portals before removing CRM property', () => {
  it('archives and deletes a property with no portal publications atomically', async () => {
    const f = fixture(); const withdraw = vi.fn();
    expect((await removeProperty(f.ctx, input, withdraw)).complete).toBe(true);
    expect(withdraw).not.toHaveBeenCalled(); expect(f.docs.has(propertyPath)).toBe(false);
    expect(events(f.docs)).toHaveLength(1);
    expect(events(f.docs)[0][1]).toMatchObject({ reason: 'collaboration_ended', listingPriceAtDeletion: 100000, propertySnapshot: { title: 'Apartament' } });
  });
  it('keeps the property until every tracked portal confirms withdrawal', async () => {
    const f = fixture(['imobiliare', 'storia', 'publi24']);
    const withdraw = vi.fn(async () => { expect(f.docs.has(propertyPath)).toBe(true); return true; });
    const result = await removeProperty(f.ctx, input, withdraw);
    expect(result.complete).toBe(true); expect(withdraw).toHaveBeenCalledTimes(3); expect(f.docs.has(propertyPath)).toBe(false);
  });
  it('keeps partial results and retries only unconfirmed withdrawals', async () => {
    const f = fixture(['imobiliare', 'storia']);
    const first = vi.fn(async (portal: string) => { if (portal === 'storia') throw new Error('PRIVATE'); return true; });
    const result = await removeProperty(f.ctx, input, first);
    expect(result.complete).toBe(false); expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(f.docs.has(propertyPath)).toBe(true); expect(events(f.docs)).toHaveLength(0);
    const retry = vi.fn(async (portal: string) => portal === 'storia');
    expect((await removeProperty(f.ctx, input, retry)).complete).toBe(true);
    expect(retry).toHaveBeenCalledTimes(1); expect(retry.mock.calls[0][0]).toBe('storia');
  });
  it('treats an unconfirmed accepted request as pending, not a deleted property', async () => {
    const f = fixture(['storia']);
    const result = await removeProperty(f.ctx, input, async () => false);
    expect(result).toMatchObject({ complete: false, portals: [{ state: 'pending' }] });
    expect(f.docs.has(propertyPath)).toBe(true);
  });
  it('preserves agency sales and their price without duplicate events on retries', async () => {
    const f = fixture(['imobiliare']);
    const sale: RemovalInput = { ...input, reason: 'sold', soldDisposition: 'agency', soldPrice: 95000 };
    const withdraw = vi.fn(async () => true);
    await removeProperty(f.ctx, sale, withdraw); await removeProperty(f.ctx, sale, withdraw);
    expect(f.docs.get(propertyPath)).toMatchObject({ status: 'Vândut', price: 95000, soldPrice: 95000, promotions: { imobiliare: { status: 'unpublished' } } });
    expect(events(f.docs, 'propertyStatusEvents')).toHaveLength(1); expect(withdraw).toHaveBeenCalledTimes(1);
  });
  it('archives external sales and returns the saved result after a lost response', async () => {
    const f = fixture(['imobiliare']); const withdraw = vi.fn(async () => true);
    const sale: RemovalInput = { ...input, reason: 'sold', soldDisposition: 'owner', soldPrice: 98000 };
    const first = await removeProperty(f.ctx, sale, withdraw);
    expect(await removeProperty(f.ctx, sale, withdraw)).toEqual(first);
    expect(events(f.docs)).toHaveLength(1); expect(events(f.docs)[0][1]).toMatchObject({ soldPrice: 98000, marketAnalysisEligible: true, listingPriceAtDeletion: 100000 });
  });
  it('can subsequently delete a sold property without repeating its confirmed withdrawals', async () => {
    const f = fixture(['imobiliare']); const withdraw = vi.fn(async () => true);
    await removeProperty(f.ctx, { ...input, reason: 'sold', soldDisposition: 'agency', soldPrice: 90000 }, withdraw);
    expect((await removeProperty(f.ctx, input, withdraw)).outcome).toBe('deleted');
    expect(f.docs.has(propertyPath)).toBe(false); expect(withdraw).toHaveBeenCalledTimes(1);
    expect(events(f.docs, 'propertyStatusEvents')).toHaveLength(1); expect(events(f.docs)).toHaveLength(1);
  });
  it('uses the private Romimo ledger even if the public projection was lost', async () => {
    const f = fixture();
    f.docs.set('agencyPrivateIntegrations/a__romimo/operations/p1', { submitted: true });
    const withdraw = vi.fn(async () => true); await removeProperty(f.ctx, input, withdraw);
    expect(withdraw).toHaveBeenCalledWith('publi24', f.ctx, expect.anything());
  });
  it('requires an admin for Storia before withdrawing anything or blocking publication', async () => {
    const f = fixture(['imobiliare', 'storia']); const withdraw = vi.fn();
    await expect(removeProperty({ ...f.ctx, role: 'agent' }, input, withdraw)).rejects.toMatchObject({ status: 403 });
    expect(withdraw).not.toHaveBeenCalled(); expect(f.docs.get(lifecycleRef(f.ctx).path)?.removalRequested).toBeUndefined();
  });
  it('blocks deletion for an unsupported portal instead of claiming success', async () => {
    const f = fixture(['homezz']); const withdraw = vi.fn();
    expect((await removeProperty(f.ctx, input, withdraw)).portals[0].state).toBe('error');
    expect(f.docs.has(propertyPath)).toBe(true); expect(withdraw).not.toHaveBeenCalled();
  });
  it('does not call portals in demo', async () => {
    const f = fixture(['storia']); const withdraw = vi.fn();
    expect((await removeProperty({ ...f.ctx, demo: true, role: 'agent' }, input, withdraw)).complete).toBe(true);
    expect(withdraw).not.toHaveBeenCalled();
  });
  it('excludes concurrent publication/removal and refuses new publication after removal starts', async () => {
    const f = fixture(['imobiliare']); let release!: () => void;
    let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
    const publishing = withPropertyOperation(f.ctx, 'publish', async () => { started(); await new Promise<void>(resolve => { release = resolve; }); });
    await ready;
    await expect(removeProperty(f.ctx, input, async () => true)).rejects.toMatchObject({ status: 409 });
    release(); await publishing;
    await removeProperty(f.ctx, input, async () => false);
    await expect(withPropertyOperation(f.ctx, 'publish', async () => undefined)).rejects.toThrow(/retragere/);
  });
  it('does not finalize after the remote mapping changes during withdrawal', async () => {
    const f = fixture(['storia']);
    await expect(removeProperty(f.ctx, input, async () => {
      f.docs.get(propertyPath)!.portalProfiles = { storia: { remoteUuid: 'different' } }; return true;
    })).rejects.toThrow(/Asocierile/);
    expect(f.docs.has(propertyPath)).toBe(true); expect(events(f.docs)).toHaveLength(0);
  });
  it('does not resurrect missing properties on delayed synchronization', async () => {
    const f = fixture(); f.docs.delete(propertyPath);
    await mergeExistingProperty(f.ctx.db.collection('agencies').doc('a').collection('properties').doc('p1'), { promotions: { imobiliare: { status: 'published' } } });
    expect(f.docs.has(propertyPath)).toBe(false);
    expect(propertyUpdateFields({ portalProfiles: { storia: { remoteUuid: 'x', activePromotions: [] } } })).toEqual({ 'portalProfiles.storia.remoteUuid': 'x', 'portalProfiles.storia.activePromotions': [] });
  });
  it('rejects foreign properties, unknown fields and incomplete sale details', async () => {
    const f = fixture();
    await expect(removeProperty({ ...f.ctx, agencyId: 'other' }, input, vi.fn())).rejects.toMatchObject({ status: 404 });
    expect(removalSchema.safeParse({ ...input, agencyId: 'other' }).success).toBe(false);
    expect(removalSchema.safeParse({ ...input, reason: 'sold' }).success).toBe(false);
    expect(removalSchema.safeParse({ ...input, propertyId: '../foreign' }).success).toBe(false);
  });
});
