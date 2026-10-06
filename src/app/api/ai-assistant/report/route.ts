import { NextRequest, NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { crmReport, reportSchema } from '@/lib/ai-assistant/report';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    return NextResponse.json(await crmReport(ctx, reportSchema.parse(Object.fromEntries(request.nextUrl.searchParams))), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
