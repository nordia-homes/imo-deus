import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la actualizarea draftului TikTok.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la actualizarea draftului TikTok.' };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ draftId: string }> }) {
  try {
    const [{ draftId }, { requireAgencyUserFromBearerToken }, { updateTikTokPostDraft }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const draft = await updateTikTokPostDraft({
      agencyId,
      draftId,
      description: body.description,
      hashtags: body.hashtags,
      privacyLevel: body.privacyLevel,
      disableComment: body.disableComment,
      disableDuet: body.disableDuet,
      disableStitch: body.disableStitch,
      aiGeneratedContent: body.aiGeneratedContent,
      coverTimestampMs: body.coverTimestampMs,
    });
    return NextResponse.json({ draft }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
