import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la statusul publicarii TikTok.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la statusul publicarii TikTok.' };
}

export async function GET(request: NextRequest, context: { params: Promise<{ draftId: string }> }) {
  try {
    const [{ draftId }, { requireAgencyUserFromBearerToken }, { refreshTikTokPostDraftStatus }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const draft = await refreshTikTokPostDraftStatus({ agencyId, draftId, requestedByUid: uid });
    return NextResponse.json({ draft }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
