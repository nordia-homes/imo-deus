import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const bodySchema = z.object({
  resources: z.array(z.object({
    resourceType: z.enum(['campaign', 'adgroup', 'ad', 'creative', 'video', 'identity', 'tiktok_post', 'form', 'lead', 'audience']),
    resourceId: id,
  }).strict()).max(100),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ operationId: string }> }) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { acknowledgeTikTokOperationRecovery }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Recovery TikTok Ads este blocat în demo.');
    const { operationId } = await context.params;
    if (!id.safeParse(operationId).success) throw new TikTokAdsError('INVALID_REQUEST', 'operationId nu este valid.');
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new TikTokAdsError('INVALID_REQUEST', 'Payload-ul de recovery nu este valid.');
    return NextResponse.json(await acknowledgeTikTokOperationRecovery({ agencyId, operationId, actorUid: uid, resources: body.data.resources }));
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
