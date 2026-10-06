import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { prepareMediaUpload, mediaPreparationSchema } from '@/lib/crm/media-uploads';
export const runtime = 'nodejs';
export async function POST(request: Request, route: { params: Promise<{ uploadId: string }> }) {
  try { return NextResponse.json(await prepareMediaUpload(await assistantContext(request), z.string().uuid().parse((await route.params).uploadId), mediaPreparationSchema.parse(JSON.parse(await readBoundedText(request.body, 4000)))), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return assistantError(error); }
}
