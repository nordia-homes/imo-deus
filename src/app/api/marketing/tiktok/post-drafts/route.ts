import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la drafturile TikTok.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la drafturile TikTok.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listTikTokPostDrafts }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const drafts = await listTikTokPostDrafts(agencyId);
    return NextResponse.json({ drafts }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { createTikTokPostDraft, createTikTokPostDraftFromStudioAsset }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Publicarea TikTok este doar preview in mediul demo.');
    }
    const body = await request.json().catch(() => ({}));
    const assetId = typeof body.assetId === 'string' ? body.assetId : '';
    if (assetId) {
      const draft = await createTikTokPostDraftFromStudioAsset({
        agencyId,
        assetId,
        requestedByUid: uid,
        description: body.description,
        hashtags: body.hashtags,
        privacyLevel: body.privacyLevel,
        disableComment: body.disableComment,
        disableDuet: body.disableDuet,
        disableStitch: body.disableStitch,
        aiGeneratedContent: body.aiGeneratedContent,
      });
      return NextResponse.json({ draft }, { status: 201 });
    }

    const propertyId = typeof body.propertyId === 'string' ? body.propertyId : '';
    if (!propertyId) {
      return NextResponse.json({ message: 'propertyId lipseste.' }, { status: 400 });
    }
    const draft = await createTikTokPostDraft({
      agencyId,
      propertyId,
      requestedByUid: uid,
      description: body.description,
      hashtags: body.hashtags,
      privacyLevel: body.privacyLevel,
      disableComment: body.disableComment,
      disableDuet: body.disableDuet,
      disableStitch: body.disableStitch,
      aiGeneratedContent: body.aiGeneratedContent,
    });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
