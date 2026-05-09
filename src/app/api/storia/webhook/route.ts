import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function buildWebhookAck(request: NextRequest) {
  const rawBody = await request.text().catch(() => '');

  try {
    if (request.method === 'POST' && rawBody) {
      const { handleStoriaWebhookNotification } = await import('@/lib/storia');
      await handleStoriaWebhookNotification(
        JSON.parse(rawBody) as Record<string, unknown>,
        request.headers.get('x-signature')
      );
    }
  } catch (error) {
    console.error('[storia] webhook processing failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

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
