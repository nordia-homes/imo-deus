import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { parseMetaSignedRequest } from '@/lib/communications/meta-signed-request';
export const runtime = 'nodejs';

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
  try { payload = parseMetaSignedRequest(signedRequest); } catch { payload = null; }
  if (!payload?.userId) return NextResponse.json({ error: 'Invalid signed request' }, { status: 403 });
  const confirmationCode = randomBytes(16).toString('hex');

  if (payload?.userId) {
    if (!payload.whatsapp) {
      const { disconnectMetaMarketingByMetaUser } = await import('@/lib/meta-marketing');
      await disconnectMetaMarketingByMetaUser(payload.userId);
    }
    const [{ disconnectCommunicationsByMetaUser }, { adminDb }] = await Promise.all([import('@/lib/communications/sync'), import('@/firebase/admin')]);
    await adminDb.collection('communicationDeletionRequests').doc(confirmationCode).create({ metaUserId: payload.userId, appId: payload.appId, status: 'pending_review', requestedAt: new Date().toISOString() });
    await disconnectCommunicationsByMetaUser(adminDb, payload.userId, payload.appId);
  }

  return NextResponse.json({
    url: `https://imodeus.ro/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
