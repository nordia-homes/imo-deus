import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import type { TikTokStudioAsset, TikTokStudioBrandKit, TikTokStudioCreativePreset } from '@/lib/types';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'Nu am putut genera conceptul TikTok Studio.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'Nu am putut genera conceptul TikTok Studio.' };
}

function parsePreset(value: unknown): TikTokStudioCreativePreset {
  if (
    value === 'fast_tiktok_hook'
    || value === 'warm_family_home'
    || value === 'investor_deal'
    || value === 'new_development'
    || value === 'luxury_real_estate'
  ) {
    return value;
  }
  return 'luxury_real_estate';
}

async function getStudioAssets(agencyId: string, assetIds: string[]) {
  const uniqueIds = Array.from(new Set(assetIds.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 20);
  const snapshots = await Promise.all(
    uniqueIds.map((assetId) => adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioAssets').doc(assetId).get())
  );
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as TikTokStudioAsset)
    .filter((asset) => asset.type === 'image');
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { generateTikTokStudioCreativeBrief }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-video-studio-creative'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const sourceAssets = await getStudioAssets(agencyId, Array.isArray(body.sourceAssetIds) ? body.sourceAssetIds : []);
    if (sourceAssets.length < 2) {
      return NextResponse.json({ message: 'Selecteaza cel putin doua fotografii pentru conceptul AI.' }, { status: 400 });
    }

    const brandKit = body.brandKit && typeof body.brandKit === 'object'
      ? body.brandKit as TikTokStudioBrandKit
      : null;
    const brief = await generateTikTokStudioCreativeBrief({
      title: typeof body.title === 'string' ? body.title : undefined,
      preset: parsePreset(body.preset),
      sourceAssets,
      propertyContext: typeof body.propertyContext === 'string' ? body.propertyContext : null,
      agentName: typeof body.agentName === 'string' ? body.agentName : null,
      agentPhone: typeof body.agentPhone === 'string' ? body.agentPhone : null,
      brandKit,
    });

    return NextResponse.json({ brief }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
