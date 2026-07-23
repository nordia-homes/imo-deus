import { FieldPath } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { parseOptionalNumber } from '@/lib/owner-listings/utils';

export const runtime = 'nodejs';

type CursorPayload = { firstDiscoveredAt: number; id: string };

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeCursor(cursor: CursorPayload) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    return typeof parsed.firstDiscoveredAt === 'number' && typeof parsed.id === 'string'
      ? { firstDiscoveredAt: parsed.firstDiscoveredAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

function matchesFilters(listing: OwnerListingSummary, params: URLSearchParams) {
  const source = params.get('source');
  if (source === 'imobiliare') {
    const origin = normalize(`${listing.originSourceLabel || ''} ${listing.originSourceUrl || ''}`);
    if (!origin.includes('imobiliare')) return false;
  }

  const propertyType = params.get('propertyType');
  if (propertyType && propertyType !== 'all' && listing.propertyType !== propertyType) return false;

  const transactionType = params.get('transactionType');
  if (transactionType && transactionType !== 'all' && listing.transactionType !== transactionType) return false;

  const rooms = parseOptionalNumber(params.get('rooms'));
  if (rooms !== null && parseOptionalNumber(listing.roomsValue ?? listing.rooms) !== rooms) return false;

  const constructionYear = params.get('constructionYear');
  if (constructionYear && constructionYear !== 'all') {
    const year = parseOptionalNumber(listing.constructionYearValue ?? listing.constructionYear ?? listing.year);
    if (year === null) return false;
    if (constructionYear === '1977-1990' && (year < 1977 || year > 1990)) return false;
    if (constructionYear === '1990-2000' && (year < 1990 || year > 2000)) return false;
    if (constructionYear === 'after-2000' && year <= 2000) return false;
  }

  const price = parseOptionalNumber(listing.priceValue ?? listing.price);
  const priceMin = parseOptionalNumber(params.get('priceMin'));
  const priceMax = parseOptionalNumber(params.get('priceMax'));
  if (priceMin !== null && (price === null || price < priceMin)) return false;
  if (priceMax !== null && (price === null || price > priceMax)) return false;

  const search = normalize(params.get('search'));
  if (search) {
    const haystack = normalize([
      listing.title,
      listing.location,
      listing.ownerPhone,
      listing.price,
      listing.area,
      listing.description,
      listing.sourceLabel,
      listing.originSourceLabel,
    ].join(' '));
    if (!search.split(' ').filter(Boolean).every((token) => haystack.includes(token))) return false;
  }

  return true;
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return { status, message: error instanceof Error ? error.message : 'Nu am putut incarca anunturile.' };
  }
  return { status: 500, message: error instanceof Error ? error.message : 'Nu am putut incarca anunturile.' };
}

export async function GET(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const params = request.nextUrl.searchParams;
    const scopeKey = params.get('scopeKey')?.trim();
    if (!scopeKey) {
      return NextResponse.json({ message: 'scopeKey este obligatoriu.' }, { status: 400 });
    }

    const pageSize = Math.max(1, Math.min(Number(params.get('pageSize') || 100), 100));
    const source = params.get('source');
    const cursor = decodeCursor(params.get('cursor'));
    const matches: Array<OwnerListingSummary & { id: string }> = [];
    let scanCursor = cursor;
    let hasMore = true;
    const maxScannedDocuments = 5000;
    let scannedDocuments = 0;

    while (matches.length < pageSize && hasMore && scannedDocuments < maxScannedDocuments) {
      let query: FirebaseFirestore.Query = adminDb
        .collection('ownerListings')
        .where('scopeKey', '==', scopeKey)
        .where('publicationStatus', '==', 'ready')
        .where('isCanonical', '==', true);

      if (source === 'imobiliare') {
        query = query.where('originSourceLabel', '==', 'Imobiliare.ro');
      } else if (source && ['olx', 'imoradar24', 'publi24'].includes(source)) {
        query = query.where('source', '==', source);
      }

      query = query
        .orderBy('firstDiscoveredAt', 'desc')
        .orderBy(FieldPath.documentId(), 'desc');

      if (scanCursor) {
        query = query.startAfter(scanCursor.firstDiscoveredAt, scanCursor.id);
      }

      const snapshot = await query.limit(250).get();
      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      let consumedFromSnapshot = 0;
      for (const doc of snapshot.docs) {
        const listing = doc.data() as OwnerListingSummary;
        scanCursor = {
          firstDiscoveredAt: Number(listing.firstDiscoveredAt || 0),
          id: doc.id,
        };
        consumedFromSnapshot += 1;
        scannedDocuments += 1;
        if (matchesFilters(listing, params)) {
          matches.push({ ...listing, id: doc.id });
          if (matches.length >= pageSize) break;
        }
        if (scannedDocuments >= maxScannedDocuments) break;
      }

      if (matches.length >= pageSize) {
        hasMore = consumedFromSnapshot < snapshot.size || snapshot.size === 250;
        break;
      }
      if (snapshot.size < 250) hasMore = false;
      if (scannedDocuments >= maxScannedDocuments) hasMore = true;
    }

    return NextResponse.json({
      listings: matches,
      nextCursor: hasMore && scanCursor ? encodeCursor(scanCursor) : null,
      hasMore,
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
