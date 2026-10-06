import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { browserVideoSchema, saveBrowserVideo } from '@/lib/crm/browser-video';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try { const { propertyId } = await params; if (!propertyId || propertyId.includes('/') || propertyId.length > 180) return NextResponse.json({ error: 'Proprietate invalidă.' }, { status: 400 });
    return NextResponse.json(await saveBrowserVideo(await assistantContext(request), propertyId, browserVideoSchema.parse(JSON.parse(await readBoundedText(request.body, 6000)))), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
