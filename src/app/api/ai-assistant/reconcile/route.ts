import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { reconciliationSchema, reconcileCrmHistory } from '@/lib/ai-assistant/reconciliation';
import { readBoundedText } from '@/lib/romimo/transport';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { return NextResponse.json(await reconcileCrmHistory(await assistantContext(request), reconciliationSchema.parse(JSON.parse(await readBoundedText(request.body, 4000))))); } catch (error) { return assistantError(error); }
}
