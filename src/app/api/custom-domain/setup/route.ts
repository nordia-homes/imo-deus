import { NextRequest, NextResponse } from 'next/server';
import { getCanonicalCustomDomain } from '@/lib/domain-routing';

export const runtime = 'nodejs';

function formatRouteError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'details' in error
  ) {
    const details = (error as { details?: unknown }).details;
    const apiMessage =
      typeof details === 'object' &&
      details !== null &&
      'error' in (details as Record<string, unknown>) &&
      typeof (details as { error?: { message?: string } }).error?.message === 'string'
        ? (details as { error: { message: string } }).error.message
        : null;

    if (apiMessage) {
      return {
        status: 'status' in (error as Record<string, unknown>) && typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : 500,
        message: apiMessage,
      };
    }
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: 'A aparut o eroare neasteptata in configurarea domeniului custom.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      formatAppHostingError,
      requireAgencyAdminFromBearerToken,
      setupAgencyCustomDomain,
    } = await import('@/lib/firebase-app-hosting');

    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const requestedDomain = getCanonicalCustomDomain(body?.domain);

    if (!requestedDomain) {
      return NextResponse.json(
        { message: 'Introdu un domeniu valid.' },
        { status: 400 }
      );
    }

    const result = await setupAgencyCustomDomain(agencyId, requestedDomain);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatRouteError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
