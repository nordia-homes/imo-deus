import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { adminDb } from '@/firebase/admin';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { renderContractContent, stripHtmlTags } from '@/lib/contracts';
import type { ContractTemplate, GeneratedContract } from '@/lib/types';

export const runtime = 'nodejs';

const requestSchema = z.object({
  values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  contactId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
});

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'contract';
}

function wrapLine(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function normalizeValues(values: Record<string, string | number | boolean | null>) {
  const normalized: Record<string, string | number | boolean | null> = {};
  Object.entries(values).forEach(([key, value]) => {
    normalized[key.replace(/\./g, '_')] = value;
  });
  return normalized;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { templateId } = await context.params;
    const body = requestSchema.parse(await request.json().catch(() => ({})));

    if (!templateId) {
      return NextResponse.json({ message: 'Template invalid.' }, { status: 400 });
    }

    const templateSnapshot = await adminDb
      .collection('agencies')
      .doc(agencyId)
      .collection('contractTemplates')
      .doc(templateId)
      .get();

    if (!templateSnapshot.exists) {
      return NextResponse.json({ message: 'Template-ul nu a fost gasit.' }, { status: 404 });
    }

    const template = templateSnapshot.data() as ContractTemplate;
    const templateName = template.name || 'contract';
    const rawContent = template.content || '';

    if (!rawContent.trim()) {
      return NextResponse.json({ message: 'Template-ul nu are continut de generat.' }, { status: 400 });
    }

    const normalizedValues = normalizeValues(body.values);
    const finalContent = stripHtmlTags(renderContractContent(rawContent, normalizedValues));

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let page = pdfDoc.addPage([595.28, 841.89]);
    let { width, height } = page.getSize();
    const marginX = 56;
    const marginTop = 64;
    const marginBottom = 56;
    const fontSize = 11;
    const lineHeight = 17;
    const maxCharsPerLine = 95;
    let cursorY = height - marginTop;

    const paragraphs = finalContent.split(/\r?\n/);

    for (const paragraph of paragraphs) {
      const lines = paragraph.trim().length
        ? wrapLine(paragraph, maxCharsPerLine)
        : [''];

      for (const line of lines) {
        if (cursorY <= marginBottom) {
          page = pdfDoc.addPage([595.28, 841.89]);
          ({ width, height } = page.getSize());
          cursorY = height - marginTop;
        }

        page.drawText(line, {
          x: marginX,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.05, 0.08, 0.12),
          maxWidth: width - marginX * 2,
          lineHeight,
        });
        cursorY -= lineHeight;
      }

      cursorY -= 8;
    }

    const pdfBytes = await pdfDoc.save();
    const generatedContractRef = adminDb
      .collection('agencies')
      .doc(agencyId)
      .collection('generatedContracts')
      .doc();

    const generatedContract: GeneratedContract = {
      id: generatedContractRef.id,
      agencyId,
      templateId: template.id || templateSnapshot.id,
      templateName,
      generatedBy: uid,
      createdAt: new Date().toISOString(),
      values: normalizedValues,
      fileName: `${sanitizeFileName(templateName)}.pdf`,
      contactId: body.contactId || null,
      propertyId: body.propertyId || null,
    };

    await generatedContractRef.set(generatedContract);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${generatedContract.fileName}"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate contract PDF:', error);
    const message = error instanceof Error ? error.message : 'Nu am putut genera contractul.';
    const status = error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;

    return NextResponse.json({ message }, { status });
  }
}
