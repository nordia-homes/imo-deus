import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { generatePricingAnalysis, type PricingAnalysisResult } from '@/lib/pricing-analysis';
import { renderPricingAnalysisPdfHtml } from '@/lib/pricing-analysis-pdf-template';
import { getDeterministicMatchedBuyers } from '@/lib/matching-engine';
import type { Agency, Contact, Property, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

function findLocalChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  const executableName = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(process.cwd(), '..', '..', '..'),
  ];

  for (const baseDir of candidates) {
    const browsersDir = path.join(baseDir, 'node_modules', 'playwright-core', '.local-browsers');
    if (!fs.existsSync(browsersDir)) continue;

    const stack = [browsersDir];
    while (stack.length) {
      const currentDir = stack.pop()!;
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(entryPath);
        } else if (entry.name === executableName) {
          return entryPath;
        }
      }
    }
  }

  return null;
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'analiza-pret';
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A aparut o eroare la generarea PDF-ului.',
    };
  }

  if (error instanceof Error) {
    if (/nu a fost gasita/i.test(error.message)) {
      return { status: 404, message: error.message };
    }
    if (/nu exista suficiente comparabile|are nevoie de pret si suprafata|preturile introduse/i.test(error.message)) {
      return { status: 422, message: error.message };
    }
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'A aparut o eroare la generarea PDF-ului.' };
}

function normalizeManualPrice(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function withManualPrices(analysis: PricingAnalysisResult, minPrice: number, recommendedPrice: number): PricingAnalysisResult {
  const surface = analysis.subject.squareFootage || 1;

  return {
    ...analysis,
    conservativeMinPrice: minPrice,
    recommendedListingPrice: recommendedPrice,
    recommendedListingPricePerSqm: Math.round(recommendedPrice / surface),
    pricingStrategy: {
      ...analysis.pricingStrategy,
      fastSalePrice: minPrice,
      fastSalePricePerSqm: Math.round(minPrice / surface),
      recommendedPrice,
      recommendedPricePerSqm: Math.round(recommendedPrice / surface),
    },
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { propertyId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const propertySnapshot = await auth.adminDb
      .collection('agencies')
      .doc(auth.agencyId!)
      .collection('properties')
      .doc(propertyId)
      .get();

    if (!propertySnapshot.exists) {
      throw new Error('Proprietatea nu a fost gasita.');
    }

    const agencySnapshot = await auth.adminDb.collection('agencies').doc(auth.agencyId!).get();
    const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
    const agency = agencySnapshot.exists ? ({ id: agencySnapshot.id, ...agencySnapshot.data() } as Agency) : null;
    const agentId = property.agentId || null;
    const agentSnapshot = agentId ? await auth.adminDb.collection('users').doc(agentId).get() : null;
    const agent = agentSnapshot?.exists ? ({ id: agentSnapshot.id, ...agentSnapshot.data() } as UserProfile) : null;
    const contactsSnapshot = await auth.adminDb
      .collection('agencies')
      .doc(auth.agencyId!)
      .collection('contacts')
      .get();
    const contacts = contactsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Contact));
    const matchedBuyers = getDeterministicMatchedBuyers(property, contacts, 20);

    const generatedAnalysis = await generatePricingAnalysis({
      agencyId: auth.agencyId!,
      propertyId,
      persist: false,
    });
    const manualMinPrice = normalizeManualPrice(body?.minPrice, generatedAnalysis.conservativeMinPrice);
    const manualRecommendedPrice = normalizeManualPrice(body?.recommendedPrice, generatedAnalysis.recommendedListingPrice);

    if (manualMinPrice > manualRecommendedPrice) {
      throw new Error('Preturile introduse nu sunt valide: pretul minim trebuie sa fie mai mic sau egal cu pretul recomandat.');
    }

    const analysis = withManualPrices(generatedAnalysis, manualMinPrice, manualRecommendedPrice);
    const html = renderPricingAnalysisPdfHtml({
      property,
      agency,
      agent,
      analysis,
      generatedAt: new Date(),
      manualMinPrice,
      manualRecommendedPrice,
      matchedBuyers,
    });
    const fileName = `${sanitizeFileName(property.title)}-analiza-pret.pdf`;

    if (request.nextUrl.searchParams.get('format') === 'html') {
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Pricing-Analysis-Filename': fileName,
          'Cache-Control': 'no-store',
        },
      });
    }

    const chromiumExecutablePath = findLocalChromiumExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-zygote',
        '--single-process',
      ],
    });
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Pricing analysis PDF generation failed:', error);
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
