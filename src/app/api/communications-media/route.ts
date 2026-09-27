import { NextRequest, NextResponse } from 'next/server';
import { context, CommunicationError } from '@/lib/communications/server';
import { downloadAttachment, saveAttachment } from '@/lib/communications/media';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const actor = await context(request);
    if (Number(request.headers.get('content-length') || 0) > 11 * 1024 * 1024) throw new CommunicationError('Fișier prea mare.', 413);
    const form = await request.formData(); const file = form.get('file'); const id = form.get('conversationId');
    if (!(file instanceof File) || typeof id !== 'string') throw new CommunicationError('Atașament invalid.');
    return NextResponse.json(await saveAttachment(actor.adminDb, actor, id, file));
  } catch (e) { return NextResponse.json({ message: e instanceof Error ? e.message : 'Upload eșuat.' }, { status: e instanceof CommunicationError ? e.status : 500 }); }
}
export async function GET(request: NextRequest) {
  try {
    const actor = await context(request); const p = request.nextUrl.searchParams;
    const file = await downloadAttachment(actor.adminDb, actor, p.get('conversationId') || '', p.get('messageId') || '', Number(p.get('index')) || 0);
    return new NextResponse(new Uint8Array(file.bytes), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return NextResponse.json({ message: e instanceof Error ? e.message : 'Descărcare eșuată.' }, { status: e instanceof CommunicationError ? e.status : 500 }); }
}
