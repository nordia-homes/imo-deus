import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { authorizeTikTokSpend, executeTikTokAdsOperation, discoverTikTokAdsCapabilities, formatTikTokAdsError } from '@/lib/tiktok-ads';
import { getAdvertiser, loadToolCache } from '@/lib/tiktok-ads/store';
import { schemaInput, rowsFor } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokCapability } from '@/lib/tiktok-ads/types';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';
import { isDemoAgencyId, createDemoBlockedResponse } from '@/lib/demo/guards';

const id = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
export const runtime = 'nodejs';
export const maxDuration = 300;
const bodySchema = z.object({ advertiserId: id, resourceId: id, kind: z.enum(['campaign', 'adgroup', 'ad']), action: z.enum(['pause', 'resume', 'budget', 'name']), value: z.string().max(512).optional(), commandId: id, confirm: z.boolean().default(false), previousValue: z.string().optional() });
export async function POST(request: NextRequest) {
  try {
    const { agencyId, uid, role } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Modificările TikTok sunt indisponibile în demo.');
    const body = bodySchema.parse(await request.json());
    const actor = { uid, role, type: 'human' as const };
    const advertiser = await getAdvertiser(agencyId, body.advertiserId);
    const resolutions = await discoverTikTokAdsCapabilities(agencyId);
    const tools = await loadToolCache(agencyId);
    const schema = (cap: TikTokCapability) => tools.find(tool => tool.name === resolutions.find(item => item.capability === cap)?.toolName)?.inputSchema;
    const readCapability = `${body.kind.toUpperCase()}_READ` as TikTokCapability;
    const read = async () => {
      const result = await executeTikTokAdsOperation({ organizationId: agencyId, actor, advertiserId: body.advertiserId, capability: readCapability, payload: schemaInput(schema(readCapability), { filtering: { [`${body.kind}_ids`]: [body.resourceId] }, [`${body.kind}_ids`]: [body.resourceId], page_size: 100 }), correlationId: randomUUID() });
      const row = rowsFor(result.remoteResult, body.kind).find(row => row.id === body.resourceId);
      if (!row) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Resursa nu a fost confirmată în contul TikTok.');
      return row;
    };
    const current = await read();
    if (!body.confirm) return NextResponse.json({ current, currency: advertiser.currency, timezone: advertiser.timezone });
    if (body.action === 'budget' && (!current.budget || current.budget !== body.previousValue)) throw new TikTokAdsError('CONFLICT', 'Bugetul s-a schimbat. Verifică și confirmă din nou.');
    if (body.action === 'budget' && body.kind === 'ad') throw new TikTokAdsError('INVALID_REQUEST', 'Bugetul se stabilește pe campanie sau grup.');
    const capability = (body.action === 'budget' ? 'BUDGET_UPDATE' : `${body.kind.toUpperCase()}_${body.action === 'name' ? 'UPDATE' : body.action.toUpperCase()}`) as TikTokCapability;
    const schemaCapability = body.action === 'budget' ? `${body.kind.toUpperCase()}_UPDATE` as TikTokCapability : capability;
    const payload = schemaInput(schema(schemaCapability), { [`${body.kind}_id`]: body.resourceId, [`${body.kind}_ids`]: [body.resourceId], budget: body.action === 'budget' ? body.value : undefined, [`${body.kind}_name`]: body.action === 'name' ? body.value : undefined });
    if (body.action === 'budget') payload._imodeus = { previousAmount: current.budget, significantChangeApproved: true };
    const operation = { organizationId: agencyId, actor, advertiserId: body.advertiserId, capability, payload, idempotencyKey: body.commandId, correlationId: randomUUID() };
    const spend = body.action === 'resume' || body.action === 'budget';
    const authorization = spend ? await authorizeTikTokSpend({ agencyId, actor, advertiserId: body.advertiserId, capability, payload, idempotencyKey: body.commandId }) : null;
    const result = await executeTikTokAdsOperation({ ...operation, authorizationToken: authorization?.token });
    const verified = await read();
    const expected = body.action === 'pause' ? 'DISABLE' : 'ENABLE';
    const verifiedMatch = body.action === 'name' ? verified.name === body.value : body.action === 'budget' ? Number(verified.budget) === Number(body.value) : verified.status === expected || verified.status === `STATUS_${expected}`;
    return NextResponse.json({ result, current: verified, verified: verifiedMatch, message: verifiedMatch ? 'Modificare confirmată în TikTok.' : 'Cererea a fost acceptată; starea finală nu este încă confirmată. Sincronizează din nou.' });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: error instanceof z.ZodError ? 400 : f.status }); }
}
