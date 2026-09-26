import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBuyerMatchCache } from '../buyer-match-cache';
import type { Contact, MatchedBuyer, Property } from '../types';

const property = { id: 'property-1', price: 150000 } as Property;
const contacts = [{ id: 'buyer-1', budget: 160000 }] as Contact[];
const result = { matchedBuyers: [{ id: 'buyer-1', matchScore: 93, reasoning: 'Original AI result' }] as MatchedBuyer[] };

afterEach(() => vi.useRealTimers());

describe('buyer recommendation cache', () => {
  it('shares concurrent requests and returns the unchanged complete matcher result', async () => {
    const matcher = vi.fn().mockResolvedValue(result);
    const match = createBuyerMatchCache(matcher);
    const first = match('agency/user', property, contacts);
    const second = match('agency/user', { ...property }, contacts.map(contact => ({ ...contact })));
    expect(second).toBe(first);
    expect(await first).toBe(result);
    expect(await match('agency/user', property, contacts)).toBe(result);
    expect(matcher).toHaveBeenCalledTimes(1);
    expect(matcher).toHaveBeenCalledWith(property, contacts);
  });

  it('recalculates for changed property data, contact data, or authenticated scope', async () => {
    const matcher = vi.fn().mockResolvedValue(result);
    const match = createBuyerMatchCache(matcher);
    await match('agency/user', property, contacts);
    await match('agency/user', { ...property, price: 200000 }, contacts);
    await match('agency/user', property, [{ ...contacts[0], budget: 210000 }]);
    await match('agency/other-user', property, contacts);
    await match('other-agency/user', property, contacts);
    expect(matcher).toHaveBeenCalledTimes(5);
  });

  it('does not cache failed requests, allowing a real retry', async () => {
    const matcher = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(result);
    const match = createBuyerMatchCache(matcher);
    await expect(match('scope', property, contacts)).rejects.toThrow('network');
    expect(await match('scope', property, contacts)).toBe(result);
    expect(matcher).toHaveBeenCalledTimes(2);
  });

  it('expires completed results without expiring a still-running request', async () => {
    vi.useFakeTimers();
    let resolve!: (value: typeof result) => void;
    const matcher = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(result);
    const match = createBuyerMatchCache(matcher, 1000);
    const pending = match('scope', property, contacts);
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    expect(match('scope', property, contacts)).toBe(pending);
    resolve(result);
    await pending;
    vi.advanceTimersByTime(999);
    expect(await match('scope', property, contacts)).toBe(result);
    expect(matcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await match('scope', property, contacts);
    expect(matcher).toHaveBeenCalledTimes(2);
  });

  it('bounds the retained entries', async () => {
    const matcher = vi.fn().mockResolvedValue(result);
    const match = createBuyerMatchCache(matcher, 120000, 2);
    await match('scope-1', property, contacts);
    await match('scope-2', property, contacts);
    await match('scope-3', property, contacts);
    await match('scope-1', property, contacts);
    expect(matcher).toHaveBeenCalledTimes(4);
  });
});
