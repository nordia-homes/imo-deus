import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la campania Meta.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la campania Meta.' };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const [{ campaignId }, { requireAgencyUserFromBearerToken }, { markMetaCampaignReady }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const result = await markMetaCampaignReady(agencyId, campaignId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
