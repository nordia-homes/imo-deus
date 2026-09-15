import { NextRequest, NextResponse } from 'next/server';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

function validateLeadId(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new TikTokAdsError('INVALID_REQUEST', 'Identificatorul lead-ului nu este valid.');
  return value;
}

export async function GET(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    const [{ leadId }, { requireAgencyAdminFromBearerToken }, { exportTikTokLead }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const result = await exportTikTokLead(agencyId, validateLeadId(leadId));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    const [{ leadId }, { requireAgencyAdminFromBearerToken }, { deleteTikTokLead }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    await deleteTikTokLead(agencyId, validateLeadId(leadId));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
