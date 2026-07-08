import { NextRequest, NextResponse } from 'next/server';
import type { Property } from '@/lib/types';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message.slice(0, 700) : 'A aparut o eroare la generarea scriptului video.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message.slice(0, 700) };
  return { status: 500, message: 'A aparut o eroare la generarea scriptului video.' };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const [{ propertyId }, { requireAgencyUserFromBearerToken }, { generatePropertyVideoTourScript }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const propertySnapshot = await authContext.adminDb
      .collection('agencies')
      .doc(authContext.agencyId)
      .collection('properties')
      .doc(propertyId)
      .get();

    if (!propertySnapshot.exists) {
      return NextResponse.json({ message: 'Proprietatea nu exista sau nu apartine agentiei curente.' }, { status: 404 });
    }

    const script = await generatePropertyVideoTourScript({
      property: { id: propertySnapshot.id, ...propertySnapshot.data() } as Property,
      style: body.style,
      targetDurationSeconds: body.targetDurationSeconds,
    });

    return NextResponse.json({ script }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
