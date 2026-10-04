import { FieldPath } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  hasOwnerListingRefinementFilters,
  matchesOwnerListingFilters,
} from '@/lib/owner-listings/search';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { OWNER_SEARCH_VERSION } from '@/lib/owner-listings/search-index';
import { parseOptionalNumber } from '@/lib/owner-listings/utils';

export const runtime = 'nodejs';

type CursorPayload = { postedAt: number; id: string };
type SearchCorpusListing = OwnerListingSummary & { id: string };
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
  'area',
  'description',
  'postedAt',
  'firstDiscoveredAt',
] as const;
const searchCorpusCache = new Map<string, Promise<SearchCorpusListing[]>>();

function withoutGlobalPhone<T extends OwnerListingSummary & { id: string }>(listing: T) {
  const { ownerPhone: _globalOwnerPhone, ...safeListing } = listing;
  return safeListing as Omit<T, 'ownerPhone'>;
}

async function loadAgencyProspectingPhones(
  db: FirebaseFirestore.Firestore,
  agencyId: string
) {
  const snapshot = await db
    .collection('agencies')
    .doc(agencyId)
    .collection('ownerListingFavorites')
    .get();
  return new Map(
    snapshot.docs
      .filter((document) => document.data().isFavoriteActive !== false)
      .map((document) => [
        String(document.data().ownerListingId || document.id),
        normalizeRomanianPhone(document.data().ownerPhone),
      ])
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
  );
}

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

async function getSearchCorpus(cacheKey: string, baseQuery: FirebaseFirestore.Query, params: URLSearchParams) {
  // Deduplicate only concurrent reads. A subsequent request always observes fresh Firestore data.
  const cached = searchCorpusCache.get(cacheKey);
  if (cached) return cached;
  const promise = (async () => {
    let candidates = baseQuery;
    const min = parseOptionalNumber(params.get('priceMin')), max = parseOptionalNumber(params.get('priceMax'));
    if (min !== null || max !== null) {
      try {
        const [all, covered] = await Promise.all([baseQuery.count().get(), baseQuery.where('searchVersion', '==', OWNER_SEARCH_VERSION).count().get()]);
        if (all.data().count > 0 && all.data().count === covered.data().count) {
          candidates = baseQuery.where('searchVersion', '==', OWNER_SEARCH_VERSION).where('searchPrice', '>=', min ?? 0);
          if (max !== null) candidates = candidates.where('searchPrice', '<=', max);
          return await loadSearchCorpus(candidates);
        }
      } catch (error) {
        if (Number((error as { code?: unknown }).code) !== 9) throw error;
      }
    }
    return loadSearchCorpus(baseQuery);
  })();
  searchCorpusCache.set(cacheKey, promise);
  try { return await promise; }
  finally { if (searchCorpusCache.get(cacheKey) === promise) searchCorpusCache.delete(cacheKey); }
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
      .filter((snapshot) => snapshot.exists && snapshot.data()?.publicationStatus === 'ready' && snapshot.data()?.isCanonical === true)
      .map((snapshot) => [
        snapshot.id,
        withoutGlobalPhone({ ...(snapshot.data() as OwnerListingSummary), id: snapshot.id }),
      ]),
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

    const requestedSize = Number(params.get('pageSize') || 100);
    const pageSize = Number.isFinite(requestedSize) ? Math.max(1, Math.min(Math.floor(requestedSize), 100)) : 100;
    const source = params.get('source');
    const cursor = decodeCursor(params.get('cursor'));
    const baseQuery = buildOwnerListingsBaseQuery(authContext.adminDb, scopeKey, source);
    const totalAvailableCountPromise = baseQuery.count().get();

    if (hasOwnerListingRefinementFilters(params)) {
      const [corpus, prospectingPhones] = await Promise.all([
        getSearchCorpus(
          `${authContext.runtimeMode}:${scopeKey}:${source || 'all'}:${params.get('priceMin') || ''}:${params.get('priceMax') || ''}`,
          baseQuery,
          params,
        ),
        loadAgencyProspectingPhones(authContext.adminDb, authContext.agencyId),
      ]);
      const agencyScopedCorpus = corpus.map((listing) => ({
        ...listing,
        ownerPhone: prospectingPhones.get(listing.id) || '',
      }));
      const [page, totalAvailableSnapshot] = await Promise.all([
        getRefinedListingPage({
          db: authContext.adminDb,
          corpus: agencyScopedCorpus,
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
    const listings = pageDocuments.map((document) =>
      withoutGlobalPhone({
        ...(document.data() as OwnerListingSummary),
        id: document.id,
      })
    );
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
