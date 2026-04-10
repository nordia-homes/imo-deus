import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdminFromBearerToken } from '@/lib/firebase-app-hosting';
import { getMasterAdminAgencyDetail } from '@/lib/master-admin';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A apărut o eroare la încărcarea detaliului agenției.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'A apărut o eroare la încărcarea detaliului agenției.' };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    await requirePlatformAdminFromBearerToken(request.headers.get('authorization'));
    const { agencyId } = await context.params;
    const detail = await getMasterAdminAgencyDetail(agencyId);

    if (!detail) {
      return NextResponse.json({ message: 'Agenția nu a fost găsită.' }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
