import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext } from '@/lib/ai-assistant/access';
import { usageReport } from '@/lib/ai-assistant/metrics';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { idSchema } from '@/lib/ai-assistant/contracts';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const ctx = await assistantContext(request), date = z.string().datetime();
    const to = date.parse(request.nextUrl.searchParams.get('to') || new Date().toISOString());
    const from = date.parse(request.nextUrl.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString());
    if (from >= to || Date.parse(to) - Date.parse(from) > 366 * 86400000) return NextResponse.json({ error: 'Interval invalid.' }, { status: 400 });
    const cursor = request.nextUrl.searchParams.get('cursor');
    return NextResponse.json(await usageReport(ctx, from, to, cursor ? idSchema.parse(cursor) : undefined), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
