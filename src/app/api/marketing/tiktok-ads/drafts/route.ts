import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { getAdvertiser } from '@/lib/tiktok-ads/store';
import { formatTikTokAdsError } from '@/lib/tiktok-ads';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';
import { adDraftSchema, assertDraftAction, canEditApproval, isApprovalAdmin, validateApprovalDraft, type ApprovalDraft } from '@/lib/tiktok-ads/approval-model';
import { FieldValue } from 'firebase-admin/firestore';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
const id = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const draftSchema = adDraftSchema;
const schema = z.object({ id, advertiserId: id, expectedVersion: z.number().int().min(0), data: draftSchema }).strict();
export async function GET(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const advertiserId = id.parse(request.nextUrl.searchParams.get('advertiserId'));
    await getAdvertiser(agencyId, advertiserId);
    const result = await adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').where('advertiserId', '==', advertiserId).limit(100).get();
    return NextResponse.json({ drafts: result.docs.map(doc => { const data = doc.data(); delete data.confirmation; delete data.lease; return { ...data, id: doc.id } as ApprovalDraft; }).filter(doc => doc.status !== 'deleted' && (isApprovalAdmin(role) || doc.ownerUid === uid)) });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: f.status }); }
}
export async function PUT(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Drafturile TikTok sunt blocate în demo.');
    if (role !== 'agent' && !isApprovalAdmin(role)) throw new TikTokAdsError('UNAUTHORIZED', 'Rol neautorizat.');
    const body = schema.parse(await request.json());
    if (JSON.stringify(body.data).length > 30000) throw new TikTokAdsError('INVALID_REQUEST', 'Draftul este prea mare.');
    await getAdvertiser(agencyId, body.advertiserId);
    if (body.data.propertyId) {
      const propertyId = id.parse(body.data.propertyId);
      if (!(await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get()).exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietate invalidă.');
    }
    const ref = adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').doc(body.id);
    const profile = (await adminDb.collection('users').doc(uid).get()).data();
    const version = await adminDb.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current && (current.advertiserId !== body.advertiserId || (!isApprovalAdmin(role) && current.ownerUid !== uid))) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Draftul aparține altui cont sau utilizator.');
      if (current && !canEditApproval(current)) throw new TikTokAdsError('CONFLICT', 'Versiunea trimisă sau publicată este blocată. Retrage cererea pentru editare.');
      if ((current?.version || 0) !== body.expectedVersion) throw new TikTokAdsError('CONFLICT', 'Draftul a fost modificat în altă fereastră. Reîncarcă-l.');
      const version = body.expectedVersion + 1;
      tx.set(ref, { advertiserId: body.advertiserId, ownerUid: current?.ownerUid || uid, ownerName: current?.ownerName || profile?.displayName || profile?.name || uid, status: current?.status || 'draft', data: body.data, version, confirmation: null, updatedAt: new Date().toISOString() }, { merge: true });
      return version;
    });
    return NextResponse.json({ id: ref.id, version });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: error instanceof z.ZodError ? 400 : f.status }); }
}

const actionSchema = z.object({ id, expectedVersion: z.number().int().positive(), action: z.enum(['submit', 'withdraw', 'request_changes', 'reject', 'delete']), note: z.string().max(2000).optional() }).strict();
export async function PATCH(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Aprobările TikTok sunt blocate în demo.');
    const body = actionSchema.parse(await request.json());
    const ref = adminDb.collection('agencies').doc(agencyId).collection('tiktokWorkspaceDrafts').doc(body.id);
    const recipients = body.action === 'submit' ? (await adminDb.collection('users').where('agencyId', '==', agencyId).get()).docs.filter(doc => isApprovalAdmin(doc.data().role)).map(doc => doc.id) : [];
    const status = { submit: 'submitted', withdraw: 'draft', request_changes: 'changes_requested', reject: 'rejected', delete: 'deleted' }[body.action];
    const version = await adminDb.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() as ApprovalDraft | undefined;
      if (!current || current.version !== body.expectedVersion) throw new TikTokAdsError('CONFLICT', 'Draftul s-a modificat. Reîncarcă lista.');
      try { assertDraftAction(current, uid, role, body.action, body.note); if (body.action === 'submit') validateApprovalDraft(current.data); }
      catch (error) { throw new TikTokAdsError('INVALID_REQUEST', error instanceof Error ? error.message : 'Acțiune invalidă.'); }
      if (body.action === 'submit') {
        const agency = adminDb.collection('agencies').doc(agencyId);
        if (!(await tx.get(agency.collection('properties').doc(current.data.propertyId))).exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu mai aparține agenției.');
        if (current.data.mode === 'video') {
          const asset = (await tx.get(agency.collection('tiktokStudioAssets').doc(current.data.assetId))).data();
          if (!asset || asset.agencyId !== agencyId || asset.propertyId !== current.data.propertyId || asset.type !== 'video' || asset.status !== 'ready') throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Selectează un videoclip pregătit al proprietății.');
        }
      }
      const version = current.version + 1, at = new Date().toISOString();
      tx.update(ref, { status, version, confirmation: null, feedback: body.note?.trim() || '', updatedAt: at, history: FieldValue.arrayUnion({ actorUid: uid, at, action: body.action, version, note: body.note?.trim() || '' }) });
      const targets = body.action === 'submit' ? recipients : ['reject', 'request_changes'].includes(body.action) ? [current.ownerUid] : [];
      for (const target of targets) {
        const eventId = `tiktok-${body.id}-${version}`;
        tx.set(adminDb.collection('users').doc(target).collection('notifications').doc(eventId), { id: eventId, eventId, agencyId, recipientId: target, type: 'tiktok_approval', category: 'taskUpdates', priority: 'action_required', title: body.action === 'submit' ? 'Reclamă TikTok de aprobat' : 'Decizie pentru reclama TikTok', body: `${current.data.name}: ${body.note?.trim() || 'Așteaptă verificarea administratorului.'}`, actionUrl: '/marketing/tiktok-ads?tab=approvals', entityType: 'tiktokDraft', entityId: body.id, createdAt: FieldValue.serverTimestamp(), isRead: false });
      }
      return version;
    });
    return NextResponse.json({ status, version });
  } catch (error) { const f = formatTikTokAdsError(error); return NextResponse.json(f.body, { status: error instanceof z.ZodError ? 400 : f.status }); }
}
