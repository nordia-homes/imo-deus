import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { finalizeLargeUpload } from '@/lib/crm/media-uploads';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request, route: { params: Promise<{ uploadId: string }> }) {
  try { return NextResponse.json(await finalizeLargeUpload(await assistantContext(request), z.string().uuid().parse((await route.params).uploadId)), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return assistantError(error); }
}
