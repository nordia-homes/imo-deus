import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import type { SalesEmailTemplate } from '@/lib/types';
import { sanitizeEmailHtml } from '@/lib/email-compose';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const input = await request.json() as Partial<SalesEmailTemplate>;
    if (!input.name?.trim() || !input.subject?.trim() || !input.body?.trim() || !input.recipientRole) {
      return NextResponse.json({ message: 'Numele, destinatarul, subiectul și mesajul sunt obligatorii.' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const ref = auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesEmailTemplates').doc();
    const template: Omit<SalesEmailTemplate, 'id'> = {
      name: input.name.trim().slice(0, 160),
      description: input.description?.trim().slice(0, 500) || 'Template personalizat al agenției',
      recipientRole: input.recipientRole,
      stage: input.stage || 'any',
      subject: input.subject.trim().slice(0, 500),
      body: input.body.trim().slice(0, 30_000),
      bodyHtml: typeof input.bodyHtml === 'string' ? sanitizeEmailHtml(input.bodyHtml.trim()).slice(0, 60_000) : null,
      defaultCc: Array.isArray(input.defaultCc) ? input.defaultCc.map((item) => String(item).trim().toLowerCase()).filter(Boolean).slice(0, 20) : [],
      defaultQuestions: (input.defaultQuestions || []).map((item) => item.trim()).filter(Boolean).slice(0, 20),
      isSystem: false,
      isActive: true,
      version: 1,
      locale: input.locale || 'ro',
      approvalStatus: 'draft',
      createdByUid: auth.uid,
      updatedByUid: auth.uid,
      approvedByUid: null,
      approvedAt: null,
      signatureMode: input.signatureMode || 'agent',
      variables: input.variables || [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(template);
    await auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesTemplateAudit').add({ templateId: ref.id, actorUid: auth.uid, action: 'created', version: 1, createdAt: now });
    return NextResponse.json({ template: { id: ref.id, ...template } }, { status: 201 });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Template-ul nu a putut fi creat.' }, { status });
  }
}
