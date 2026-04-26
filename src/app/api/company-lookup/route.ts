import { NextRequest, NextResponse } from 'next/server';
import { lookupCompanyByTaxId } from '@/lib/infocui';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const taxId = request.nextUrl.searchParams.get('taxId')?.trim() || '';

  if (!taxId) {
    return NextResponse.json(
      { ok: false, message: 'Introdu un CUI / CIF pentru preluarea datelor.' },
      { status: 400 }
    );
  }

  try {
    const company = await lookupCompanyByTaxId(taxId);

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Nu am putut prelua datele companiei acum.';

    const status = message.includes('lipseste') ? 500 : 400;

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status }
    );
  }
}
