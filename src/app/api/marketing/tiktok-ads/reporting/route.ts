import { NextRequest, NextResponse } from 'next/server';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getPropertyTikTokReporting }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const propertyId = request.nextUrl.searchParams.get('propertyId') || '';
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(propertyId)) throw new TikTokAdsError('INVALID_REQUEST', 'propertyId este obligatoriu.');
    const property = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
    if (!property.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu aparține organizației curente.');
    return NextResponse.json({ rows: await getPropertyTikTokReporting(agencyId, propertyId) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
