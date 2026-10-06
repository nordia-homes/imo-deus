import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { initializeLargeUpload, largeUploadSchema } from '@/lib/crm/media-uploads';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { return NextResponse.json(await initializeLargeUpload(await assistantContext(request), largeUploadSchema.parse(JSON.parse(await readBoundedText(request.body, 2000)))), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return assistantError(error); }
}
