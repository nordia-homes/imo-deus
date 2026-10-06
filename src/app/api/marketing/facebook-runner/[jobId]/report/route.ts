import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { runnerGroupSchema, updateLegacyRunner } from '@/lib/crm/facebook-runner';
// Device report, deliberately not registered as an AI operation.
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try { return NextResponse.json(await updateLegacyRunner(await assistantContext(request), (await params).jobId, runnerGroupSchema.parse(JSON.parse(await readBoundedText(request.body, 2000))), 'human_callback')); } catch (error) { return assistantError(error); }
}
