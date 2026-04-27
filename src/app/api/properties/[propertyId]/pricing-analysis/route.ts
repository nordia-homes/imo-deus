import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { generatePricingAnalysis } from '@/lib/pricing-analysis';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A aparut o eroare la generarea analizei.',
    };
  }

  if (error instanceof Error) {
    if (/nu a fost gasita/i.test(error.message)) {
      return { status: 404, message: error.message };
    }
    if (/nu exista suficiente comparabile|are nevoie de pret si suprafata/i.test(error.message)) {
      return { status: 422, message: error.message };
    }
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'A aparut o eroare la generarea analizei.' };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { propertyId } = await context.params;
    const analysis = await generatePricingAnalysis({
      agencyId: auth.agencyId!,
      propertyId,
    });

    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
