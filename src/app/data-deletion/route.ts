import { createHmac, randomBytes } from 'crypto';
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
  if (received.length !== expected.length || !received.equals(expected)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as {
    user_id?: string;
    issued_at?: number;
  };
  return payload;
}

export async function GET() {
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
  const payload = parseSignedRequest(signedRequest);
  const confirmationCode = randomBytes(16).toString('hex');

  if (payload?.user_id) {
    const { disconnectMetaMarketingByMetaUser } = await import('@/lib/meta-marketing');
    await disconnectMetaMarketingByMetaUser(payload.user_id).catch(() => undefined);
  }

  return NextResponse.json({
    url: 'https://imodeus.ro/data-deletion',
    confirmation_code: confirmationCode,
  });
}
