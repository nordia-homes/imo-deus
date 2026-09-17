import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';
export const maxDuration = 300;

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'Randarea proiectului TikTok Studio a esuat.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'Randarea proiectului TikTok Studio a esuat.' };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { enqueueStudioRender }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-studio-jobs'),
    ]);
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Randarea TikTok AI Studio este blocata in mediul demo.');
    }
    const params = await context.params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.projectId)) {
      return NextResponse.json({ message: 'projectId este obligatoriu.' }, { status: 400 });
    }
    const result = await enqueueStudioRender(agencyId, uid, params.projectId);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
