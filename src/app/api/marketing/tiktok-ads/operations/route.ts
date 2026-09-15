import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import { parseOperationBody } from '@/lib/tiktok-ads/request-validation';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';
export const maxDuration = 300;

function correlationId(request: NextRequest) {
  const supplied = request.headers.get('x-correlation-id');
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { executeTikTokAdsOperation }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Operațiile TikTok Ads sunt blocate în demo.');
    const body = parseOperationBody(await request.json().catch(() => null));
    if (body.propertyId) {
      const property = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(body.propertyId).get();
      if (!property.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu aparține organizației curente.');
    }
    const result = await executeTikTokAdsOperation({
      organizationId: agencyId,
      actor: { uid, role, type: 'human' },
      capability: body.capability,
      advertiserId: body.advertiserId,
      propertyId: body.propertyId,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
      authorizationToken: body.authorizationToken,
      expectedVersion: body.expectedVersion,
      correlationId: correlationId(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
