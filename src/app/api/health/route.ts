import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    source: 'next-app',
    marker: 'IMO-DEUS-HEALTHCHECK',
    timestamp: new Date().toISOString(),
  });
}
