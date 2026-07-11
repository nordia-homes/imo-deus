import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la asset-urile TikTok Studio.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la asset-urile TikTok Studio.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listTikTokStudioAssets }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const assets = await listTikTokStudioAssets(agencyId);
    return NextResponse.json({ assets }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { createTikTokStudioAsset }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Importul media TikTok Studio este blocat in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type === 'image' ? 'image' : body.type === 'video' ? 'video' : null;
    const url = typeof body.url === 'string' ? body.url : '';
    if (!type || !url) {
      return NextResponse.json({ message: 'type si url sunt obligatorii.' }, { status: 400 });
    }

    const asset = await createTikTokStudioAsset({
      agencyId,
      ownerUid: uid,
      type,
      name: typeof body.name === 'string' ? body.name : '',
      url,
      thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : null,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : null,
      sizeBytes: Number(body.sizeBytes) || null,
      source: body.source,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { deleteTikTokStudioAsset }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Stergerea media TikTok Studio este blocata in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const assetId = typeof body.assetId === 'string' ? body.assetId : '';
    if (!assetId) {
      return NextResponse.json({ message: 'assetId este obligatoriu.' }, { status: 400 });
    }

    const result = await deleteTikTokStudioAsset(agencyId, assetId);
    return NextResponse.json({ assetId: result.id }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
