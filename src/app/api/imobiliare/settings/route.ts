import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import type { ImobiliarePromotionSettings } from '@/lib/types';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la salvarea setarilor imobiliare.ro.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la salvarea setarilor imobiliare.ro.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { updateAgencyImobiliareSettings }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));

    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Setarile reale imobiliare.ro nu pot fi modificate in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const defaultPromotionSettings =
      body?.defaultPromotionSettings && typeof body.defaultPromotionSettings === 'object'
        ? (body.defaultPromotionSettings as ImobiliarePromotionSettings)
        : null;

    const result = await updateAgencyImobiliareSettings({
      agencyId,
      acpUrl: typeof body?.acpUrl === 'string' ? body.acpUrl : null,
      performanceReportEmail: typeof body?.performanceReportEmail === 'string' ? body.performanceReportEmail : null,
      defaultPromotionSettings,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
