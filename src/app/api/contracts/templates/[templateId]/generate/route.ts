import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { adminDb } from '@/firebase/admin';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  buildContractHeaderHtml,
  buildStructuredHeaderBlocks,
  renderContractContent,
  stripHtmlTags,
} from '@/lib/contracts';
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeText(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function stripRomanianDiacritics(value: string) {
  return value
    .replace(/[ăâ]/g, 'a')
    .replace(/[ĂÂ]/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/[șş]/g, 's')
    .replace(/[ȘŞ]/g, 'S')
    .replace(/[țţ]/g, 't')
    .replace(/[ȚŢ]/g, 'T');
}

function extractParagraphsFromHtml(value: string) {
  return stripHtmlTags(
    value
      .replace(/<\/h1>/gi, '</h1>\n')
      .replace(/<\/h2>/gi, '</h2>\n')
      .replace(/<hr[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
  )
    .split(/\r?\n/)
    .map((chunk) => normalizeText(chunk))
    .filter(Boolean);
}

function normalizeValues(values: Record<string, string | number | boolean | null>) {
  const normalized: Record<string, string | number | boolean | null> = {};
  Object.entries(values).forEach(([key, value]) => {
    normalized[key.replace(/\./g, '_')] = value;
  });
  return normalized;
}

async function loadUnicodeFont(pdfDoc: PDFDocument, fileName: string) {
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(
    process.cwd(),
    'node_modules',
    'pdfjs-dist',
    'standard_fonts',
    fileName
  );
  const fontBytes = await readFile(fontPath);
  return pdfDoc.embedFont(fontBytes, { subset: true });
}

type PdfState = {
  page: import('pdf-lib').PDFPage;
  width: number;
  height: number;
  cursorY: number;
};

function createPage(pdfDoc: PDFDocument) {
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  return { page, width, height };
}

function drawPageHeader(params: {
  state: PdfState;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  color: ReturnType<typeof rgb>;
}) {
  const { state, text, font, color } = params;
  if (!text.trim()) return;

  const fontSize = 9.5;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  state.page.drawText(text, {
    x: Math.max(40, (state.width - textWidth) / 2),
    y: state.height - 26,
    size: fontSize,
    font,
    color,
  });
  state.page.drawLine({
    start: { x: 40, y: state.height - 34 },
    end: { x: state.width - 40, y: state.height - 34 },
    thickness: 0.8,
    color: rgb(0.88, 0.9, 0.93),
  });
}

function drawPageFooter(params: {
  state: PdfState;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  color: ReturnType<typeof rgb>;
}) {
  const { state, text, font, color } = params;
  const fontSize = 9.5;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  state.page.drawLine({
    start: { x: 40, y: 30 },
    end: { x: state.width - 40, y: 30 },
    thickness: 0.8,
    color: rgb(0.88, 0.9, 0.93),
  });
  state.page.drawText(text, {
    x: (state.width - textWidth) / 2,
    y: 16,
    size: fontSize,
    font,
    color,
  });
}

type PdfInlineRun = {
  text: string;
  bold?: boolean;
};

type PdfRichBlock = {
  runs: PdfInlineRun[];
  align: 'left' | 'center' | 'right' | 'justify';
  spacingAfter: number;
};

function decodeHtmlPreservingWhitespace(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseInlineRunsFromHtml(value: string): PdfInlineRun[] {
  const runs: PdfInlineRun[] = [];
  const tokenRegex = /(<\/?(?:strong|b)[^>]*>|<br\s*\/?>)/gi;
  let cursor = 0;
  let isBold = false;
  const stripResidualTags = (input: string) => decodeHtmlPreservingWhitespace(input).replace(/<[^>]+>/g, '');

  for (const match of value.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index ?? 0;
    const text = stripResidualTags(value.slice(cursor, index));
    if (text) {
      runs.push({ text, bold: isBold });
    }

    if (/^<br/i.test(token)) {
      runs.push({ text: '\n', bold: false });
    } else if (/^<\s*\/\s*(strong|b)/i.test(token)) {
      isBold = false;
    } else {
      isBold = true;
    }

    cursor = index + token.length;
  }

  const tail = stripResidualTags(value.slice(cursor));
  if (tail) {
    runs.push({ text: tail, bold: isBold });
  }

  return runs;
}

function extractRichBlocksFromHtml(value: string): PdfRichBlock[] {
  const normalized = value
    .replace(/<hr[^>]*>/gi, '<p></p>')
    .replace(/<div(?=[\s>])/gi, '<p')
    .replace(/<\/div>/gi, '</p>');

  const blocks: PdfRichBlock[] = [];
  const blockRegex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;

  for (const match of normalized.matchAll(blockRegex)) {
    const tag = (match[1] || 'p').toLowerCase();
    const attrs = match[2] || '';
    const inner = match[3] || '';
    const alignMatch = attrs.match(/text-align\s*:\s*(left|center|right|justify)/i);
    const align = (alignMatch?.[1]?.toLowerCase() as PdfRichBlock['align']) || 'left';
    const runs = parseInlineRunsFromHtml(tag === 'li' ? `• ${inner}` : inner);

    if (!runs.length || !runs.some((run) => run.text.replace(/\s+/g, '').length)) {
      continue;
    }

    blocks.push({
      runs,
      align,
      spacingAfter: tag === 'h1' || tag === 'h2' || tag === 'h3' ? 10 : 8,
    });
  }

  if (blocks.length) return blocks;

  const fallbackRuns = parseInlineRunsFromHtml(normalized);
  return fallbackRuns.length
    ? [{ runs: fallbackRuns, align: 'left', spacingAfter: 8 }]
    : [];
}

function drawPageWatermark(params: {
  state: PdfState;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
}) {
  const { state, text, font } = params;
  if (!text.trim()) return;

  const angle = 32;
  const angleRad = (angle * Math.PI) / 180;
  const maxProjectedWidth = state.width * 0.72;
  let size = 82;
  let textWidth = font.widthOfTextAtSize(text, size);
  let projectedWidth = textWidth * Math.cos(angleRad) + size * Math.sin(angleRad);

  if (projectedWidth > maxProjectedWidth) {
    size = size * (maxProjectedWidth / projectedWidth);
    textWidth = font.widthOfTextAtSize(text, size);
    projectedWidth = textWidth * Math.cos(angleRad) + size * Math.sin(angleRad);
  }

  const startX = Math.max(24, (state.width - projectedWidth) / 2);
  const startY = state.height * 0.15;

  state.page.drawText(text, {
    x: startX,
    y: startY,
    size,
    font,
    rotate: degrees(angle),
    color: rgb(0.72, 0.77, 0.84),
    opacity: 0.18,
  });
}

function ensureSpace(params: {
  pdfDoc: PDFDocument;
  state: PdfState;
  needed: number;
  marginTop: number;
  marginBottom: number;
  pageHeaderText?: string;
  headerFont?: Awaited<ReturnType<typeof loadUnicodeFont>>;
  headerColor?: ReturnType<typeof rgb>;
}) {
  const { pdfDoc, state, needed, marginTop, marginBottom, pageHeaderText, headerFont, headerColor } = params;
  if (state.cursorY - needed >= marginBottom) {
    return state;
  }

  const next = createPage(pdfDoc);
  const nextState = {
    ...next,
    cursorY: next.height - marginTop,
  };
  if (pageHeaderText && headerFont && headerColor) {
    drawPageHeader({
      state: nextState,
      text: pageHeaderText,
      font: headerFont,
      color: headerColor,
    });
  }
  return nextState;
}

function drawWrappedText(params: {
  pdfDoc: PDFDocument;
  state: PdfState;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  fontSize: number;
  lineHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  color?: ReturnType<typeof rgb>;
  pageHeaderText?: string;
  headerFont?: Awaited<ReturnType<typeof loadUnicodeFont>>;
  headerColor?: ReturnType<typeof rgb>;
}) {
  let { state } = params;
  const { pdfDoc, text, font, fontSize, lineHeight, marginX, marginTop, marginBottom, pageHeaderText, headerFont, headerColor } = params;
  const color = params.color || rgb(0.05, 0.08, 0.12);
  const maxWidth = state.width - marginX * 2;
  const words = normalizeText(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push('');

  for (const line of lines) {
    state = ensureSpace({
      pdfDoc,
      state,
      needed: lineHeight,
      marginTop,
      marginBottom,
      pageHeaderText,
      headerFont,
      headerColor,
    });

    state.page.drawText(line, {
      x: marginX,
      y: state.cursorY,
      size: fontSize,
      font,
      color,
    });
    state.cursorY -= lineHeight;
  }

  return state;
}

function drawLeadingBoldWrappedText(params: {
  pdfDoc: PDFDocument;
  state: PdfState;
  boldText: string;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  boldFont: Awaited<ReturnType<typeof loadUnicodeFont>>;
  fontSize: number;
  lineHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  color?: ReturnType<typeof rgb>;
  pageHeaderText?: string;
  headerFont?: Awaited<ReturnType<typeof loadUnicodeFont>>;
  headerColor?: ReturnType<typeof rgb>;
}) {
  let { state } = params;
  const {
    pdfDoc,
    boldText,
    text,
    font,
    boldFont,
    fontSize,
    lineHeight,
    marginX,
    marginTop,
    marginBottom,
    pageHeaderText,
    headerFont,
    headerColor,
  } = params;
  const color = params.color || rgb(0.05, 0.08, 0.12);
  const maxWidth = state.width - marginX * 2;

  const normalizedRestText =
    text.trimStart().startsWith(',') ? text : `, ${text.trimStart()}`;

  const segments = [
    { text: normalizeText(boldText), font: boldFont },
    { text: normalizeText(normalizedRestText), font },
  ]
    .flatMap((segment) =>
      segment.text
        .split(/(\s+)/)
        .filter(Boolean)
        .map((part) => ({ text: part, font: segment.font }))
    );

  const lines: Array<Array<{ text: string; font: Awaited<ReturnType<typeof loadUnicodeFont>> }>> = [];
  let currentLine: Array<{ text: string; font: Awaited<ReturnType<typeof loadUnicodeFont>> }> = [];
  let currentWidth = 0;

  for (const segment of segments) {
    const segmentWidth = segment.font.widthOfTextAtSize(segment.text, fontSize);
    if (currentLine.length && currentWidth + segmentWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
    currentLine.push(segment);
    currentWidth += segmentWidth;
  }

  if (currentLine.length) lines.push(currentLine);
  if (!lines.length) lines.push([{ text: '', font }]);

  for (const line of lines) {
    state = ensureSpace({
      pdfDoc,
      state,
      needed: lineHeight,
      marginTop,
      marginBottom,
      pageHeaderText,
      headerFont,
      headerColor,
    });

    let cursorX = marginX;
    for (const segment of line) {
      state.page.drawText(segment.text, {
        x: cursorX,
        y: state.cursorY,
        size: fontSize,
        font: segment.font,
        color,
      });
      cursorX += segment.font.widthOfTextAtSize(segment.text, fontSize);
    }

    state.cursorY -= lineHeight;
  }

  return state;
}

function drawRichWrappedText(params: {
  pdfDoc: PDFDocument;
  state: PdfState;
  runs: PdfInlineRun[];
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  boldFont: Awaited<ReturnType<typeof loadUnicodeFont>>;
  fontSize: number;
  lineHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: ReturnType<typeof rgb>;
  pageHeaderText?: string;
  headerFont?: Awaited<ReturnType<typeof loadUnicodeFont>>;
  headerColor?: ReturnType<typeof rgb>;
}) {
  let { state } = params;
  const {
    pdfDoc,
    runs,
    font,
    boldFont,
    fontSize,
    lineHeight,
    marginX,
    marginTop,
    marginBottom,
    pageHeaderText,
    headerFont,
    headerColor,
  } = params;
  const color = params.color || rgb(0.05, 0.08, 0.12);
  const align = params.align || 'left';
  const maxWidth = state.width - marginX * 2;

  const lineGroups: Array<Array<{ text: string; font: Awaited<ReturnType<typeof loadUnicodeFont>> }>> = [[]];

  for (const run of runs) {
    const targetFont = run.bold ? boldFont : font;
    const pieces = run.text.split('\n');

    pieces.forEach((piece, pieceIndex) => {
      if (piece) {
        piece
          .split(/(\s+)/)
          .filter((part) => part.length > 0)
          .forEach((part) => {
            lineGroups[lineGroups.length - 1].push({ text: part, font: targetFont });
          });
      }

      if (pieceIndex < pieces.length - 1) {
        lineGroups.push([]);
      }
    });
  }

  const wrappedLines: Array<Array<{ text: string; font: Awaited<ReturnType<typeof loadUnicodeFont>> }>> = [];

  for (const rawLine of lineGroups) {
    if (!rawLine.length) {
      wrappedLines.push([]);
      continue;
    }

    let currentLine: Array<{ text: string; font: Awaited<ReturnType<typeof loadUnicodeFont>> }> = [];
    let currentWidth = 0;

    for (const segment of rawLine) {
      const segmentWidth = segment.font.widthOfTextAtSize(segment.text, fontSize);
      if (currentLine.length && currentWidth + segmentWidth > maxWidth) {
        wrappedLines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }

      currentLine.push(segment);
      currentWidth += segmentWidth;
    }

    if (currentLine.length) {
      wrappedLines.push(currentLine);
    }
  }

  if (!wrappedLines.length) {
    wrappedLines.push([]);
  }

  for (const line of wrappedLines) {
    state = ensureSpace({
      pdfDoc,
      state,
      needed: lineHeight,
      marginTop,
      marginBottom,
      pageHeaderText,
      headerFont,
      headerColor,
    });

    const lineWidth = line.reduce((total, segment) => total + segment.font.widthOfTextAtSize(segment.text, fontSize), 0);
    let cursorX = marginX;

    if (align === 'center') {
      cursorX = marginX + Math.max(0, (maxWidth - lineWidth) / 2);
    } else if (align === 'right') {
      cursorX = marginX + Math.max(0, maxWidth - lineWidth);
    }

    for (const segment of line) {
      state.page.drawText(segment.text, {
        x: cursorX,
        y: state.cursorY,
        size: fontSize,
        font: segment.font,
        color,
      });
      cursorX += segment.font.widthOfTextAtSize(segment.text, fontSize);
    }

    state.cursorY -= lineHeight;
  }

  return state;
}

function drawCenteredText(params: {
  pdfDoc: PDFDocument;
  state: PdfState;
  text: string;
  font: Awaited<ReturnType<typeof loadUnicodeFont>>;
  fontSize: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  color?: ReturnType<typeof rgb>;
  pageHeaderText?: string;
  headerFont?: Awaited<ReturnType<typeof loadUnicodeFont>>;
  headerColor?: ReturnType<typeof rgb>;
}) {
  let { state } = params;
  const { pdfDoc, text, font, fontSize, marginX, marginTop, marginBottom, pageHeaderText, headerFont, headerColor } = params;
  const color = params.color || rgb(0.05, 0.08, 0.12);
  state = ensureSpace({
    pdfDoc,
    state,
    needed: fontSize * 1.6,
    marginTop,
    marginBottom,
    pageHeaderText,
    headerFont,
    headerColor,
  });

  const normalized = normalizeText(text);
  const textWidth = font.widthOfTextAtSize(normalized, fontSize);
  const x = Math.max(marginX, (state.width - textWidth) / 2);
  state.page.drawText(normalized, {
    x,
    y: state.cursorY,
    size: fontSize,
    font,
    color,
  });
  state.cursorY -= fontSize * 1.6;
  return state;
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
    const normalizedValues = normalizeValues(body.values);
    const rawContent = template.content || '';
    const renderedHeaderHtml = renderContractContent(
      buildContractHeaderHtml({
        title: templateName,
        category: template.category || 'reservation',
      }),
      normalizedValues
    );
    const renderedBodyHtml = stripRomanianDiacritics(renderContractContent(rawContent, normalizedValues));
    const headerParagraphs = extractParagraphsFromHtml(renderedHeaderHtml);
    const headerBlocks = buildStructuredHeaderBlocks(template.category || 'reservation', normalizedValues, {
      emptyFallback: '.'.repeat(35),
    });
    const bodyBlocks = extractRichBlocksFromHtml(renderedBodyHtml);

    if (!headerParagraphs.length && !bodyBlocks.length) {
      return NextResponse.json({ message: 'Template-ul nu are continut de generat.' }, { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await loadUnicodeFont(pdfDoc, 'LiberationSans-Regular.ttf');
    const boldFont = await loadUnicodeFont(pdfDoc, 'LiberationSans-Bold.ttf');
    let state = {
      ...createPage(pdfDoc),
      cursorY: 0,
    };
    const marginX = 56;
    const marginTop = 64;
    const marginBottom = 28;
    state.cursorY = state.height - marginTop;

    const accent = rgb(0.19, 0.46, 0.83);
    const titleAccent = rgb(0.72, 0.12, 0.18);
    const textColor = rgb(0.05, 0.08, 0.12);
    const muted = rgb(0.35, 0.39, 0.46);
    const legalName = normalizeText(String(normalizedValues.agency_legalCompanyName || normalizedValues.agency_name || 'Agentie imobiliara'));
    const agencyDisplayName = normalizeText(String(normalizedValues.agency_name || normalizedValues.agency_legalCompanyName || ''));
    const agencyPhone = normalizeText(String(normalizedValues.agency_phone || ''));
    const agencyEmail = normalizeText(String(normalizedValues.agency_email || ''));
    const pageHeaderText = [legalName, agencyPhone, agencyEmail].filter(Boolean).join('   •   ');

    drawPageHeader({
      state,
      text: pageHeaderText,
      font,
      color: muted,
    });

    const agencyBlockTop = state.height - 56;
    const agencyTextSize = 24;
    const agencyTextY = state.height - 84;
    const agencyLineWidth = 220;
    const agencyLineStart = (state.width - agencyLineWidth) / 2;
    const agencyLineEnd = agencyLineStart + agencyLineWidth;

    state.page.drawLine({
      start: { x: agencyLineStart, y: agencyBlockTop },
      end: { x: agencyLineEnd, y: agencyBlockTop },
      thickness: 1.5,
      color: accent,
    });

    state.page.drawLine({
      start: { x: agencyLineStart, y: state.height - 92 },
      end: { x: agencyLineEnd, y: state.height - 92 },
      thickness: 1.5,
      color: accent,
    });

    const agencyTextWidth = boldFont.widthOfTextAtSize(legalName, agencyTextSize);
    state.page.drawText(legalName, {
      x: agencyLineStart + Math.max(0, (agencyLineEnd - agencyLineStart - agencyTextWidth) / 2),
      y: agencyTextY,
      size: agencyTextSize,
      font,
      color: textColor,
    });

    state.cursorY = state.height - 118;
    state = drawCenteredText({
      pdfDoc,
      state,
      text: templateName,
      font: boldFont,
      fontSize: 17.5,
      marginX,
      marginTop,
      marginBottom,
      color: textColor,
      pageHeaderText,
      headerFont: font,
      headerColor: muted,
    });

    const contractNumber = normalizeText(String(normalizedValues.contract_number || ''));
    const currentDate = normalizeText(String(normalizedValues.currentDate || ''));
    const centeredMeta = [contractNumber ? `Contract nr. ${contractNumber}` : '', currentDate ? `Data ${currentDate}` : '']
      .filter(Boolean)
      .join('   |   ');

    if (centeredMeta) {
      state.cursorY += 12;
      state = drawCenteredText({
        pdfDoc,
        state,
        text: centeredMeta,
      font,
      fontSize: 11.25,
        marginX,
        marginTop,
        marginBottom,
        color: accent,
        pageHeaderText,
        headerFont: font,
        headerColor: muted,
      });
    }

    state.cursorY -= 8;

    for (const block of headerBlocks) {
      if (block.kind === 'intro') {
        const introText = normalizeText(block.text);
        const introFontSize = 11;
        const introLineHeight = 17;
        const introPaddingX = 8;
        const introPaddingY = 4;
        const introWidth = Math.min(
          state.width - marginX * 2,
          font.widthOfTextAtSize(introText, introFontSize) + introPaddingX * 2
        );
        const introHeight = introFontSize + introPaddingY * 2;

        state = ensureSpace({
          pdfDoc,
          state,
          needed: introHeight + 6,
          marginTop,
          marginBottom,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
        });

        state.page.drawRectangle({
          x: marginX,
          y: state.cursorY - introPaddingY,
          width: introWidth,
          height: introHeight,
          color: rgb(0.94, 0.95, 0.97),
        });

        state.page.drawText(introText, {
          x: marginX + introPaddingX,
          y: state.cursorY,
          size: introFontSize,
          font,
          color: rgb(0.12, 0.16, 0.22),
        });

        state.cursorY -= introLineHeight + 6;
        continue;
      }

      if (block.kind === 'connector') {
        state = drawWrappedText({
          pdfDoc,
          state,
          text: block.text,
          font,
          fontSize: 11,
          lineHeight: 17,
          marginX,
          marginTop,
          marginBottom,
          color: textColor,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
        });
        state.cursorY -= 2;
        continue;
      }

      if (block.kind === 'emphasis') {
        state = drawWrappedText({
          pdfDoc,
          state,
          text: block.text,
          font: boldFont,
          fontSize: 11,
          lineHeight: 17,
          marginX,
          marginTop,
          marginBottom,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
          color: textColor,
        });
        state.cursorY -= 4;
        continue;
      }

      if (block.kind === 'separator') {
        state = ensureSpace({
          pdfDoc,
          state,
          needed: 18,
          marginTop,
          marginBottom,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
        });
        state.cursorY -= 6;
        state.page.drawLine({
          start: { x: marginX, y: state.cursorY },
          end: { x: state.width - marginX, y: state.cursorY },
          thickness: 0.8,
          color: rgb(0.84, 0.87, 0.91),
        });
        state.cursorY -= 12;
        continue;
      }

      if (block.kind === 'party') {
        state = drawWrappedText({
          pdfDoc,
          state,
          text: `${block.index}. ${block.text}`,
          font,
          fontSize: 11,
          lineHeight: 17,
          marginX,
          marginTop,
          marginBottom,
          color: textColor,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
        });
        state.cursorY -= 4;
        continue;
      }

      if (block.kind === 'namedParagraph') {
        state = drawLeadingBoldWrappedText({
          pdfDoc,
          state,
          boldText: block.boldText,
          text: block.text,
          font,
          boldFont,
          fontSize: 11,
          lineHeight: 17,
          marginX,
          marginTop,
          marginBottom,
          color: textColor,
          pageHeaderText,
          headerFont: font,
          headerColor: muted,
        });
        state.cursorY -= 4;
        continue;
      }

      state = drawWrappedText({
        pdfDoc,
        state,
        text: block.text,
        font,
        fontSize: 11,
        lineHeight: 17,
        marginX,
        marginTop,
        marginBottom,
        color: textColor,
        pageHeaderText,
        headerFont: font,
        headerColor: muted,
      });
      state.cursorY -= 4;
    }

    state.cursorY -= 10;
    state.page.drawLine({
      start: { x: marginX, y: state.cursorY },
      end: { x: state.width - marginX, y: state.cursorY },
      thickness: 1,
      color: rgb(0.8, 0.84, 0.88),
    });
    state.cursorY -= 22;

    for (const block of bodyBlocks) {
      state = drawRichWrappedText({
        pdfDoc,
        state,
        runs: block.runs,
        font,
        boldFont,
        fontSize: 11,
        lineHeight: 17,
        marginX,
        marginTop,
        marginBottom,
        align: block.align,
        color: textColor,
        pageHeaderText,
        headerFont: font,
        headerColor: muted,
      });
      state.cursorY -= block.spacingAfter;
    }

    const totalPages = pdfDoc.getPages();
    totalPages.forEach((pageEntry, index) => {
      const { width, height } = pageEntry.getSize();
      drawPageWatermark({
        state: { page: pageEntry, width, height, cursorY: 0 },
        text: legalName || agencyDisplayName || 'Agentie imobiliara',
        font,
      });
      drawPageFooter({
        state: { page: pageEntry, width, height, cursorY: 0 },
        text: `Pagina ${index + 1}`,
        font,
        color: muted,
      });
    });

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
