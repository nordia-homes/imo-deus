import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { scheduleTikTokPost, cancelScheduledTikTokPost } from '@/lib/tiktok-studio-jobs';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
export async function POST(request: NextRequest, context: { params: Promise<{ draftId: string }> }) {
  try {
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Publicarea nu este disponibilă în demo.');
    const { draftId } = await context.params;
    const body = await request.json();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(draftId) || body.confirm !== true || typeof body.runAt !== 'string') return NextResponse.json({ message: 'Confirmă data și publicarea.' }, { status: 400 });
    return NextResponse.json(await scheduleTikTokPost(agencyId, uid, draftId, body.runAt));
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Programarea a eșuat.' }, { status: 400 }); }
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ draftId: string }> }) {
  try {
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Publicarea nu este disponibilă în demo.');
    const { draftId } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(draftId)) return NextResponse.json({ message: 'Postare invalidă.' }, { status: 400 });
    return NextResponse.json(await cancelScheduledTikTokPost(agencyId, uid, draftId));
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Anularea a eșuat.' }, { status: 400 }); }
}
