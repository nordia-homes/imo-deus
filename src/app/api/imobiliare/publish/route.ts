import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function extractErrorText(details: unknown) {
  if (!details) {
    return '';
  }

  if (typeof details === 'string') {
    return details;
  }

  if (typeof details !== 'object') {
    return '';
  }

  const record = details as {
    message?: unknown;
    error?: unknown;
    error_description?: unknown;
    errors?: Record<string, unknown>;
  };

  if (record.errors && typeof record.errors === 'object') {
    const flattened = Object.entries(record.errors)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) {
          return value
            .filter((item): item is string => typeof item === 'string' && Boolean(item))
            .map((item) => `${field}: ${item}`);
        }

        if (typeof value === 'string' && value) {
          return [`${field}: ${value}`];
        }

        return [];
      })
      .filter(Boolean);

    if (flattened.length) {
      return flattened.join(' | ');
    }
  }

  if (typeof record.error_description === 'string' && record.error_description) {
    return record.error_description;
  }

  if (typeof record.error === 'string' && record.error) {
    return record.error;
  }

  if (typeof record.message === 'string' && record.message) {
    return record.message;
  }

  return '';
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const details = 'payload' in error ? (error as { payload?: unknown }).payload : null;
    const detailMessage = extractErrorText(details);
    const fallbackMessage = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la publicarea in imobiliare.ro.';
    return { status, message: detailMessage || fallbackMessage, details };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message, details: null };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la publicarea in imobiliare.ro.', details: null };
}

export async function POST(request: NextRequest) {
  let agencyIdForLog: string | null = null;
  let propertyIdForLog: string | null = null;
  try {
    const [{ requireAgencyUserFromBearerToken }, { publishPropertyToImobiliare }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    agencyIdForLog = agencyId;
    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    propertyIdForLog = propertyId || null;

    if (!propertyId) {
      return NextResponse.json({ message: 'Lipseste proprietatea pentru publicare.' }, { status: 400 });
    }

    const result = await publishPropertyToImobiliare({
      agencyId,
      propertyId,
      requestedByUid: uid,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    console.error('[imobiliare] publish route failed', {
      agencyId: agencyIdForLog,
      propertyId: propertyIdForLog,
      status: formatted.status,
      message: formatted.message,
      details: formatted.details,
    });
    return NextResponse.json({ message: formatted.message, details: formatted.details }, { status: formatted.status });
  }
}
