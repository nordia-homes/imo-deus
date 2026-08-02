import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A apărut o eroare la verificarea anului de construcție.',
    };
  }

  return {
    status: 500,
    message: error instanceof Error && error.message
      ? error.message
      : 'A apărut o eroare la verificarea anului de construcție.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { lookupHartaBlocuriByAddress }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/harta-blocuri'),
    ]);
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));

    const payload = await request.json().catch(() => ({})) as { address?: unknown };
    const address = typeof payload.address === 'string' ? payload.address.trim() : '';
    if (!address) {
      return NextResponse.json({ message: 'Introdu adresa completă a imobilului.' }, { status: 400 });
    }

    const lookup = await lookupHartaBlocuriByAddress(address, request.signal);
    return NextResponse.json({
      ok: true,
      ...lookup,
      source: 'HartaBlocuri.ro',
      disclaimer: 'Datele sunt orientative și trebuie confirmate din documentele oficiale ale imobilului.',
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ ok: false, message: formatted.message }, { status: formatted.status });
  }
}
