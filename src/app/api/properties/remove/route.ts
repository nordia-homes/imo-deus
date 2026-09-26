import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { PropertyLifecycleError } from '@/lib/property-removal/lifecycle';
import { removalSchema } from '@/lib/property-removal/schema';
import { removeProperty } from '@/lib/property-removal/service';
import { BodyLimitError, readBoundedText } from '@/lib/romimo/transport';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!['admin', 'agent'].includes(auth.role || '')) throw new PropertyLifecycleError('Acces nepermis.', 403);
    const text = await readBoundedText(request.body, 20000);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new PropertyLifecycleError('Cerere JSON invalidă.', 400); }
    const input = removalSchema.parse(body);
    const result = await removeProperty({ db: auth.adminDb, agencyId: auth.agencyId, uid: auth.uid, role: auth.role!, propertyId: input.propertyId, demo: auth.runtimeMode === 'demo' || isDemoAgencyId(auth.agencyId) }, input);
    return NextResponse.json(result, { status: result.complete ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ message: 'Cererea este prea mare.' }, { status: 413 });
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Verifică motivul și detaliile vânzării.' }, { status: 400 });
    if (error instanceof PropertyLifecycleError) return NextResponse.json({ message: error.message }, { status: error.status });
    const status = error && typeof error === 'object' && 'status' in error && [401, 403].includes(Number(error.status)) ? Number(error.status) : 500;
    return NextResponse.json({ message: status === 500 ? 'Rezultatul nu a putut fi confirmat. Reîncearcă; retragerile confirmate se păstrează.' : 'Sesiune invalidă sau acces nepermis.' }, { status });
  }
}
