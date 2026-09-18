import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { draftId, isApprovalAdmin } from '@/lib/tiktok-ads/approval-model';
import { previewPublication, publishApprovedDraft } from '@/lib/tiktok-ads/approval-publishing';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';
export const maxDuration = 300;
const schema = z.object({ id: draftId, expectedVersion: z.number().int().positive(), action: z.enum(['preview', 'publish']), token: z.string().max(128).optional() }).strict();
export async function POST(request: NextRequest) {
  try {
    const { agencyId, uid, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Publicarea TikTok Ads este blocată în demo.');
    if (!isApprovalAdmin(role)) return NextResponse.json({ error: 'Doar administratorul poate aproba și publica.' }, { status: 403 });
    const body = schema.parse(await request.json());
    return NextResponse.json(body.action === 'preview' ? await previewPublication(agencyId, uid, role, body.id, body.expectedVersion) : await publishApprovedDraft(agencyId, uid, role, body.id, body.expectedVersion, body.token || ''));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Publicarea nu a fost confirmată.' }, { status: 400 }); }
}
