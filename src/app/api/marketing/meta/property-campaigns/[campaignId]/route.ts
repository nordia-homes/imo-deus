import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const [{ campaignId }, { requireAgencyUserFromBearerToken }, { updateMetaCampaignDraft }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Campaniile Meta sunt doar preview in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const campaign = await updateMetaCampaignDraft(agencyId, campaignId, body);
    return NextResponse.json({ campaign }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
