import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { adminDb } from '@/firebase/admin';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Nu am putut citi statusul anunturilor de proprietari.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Nu am putut citi statusul anunturilor de proprietari.' };
}

export async function GET(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await adminDb.collection('ownerListings').orderBy('lastSeenAt', 'desc').limit(1).get();
    const latest = snapshot.docs[0]?.data() as { lastSeenAt?: number; sourceLabel?: string } | undefined;

    return NextResponse.json(
      {
        countSample: snapshot.size,
        latestSeenAt: latest?.lastSeenAt || null,
        latestSource: latest?.sourceLabel || null,
      },
      { status: 200 }
    );
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
