import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { extractDocumentTextWithGoogleVision, extractPdfTextWithGoogleVision } from '@/lib/google-vision';
import { parseRomanianAddressProof, parseRomanianElectronicIdCard, parseRomanianIdCard } from '@/lib/id-card-parser';
import { extractTextFromPdfBuffer } from '@/lib/pdf-text';

export const runtime = 'nodejs';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ACCEPTED_PDF_TYPES = new Set(['application/pdf']);

async function extractIdentityText(params: { file: File; bytes: Buffer }) {
  const { file, bytes } = params;

  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    const ocr = await extractDocumentTextWithGoogleVision({
      contentBase64: bytes.toString('base64'),
      mimeType: file.type,
    });

    return {
      fullText: ocr.fullText,
      words: ocr.words,
      source: 'vision',
    } as const;
  }

  if (ACCEPTED_PDF_TYPES.has(file.type)) {
    const pdfText = await extractTextFromPdfBuffer(bytes);
    return {
      fullText: pdfText,
      words: [],
      source: 'pdf-text',
    } as const;
  }

  throw new Error('Momentan OCR-ul pentru CI suporta doar imagini JPG, PNG, WEBP sau PDF.');
}

export async function POST(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));

    const formData = await request.formData();
    const mode = String(formData.get('mode') || 'standard');
    const file = formData.get('file');
    const addressProof = formData.get('addressProof');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Fisierul este obligatoriu.' }, { status: 400 });
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type) && !ACCEPTED_PDF_TYPES.has(file.type)) {
      return NextResponse.json({ message: 'Momentan OCR-ul pentru CI suporta imagini JPG, PNG, WEBP sau PDF.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ocr = await extractIdentityText({ file, bytes });
    if (mode === 'electronic') {
      if (!(addressProof instanceof File)) {
        return NextResponse.json({ message: 'Dovada de adresa este obligatorie pentru CI electronica.' }, { status: 400 });
      }

      if (!ACCEPTED_PDF_TYPES.has(addressProof.type)) {
        return NextResponse.json({ message: 'Dovada de adresa trebuie sa fie PDF.' }, { status: 400 });
      }

      const addressProofBytes = Buffer.from(await addressProof.arrayBuffer());
      let addressProofText = await extractTextFromPdfBuffer(addressProofBytes);
      let electronicIdText = ocr.fullText;
      let electronicWords = ocr.words;
      let parsedElectronicCard = parseRomanianElectronicIdCard(electronicIdText);

      if (
        file.type === 'application/pdf' &&
        (!parsedElectronicCard.name || !parsedElectronicCard.personalNumericCode || !parsedElectronicCard.identityDocumentNumber)
      ) {
        const electronicPdfOcr = await extractPdfTextWithGoogleVision({
          contentBase64: bytes.toString('base64'),
          pages: [1],
        });
        if (electronicPdfOcr.fullText.trim()) {
          electronicIdText = electronicPdfOcr.fullText;
          electronicWords = electronicPdfOcr.words;
          parsedElectronicCard = parseRomanianElectronicIdCard(electronicIdText);
        }
      }

      let parsedAddressProof = parseRomanianAddressProof(addressProofText);

      if (!parsedAddressProof.address) {
        const addressProofOcr = await extractPdfTextWithGoogleVision({
          contentBase64: addressProofBytes.toString('base64'),
          pages: [1],
        });
        addressProofText = addressProofOcr.fullText;
        parsedAddressProof = parseRomanianAddressProof(addressProofText);
      }

      return NextResponse.json({
        parsed: {
          ...parsedElectronicCard,
          address: parsedAddressProof.address || '',
          confidence: {
            ...parsedElectronicCard.confidence,
            address: parsedAddressProof.confidence.address,
          },
        },
        electronicIdText,
        addressProofText,
        words: electronicWords.slice(0, 300),
      });
    }

    let parsed = parseRomanianIdCard(ocr.fullText);
    let fullText = ocr.fullText;
    let words = ocr.words;

    if (
      file.type === 'application/pdf' &&
      (!parsed.name || !parsed.personalNumericCode || !parsed.identityDocumentNumber)
    ) {
      const pdfOcr = await extractPdfTextWithGoogleVision({
        contentBase64: bytes.toString('base64'),
        pages: [1],
      });
      if (pdfOcr.fullText.trim()) {
        fullText = pdfOcr.fullText;
        words = pdfOcr.words;
        parsed = parseRomanianIdCard(fullText);
      }
    }

    return NextResponse.json({
      parsed,
      fullText,
      words: words.slice(0, 300),
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
