import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { getNearbyObjectivesForProperty } from '@/lib/property-presentations/nearby-google';
import type { Property } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { propertyId } = await context.params;
    const snapshot = await auth.adminDb
      .collection('agencies')
      .doc(auth.agencyId!)
      .collection('properties')
      .doc(propertyId)
      .get();

    if (!snapshot.exists) {
      return NextResponse.json({ message: 'Proprietatea nu a fost găsită.' }, { status: 404 });
    }

    const property = { id: snapshot.id, ...snapshot.data() } as Property;
    const objectives = await getNearbyObjectivesForProperty(property);

    return NextResponse.json(
      { objectives, updatedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
    const message = error instanceof Error ? error.message : 'Obiectivele apropiate nu au putut fi calculate.';
    return NextResponse.json({ message }, { status });
  }
}
