import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/firebase/admin';
import { getSaleDocumentStages } from '@/lib/sales-documents';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleChecklistStage } from '@/lib/types';

export const runtime = 'nodejs';

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'document';
}

export async function GET(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const stageValue = request.nextUrl.searchParams.get('stage');
    const stage = ['reservation', 'precontract', 'contract'].includes(stageValue || '')
      ? stageValue as SaleChecklistStage
      : null;
    const checklist = access.sale.checklist || [];
    const eligible = checklist.filter((item) => {
      if (item.status !== 'verified' || !item.storagePath) return false;
      const stages = getSaleDocumentStages(item);
      return !stage || !stages.length || stages.includes(stage);
    });
    if (!eligible.length) throw new SalesApiError('Nu există documente verificate pentru pachetul selectat.', 409);

    const zip = new JSZip();
    const manifest = {
      generatedAt: new Date().toISOString(),
      trackingCode: access.sale.trackingCode,
      property: {
        title: access.sale.propertyTitle,
        address: access.sale.propertyAddress,
      },
      stage: stage || 'all',
      documents: eligible.map((item) => ({
        id: item.id,
        label: item.label,
        fileName: item.fileName,
        version: item.version || 1,
        verifiedAt: item.verifiedAt || item.reviewedAt || null,
        participantRole: item.participantRole,
        participantId: item.participantId || null,
        scope: item.scope || null,
      })),
      missingRequirements: checklist
        .filter((item) => item.required && item.status !== 'not_required' && item.status !== 'verified')
        .filter((item) => {
          const stages = getSaleDocumentStages(item);
          return !stage || !stages.length || stages.includes(stage);
        })
        .map((item) => item.label),
    };

    await Promise.all(eligible.map(async (item, index) => {
      const [bytes] = await adminStorage.bucket().file(item.storagePath as string).download();
      const roleFolder = item.participantRole === 'buyer' ? 'cumparator' : 'proprietar';
      const original = item.fileName || item.label;
      const packageName = `${String(index + 1).padStart(2, '0')}-${safeFileName(item.label)}-${item.id.slice(0, 8)}-${safeFileName(original)}`;
      zip.file(`documente/${roleFolder}/${packageName}`, bytes);
    }));
    zip.file('manifest-dosar.json', JSON.stringify(manifest, null, 2));
    const archive = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    const audit = appendSalesAudit(access.adminDb, access.saleRef, {
      agencyId: access.agencyId,
      saleId,
      actorUid: access.uid,
      actorType: 'agent',
      action: 'document.package_exported',
      entityType: 'sale',
      entityId: saleId,
      summary: 'Pachet documente generat pentru ' + (stage || 'toate etapele'),
      metadata: { stage: stage || 'all', documentCount: eligible.length },
    });
    await audit.ref.set(audit.data);

    const suffix = stage || 'complet';
    return new NextResponse(Buffer.from(archive), {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="dosar-' + access.sale.trackingCode + '-' + suffix + '.zip"',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}