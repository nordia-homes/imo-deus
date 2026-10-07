import { NextRequest, NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { reconcileRuleNotifications } from '@/lib/ai-assistant/notification-relevance';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    const result = await reconcileRuleNotifications(ctx, await request.json());
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
