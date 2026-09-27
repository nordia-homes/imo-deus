import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getMetaAppSecret() {
  return (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim();
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function parseSignedRequest(signedRequest?: string | null) {
  if (!signedRequest) return null;
  const [encodedSignature, encodedPayload] = signedRequest.split('.');
  if (!encodedSignature || !encodedPayload) return null;

  const secret = getMetaAppSecret();
  if (!secret) return null;

  const expected = createHmac('sha256', secret).update(encodedPayload).digest();
  const received = base64UrlDecode(encodedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as {
    user_id?: string;
    issued_at?: number;
  };
  return payload;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    if (!/^[a-f0-9]{32}$/.test(code)) return new NextResponse('Not found', { status: 404 });
    const { adminDb } = await import('@/firebase/admin');
    const receipt = await adminDb.collection('communicationDeletionRequests').doc(code).get();
    if (!receipt.exists) return new NextResponse('Not found', { status: 404 });
    return NextResponse.json({ confirmation_code: code, status: receipt.data()?.status, requestedAt: receipt.data()?.requestedAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return new NextResponse(
    `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Stergere date ImoDeus</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;max-width:760px;margin:48px auto;padding:0 24px"><h1>Stergere date ImoDeus</h1><p>Pentru stergerea datelor asociate conectarii Meta, trimite o solicitare la <a href="mailto:crm@imodeus.ro">crm@imodeus.ro</a> sau foloseste fluxul de deautorizare din Facebook.</p><p>Endpoint-ul accepta si callback-ul Meta Data Deletion Requests.</p></body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const signedRequest = typeof formData?.get('signed_request') === 'string'
    ? formData.get('signed_request') as string
    : null;
  let payload;
  try { payload = parseSignedRequest(signedRequest); } catch { payload = null; }
  if (!payload?.user_id) return NextResponse.json({ error: 'Invalid signed request' }, { status: 403 });
  const confirmationCode = randomBytes(16).toString('hex');

  if (payload?.user_id) {
    const { disconnectMetaMarketingByMetaUser } = await import('@/lib/meta-marketing');
    await disconnectMetaMarketingByMetaUser(payload.user_id).catch(() => undefined);
    const [{ disconnectCommunicationsByMetaUser }, { adminDb }] = await Promise.all([import('@/lib/communications/sync'), import('@/firebase/admin')]);
    await adminDb.collection('communicationDeletionRequests').doc(confirmationCode).create({ metaUserId: payload.user_id, status: 'pending_review', requestedAt: new Date().toISOString() });
    await disconnectCommunicationsByMetaUser(adminDb, payload.user_id);
  }

  return NextResponse.json({
    url: `https://imodeus.ro/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
