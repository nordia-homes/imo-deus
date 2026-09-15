import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export async function GET(request: NextRequest, context: { params: Promise<{ operationId: string }> }) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getTikTokAdsOperationStatus }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { operationId } = await context.params;
    if (!id.safeParse(operationId).success) throw new TikTokAdsError('INVALID_REQUEST', 'operationId nu este valid.');
    return NextResponse.json({ operation: await getTikTokAdsOperationStatus(agencyId, operationId) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
