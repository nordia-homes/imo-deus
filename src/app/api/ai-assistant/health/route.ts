import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { crmHealth } from '@/lib/ai-assistant/health';
import { assistantError } from '@/lib/ai-assistant/http-error';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { return NextResponse.json(await crmHealth(await assistantContext(request)), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return assistantError(error); }
}
