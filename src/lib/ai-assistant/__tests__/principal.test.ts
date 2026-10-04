import { describe, expect, it } from 'vitest';
import { assistantPrincipal, withAssistantPrincipal, INTERNAL_PRINCIPAL_HEADER } from '../principal';
import type { AssistantContext } from '../access';
const ctx = (agencyId: string) => ({ uid: 'u', agencyId, role: 'agent', adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ agencyId, role: 'agent' }) }) }) }) } }) as unknown as AssistantContext;
describe('request-local handler authorization', () => {
  it('rejects forged HTTP service credentials outside an authorized request scope', async () => { expect(await assistantPrincipal(INTERNAL_PRINCIPAL_HEADER)).toBeNull(); });
  it('does not accept other tokens inside the internal scope', async () => { await withAssistantPrincipal(ctx('a'), async () => { expect(await assistantPrincipal('Bearer attacker')).toBeNull(); }); });
  it('keeps parallel tenants separate across async boundaries', async () => {
    const agencies = await Promise.all(['a', 'b', 'c'].map(agency => withAssistantPrincipal(ctx(agency), async () => { await new Promise(resolve => setTimeout(resolve, 5)); return (await assistantPrincipal(INTERNAL_PRINCIPAL_HEADER))?.agencyId; })));
    expect(agencies).toEqual(['a', 'b', 'c']); expect(await assistantPrincipal(INTERNAL_PRINCIPAL_HEADER)).toBeNull();
  });
  it('rereads revoked membership before using the internal principal', async () => { const context = ctx('a'); context.agencyId = 'other'; await expect(withAssistantPrincipal(context, () => assistantPrincipal(INTERNAL_PRINCIPAL_HEADER))).rejects.toThrow('revoked'); });
});
