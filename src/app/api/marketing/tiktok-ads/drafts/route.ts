import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { getAdvertiser } from '@/lib/tiktok-ads/store';
import { formatTikTokAdsError } from '@/lib/tiktok-ads';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';
const id = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const optionalId = z.union([id, z.literal('')]);
const draftSchema = z.object({ name: z.string().max(512), propertyId: optionalId, assetId: optionalId, identityId: optionalId, objective: z.enum(['TRAFFIC', 'LEAD_GENERATION', 'VIDEO_VIEWS']), text: z.string().max(2200), url: z.string().max(2048), formId: optionalId, locationIds: z.array(id).max(100), budget: z.string().max(30), start: z.string().max(30), end: z.string().max(30), cta: z.string().max(50), mode: z.enum(['video', 'post']), postId: optionalId, adgroupId: optionalId }).strict();
const schema = z.object({ id, advertiserId: id, expectedVersion: z.number().int().min(0), data: draftSchema }).strict();
export async function GET(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const advertiserId = id.parse(request.nextUrl.searchParams.get('advertiserId'));
    await getAdvertiser(agencyId, advertiserId);
    const result = await adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').where('advertiserId', '==', advertiserId).limit(100).get();
    return NextResponse.json({ drafts: result.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((doc) => role !== 'agent' || (doc as Record<string, unknown>).ownerUid === uid) });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: f.status }); }
}
export async function PUT(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = schema.parse(await request.json());
    if (JSON.stringify(body.data).length > 30000) throw new TikTokAdsError('INVALID_REQUEST', 'Draftul este prea mare.');
    await getAdvertiser(agencyId, body.advertiserId);
    if (body.data.propertyId) {
      const propertyId = id.parse(body.data.propertyId);
      if (!(await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get()).exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietate invalidă.');
    }
    const ref = adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').doc(body.id);
    const version = await adminDb.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current && (current.advertiserId !== body.advertiserId || (role === 'agent' && current.ownerUid !== uid))) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Draftul aparține altui cont sau utilizator.');
      if ((current?.version || 0) !== body.expectedVersion) throw new TikTokAdsError('CONFLICT', 'Draftul a fost modificat în altă fereastră. Reîncarcă-l.');
      const version = body.expectedVersion + 1;
      tx.set(ref, { advertiserId: body.advertiserId, ownerUid: current?.ownerUid || uid, data: body.data, version, updatedAt: new Date().toISOString() });
      return version;
    });
    return NextResponse.json({ id: ref.id, version });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: error instanceof z.ZodError ? 400 : f.status }); }
}
