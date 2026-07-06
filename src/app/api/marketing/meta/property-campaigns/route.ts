import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la campaniile Meta.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la campaniile Meta.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listPropertyMetaCampaigns }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const propertyId = request.nextUrl.searchParams.get('propertyId') || '';
    if (!propertyId) {
      return NextResponse.json({ message: 'propertyId lipseste.' }, { status: 400 });
    }

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const campaigns = await listPropertyMetaCampaigns(agencyId, propertyId);
    return NextResponse.json({ campaigns }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { createMetaCampaignDraft }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Campaniile Meta sunt doar preview in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId : '';
    if (!propertyId) {
      return NextResponse.json({ message: 'propertyId lipseste.' }, { status: 400 });
    }

    const draft = await createMetaCampaignDraft({
      agencyId,
      propertyId,
      requestedByUid: uid,
      objective: body.objective,
      budgetAmount: Number(body.budgetAmount) || undefined,
      budgetType: body.budgetType,
      durationDays: Number(body.durationDays) || undefined,
    });
    return NextResponse.json({ campaign: draft }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
