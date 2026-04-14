import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { extractDocumentTextWithGoogleVision } from '@/lib/google-vision';
import { parseRomanianIdCard } from '@/lib/id-card-parser';

export const runtime = 'nodejs';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Fisierul este obligatoriu.' }, { status: 400 });
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: 'Momentan OCR-ul pentru CI suporta doar imagini JPG, PNG sau WEBP.' },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ocr = await extractDocumentTextWithGoogleVision({
      contentBase64: bytes.toString('base64'),
      mimeType: file.type,
    });

    const parsed = parseRomanianIdCard(ocr.fullText);

    return NextResponse.json({
      parsed,
      fullText: ocr.fullText,
      words: ocr.words.slice(0, 300),
    });
  } catch (error) {
    console.error('Failed to OCR identity document:', error);
    const message = error instanceof Error ? error.message : 'Nu am putut extrage datele din document.';
    const status =
      error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;

    return NextResponse.json({ message }, { status });
  }
}
