import { NextRequest, NextResponse } from 'next/server';
import type { ImobiliarePromotionSettings } from '@/lib/types';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la salvarea promovarilor.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la salvarea promovarilor.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { updatePropertyImobiliarePromotionSettings }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const promotionSettings =
      body?.promotionSettings && typeof body.promotionSettings === 'object'
        ? (body.promotionSettings as ImobiliarePromotionSettings)
        : null;

    if (!propertyId) {
      return NextResponse.json({ message: 'Lipseste proprietatea.' }, { status: 400 });
    }

    const result = await updatePropertyImobiliarePromotionSettings({
      agencyId,
      propertyId,
      promotionSettings,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
