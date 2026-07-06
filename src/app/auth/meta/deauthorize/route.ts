import { createHmac } from 'crypto';
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
  if (received.length !== expected.length || !received.equals(expected)) return null;

  return JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as {
    user_id?: string;
  };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const signedRequest = typeof formData?.get('signed_request') === 'string'
    ? formData.get('signed_request') as string
    : null;
  const payload = parseSignedRequest(signedRequest);

  if (payload?.user_id) {
    const { disconnectMetaMarketingByMetaUser } = await import('@/lib/meta-marketing');
    await disconnectMetaMarketingByMetaUser(payload.user_id).catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}
