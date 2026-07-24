import { FieldPath } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  hasOwnerListingRefinementFilters,
  matchesOwnerListingFilters,
} from '@/lib/owner-listings/search';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';

export const runtime = 'nodejs';

type CursorPayload = { postedAt: number; id: string };
type SearchCorpusListing = OwnerListingSummary & { id: string };
type SearchCorpusCacheEntry = {
  expiresAt: number;
  lastAccessedAt: number;
  promise: Promise<SearchCorpusListing[]>;
};

const SEARCH_CORPUS_TTL_MS = 60_000;
const SEARCH_CORPUS_MAX_CACHE_ENTRIES = 3;
const SEARCH_CORPUS_FIELDS = [
  'source',
  'sourceLabel',
  'originSourceUrl',
  'originSourceLabel',
  'propertyType',
  'transactionType',
  'rooms',
  'roomsValue',
  'constructionYear',
  'constructionYearValue',
  'year',
  'price',
  'priceValue',
  'title',
  'location',
  'ownerPhone',
  'area',
  'description',
  'postedAt',
  'firstDiscoveredAt',
] as const;
const searchCorpusCache = new Map<string, SearchCorpusCacheEntry>();

function encodeCursor(cursor: CursorPayload) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    return typeof parsed.postedAt === 'number' && typeof parsed.id === 'string'
      ? { postedAt: parsed.postedAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
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

function buildOwnerListingsBaseQuery(
  db: FirebaseFirestore.Firestore,
  scopeKey: string,
  source: string | null,
) {
  let query: FirebaseFirestore.Query = db
    .collection('ownerListings')
    .where('scopeKey', '==', scopeKey)
    .where('publicationStatus', '==', 'ready')
    .where('isCanonical', '==', true);

  if (source === 'imobiliare') {
    query = query.where('originSourceLabel', '==', 'Imobiliare.ro');
  } else if (source && ['olx', 'imoradar24', 'publi24'].includes(source)) {
    query = query.where('source', '==', source);
  }

  return query;
}

async function loadSearchCorpus(baseQuery: FirebaseFirestore.Query) {
  const snapshot = await baseQuery.select(...SEARCH_CORPUS_FIELDS).get();
  return snapshot.docs
    .map((document) => ({
      ...(document.data() as OwnerListingSummary),
      id: document.id,
    }))
    .sort((left, right) => {
      const postedAtDifference = Number(right.postedAt || 0) - Number(left.postedAt || 0);
      if (postedAtDifference !== 0) return postedAtDifference;
      if (left.id === right.id) return 0;
      return left.id > right.id ? -1 : 1;
    });
}

function pruneSearchCorpusCache(now: number) {
  for (const [key, entry] of searchCorpusCache) {
    if (entry.expiresAt <= now) searchCorpusCache.delete(key);
  }

  while (searchCorpusCache.size >= SEARCH_CORPUS_MAX_CACHE_ENTRIES) {
    const oldestEntry = [...searchCorpusCache.entries()]
      .sort((left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt)[0];
    if (!oldestEntry) break;
    searchCorpusCache.delete(oldestEntry[0]);
  }
}

function getSearchCorpus(cacheKey: string, baseQuery: FirebaseFirestore.Query) {
  const now = Date.now();
  const cached = searchCorpusCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    cached.lastAccessedAt = now;
    return cached.promise;
  }

  if (cached) searchCorpusCache.delete(cacheKey);
  pruneSearchCorpusCache(now);

  const promise = loadSearchCorpus(baseQuery);
  const entry: SearchCorpusCacheEntry = {
    expiresAt: now + SEARCH_CORPUS_TTL_MS,
    lastAccessedAt: now,
    promise,
  };
  searchCorpusCache.set(cacheKey, entry);
  promise.catch(() => {
    if (searchCorpusCache.get(cacheKey) === entry) {
      searchCorpusCache.delete(cacheKey);
    }
  });
  return promise;
}

function findPageStartIndex(matches: SearchCorpusListing[], cursor: CursorPayload | null) {
  if (!cursor) return 0;

  const exactIndex = matches.findIndex(
    (listing) => listing.id === cursor.id
      && Number(listing.postedAt || 0) === cursor.postedAt,
  );
  if (exactIndex >= 0) return exactIndex + 1;

  const nextIndex = matches.findIndex((listing) => {
    const postedAt = Number(listing.postedAt || 0);
    return postedAt < cursor.postedAt
      || (postedAt === cursor.postedAt && listing.id < cursor.id);
  });
  return nextIndex >= 0 ? nextIndex : matches.length;
}

async function getRefinedListingPage(input: {
  db: FirebaseFirestore.Firestore;
  corpus: SearchCorpusListing[];
  cursor: CursorPayload | null;
  pageSize: number;
  params: URLSearchParams;
}) {
  const matches = input.corpus.filter((listing) => matchesOwnerListingFilters(listing, input.params));
  const startIndex = findPageStartIndex(matches, input.cursor);
  const pageEntries = matches.slice(startIndex, startIndex + input.pageSize);
  const snapshots = pageEntries.length > 0
    ? await input.db.getAll(...pageEntries.map((listing) => input.db.collection('ownerListings').doc(listing.id)))
    : [];
  const listingsById = new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, { ...(snapshot.data() as OwnerListingSummary), id: snapshot.id }]),
  );
  const listings = pageEntries
    .map((listing) => listingsById.get(listing.id))
    .filter((listing): listing is OwnerListingSummary & { id: string } => Boolean(listing));
  const hasMore = startIndex + pageEntries.length < matches.length;
  const lastPageEntry = pageEntries.at(-1);

  return {
    listings,
    nextCursor: hasMore && lastPageEntry
      ? encodeCursor({
          postedAt: Number(lastPageEntry.postedAt || 0),
          id: lastPageEntry.id,
        })
      : null,
    hasMore,
    totalMatchingCount: matches.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const params = request.nextUrl.searchParams;
    const scopeKey = params.get('scopeKey')?.trim();
    if (!scopeKey) {
      return NextResponse.json({ message: 'scopeKey este obligatoriu.' }, { status: 400 });
    }

    const pageSize = Math.max(1, Math.min(Number(params.get('pageSize') || 100), 100));
    const source = params.get('source');
    const cursor = decodeCursor(params.get('cursor'));
    const baseQuery = buildOwnerListingsBaseQuery(authContext.adminDb, scopeKey, source);
    const totalAvailableCountPromise = baseQuery.count().get();

    if (hasOwnerListingRefinementFilters(params)) {
      const corpus = await getSearchCorpus(
        `${authContext.runtimeMode}:${scopeKey}:${source || 'all'}`,
        baseQuery,
      );
      const [page, totalAvailableSnapshot] = await Promise.all([
        getRefinedListingPage({
          db: authContext.adminDb,
          corpus,
          cursor,
          pageSize,
          params,
        }),
        totalAvailableCountPromise,
      ]);

      return NextResponse.json({
        ...page,
        totalAvailableCount: totalAvailableSnapshot.data().count,
      });
    }

    let query = baseQuery
        .orderBy('postedAt', 'desc')
        .orderBy(FieldPath.documentId(), 'desc');

    if (cursor) {
      query = query.startAfter(cursor.postedAt, cursor.id);
    }

    const snapshot = await query.limit(pageSize + 1).get();
    const pageDocuments = snapshot.docs.slice(0, pageSize);
    const listings = pageDocuments.map((document) => ({
      ...(document.data() as OwnerListingSummary),
      id: document.id,
    }));
    const hasMore = snapshot.size > pageSize;
    const lastDocument = pageDocuments.at(-1);
    const totalAvailableCount = (await totalAvailableCountPromise).data().count;

    return NextResponse.json({
      listings,
      nextCursor: hasMore && lastDocument
        ? encodeCursor({
            postedAt: Number(lastDocument.get('postedAt') || 0),
            id: lastDocument.id,
          })
        : null,
      hasMore,
      totalAvailableCount,
      totalMatchingCount: totalAvailableCount,
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
