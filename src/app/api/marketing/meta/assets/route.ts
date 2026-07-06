import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la incarcarea asset-urilor Meta.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la incarcarea asset-urilor Meta.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listMetaMarketingAssets }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const assets = await listMetaMarketingAssets(agencyId);
    return NextResponse.json(assets, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { selectMetaMarketingAssets }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Selectia asset-urilor Meta este blocata in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const businessId = typeof body.businessId === 'string' ? body.businessId : '';
    const adAccountId = typeof body.adAccountId === 'string' ? body.adAccountId : '';
    const pageId = typeof body.pageId === 'string' ? body.pageId : '';
    const instagramAccountId = typeof body.instagramAccountId === 'string' ? body.instagramAccountId : null;

    if (!businessId || !adAccountId || !pageId) {
      return NextResponse.json({ message: 'Alege Business, Ad Account si Page.' }, { status: 400 });
    }

    const result = await selectMetaMarketingAssets(agencyId, {
      businessId,
      adAccountId,
      pageId,
      instagramAccountId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
