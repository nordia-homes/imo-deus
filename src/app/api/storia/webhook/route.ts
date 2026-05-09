import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function buildWebhookAck(request: NextRequest) {
  const rawBody = await request.text().catch(() => '');

  console.info('[storia] webhook received', {
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    hasSignature: Boolean(request.headers.get('x-signature')),
    bodyLength: rawBody.length,
  });

  return NextResponse.json(
    {
      ok: true,
      provider: 'storia',
      receivedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function GET(request: NextRequest) {
  return buildWebhookAck(request);
}

export async function POST(request: NextRequest) {
  return buildWebhookAck(request);
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
