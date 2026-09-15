import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import { parseOperationBody } from '@/lib/tiktok-ads/request-validation';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { authorizeTikTokSpend }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid, role, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Operațiile TikTok cu spend sunt blocate în demo.');
    const body = parseOperationBody(await request.json().catch(() => null));
    if (body.propertyId) {
      const property = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(body.propertyId).get();
      if (!property.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu aparține organizației curente.');
    }
    const authorization = await authorizeTikTokSpend({
      agencyId,
      actor: { uid, role, type: 'human' },
      capability: body.capability,
      advertiserId: body.advertiserId,
      propertyId: body.propertyId,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json(authorization, { status: 201 });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
