import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readPlanOutcomes } from '@/lib/ai-assistant/plan-outcomes';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  try {
    const ctx = await assistantContext(request), planId = z.string().uuid().parse(request.nextUrl.searchParams.get('planId'));
    return NextResponse.json(await readPlanOutcomes(ctx, planId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
