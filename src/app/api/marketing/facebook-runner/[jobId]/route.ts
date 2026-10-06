import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { readLegacyRunner, runnerSkipSchema, updateLegacyRunner } from '@/lib/crm/facebook-runner';
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try { return NextResponse.json(await readLegacyRunner(await assistantContext(request), (await params).jobId), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return assistantError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try { return NextResponse.json(await updateLegacyRunner(await assistantContext(request), (await params).jobId, runnerSkipSchema.parse(JSON.parse(await readBoundedText(request.body, 2000))), 'assistant_skip')); } catch (error) { return assistantError(error); }
}
