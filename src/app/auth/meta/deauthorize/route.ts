import { NextRequest, NextResponse } from 'next/server';
import { parseMetaSignedRequest } from '@/lib/communications/meta-signed-request';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const payload = parseMetaSignedRequest(form?.get('signed_request'));
  if (!payload) return NextResponse.json({ error: 'Invalid signed request' }, { status: 403 });
  if (!payload.whatsapp) {
    const { disconnectMetaMarketingByMetaUser } = await import('@/lib/meta-marketing');
    await disconnectMetaMarketingByMetaUser(payload.userId);
  }
  const [{ disconnectCommunicationsByMetaUser }, { adminDb }] = await Promise.all([import('@/lib/communications/sync'), import('@/firebase/admin')]);
  await disconnectCommunicationsByMetaUser(adminDb, payload.userId, payload.appId);
  return NextResponse.json({ success: true });
}
