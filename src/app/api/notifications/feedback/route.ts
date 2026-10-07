import { NextRequest, NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { saveNotificationFeedback } from '@/lib/ai-assistant/notification-feedback';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    return NextResponse.json(await saveNotificationFeedback(ctx, await request.json()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
