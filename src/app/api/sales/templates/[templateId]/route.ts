import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { sanitizeEmailHtml } from '@/lib/email-compose';

export const runtime = 'nodejs';

function errorResponse(error: unknown, fallback: string) {
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await context.params;
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const ref = auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesEmailTemplates').doc(templateId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ message: 'Template-ul nu există.' }, { status: 404 });
    const current = snapshot.data() || {};
    const input = await request.json() as { action?: string; name?: string; description?: string; subject?: string; body?: string; bodyHtml?: string; defaultCc?: string[]; defaultQuestions?: string[] };
    const admin = auth.role === 'admin' || auth.role === 'platform_admin';
    if (['approve', 'reject', 'activate', 'deactivate'].includes(input.action || '') && !admin) return NextResponse.json({ message: 'Acțiunea necesită rol de administrator.' }, { status: 403 });
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now, updatedByUid: auth.uid, version: Number(current.version || 1) + 1 };
    if (input.action === 'submit') patch.approvalStatus = 'pending_approval';
    else if (input.action === 'approve') Object.assign(patch, { approvalStatus: 'approved', approvedAt: now, approvedByUid: auth.uid, isActive: true });
    else if (input.action === 'reject') Object.assign(patch, { approvalStatus: 'rejected', isActive: false });
    else if (input.action === 'deactivate') patch.isActive = false;
    else if (input.action === 'activate') patch.isActive = true;
    else {
      if (current.createdByUid && current.createdByUid !== auth.uid && !admin) return NextResponse.json({ message: 'Poți edita doar template-urile tale.' }, { status: 403 });
      for (const key of ['name', 'description', 'subject', 'body'] as const) if (typeof input[key] === 'string') patch[key] = input[key]!.trim().slice(0, key === 'body' ? 30_000 : 500);
      if (typeof input.bodyHtml === 'string') patch.bodyHtml = sanitizeEmailHtml(input.bodyHtml.trim()).slice(0, 60_000);
      if (Array.isArray(input.defaultCc)) patch.defaultCc = input.defaultCc.map((item) => String(item).trim().toLowerCase()).filter(Boolean).slice(0, 20);
      if (Array.isArray(input.defaultQuestions)) patch.defaultQuestions = input.defaultQuestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
      patch.approvalStatus = 'draft';
    }
    await ref.set(patch, { merge: true });
    await auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesTemplateAudit').add({ templateId, actorUid: auth.uid, action: input.action || 'updated', version: patch.version, createdAt: now });
    return NextResponse.json({ template: { id: templateId, ...current, ...patch } });
  } catch (error) {
    return errorResponse(error, 'Template-ul nu a putut fi actualizat.');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await context.params;
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const source = await auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesEmailTemplates').doc(templateId).get();
    if (!source.exists) return NextResponse.json({ message: 'Template-ul nu există.' }, { status: 404 });
    const now = new Date().toISOString();
    const ref = auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesEmailTemplates').doc();
    const data = { ...source.data(), name: `${source.data()?.name || 'Template'} — copie`, version: 1, approvalStatus: 'draft', isActive: true, createdByUid: auth.uid, updatedByUid: auth.uid, approvedByUid: null, approvedAt: null, createdAt: now, updatedAt: now };
    await ref.set(data);
    return NextResponse.json({ template: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Template-ul nu a putut fi duplicat.');
  }
}
