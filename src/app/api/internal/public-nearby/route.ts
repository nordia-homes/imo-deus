import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { populatePublicNearbyOnce } from '@/lib/public-nearby-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const expected = process.env.OWNER_LISTINGS_CRON_SECRET;
  const provided = request.headers.get('x-owner-listings-cron-secret') || '';
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    return NextResponse.json({ message: 'Neautorizat.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,128}$/.test(id);
  if (!validId(body?.agencyId) || !validId(body?.propertyId)) return NextResponse.json({ message: 'Identificator invalid.' }, { status: 400 });
  if (!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_STATIC_API_KEY)?.trim()) {
    return NextResponse.json({ message: 'Configurare indisponibilă.' }, { status: 503 });
  }
  try {
    return NextResponse.json(await populatePublicNearbyOnce(adminDb, body.agencyId, body.propertyId));
  } catch {
    return NextResponse.json({ message: 'Calcularea obiectivelor nu a fost finalizată.' }, { status: 500 });
  }
}
