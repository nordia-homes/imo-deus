import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  const raw=error&&typeof error==='object'&&'status' in error?(error as {status?:unknown}).status:null;
  const status=typeof raw==='number'&&Number.isInteger(raw)&&raw>=400&&raw<=599?raw:500;
  return {status,message:'Publicarea nu este confirmată. Verifică starea înainte de reluare; operațiile incerte nu sunt retrimise automat.'};
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { publishPropertyToFacebookPage }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId, uid, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!['admin', 'agent'].includes(role || '')) {
      return NextResponse.json({ message: 'Acces de agent al agenției necesar pentru publicare.' }, { status: 403 });
    }
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Publicarea pe Facebook este blocata in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId : '';
    const mediaType = body.mediaType === 'video' ? 'video' : 'gallery';
    if (!propertyId) {
      return NextResponse.json({ message: 'propertyId lipseste.' }, { status: 400 });
    }

    const post = await publishPropertyToFacebookPage({
      agencyId,
      propertyId,
      requestedByUid: uid,
      mediaType,
    });

    return NextResponse.json({ post }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
